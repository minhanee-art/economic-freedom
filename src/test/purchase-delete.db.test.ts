// 매수 기록 개별 삭제 통합 테스트 — 실제 Postgres에 neon-schema.sql(+ 코드 안 CREATE/ALTER)을 적용하고
// 매수 POST로 쌓은 보유 수량·원가가 DELETE /api/purchases/[id] 후 정확히 되돌아가는지, 되돌릴 수 없는 경우
// 아무것도 바꾸지 않고 409로 거절하는지, 다른 사용자·다른 계좌 기록은 404인지 실제 SQL로 확인한다.
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

const U1 = "cccccccc-0000-4000-8000-000000000001";
const U2 = "cccccccc-0000-4000-8000-000000000002";

const session = { userId: null as string | null };
mock.module("@/lib/session", {
  namedExports: {
    getSession: async () => (session.userId ? { userId: session.userId } : null),
    getBearerSession: async () => null,
    getRequestSession: async () => (session.userId ? { userId: session.userId, source: "cookie" as const } : null),
  },
});

let db: PgTestDb;
let purchases: typeof import("@/app/api/purchases/route");
let purchaseById: typeof import("@/app/api/purchases/[id]/route");
let trades: typeof import("@/app/api/trades/route");
let holdingsRoute: typeof import("@/app/api/holdings/route");

before(async () => {
  if (!connectionString) return;
  db = await createPgTestDb(connectionString);
  mock.module("@/lib/db", { namedExports: { sql: db.sql } });

  await db.pool.query(readFileSync("neon-schema.sql", "utf8"));
  const accounts = await import("@/lib/portfolio-accounts");
  await accounts.ensurePortfolioAccountSchema();

  purchases = await import("@/app/api/purchases/route");
  purchaseById = await import("@/app/api/purchases/[id]/route");
  trades = await import("@/app/api/trades/route");
  holdingsRoute = await import("@/app/api/holdings/route");
});

after(async () => {
  if (db) await db.pool.end();
});

type Seeded = { accountId: string; secondAccountId: string; a: string; b: string; otherAccountHolding: string };
let s1: Seeded;

async function seedUser(id: string, email: string): Promise<Seeded> {
  await db.sql`INSERT INTO users (id, email) VALUES (${id}, ${email})`;
  await db.sql`INSERT INTO profiles (id, email) VALUES (${id}, ${email})`;
  const [acc] = await db.sql`
    INSERT INTO portfolio_accounts (user_id, name, display_order) VALUES (${id}, ${"내 계좌"}, ${0}) RETURNING id
  `;
  const [acc2] = await db.sql`
    INSERT INTO portfolio_accounts (user_id, name, display_order) VALUES (${id}, ${"연금 계좌"}, ${1}) RETURNING id
  `;
  const [a] = await db.sql`
    INSERT INTO holdings (user_id, account_id, code, name, category, sub_category, current_price)
    VALUES (${id}, ${acc.id}, ${"069500"}, ${"KODEX 200"}, ${"주식"}, ${"국장"}, ${1000}) RETURNING id
  `;
  const [b] = await db.sql`
    INSERT INTO holdings (user_id, account_id, code, name, category, sub_category, current_price)
    VALUES (${id}, ${acc.id}, ${"360750"}, ${"TIGER 미국S&P500"}, ${"주식"}, ${"미장"}, ${2000}) RETURNING id
  `;
  const [c] = await db.sql`
    INSERT INTO holdings (user_id, account_id, code, name, category, sub_category, current_price)
    VALUES (${id}, ${acc2.id}, ${"069500"}, ${"KODEX 200"}, ${"주식"}, ${"국장"}, ${1000}) RETURNING id
  `;
  return {
    accountId: String(acc.id),
    secondAccountId: String(acc2.id),
    a: String(a.id),
    b: String(b.id),
    otherAccountHolding: String(c.id),
  };
}

beforeEach(async () => {
  if (!db) return;
  await db.sql`DELETE FROM users`;
  s1 = await seedUser(U1, "buyer@pension.local");
  await seedUser(U2, "other@pension.local");
  session.userId = U1;
});

type Item = { holdingId: string; quantity: number; price: number; cost: number };

async function buy(date: string, items: Item[], accountId?: string): Promise<string> {
  const response = await purchases.POST(
    authRequest("POST", {
      body: { date, items },
      headers: accountId ? { "X-Portfolio-Account-Id": accountId } : undefined,
    })
  );
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  return String((await response.json()).recordId);
}

async function remove(recordId: string, accountId?: string) {
  const response = await purchaseById.DELETE(
    authRequest("DELETE", { headers: accountId ? { "X-Portfolio-Account-Id": accountId } : undefined }),
    { params: Promise.resolve({ id: recordId }) }
  );
  return { status: response.status, body: await response.json() };
}

