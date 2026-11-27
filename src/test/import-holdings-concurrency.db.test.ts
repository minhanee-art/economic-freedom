// 동시 요청 통합 테스트 — 실제 Postgres에서 두 요청을 동시에 보내 원자성을 확인한다.
//   1) POST /api/import: 같은 파일을 동시에 두 번 가져와도(더블 클릭) 매수·매도·배당·수량·원가가 한 번만 반영된다.
//   2) PATCH /api/holdings: 평단가만 고칠 때 읽어 둔 수량을 되쓰지 않아, 동시에 들어온 매도를 되돌리지 않는다.
// 경쟁을 확실히 만들려고 별도 연결에서 대상(행/테이블)을 먼저 잠가 두고, 요청들이 모두 잠금을 기다리는 것을
// pg_stat_activity 로 확인한 뒤 잠금을 푼다 (두 요청의 중복 검사·읽기가 모두 앞 요청 커밋 전에 끝난 최악의 순서).
// TEST_DATABASE_URL이 없으면 전체를 건너뛴다. 실행: scripts/verify-snapshot-db.sh
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach, mock } from "node:test";

import { authRequest } from "@/test/api-helpers";
import { createPgTestDb, type PgTestDb } from "@/test/pg-sql";

const connectionString = process.env.TEST_DATABASE_URL;
const skip = connectionString
  ? false
  : "TEST_DATABASE_URL이 없어 건너뜀 (scripts/verify-snapshot-db.sh로 실행)";

const U1 = "eeeeeeee-0000-4000-8000-000000000001";

const session = { userId: null as string | null };
mock.module("@/lib/session", {
  namedExports: {
    getSession: async () => (session.userId ? { userId: session.userId } : null),
    getBearerSession: async () => null,
    getRequestSession: async () => (session.userId ? { userId: session.userId, source: "cookie" as const } : null),
  },
});

let db: PgTestDb;
let pool: import("pg").Pool;
let importRoute: typeof import("@/app/api/import/route");
let holdingsRoute: typeof import("@/app/api/holdings/route");
let trades: typeof import("@/app/api/trades/route");

before(async () => {
  if (!connectionString) return;
  db = await createPgTestDb(connectionString);
  mock.module("@/lib/db", { namedExports: { sql: db.sql } });
  const { Pool } = await import("pg");
  pool = new Pool({ connectionString, max: 2 });

  await db.pool.query(readFileSync("neon-schema.sql", "utf8"));
  const accounts = await import("@/lib/portfolio-accounts");
  await accounts.ensurePortfolioAccountSchema();

  importRoute = await import("@/app/api/import/route");
  holdingsRoute = await import("@/app/api/holdings/route");
  trades = await import("@/app/api/trades/route");
});

after(async () => {
  if (pool) await pool.end();
  if (db) await db.pool.end();
});

let accountId: string;
let holdingId: string | null;
const CODE = "069500";

async function seed(withHolding: boolean) {
  await db.sql`DELETE FROM users`;
  await db.sql`INSERT INTO users (id, email) VALUES (${U1}, ${"import@pension.local"})`;
  await db.sql`INSERT INTO profiles (id, email) VALUES (${U1}, ${"import@pension.local"})`;
  const [acc] = await db.sql`
    INSERT INTO portfolio_accounts (user_id, name, display_order) VALUES (${U1}, ${"내 계좌"}, ${0}) RETURNING id
  `;
  accountId = String(acc.id);
  holdingId = null;
  if (withHolding) {
    const [h] = await db.sql`
      INSERT INTO holdings (user_id, account_id, code, name, category, sub_category, current_price)
      VALUES (${U1}, ${accountId}, ${CODE}, ${"KODEX 200"}, ${"주식"}, ${"국장"}, ${1000}) RETURNING id
    `;
    holdingId = String(h.id);
  }
  session.userId = U1;
}

beforeEach(async () => {
  if (db) await seed(true);
});

type Item = { date: string; code: string; name: string; type: string; qty: number; price: number; amount: number };
const NAME = "KODEX 200";
const buyItem = (date: string, qty: number, price: number): Item => ({ date, code: CODE, name: NAME, type: "매수", qty, price, amount: qty * price });
const sellItem = (date: string, qty: number, price: number): Item => ({ date, code: CODE, name: NAME, type: "매도", qty, price, amount: qty * price });
const divItem = (date: string, amount: number): Item => ({ date, code: CODE, name: NAME, type: "배당", qty: 1, price: 0, amount });

