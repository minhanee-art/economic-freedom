import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import {
  authRequest,
  createAccountsState,
  createFakeSql,
  createSessionState,
  jsonRequest,
  readJson,
} from "@/test/api-helpers";

const session = createSessionState("user-1");
const db = createFakeSql();
const accounts = createAccountsState([
  { id: "acc-1", name: "기본 계좌", ownerType: "self" },
  { id: "acc-2", name: "연금 계좌", ownerType: "self" },
]);

mock.module("@/lib/session", { namedExports: session.namedExports });
mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/portfolio-accounts", { namedExports: accounts.namedExports });

let purchases: typeof import("@/app/api/purchases/route");
let purchaseById: typeof import("@/app/api/purchases/[id]/route");
let todayKstDateKey: typeof import("@/lib/record-validation").todayKstDateKey;

before(async () => {
  purchases = await import("@/app/api/purchases/route");
  purchaseById = await import("@/app/api/purchases/[id]/route");
  ({ todayKstDateKey } = await import("@/lib/record-validation"));
});

beforeEach(() => {
  db.reset();
  session.state.userId = "user-1";
});

const H1 = "11111111-1111-4111-8111-111111111111";
const H2 = "22222222-2222-4222-8222-222222222222";
const R1 = "33333333-3333-4333-8333-333333333333";

const validItem = { holdingId: H1, code: "305050", name: "ACE 코스피", quantity: 3, price: 10_000, cost: 30_015 };
const HOLDINGS = [
  { id: H1, code: "305050", name: "ACE 코스피" },
  { id: H2, code: "360750", name: "TIGER 미국S&P500" },
];
const ownedHoldings = (query: string, values: unknown[]) =>
  query.includes("SELECT id, code, name FROM holdings")
    ? HOLDINGS.filter((h) => (values[2] as string[]).includes(h.id))
    : [];

// ---------- POST 검증 ----------

test("POST: 수량·단가·금액이 0·음수·소수·범위 초과면 400이고 아무것도 쓰지 않는다", async () => {
  db.setHandler(ownedHoldings);
  const bad = [
    { quantity: 0 },
    { quantity: -1 },
    { quantity: 1.5 },
    { quantity: 2_147_483_648 },
    { price: 0 },
    { price: 10_000.5 },
    { cost: -5 },
    { cost: "abc" },
    { holdingId: "h1" },
  ];
  for (const patch of bad) {
    const response = await purchases.POST(
      jsonRequest("POST", { date: "2026-01-15", items: [{ ...validItem, ...patch }] })
    );
    assert.equal(response.status, 400, JSON.stringify(patch));
  }
  assert.equal(db.find("<transaction>").length, 0);
});

test("POST: 날짜 형식 오류·없는 날짜·미래 날짜(KST)면 400", async () => {
  db.setHandler(ownedHoldings);
  const tomorrow = todayKstDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
  for (const date of ["2026/01/15", "2026-02-30", "26-01-15", tomorrow]) {
    const response = await purchases.POST(jsonRequest("POST", { date, items: [validItem] }));
    assert.equal(response.status, 400, date);
  }
  assert.equal(db.find("<transaction>").length, 0);
});

test("POST: 총 매수 금액이 INTEGER 범위를 넘거나 항목이 너무 많으면 400", async () => {
  db.setHandler(ownedHoldings);
  const big = { ...validItem, cost: 2_000_000_000 };
  const overflow = await purchases.POST(jsonRequest("POST", { date: "2026-01-15", items: [big, { ...big, holdingId: H2 }] }));
  assert.equal(overflow.status, 400);

  const many = await purchases.POST(
    jsonRequest("POST", { date: "2026-01-15", items: Array.from({ length: 101 }, () => validItem) })
  );
  assert.equal(many.status, 400);
});

test("POST: 정상 입력은 201, 종목코드·이름은 서버 보유 종목 값으로 저장한다", async () => {
  db.setHandler(ownedHoldings);
  const today = todayKstDateKey();
  const response = await purchases.POST(
    jsonRequest("POST", { date: today, items: [{ ...validItem, code: "위조", name: "위조", quantity: "3" }] })
  );
  assert.equal(response.status, 201);
  assert.equal(db.find("<transaction>").length, 1);

  const [record] = db.find("INSERT INTO purchase_records");
  assert.deepEqual(record.values.slice(3), [today, 30_015]);
  const [item] = db.find("INSERT INTO purchase_items");
  assert.deepEqual(item.values.slice(1), [H1, "305050", "ACE 코스피", 3, 10_000, 30_015]);
});