async function state(holdingId: string) {
  const [h] = await db.sql`SELECT shares FROM holdings WHERE id = ${holdingId}`;
  const [cb] = await db.sql`SELECT total_cost, total_shares FROM cost_basis WHERE holding_id = ${holdingId}`;
  return {
    shares: Number(h.shares),
    totalCost: cb ? Number(cb.total_cost) : null,
    totalShares: cb ? Number(cb.total_shares) : null,
  };
}

async function recordExists(recordId: string) {
  const rows = await db.sql`SELECT id FROM purchase_records WHERE id = ${recordId}`;
  const items = await db.sql`SELECT id FROM purchase_items WHERE record_id = ${recordId}`;
  return { record: rows.length, items: items.length };
}

test("중간 매수 기록을 지우면 그 매수분 수량·원가만 정확히 빠진다", { skip }, async () => {
  const r1 = await buy("2026-01-10", [{ holdingId: s1.a, quantity: 10, price: 1000, cost: 10_015 }]);
  const r2 = await buy("2026-02-10", [{ holdingId: s1.a, quantity: 5, price: 1200, cost: 6_009 }]);
  const r3 = await buy("2026-03-10", [{ holdingId: s1.a, quantity: 2, price: 1100, cost: 2_203 }]);
  assert.deepEqual(await state(s1.a), { shares: 17, totalCost: 18_227, totalShares: 17 });

  const res = await remove(r2);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.holdings, [
    {
      holdingId: s1.a,
      code: "069500",
      name: "KODEX 200",
      removedQuantity: 5,
      removedCost: 6_009,
      shares: 12,
      totalCost: 12_218,
      totalShares: 12,
    },
  ]);
  assert.deepEqual(await state(s1.a), { shares: 12, totalCost: 12_218, totalShares: 12 });
  assert.deepEqual(await recordExists(r2), { record: 0, items: 0 });
  assert.deepEqual(await recordExists(r1), { record: 1, items: 1 });

  // 나머지도 지우면 0으로 돌아온다
  assert.equal((await remove(r1)).status, 200);
  assert.equal((await remove(r3)).status, 200);
  assert.deepEqual(await state(s1.a), { shares: 0, totalCost: 0, totalShares: 0 });

  // 이미 지운 기록을 다시 지우면 404
  assert.equal((await remove(r3)).status, 404);
});

test("여러 종목이 든 매수 기록은 종목별로 모두 되돌린다 (같은 종목 중복 항목 포함)", { skip }, async () => {
  await buy("2026-01-10", [{ holdingId: s1.b, quantity: 4, price: 2000, cost: 8_000 }]);
  const r = await buy("2026-02-10", [
    { holdingId: s1.a, quantity: 3, price: 1000, cost: 3_000 },
    { holdingId: s1.b, quantity: 1, price: 2100, cost: 2_100 },
    { holdingId: s1.a, quantity: 2, price: 1010, cost: 2_020 },
  ]);
  assert.deepEqual(await state(s1.a), { shares: 5, totalCost: 5_020, totalShares: 5 });
  assert.deepEqual(await state(s1.b), { shares: 5, totalCost: 10_100, totalShares: 5 });

  const res = await remove(r);
  assert.equal(res.status, 200);
  assert.deepEqual(await state(s1.a), { shares: 0, totalCost: 0, totalShares: 0 });
  assert.deepEqual(await state(s1.b), { shares: 4, totalCost: 8_000, totalShares: 4 });
});

test("보유 종목 추가 때 만든 초기 수량 기록도 지우면 그 수량·원가가 빠진다", { skip }, async () => {
  const created = await holdingsRoute.POST(
    authRequest("POST", {
      body: { code: "133690", name: "TIGER 미국나스닥100", category: "주식", current_price: 100_000, shares: 7, avg_price: 90_000 },
    })
  );
  assert.equal(created.status, 201);
  const holdingId = String((await created.json()).id);
  const [initial] = await db.sql`
    SELECT pr.id FROM purchase_records pr JOIN purchase_items pi ON pi.record_id = pr.id WHERE pi.holding_id = ${holdingId}
  `;
  await buy("2026-01-01", [{ holdingId, quantity: 1, price: 95_000, cost: 95_000 }]);
  assert.deepEqual(await state(holdingId), { shares: 8, totalCost: 725_000, totalShares: 8 });

  assert.equal((await remove(String(initial.id))).status, 200);
  assert.deepEqual(await state(holdingId), { shares: 1, totalCost: 95_000, totalShares: 1 });
});

test("이후 매도가 있으면 409로 거절하고 아무것도 바꾸지 않는다", { skip }, async () => {
  const r1 = await buy("2026-01-10", [{ holdingId: s1.a, quantity: 10, price: 1000, cost: 10_000 }]);
  await buy("2026-02-10", [{ holdingId: s1.a, quantity: 10, price: 2000, cost: 20_000 }]);
  const sold = await trades.POST(
    authRequest("POST", { body: { holdingId: s1.a, action: "sell", quantity: 5, price: 1500, date: "2026-03-01" } })
  );
  assert.equal(sold.status, 200);
  const before = await state(s1.a);
  assert.deepEqual(before, { shares: 15, totalCost: 22_500, totalShares: 15 });

  const res = await remove(r1);
  assert.equal(res.status, 409);
  assert.deepEqual(res.body.conflicts, [{ holdingId: s1.a, code: "069500", name: "KODEX 200", reason: "sold_after" }]);
  assert.match(res.body.error, /매도 기록/);
  assert.deepEqual(await state(s1.a), before);
  assert.deepEqual(await recordExists(r1), { record: 1, items: 1 });
});