function importItems(items: Item[]) {
  return importRoute.POST(authRequest("POST", { body: { items } }));
}

async function state() {
  const [h] = await db.sql`SELECT COUNT(*)::int AS n, COALESCE(SUM(shares), 0)::int AS shares FROM holdings WHERE user_id = ${U1} AND code = ${CODE}`;
  const [cb] = await db.sql`
    SELECT COALESCE(SUM(total_cost), 0)::int AS cost, COALESCE(SUM(total_shares), 0)::int AS shares FROM cost_basis WHERE user_id = ${U1}
  `;
  const [p] = await db.sql`SELECT COUNT(*)::int AS records FROM purchase_records WHERE user_id = ${U1}`;
  const [pi] = await db.sql`SELECT COUNT(*)::int AS items FROM purchase_items`;
  const [s] = await db.sql`SELECT COUNT(*)::int AS rows FROM sell_items WHERE user_id = ${U1}`;
  const [d] = await db.sql`SELECT COUNT(*)::int AS rows, COALESCE(SUM(amount), 0)::int AS total FROM dividends WHERE user_id = ${U1}`;
  return {
    holdings: Number(h.n), shares: Number(h.shares), costTotal: Number(cb.cost), costShares: Number(cb.shares),
    purchaseRecords: Number(p.records), purchaseItems: Number(pi.items), sellRows: Number(s.rows),
    dividendRows: Number(d.rows), dividendTotal: Number(d.total),
  };
}

