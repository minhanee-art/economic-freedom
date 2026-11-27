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
  // 가짜 sql 은 호출 즉시 handler 를 돌리므로, 트랜잭션 결과는 각 문장의 handler 결과다.
  db.sql.transaction = async (queries: unknown[]) => {
    db.calls.push({ query: "<transaction>", values: queries });
    return Promise.all(queries as Promise<unknown>[]);
  };
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

  const response = await route.GET(jsonRequest("GET"));
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

test("POST: 목표 비중이 100을 넘으면 400", async () => {
  const response = await route.POST(jsonRequest("POST", { ...validBody, target_pct: 101 }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /목표 비중/);
});

test("POST: 보유수량이 정수가 아니면 400", async () => {
  const response = await route.POST(jsonRequest("POST", { ...validBody, shares: 1.5 }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /보유수량/);
});

test("POST: 수량이 있는데 평균단가가 0이면 400", async () => {
  const response = await route.POST(jsonRequest("POST", { ...validBody, shares: 10, avg_price: 0 }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /평균단가/);
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
  // 수량 10 × 반올림 평균단가 1235 = 12,350 / values: [user, account, holdingId, cost, shares]
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

test("POST: 목록에 없는 자산군는 주식으로 처리한다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [{ id: "h-new" }] : []));

  await route.POST(jsonRequest("POST", { ...validBody, category: "코인" }));
  const [insert] = db.find("INSERT INTO holdings");
  assert.equal(insert.values[5], "주식");
});

test("POST: 종목명과 종목코드만 보내도(모바일 종목 추가) 분류를 추론해 0주로 만든다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [{ id: "h-new" }] : []));

  const response = await route.POST(jsonRequest("POST", { code: "069500", name: "KODEX 200" }));
  assert.equal(response.status, 201);
  const [insert] = db.find("INSERT INTO holdings");
  // values: [id, user_id, account_id, code, name, category, sub_category, current_price, shares, target_pct]
  assert.deepEqual(insert.values.slice(3, 5), ["069500", "KODEX 200"]);
  assert.ok(insert.values[5], "자산군가 비어 있으면 안 된다");
  assert.deepEqual(insert.values.slice(7), [0, 0, 0]);
  assert.equal(db.find("INSERT INTO purchase_records").length, 0);
});

test("POST: 종목코드 형식이 틀리면 400이고 아무것도 쓰지 않는다", async () => {
  for (const code of ["30 5050", "305050;", "가나다", "1234567890123"]) {
    db.reset();
    const response = await route.POST(jsonRequest("POST", { code, name: "테스트" }));
    assert.equal(response.status, 400, code);
    assert.equal(db.find("INSERT INTO holdings").length, 0);
  }
});

test("POST: 같은 계좌에 같은 종목코드가 있으면 409", async () => {
  db.sql.transaction = async () => {
    throw Object.assign(new Error("duplicate key"), { code: "23505" });
  };
  const response = await route.POST(jsonRequest("POST", { code: "305050", name: "ACE 코스피" }));
  assert.equal(response.status, 409);
  assert.match((await readJson<{ error: string }>(response)).error, /이미/);
});

test("PATCH: id가 없으면 400", async () => {
  const response = await route.PATCH(jsonRequest("PATCH", { current_price: 1000 }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /id/);
});

test("PATCH: 목표 비중 범위를 벗어나면 400", async () => {
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
    if (query.includes("RETURNING id")) return [{ id: "h1" }];
    if (query.includes("FROM holdings")) return [{ id: "h1", shares: 0 }];
    return [];
  });

  const response = await route.PATCH(jsonRequest("PATCH", { id: "h1", shares: 0 }));
  assert.equal(response.status, 200);
  assert.equal(db.find("DELETE FROM cost_basis").length, 1);
  assert.equal(db.find("INSERT INTO cost_basis").length, 0);
});

test("PATCH: 수량이 있는데 평균단가가 0이면 400", async () => {
  const response = await route.PATCH(jsonRequest("PATCH", { id: "h1", shares: 3, avg_price: 0 }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /평균단가/);
  assert.equal(db.find("<transaction>").length, 0);
});

test("PATCH: 계좌에 없는 종목이면 404", async () => {
  db.setHandler(() => []);

  const response = await route.PATCH(jsonRequest("PATCH", { id: "h-other", shares: 3, avg_price: 100 }));
  assert.equal(response.status, 404);
});

test("PATCH: 평균단가만 보내면 수량을 읽어 되쓰지 않고 한 문장으로 원가만 다시 계산한다", async () => {
  db.setHandler((query) => (query.includes("WITH h AS") ? [{ found: 1, shares: 7 }] : query.includes("FROM holdings") ? [{ id: "h1", shares: 7 }] : []));

  const response = await route.PATCH(jsonRequest("PATCH", { id: "h1", avg_price: 1200 }));
  assert.equal(response.status, 200);

  assert.equal(db.find("UPDATE holdings SET shares").length, 0, "shares 를 다시 쓰지 않는다");
  const [stmt] = db.find("WITH h AS");
  assert.match(stmt.query, /FOR UPDATE/);
  assert.match(stmt.query, /h\.shares::bigint \* \?::int/);
  assert.equal(db.find("SELECT shares FROM holdings").length, 0, "트랜잭션 밖 사전 조회 없음");
});

test("PATCH: 평균단가만 보냈는데 종목이 없으면 404", async () => {
  db.setHandler((query) => (query.includes("WITH h AS") ? [{ found: 0, shares: 0 }] : []));

  const response = await route.PATCH(jsonRequest("PATCH", { id: "h-other", avg_price: 1200 }));
  assert.equal(response.status, 404);
});

test("PATCH: 평균단가만 0으로 보내면 수량이 있을 때 400, 아무 것도 쓰지 않는다", async () => {
  db.setHandler((query) => (query.includes("SELECT shares FROM holdings") ? [{ shares: 5 }] : []));

  const response = await route.PATCH(jsonRequest("PATCH", { id: "h1", name: "새 이름", avg_price: 0 }));
  assert.equal(response.status, 400);
  assert.equal(db.find("<transaction>").length, 0);
});

test("PATCH: 여러 필드를 보내면 한 트랜잭션으로 묶고, 검증 실패 시 하나도 쓰지 않는다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [{ id: "h1" }] : []));

  const ok = await route.PATCH(jsonRequest("PATCH", { id: "h1", current_price: 1000, target_pct: 10, name: "새 이름" }));
  assert.equal(ok.status, 200);
  const [tx] = db.find("<transaction>");
  assert.equal((tx.values as unknown[]).length, 3);

  db.reset();
  const bad = await route.PATCH(jsonRequest("PATCH", { id: "h1", current_price: 1000, name: "  " }));
  assert.equal(bad.status, 400);
  assert.equal(db.find("<transaction>").length, 0, "트랜잭션을 시작하지 않으므로 앞 필드도 반영되지 않는다");
});

test("DELETE: 계좌·사용자 범위로만 지운다", async () => {
  const response = await route.DELETE(jsonRequest("DELETE", { id: "h1" }));
  assert.equal(response.status, 200);

  const [deleted] = db.find("DELETE FROM holdings");
  assert.match(deleted.query, /WHERE id = \? AND user_id = \? AND account_id = \?/);
  assert.deepEqual(deleted.values, ["h1", "user-1", "acc-1"]);
});