test("매수 이전 날짜의 매도라도 매수 기록 입력 뒤에 들어왔으면 거절한다 (평균단가 차감 순서)", { skip }, async () => {
  const r1 = await buy("2026-02-10", [{ holdingId: s1.a, quantity: 10, price: 1000, cost: 10_000 }]);
  const sold = await trades.POST(
    authRequest("POST", { body: { holdingId: s1.a, action: "sell", quantity: 1, price: 1500, date: "2026-01-01" } })
  );
  assert.equal(sold.status, 200);
  assert.equal((await remove(r1)).status, 409);
});

test("다른 종목의 매도는 삭제를 막지 않는다", { skip }, async () => {
  await buy("2026-01-10", [{ holdingId: s1.b, quantity: 3, price: 2000, cost: 6_000 }]);
  const r = await buy("2026-01-11", [{ holdingId: s1.a, quantity: 2, price: 1000, cost: 2_000 }]);
  await trades.POST(authRequest("POST", { body: { holdingId: s1.b, action: "sell", quantity: 1, price: 2000, date: "2026-02-01" } }));
  assert.equal((await remove(r)).status, 200);
  assert.deepEqual(await state(s1.a), { shares: 0, totalCost: 0, totalShares: 0 });
});

test("보유 수량을 직접 줄여 되돌릴 수량이 모자라면 409, 변경 없음", { skip }, async () => {
  const r = await buy("2026-01-10", [{ holdingId: s1.a, quantity: 10, price: 1000, cost: 10_000 }]);
  const patched = await holdingsRoute.PATCH(authRequest("PATCH", { body: { id: s1.a, shares: 4, avg_price: 1000 } }));
  assert.equal(patched.status, 200);
  const before = await state(s1.a);

  const res = await remove(r);
  assert.equal(res.status, 409);
  assert.equal(res.body.conflicts[0].reason, "shares_short");
  assert.deepEqual(await state(s1.a), before);
  assert.deepEqual(await recordExists(r), { record: 1, items: 1 });
});

test("다른 사용자의 기록은 404, 변경 없음", { skip }, async () => {
  const r = await buy("2026-01-10", [{ holdingId: s1.a, quantity: 10, price: 1000, cost: 10_000 }]);
  session.userId = U2;
  assert.equal((await remove(r)).status, 404);
  // 다른 사용자 계좌를 헤더로 지정해도 소유권 검증에서 404
  assert.equal((await remove(r, s1.accountId)).status, 404);
  session.userId = U1;
  assert.deepEqual(await state(s1.a), { shares: 10, totalCost: 10_000, totalShares: 10 });
  assert.deepEqual(await recordExists(r), { record: 1, items: 1 });
});

test("같은 사용자라도 다른 계좌를 지정하면 404, 그 계좌를 지정하면 삭제된다", { skip }, async () => {
  const r = await buy("2026-01-10", [{ holdingId: s1.otherAccountHolding, quantity: 3, price: 1000, cost: 3_000 }], s1.secondAccountId);
  assert.equal((await remove(r, s1.accountId)).status, 404);
  assert.equal((await remove(r)).status, 404); // 기본(첫) 계좌로 해석
  assert.deepEqual(await state(s1.otherAccountHolding), { shares: 3, totalCost: 3_000, totalShares: 3 });

  assert.equal((await remove(r, s1.secondAccountId)).status, 200);
  assert.deepEqual(await state(s1.otherAccountHolding), { shares: 0, totalCost: 0, totalShares: 0 });
});

test("POST 검증: 미래 날짜·소수 수량은 DB에 아무것도 쓰지 않는다", { skip }, async () => {
  const future = await purchases.POST(
    authRequest("POST", { body: { date: "2999-01-01", items: [{ holdingId: s1.a, quantity: 1, price: 1000, cost: 1000 }] } })
  );
  assert.equal(future.status, 400);
  const fraction = await purchases.POST(
    authRequest("POST", { body: { date: "2026-01-01", items: [{ holdingId: s1.a, quantity: 1.5, price: 1000, cost: 1500 }] } })
  );
  assert.equal(fraction.status, 400);
  const [{ count }] = await db.sql`SELECT COUNT(*)::int AS count FROM purchase_records WHERE user_id = ${U1}`;
  assert.equal(count, 0);
  assert.deepEqual(await state(s1.a), { shares: 0, totalCost: null, totalShares: null });
});
