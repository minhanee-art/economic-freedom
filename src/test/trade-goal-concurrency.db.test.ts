// 동시 요청 통합 테스트 — 실제 Postgres에서 두 요청을 동시에 보내 원자성을 확인한다.
//   1) POST /api/trades 매도: 검사와 변경이 한 SQL 문이라 10주 보유에 8주 매도 두 건이 오면 하나만 성공하고,
//      보유 수량·원가·매도 기록이 서로 맞는다.
//   2) PATCH /api/pension/goal: 보낸 항목만 바꾸므로 두 기기가 서로 다른 항목을 동시에 고쳐도 서로 덮어쓰지 않는다.
// 경쟁을 확실히 만들기 위해 별도 연결에서 대상 행을 먼저 잠가 두고, 두 요청이 모두 그 잠금을 기다리는 것을
// pg_stat_activity로 확인한 뒤 잠금을 푼다 (두 요청의 스냅샷이 모두 앞 요청 커밋 전에 잡히는 최악의 순서).
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

const U1 = "dddddddd-0000-4000-8000-000000000001";

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
let trades: typeof import("@/app/api/trades/route");
let purchases: typeof import("@/app/api/purchases/route");
let goal: typeof import("@/app/api/pension/goal/route");

before(async () => {
  if (!connectionString) return;
  db = await createPgTestDb(connectionString);
  mock.module("@/lib/db", { namedExports: { sql: db.sql } });
  // 잠금을 잡는 연결 + 동시 요청 두 개 + 후속 조회가 서로 막지 않도록 별도 풀
  const { Pool } = await import("pg");
  pool = new Pool({ connectionString, max: 2 });

  await db.pool.query(readFileSync("neon-schema.sql", "utf8"));
  const accounts = await import("@/lib/portfolio-accounts");
  await accounts.ensurePortfolioAccountSchema();
  const pension = await import("@/lib/pension-data");
  await pension.ensurePensionSchema();

  trades = await import("@/app/api/trades/route");
  purchases = await import("@/app/api/purchases/route");
  goal = await import("@/app/api/pension/goal/route");
});

after(async () => {
  if (pool) await pool.end();
  if (db) await db.pool.end();
});

let holdingId: string;

beforeEach(async () => {
  if (!db) return;
  await db.sql`DELETE FROM users`;
  await db.sql`INSERT INTO users (id, email) VALUES (${U1}, ${"trader@pension.local"})`;
  await db.sql`INSERT INTO profiles (id, email) VALUES (${U1}, ${"trader@pension.local"})`;
  const [acc] = await db.sql`
    INSERT INTO portfolio_accounts (user_id, name, display_order) VALUES (${U1}, ${"내 계좌"}, ${0}) RETURNING id
  `;
  const [h] = await db.sql`
    INSERT INTO holdings (user_id, account_id, code, name, category, sub_category, current_price)
    VALUES (${U1}, ${acc.id}, ${"069500"}, ${"KODEX 200"}, ${"주식"}, ${"국장"}, ${1000}) RETURNING id
  `;
  holdingId = String(h.id);
  session.userId = U1;
});

async function buy(quantity: number, cost: number) {
  const response = await purchases.POST(
    authRequest("POST", { body: { date: "2026-01-10", items: [{ holdingId, quantity, price: Math.max(1, Math.round(cost / quantity)), cost }] } })
  );
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
}

function sell(quantity: number, price = 1500) {
  return trades.POST(authRequest("POST", { body: { holdingId, action: "sell", quantity, price, date: "2026-02-01" } }));
}

async function state() {
  const [h] = await db.sql`SELECT shares FROM holdings WHERE id = ${holdingId}`;
  const [cb] = await db.sql`SELECT total_cost, total_shares FROM cost_basis WHERE holding_id = ${holdingId}`;
  const [s] = await db.sql`
    SELECT COALESCE(SUM(quantity), 0)::int AS sold, COUNT(*)::int AS rows FROM sell_items WHERE holding_id = ${holdingId}
  `;
  return {
    shares: Number(h.shares),
    totalCost: Number(cb.total_cost),
    totalShares: Number(cb.total_shares),
    soldQuantity: Number(s.sold),
    sellRows: Number(s.rows),
  };
}

/**
 * lockSql로 행을 잠근 채 requests를 동시에 보내고, 모두 잠금 대기에 들어간 뒤 잠금을 푼다.
 * 대기 확인은 pg_stat_activity의 Lock 대기 수로 한다.
 */
