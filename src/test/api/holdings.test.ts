import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import {
  createAccountsState,
  createFakeSql,
  createSessionState,
  jsonRequest,
  readJson,
  rawRequest,
} from "@/test/api-helpers";

const session = createSessionState("user-1");
const db = createFakeSql();
const accounts = createAccountsState();

mock.module("@/lib/session", { namedExports: session.namedExports });
mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/portfolio-accounts", { namedExports: accounts.namedExports });

type RouteModule = typeof import("@/app/api/holdings/route");
let route: RouteModule;

before(async () => {
  route = await import("@/app/api/holdings/route");
});

beforeEach(() => {
  db.reset();
  session.state.userId = "user-1";
});

const validBody = {
  code: "305050",
  name: "ACE 코스피",
  category: "주식",
  sub_category: "국장",
  current_price: 57490,
  target_pct: 13,
  shares: 0,
  avg_price: 0,
};

test("GET: 현재 계좌 종목만 조회한다", async () => {
  const rows = [{ id: "h1", name: "ACE 코스피" }];
  db.setHandler((query) => (query.includes("FROM holdings") ? rows : []));

  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), rows);

  const [select] = db.find("FROM holdings");
  assert.match(select.query, /user_id = \? AND account_id = \?/);
  assert.deepEqual(select.values, ["user-1", "acc-1"]);
});

test("POST: 종목코드가 없으면 400", async () => {
  const response = await route.POST(jsonRequest("POST", { ...validBody, code: "  " }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /종목코드/);
});

test("POST: JSON이 깨져도 400으로 응답한다", async () => {
  const response = await route.POST(rawRequest("POST", "{broken"));
  assert.equal(response.status, 400);
});

test("POST: 현재가가 음수면 400", async () => {
  const response = await route.POST(jsonRequest("POST", { ...validBody, current_price: -1 }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /현재가/);
});

test("POST: 설정비중이 100을 넘으면 400", async () => {
  const response = await route.POST(jsonRequest("POST", { ...validBody, target_pct: 101 }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /설정비중/);
});

test("POST: 보유수량이 정수가 아니면 400", async () => {
  const response = await route.POST(jsonRequest("POST", { ...validBody, shares: 1.5 }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /보유수량/);
});

test("POST: 수량이 있는데 평단가가 0이면 400", async () => {
  const response = await route.POST(jsonRequest("POST", { ...validBody, shares: 10, avg_price: 0 }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /평단가/);
});

test("POST: 수량 0이면 원가·매수기록을 만들지 않는다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [{ id: "h-new", name: "ACE 코스피" }] : []));

  const response = await route.POST(jsonRequest("POST", validBody));
  assert.equal(response.status, 201);
  assert.equal(db.find("INSERT INTO cost_basis").length, 0);
  assert.equal(db.find("INSERT INTO purchase_records").length, 0);

  const inserts = db.find("INSERT INTO holdings");
  assert.equal(inserts.length, 1);
  assert.deepEqual(inserts[0].values.slice(1, 5), ["user-1", "acc-1", "305050", "ACE 코스피"]);
});

test("POST: 수량이 있으면 원가와 매수기록을 함께 만든다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [{ id: "h-new", shares: 10 }] : []));

  const response = await route.POST(
    jsonRequest("POST", { ...validBody, shares: 10, avg_price: 1234.6 })
  );
  assert.equal(response.status, 201);

  const costBasis = db.find("INSERT INTO cost_basis");
  assert.equal(costBasis.length, 1);
  // 수량 10 × 반올림 평단가 1235 = 12,350 / values: [user, account, holdingId, cost, shares]
  assert.match(String(costBasis[0].values[2]), /^[0-9a-f-]{36}$/);
  assert.deepEqual(costBasis[0].values.slice(3), [12_350, 10]);

  const purchaseItems = db.find("INSERT INTO purchase_items");
  assert.equal(purchaseItems.length, 1);
  assert.equal(purchaseItems[0].values.at(-1), 12_350);
});

test("POST: 분류를 생략하면 종목명으로 추론한다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [{ id: "h-new" }] : []));

  const response = await route.POST(
    jsonRequest("POST", {
      code: "458730",
      name: "TIGER 미국배당다우존스",
      current_price: 14635,
      target_pct: 10,
    })
  );
  assert.equal(response.status, 201);

  const [insert] = db.find("INSERT INTO holdings");
  // values: [id, user_id, account_id, code, name, category, sub_category, ...]
  assert.equal(insert.values[5], "주식");
  assert.equal(insert.values[6], "배당");
});

test("POST: 목록에 없는 대분류는 주식으로 처리한다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [{ id: "h-new" }] : []));

  await route.POST(jsonRequest("POST", { ...validBody, category: "코인" }));
  const [insert] = db.find("INSERT INTO holdings");
  assert.equal(insert.values[5], "주식");
});

test("PATCH: id가 없으면 400", async () => {
  const response = await route.PATCH(jsonRequest("PATCH", { current_price: 1000 }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /id/);
});

test("PATCH: 설정비중 범위를 벗어나면 400", async () => {
  const response = await route.PATCH(jsonRequest("PATCH", { id: "h1", target_pct: 101 }));
  assert.equal(response.status, 400);
});

test("PATCH: 종목코드 형식이 틀리면 400", async () => {
  const response = await route.PATCH(jsonRequest("PATCH", { id: "h1", code: "3050-50!" }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /종목코드/);
});

test("PATCH: 수량을 0으로 바꾸면 원가를 지운다", async () => {
  db.setHandler((query) => {
    if (query.includes("SELECT shares")) return [{ shares: 5 }];
    if (query.includes("FROM holdings")) return [{ id: "h1", shares: 0 }];
    return [];
  });

  const response = await route.PATCH(jsonRequest("PATCH", { id: "h1", shares: 0 }));
  assert.equal(response.status, 200);
  assert.equal(db.find("DELETE FROM cost_basis").length, 1);
  assert.equal(db.find("INSERT INTO cost_basis").length, 0);
});

test("PATCH: 수량이 있는데 평단가가 0이면 400", async () => {
  db.setHandler((query) => (query.includes("SELECT shares") ? [{ shares: 5 }] : []));

  const response = await route.PATCH(jsonRequest("PATCH", { id: "h1", shares: 3, avg_price: 0 }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /평단가/);
});

test("PATCH: 계좌에 없는 종목이면 404", async () => {
  db.setHandler(() => []);

  const response = await route.PATCH(jsonRequest("PATCH", { id: "h-other", shares: 3, avg_price: 100 }));
  assert.equal(response.status, 404);
});

test("DELETE: 계좌·사용자 범위로만 지운다", async () => {
  const response = await route.DELETE(jsonRequest("DELETE", { id: "h1" }));
  assert.equal(response.status, 200);

  const [deleted] = db.find("DELETE FROM holdings");
  assert.match(deleted.query, /WHERE id = \? AND user_id = \? AND account_id = \?/);
  assert.deepEqual(deleted.values, ["h1", "user-1", "acc-1"]);
});