async function waitingCount(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS waiting FROM pg_stat_activity
     WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`
  );
  return Number(rows[0].waiting);
}

/**
 * lockSql 로 잠가 둔 채 requests 를 앞에서부터 하나씩 시작한다. 각 요청이 잠금 대기에 들어간 것을 확인하고
 * 다음 요청을 시작하므로 대기열 순서(= 잠금이 풀린 뒤 실행 순서)가 requests 순서와 같다. 모두 대기하면 잠금을 푼다.
 */
async function raceBehindLock<T>(lockSql: string, requests: (() => Promise<T>)[]): Promise<T[]> {
  const locker = await pool.connect();
  try {
    await locker.query("BEGIN");
    await locker.query(lockSql);
    const pending: Promise<T>[] = [];
    for (const run of requests) {
      pending.push(run());
      const deadline = Date.now() + 10_000;
      while ((await waitingCount()) < pending.length) {
        if (Date.now() > deadline) throw new Error(`요청이 잠금 대기에 들어가지 않음 (대기 ${await waitingCount()}/${pending.length})`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    await locker.query("COMMIT");
    return await Promise.all(pending);
  } catch (error) {
    await locker.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    locker.release();
  }
}

// 보유 종목 테이블에 쓰기를 막는다 (읽기·FK 확인은 통과) — 두 요청의 중복 검사 읽기가 모두 끝난 뒤 쓰기에서 멈춘다.
const BLOCK_HOLDINGS_WRITES = "LOCK TABLE holdings IN SHARE ROW EXCLUSIVE MODE";

test("같은 파일을 동시에 두 번 가져와도(더블 클릭) 매수가 한 번만 반영된다", { skip }, async () => {
  const items = [buyItem("2026-01-05", 10, 1000), buyItem("2026-01-06", 5, 1200)];

  const responses = await raceBehindLock(BLOCK_HOLDINGS_WRITES, [() => importItems(items), () => importItems(items)]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200]);
  const bodies = await Promise.all(responses.map((r) => r.json()));
  assert.deepEqual(bodies.map((b) => b.buyCount).sort(), [0, 2], "한쪽만 반영, 다른 쪽은 전부 중복");
  assert.deepEqual(bodies.map((b) => b.dupSkipped).sort(), [0, 2]);

  assert.deepEqual(await state(), {
    holdings: 1, shares: 15, costTotal: 16_000, costShares: 15,
    purchaseRecords: 2, purchaseItems: 2, sellRows: 0, dividendRows: 0, dividendTotal: 0,
  });
});

test("동시 가져오기: 매도와 배당도 한 번만 반영된다 (수량·원가 이중 차감 없음)", { skip }, async () => {
  assert.equal((await importItems([buyItem("2026-01-05", 10, 1000)])).status, 200);
  const items = [sellItem("2026-02-01", 3, 1500), divItem("2026-03-01", 700)];

  const responses = await raceBehindLock(BLOCK_HOLDINGS_WRITES, [() => importItems(items), () => importItems(items)]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200]);
  const bodies = await Promise.all(responses.map((r) => r.json()));
  assert.deepEqual(bodies.map((b) => b.sellCount + b.dividendCount).sort(), [0, 2]);

  assert.deepEqual(await state(), {
    holdings: 1, shares: 7, costTotal: 7_000, costShares: 7,
    purchaseRecords: 1, purchaseItems: 1, sellRows: 1, dividendRows: 1, dividendTotal: 700,
  });
});

test("동시 가져오기: 계좌에 없는 새 종목도 종목 1개·수량 한 번만 반영된다", { skip }, async () => {
  await seed(false);
  const items = [buyItem("2026-01-05", 10, 1000)];

  const responses = await raceBehindLock(BLOCK_HOLDINGS_WRITES, [() => importItems(items), () => importItems(items)]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200], JSON.stringify(await Promise.all(responses.map((r) => r.clone().json()))));
  const bodies = await Promise.all(responses.map((r) => r.json()));
  assert.deepEqual(bodies.map((b) => b.autoAdded.length).sort(), [0, 1], "종목 자동 추가는 한쪽만");

  assert.deepEqual(await state(), {
    holdings: 1, shares: 10, costTotal: 10_000, costShares: 10,
    purchaseRecords: 1, purchaseItems: 1, sellRows: 0, dividendRows: 0, dividendTotal: 0,
  });
});

test("가져오기: 일부만 겹치는 파일은 새 항목만 반영하고 누적 투입원금은 새 기록만 합친다", { skip }, async () => {
  assert.equal((await importItems([buyItem("2026-01-05", 10, 1000)])).status, 200);

  const response = await importItems([buyItem("2026-01-05", 10, 1000), buyItem("2026-01-06", 5, 1200)]);
  const body = await response.json();
  assert.equal(body.buyCount, 1);
  assert.equal(body.dupSkipped, 1);
  assert.equal(body.totalRecords, 1);

  const rows = await db.sql`SELECT date::text AS date, total_spent, total_value_after FROM purchase_records ORDER BY date`;
  assert.deepEqual(rows.map((r) => [r.date, Number(r.total_spent), Number(r.total_value_after)]), [
    ["2026-01-05", 10_000, 10_000],
    ["2026-01-06", 6_000, 6_000], // 건너뛴 중복(10,000)은 누적에 넣지 않는다
  ]);
  assert.equal((await state()).shares, 15);
});

test("가져오기: 한 번 더 가져오면 아무것도 바뀌지 않는다 (순차 멱등)", { skip }, async () => {
  const items = [buyItem("2026-01-05", 10, 1000), sellItem("2026-02-01", 2, 1500), divItem("2026-03-01", 700)];
  assert.equal((await importItems(items)).status, 200);
  const first = await state();

  const body = await (await importItems(items)).json();
  assert.equal(body.buyCount + body.sellCount + body.dividendCount, 0);
  assert.equal(body.dupSkipped, 3);
  assert.deepEqual(await state(), first);
  assert.equal(first.shares, 8);
});

const LOCK_HOLDING_ROW = () => `SELECT id FROM holdings WHERE id = '${holdingId}' FOR UPDATE`;

function patchHolding(body: Record<string, unknown>) {
  return holdingsRoute.PATCH(authRequest("PATCH", { body: { id: holdingId, ...body } }));
}
function sell(quantity: number) {
  return trades.POST(authRequest("POST", { body: { holdingId, action: "sell", quantity, price: 1500, date: "2026-02-01" } }));
}
async function holdingState() {
  const [h] = await db.sql`SELECT shares FROM holdings WHERE id = ${holdingId}`;
  const [cb] = await db.sql`SELECT total_cost, total_shares FROM cost_basis WHERE holding_id = ${holdingId}`;
  const [s] = await db.sql`SELECT COALESCE(SUM(quantity), 0)::int AS sold FROM sell_items WHERE holding_id = ${holdingId}`;
  return { shares: Number(h.shares), totalCost: Number(cb?.total_cost ?? 0), totalShares: Number(cb?.total_shares ?? 0), sold: Number(s.sold) };
}

test("평단가 편집이 동시에 들어온 매도를 되돌리지 않는다 (매도가 먼저 반영된 뒤 평단가 편집)", { skip }, async () => {
  assert.equal((await importItems([buyItem("2026-01-05", 10, 1000)])).status, 200);

  const responses = await raceBehindLock(LOCK_HOLDING_ROW(), [() => sell(3), () => patchHolding({ avg_price: 1500 })]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200]);

  // 매도 3주 반영(보유 7) 위에 평단가 1500 → 원가 7 × 1500
  assert.deepEqual(await holdingState(), { shares: 7, totalCost: 10_500, totalShares: 7, sold: 3 });
});

test("평단가 편집이 먼저 반영되고 매도가 뒤따라도 결과가 같다", { skip }, async () => {
  assert.equal((await importItems([buyItem("2026-01-05", 10, 1000)])).status, 200);

  const responses = await raceBehindLock(LOCK_HOLDING_ROW(), [() => patchHolding({ avg_price: 1500 }), () => sell(3)]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200]);

  assert.deepEqual(await holdingState(), { shares: 7, totalCost: 10_500, totalShares: 7, sold: 3 });
});

test("수량과 평단가를 함께 지정하는 편집은 절대값 그대로 (last-write-wins 유지)", { skip }, async () => {
  assert.equal((await importItems([buyItem("2026-01-05", 10, 1000)])).status, 200);

  const response = await patchHolding({ shares: 4, avg_price: 2000 });
  assert.equal(response.status, 200);
  assert.deepEqual(await holdingState(), { shares: 4, totalCost: 8_000, totalShares: 4, sold: 0 });

  assert.equal((await patchHolding({ shares: 0 })).status, 200);
  assert.deepEqual(await holdingState(), { shares: 0, totalCost: 0, totalShares: 0, sold: 0 });
});

test("PATCH: 평단가만 보내는 편집은 수량을 건드리지 않고 원가만 바꾼다, 수량 0이면 원가를 지운다", { skip }, async () => {
  assert.equal((await importItems([buyItem("2026-01-05", 10, 1000)])).status, 200);
  assert.equal((await patchHolding({ avg_price: 1234 })).status, 200);
  assert.deepEqual(await holdingState(), { shares: 10, totalCost: 12_340, totalShares: 10, sold: 0 });

  assert.equal((await patchHolding({ avg_price: 0 })).status, 400, "수량이 있으면 평단가 0 불가");
  assert.deepEqual(await holdingState(), { shares: 10, totalCost: 12_340, totalShares: 10, sold: 0 });

  assert.equal((await patchHolding({ shares: 0 })).status, 200);
  assert.equal((await patchHolding({ avg_price: 0 })).status, 200);
  assert.deepEqual(await holdingState(), { shares: 0, totalCost: 0, totalShares: 0, sold: 0 });
});

test("PATCH: 여러 필드는 한 번에 반영되고, 없는 종목은 404 + 아무것도 쓰지 않음", { skip }, async () => {
  const ok = await patchHolding({ name: "새 이름", target_pct: 25, current_price: 2000 });
  assert.equal(ok.status, 200);
  const [h] = await db.sql`SELECT name, target_pct::float AS t, current_price FROM holdings WHERE id = ${holdingId}`;
  assert.deepEqual([h.name, h.t, Number(h.current_price)], ["새 이름", 25, 2000]);

  const missing = await holdingsRoute.PATCH(
    authRequest("PATCH", { body: { id: "00000000-0000-4000-8000-000000000000", avg_price: 1000 } })
  );
  assert.equal(missing.status, 404);
  const missingShares = await holdingsRoute.PATCH(
    authRequest("PATCH", { body: { id: "00000000-0000-4000-8000-000000000000", shares: 3, avg_price: 1000 } })
  );
  assert.equal(missingShares.status, 404);
  assert.equal((await db.sql`SELECT 1 FROM cost_basis WHERE user_id = ${U1}`).length, 0);
});
