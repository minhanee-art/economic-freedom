import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import {
  createAccountsState,
  createFakeSql,
  createSessionState,
  jsonRequest,
  readJson,
} from "@/test/api-helpers";

const session = createSessionState("user-1");
const db = createFakeSql();
const accounts = createAccountsState();

mock.module("@/lib/session", { namedExports: session.namedExports });
mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/portfolio-accounts", { namedExports: accounts.namedExports });

let trades: typeof import("@/app/api/trades/route");

before(async () => {
  trades = await import("@/app/api/trades/route");
});

beforeEach(() => {
  db.reset();
});

const H1 = "aaaaaaaa-0000-4000-8000-000000000001";
const holding = { id: H1, code: "305050", name: "ACE 코스피", shares: 10 };

test("POST: holdingId나 action이 없으면 400", async () => {
  const noAction = await trades.POST(jsonRequest("POST", { holdingId: H1, quantity: 1, price: 1000 }));
  assert.equal(noAction.status, 400);

  const noHolding = await trades.POST(jsonRequest("POST", { action: "buy", quantity: 1, price: 1000 }));
  assert.equal(noHolding.status, 400);
});

test("POST: 수량이 0이거나 소수면 400", async () => {
  const zero = await trades.POST(jsonRequest("POST", { holdingId: H1, action: "buy", quantity: 0, price: 1000 }));
  assert.equal(zero.status, 400);

  const fraction = await trades.POST(jsonRequest("POST", { holdingId: H1, action: "buy", quantity: 1.5, price: 1000 }));
  assert.equal(fraction.status, 400);
});

test("POST: 가격이 음수면 400", async () => {
  const response = await trades.POST(jsonRequest("POST", { holdingId: H1, action: "buy", quantity: 1, price: -1 }));
  assert.equal(response.status, 400);
});

test("POST: 계좌에 없는 종목이면 404", async () => {
  db.setHandler(() => []);

  const response = await trades.POST(
    jsonRequest("POST", { holdingId: "aaaaaaaa-0000-4000-8000-0000000000ff", action: "buy", quantity: 1, price: 1000 })
  );
  assert.equal(response.status, 404);
  assert.match((await readJson<{ error: string }>(response)).error, /찾을 수 없습니다/);
});

test("POST: 보유 수량보다 많이 매도하면 409 — 검사와 변경이 한 SQL 문이라 별도 트랜잭션이 없다", async () => {
  // 잠근 보유 수량(10)이 모자라 ok=false → INSERT/UPDATE 0건
  db.setHandler((query) => (query.includes("WITH held AS") ? [{ found: 1, shares: 10, sold: 0, updated: 0 }] : []));

  const response = await trades.POST(
    jsonRequest("POST", { holdingId: H1, action: "sell", quantity: 11, price: 1000 })
  );
  assert.equal(response.status, 409);
  const body = await readJson<{ error: string; shares: number }>(response);
  assert.match(body.error, /많이 매도/);
  assert.equal(body.shares, 10);
  assert.equal(db.find("<transaction>").length, 0);
});

test("POST: 매도할 종목이 현재 계좌에 없으면 404", async () => {
  db.setHandler((query) => (query.includes("WITH held AS") ? [{ found: 0, shares: null, sold: 0, updated: 0 }] : []));
  const response = await trades.POST(jsonRequest("POST", { holdingId: H1, action: "sell", quantity: 1, price: 1000 }));
  assert.equal(response.status, 404);
});

test("POST: holdingId가 UUID가 아니면 DB를 건드리지 않고 404", async () => {
  const response = await trades.POST(jsonRequest("POST", { holdingId: "h1", action: "sell", quantity: 1, price: 1000 }));
  assert.equal(response.status, 404);
  assert.equal(db.calls.length, 0);
});

test("POST: 날짜 검증 — 미래·형식 오류·없는 날짜는 400, 생략하면 오늘(KST)", async () => {
  for (const date of ["2999-01-01", "2026/01/01", "2026-02-30", "1969-12-31", 20260101]) {
    const response = await trades.POST(jsonRequest("POST", { holdingId: H1, action: "buy", quantity: 1, price: 1000, date }));
    assert.equal(response.status, 400, String(date));
  }
  assert.equal(db.calls.length, 0);

  db.setHandler((query) => (query.includes("SELECT id, code, name, shares") ? [holding] : []));
  const response = await trades.POST(jsonRequest("POST", { holdingId: H1, action: "buy", quantity: 1, price: 1000 }));
  assert.equal(response.status, 200);
  const [record] = db.find("INSERT INTO purchase_records");
  const todayKst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  assert.equal(record.values[3], todayKst);
});