async function raceBehindLock<T>(lockSql: string, lockValues: unknown[], requests: (() => Promise<T>)[]): Promise<T[]> {
  const locker = await pool.connect();
  try {
    await locker.query("BEGIN");
    await locker.query(lockSql, lockValues);
    const pending = requests.map((run) => run());
    const deadline = Date.now() + 10_000;
    for (;;) {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS waiting FROM pg_stat_activity
         WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`
      );
      if (Number(rows[0].waiting) >= requests.length) break;
      if (Date.now() > deadline) throw new Error(`동시 요청이 잠금 대기에 들어가지 않음 (대기 ${rows[0].waiting})`);
      await new Promise((resolve) => setTimeout(resolve, 20));
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

const LOCK_HOLDING = "SELECT id FROM holdings WHERE id = $1 FOR UPDATE";

test("10주 보유에 8주 매도 두 건이 동시에 오면 하나만 성공하고 수량·원가·매도 기록이 맞는다", { skip }, async () => {
  await buy(10, 10_000);

  const responses = await raceBehindLock(LOCK_HOLDING, [holdingId], [() => sell(8), () => sell(8)]);
  const statuses = responses.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 409]);
  const rejected = responses.find((r) => r.status === 409)!;
  const body = await rejected.json();
  assert.match(body.error, /많이 매도/);
  assert.equal(body.shares, 2, "잠금 뒤 최신 수량으로 검사");

  assert.deepEqual(await state(), { shares: 2, totalCost: 2_000, totalShares: 2, soldQuantity: 8, sellRows: 1 });
});

test("동시 매도가 둘 다 수량 안이면 둘 다 반영된다 (앞 요청 결과 위에 차감)", { skip }, async () => {
  await buy(10, 10_000);

  const responses = await raceBehindLock(LOCK_HOLDING, [holdingId], [() => sell(3), () => sell(3)]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200]);
  assert.deepEqual(await state(), { shares: 4, totalCost: 4_000, totalShares: 4, soldQuantity: 6, sellRows: 2 });
});

test("동시 매수·매도도 서로 덮어쓰지 않는다", { skip }, async () => {
  await buy(10, 10_000);

  const buyMore = () =>
    trades.POST(authRequest("POST", { body: { holdingId, action: "buy", quantity: 5, price: 2000, date: "2026-02-01" } }));
  const responses = await raceBehindLock(LOCK_HOLDING, [holdingId], [buyMore, () => sell(4)]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200]);
  const after = await state();
  assert.equal(after.shares, 11);
  assert.equal(after.totalShares, 11);
  assert.equal(after.soldQuantity, 4);
  // 순서에 따라 평균단가 차감액이 다르다: 매도 먼저 → 10000-4000+10000=16000, 매수 먼저 → 20000-20000/15*4≈14667
  assert.ok([16_000, 14_667].includes(after.totalCost), String(after.totalCost));
});

test("매도: 전량 매도는 원가를 0으로, 초과 매도는 아무것도 바꾸지 않고 409", { skip }, async () => {
  await buy(3, 3_001);
  assert.equal((await sell(4)).status, 409);
  assert.deepEqual(await state(), { shares: 3, totalCost: 3_001, totalShares: 3, soldQuantity: 0, sellRows: 0 });

  assert.equal((await sell(3)).status, 200);
  assert.deepEqual(await state(), { shares: 0, totalCost: 0, totalShares: 0, soldQuantity: 3, sellRows: 1 });
  assert.equal((await sell(1)).status, 409);
});

test("매도: 미래 날짜는 400, DB 변경 없음", { skip }, async () => {
  await buy(3, 3_000);
  const response = await trades.POST(
    authRequest("POST", { body: { holdingId, action: "sell", quantity: 1, price: 1000, date: "2999-01-01" } })
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await state(), { shares: 3, totalCost: 3_000, totalShares: 3, soldQuantity: 0, sellRows: 0 });
});

const LOCK_PROFILE = "SELECT id FROM profiles WHERE id = $1 FOR UPDATE";

function patchGoal(body: Record<string, unknown>) {
  return goal.PATCH(authRequest("PATCH", { body }));
}

async function readGoal() {
  return (await (await goal.GET(authRequest("GET"))).json()).goal;
}

test("은퇴 목표: 두 기기가 서로 다른 항목을 동시에 고쳐도 둘 다 남는다", { skip }, async () => {
  assert.equal((await patchGoal({ targetMonthly: 2_000_000, retirementAge: 60, expectedReturnPct: 4 })).status, 200);

  const responses = await raceBehindLock(LOCK_PROFILE, [U1], [
    () => patchGoal({ targetMonthly: 3_500_000 }),
    () => patchGoal({ retirementAge: 65 }),
  ]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200]);

  const saved = await readGoal();
  assert.equal(saved.targetMonthly, 3_500_000);
  assert.equal(saved.retirementAge, 65);
  assert.equal(saved.expectedReturnPct, 4, "건드리지 않은 항목은 그대로");
});

test("은퇴 목표: 명시적 null은 지우고, 보내지 않은 항목은 유지하며, 응답은 저장된 전체 목표", { skip }, async () => {
  await patchGoal({ targetMonthly: 2_000_000, retirementAge: 60, birthYear: 1980, expectedReturnPct: 4.5, salaryBracket: "high" });

  const response = await patchGoal({ expectedReturnPct: null, salaryBracket: "low" });
  assert.equal(response.status, 200);
  const expected = {
    targetMonthly: 2_000_000,
    retirementAge: 60,
    birthYear: 1980,
    spouseBirthYear: null,
    expectedReturnPct: null,
    salaryBracket: "low",
  };
  assert.deepEqual((await response.json()).goal, expected);
  assert.deepEqual(await readGoal(), expected);
});

test("은퇴 목표: 프로필이 없으면 404", { skip }, async () => {
  session.userId = "dddddddd-0000-4000-8000-0000000000ff";
  assert.equal((await patchGoal({ retirementAge: 60 })).status, 404);
});