test("POST: 현재 계좌에 없는 종목이 섞이면 400", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [{ id: H1, code: "305050", name: "ACE 코스피" }] : []));
  const response = await purchases.POST(
    jsonRequest("POST", { date: "2026-01-15", items: [validItem, { ...validItem, holdingId: H2 }] })
  );
  assert.equal(response.status, 400);
});

// ---------- DELETE /api/purchases/[id] ----------

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test("DELETE: 인증이 없으면 401", async () => {
  session.state.userId = null;
  const response = await purchaseById.DELETE(jsonRequest("DELETE"), ctx(R1));
  assert.equal(response.status, 401);
  assert.equal(db.calls.length, 0);
});

test("DELETE: UUID가 아닌 id는 쿼리 없이 404", async () => {
  const response = await purchaseById.DELETE(jsonRequest("DELETE"), ctx("not-a-uuid"));
  assert.equal(response.status, 404);
  assert.equal(db.calls.length, 0);
});

test("DELETE: 소유하지 않은 계좌를 지정하면 404", async () => {
  const response = await purchaseById.DELETE(
    authRequest("DELETE", { headers: { "X-Portfolio-Account-Id": "acc-someone-else" } }),
    ctx(R1)
  );
  assert.equal(response.status, 404);
  assert.equal(db.calls.length, 0);
});

test("DELETE: 사용자·계좌 범위로 찾고, 없으면(다른 사용자·다른 계좌 기록 포함) 404", async () => {
  db.setHandler(() => [{ found: 0, deleted: 0, conflicts: [], holdings: [] }]);
  const response = await purchaseById.DELETE(
    authRequest("DELETE", { headers: { "X-Portfolio-Account-Id": "acc-2" } }),
    ctx(R1)
  );
  assert.equal(response.status, 404);

  const [call] = db.find("WITH rec AS");
  assert.match(call.query, /FROM purchase_records WHERE id = \? AND user_id = \? AND account_id = \?/);
  assert.deepEqual(call.values.slice(0, 3), [R1, "user-1", "acc-2"]);
});

test("DELETE: 되돌릴 수 없으면 409와 충돌 종목을 돌려준다", async () => {
  const conflicts = [{ holdingId: H1, code: "305050", name: "ACE 코스피", reason: "sold_after" }];
  db.setHandler(() => [{ found: 1, deleted: 0, conflicts, holdings: [] }]);
  const response = await purchaseById.DELETE(jsonRequest("DELETE"), ctx(R1));
  assert.equal(response.status, 409);
  const body = await readJson<{ error: string; conflicts: unknown[] }>(response);
  assert.match(body.error, /ACE 코스피: .*매도 기록/);
  assert.deepEqual(body.conflicts, conflicts);
});

test("DELETE: 성공하면 200과 갱신된 보유 수량·원가", async () => {
  const holdings = [{ holdingId: H1, code: "305050", name: "ACE 코스피", removedQuantity: 3, removedCost: 30_015, shares: 7, totalCost: 70_000, totalShares: 7 }];
  db.setHandler(() => [{ found: 1, deleted: 1, conflicts: [], holdings }]);
  const response = await purchaseById.DELETE(jsonRequest("DELETE"), ctx(R1));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, recordId: R1, holdings });
  // 기록 삭제·보유·원가 갱신이 한 SQL 문에 들어 있어야 원자적이다
  const [call] = db.find("WITH rec AS");
  assert.match(call.query, /UPDATE holdings/);
  assert.match(call.query, /UPDATE cost_basis/);
  assert.match(call.query, /DELETE FROM purchase_records/);
  assert.equal(db.calls.filter((c) => c.query !== "<transaction>").length, 1);
});

test("GET: date를 SQL에서 ::text로 뽑고(시간대 무관), 응답의 date는 문자열 그대로 나간다", async () => {
  db.setHandler((query) =>
    query.includes("FROM purchase_records pr")
      ? [{ id: R1, date: "2025-03-01", total_spent: 30_015, purchase_items: null }]
      : [{ count: 1 }]
  );
  const response = await purchases.GET(authRequest("GET", { cookie: "t" }));
  assert.equal(response.status, 200);
  const body = await readJson<{ records: { date: string }[] }>(response);
  assert.equal(body.records[0].date, "2025-03-01");

  const [call] = db.find("FROM purchase_records pr");
  assert.match(call.query, /pr\.date::text AS date/);
  assert.doesNotMatch(call.query, /pr\.\*/, "pr.*는 DATE를 JS Date로 바꿔 시간대에 따라 하루 밀릴 수 있다");
});