test("POST: 수량 × 가격이 INTEGER 범위를 넘으면 400", async () => {
  const response = await trades.POST(
    jsonRequest("POST", { holdingId: H1, action: "buy", quantity: 3, price: 1_000_000_000 })
  );
  assert.equal(response.status, 400);
  assert.equal(db.calls.length, 0);
});

test("POST: 매수는 매수기록·보유 갱신·원가 누적을 한 트랜잭션으로 처리한다", async () => {
  db.setHandler((query) => {
    if (query.includes("SELECT id, code, name, shares")) return [holding];
    if (query.includes("FROM holdings") && query.includes("target_pct")) return [{ id: H1, shares: 13 }];
    if (query.includes("FROM cost_basis")) return [{ id: "cb1", total_cost: 13_000, total_shares: 13 }];
    return [];
  });

  const response = await trades.POST(
    jsonRequest("POST", { holdingId: H1, action: "buy", quantity: 3, price: 1000.4 })
  );
  assert.equal(response.status, 200);

  const body = await readJson<{ ok: boolean; action: string }>(response);
  assert.equal(body.ok, true);
  assert.equal(body.action, "buy");

  assert.equal(db.find("INSERT INTO purchase_records").length, 1);
  assert.equal(db.find("INSERT INTO purchase_items").length, 1);
  assert.equal(db.find("INSERT INTO cost_basis").length, 1);
  assert.equal(db.find("UPDATE holdings").length, 1);

  const [item] = db.find("INSERT INTO purchase_items");
  // 수량 3, 단가 1000으로 반올림 저장, 금액은 반올림 전 가격 기준(3 × 1000.4 = 3001.2 → 3001)
  assert.equal(item.values[4], 3);
  assert.equal(item.values[5], 1000);
  assert.equal(item.values[6], 3_001);

  const [transaction] = db.find("<transaction>");
  assert.equal(transaction.values.length, 5);
});

test("POST: 매도는 수량 검사·매도기록·보유 갱신·원가 차감을 한 SQL 문으로 처리한다", async () => {
  db.setHandler((query) => {
    if (query.includes("WITH held AS")) return [{ found: 1, shares: 10, sold: 1, updated: 1 }];
    if (query.includes("FROM holdings") && query.includes("target_pct")) return [{ id: H1, shares: 7 }];
    if (query.includes("FROM cost_basis")) return [{ id: "cb1", total_cost: 7_000, total_shares: 7 }];
    return [];
  });

  const response = await trades.POST(
    jsonRequest("POST", { holdingId: H1, action: "sell", quantity: 3, price: 2000 })
  );
  assert.equal(response.status, 200);

  const [statement] = db.find("WITH held AS");
  assert.ok(statement, "매도 CTE 실행");
  assert.match(statement.query, /FOR UPDATE/);
  assert.match(statement.query, /INSERT INTO sell_items/);
  assert.match(statement.query, /UPDATE holdings/);
  assert.match(statement.query, /UPDATE cost_basis/);
  assert.match(statement.query, /WHERE ok\.ok/);
  assert.doesNotMatch(statement.query, /GREATEST\(0, h\.shares/, "보유 수량을 0에서 조용히 멈추지 않는다");
  assert.equal(
    db.find("SELECT id, code, name, shares").filter((call) => !call.query.includes("WITH held AS")).length,
    0,
    "트랜잭션 밖 사전 조회 없음"
  );
  assert.equal(db.find("<transaction>").length, 0);
  assert.equal(db.find("INSERT INTO purchase_records").length, 0);
});

test("POST: 트랜잭션이 실패하면 500과 메시지를 돌려준다", async () => {
  db.setHandler((query) => {
    if (query.includes("SELECT id, code, name, shares")) return [holding];
    return [];
  });
  (db.sql as unknown as { transaction: () => Promise<unknown> }).transaction = async () => {
    throw new Error("데드락");
  };

  const response = await trades.POST(
    jsonRequest("POST", { holdingId: H1, action: "buy", quantity: 1, price: 1000 })
  );
  assert.equal(response.status, 500);
  assert.match((await readJson<{ error: string }>(response)).error, /데드락/);
});
