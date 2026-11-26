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

let dividends: typeof import("@/app/api/dividends/route");

const H1 = "11111111-1111-4111-8111-111111111111";

before(async () => {
  dividends = await import("@/app/api/dividends/route");
});

beforeEach(() => {
  db.reset();
});

test("GET: 현재 계좌 배당 내역을 조회한다", async () => {
  const rows = [{ id: "d1", amount: 10_000, date: "2026-01-15", holding_name: "ACE 코스피" }];
  db.setHandler((query) => (query.includes("FROM dividends d") ? rows : []));

  const response = await dividends.GET(jsonRequest("GET"));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), rows);
  assert.deepEqual(db.find("FROM dividends d")[0].values, ["user-1", "acc-1"]);
});

test("POST: 필수 값이 없으면 400", async () => {
  const response = await dividends.POST(jsonRequest("POST", { holdingId: "h1", date: "2026-01-15" }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /필요/);
});

test("POST: 현재 계좌 보유 종목이 아니면 400", async () => {
  db.setHandler(() => []);

  const response = await dividends.POST(
    jsonRequest("POST", { holdingId: "h-other", amount: 10_000, date: "2026-01-15" })
  );
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /보유 종목/);
});

test("POST: 보유 종목이면 등록하고 201을 돌려준다", async () => {
  const row = { id: "d1", amount: 10_000, date: "2026-01-15", holding_name: "ACE 코스피" };
  db.setHandler((query) => {
    if (query.includes("SELECT id FROM holdings")) return [{ id: H1 }];
    if (query.includes("INSERT INTO dividends")) return [row];
    return [];
  });

  const response = await dividends.POST(
    jsonRequest("POST", { holdingId: H1, amount: 10_000, date: "2026-01-15", memo: "1분기" })
  );
  assert.equal(response.status, 201);
  assert.deepEqual(await readJson(response), row);

  const [insert] = db.find("INSERT INTO dividends");
  assert.deepEqual(insert.values, ["user-1", "acc-1", H1, 10_000, "2026-01-15", "1분기"]);
});

test("POST: 메모를 생략하면 NULL로 저장한다", async () => {
  db.setHandler((query) => {
    if (query.includes("SELECT id FROM holdings")) return [{ id: H1 }];
    return [{ id: "d1" }];
  });

  await dividends.POST(jsonRequest("POST", { holdingId: H1, amount: 1_000, date: "2026-02-01" }));
  const [insert] = db.find("INSERT INTO dividends");
  assert.equal(insert.values[5], null);
});

test("POST: 배당금이 0·음수·소수·범위 초과·숫자가 아니면 400", async () => {
  db.setHandler(() => [{ id: H1 }]);
  for (const amount of [0, -100, 10.5, 2_147_483_648, "abc", "1e3.5"]) {
    const response = await dividends.POST(jsonRequest("POST", { holdingId: H1, amount, date: "2026-01-15" }));
    assert.equal(response.status, 400, `amount=${amount}`);
  }
  assert.equal(db.find("INSERT INTO dividends").length, 0);
});

test("POST: 날짜 형식이 틀리거나 없는 날짜·미래 날짜(KST)면 400", async () => {
  db.setHandler(() => [{ id: H1 }]);
  const { todayKstDateKey } = await import("@/lib/record-validation");
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  for (const date of ["2026/01/15", "2026-02-30", "15-01-2026", "1969-12-31", todayKstDateKey(tomorrow)]) {
    const response = await dividends.POST(jsonRequest("POST", { holdingId: H1, amount: 1_000, date }));
    assert.equal(response.status, 400, `date=${date}`);
  }
  assert.equal(db.find("INSERT INTO dividends").length, 0);
});

test("POST: 오늘(KST) 날짜와 숫자 문자열 금액은 허용한다", async () => {
  db.setHandler((query) => (query.includes("SELECT id FROM holdings") ? [{ id: H1 }] : [{ id: "d1" }]));
  const { todayKstDateKey } = await import("@/lib/record-validation");
  const response = await dividends.POST(jsonRequest("POST", { holdingId: H1, amount: "1500", date: todayKstDateKey() }));
  assert.equal(response.status, 201);
  assert.equal(db.find("INSERT INTO dividends")[0].values[3], 1500);
});

test("POST: 메모가 너무 길면 400", async () => {
  db.setHandler(() => [{ id: H1 }]);
  const response = await dividends.POST(
    jsonRequest("POST", { holdingId: H1, amount: 1_000, date: "2026-01-15", memo: "가".repeat(501) })
  );
  assert.equal(response.status, 400);
});

test("DELETE: 계좌·사용자 범위로만 지운다", async () => {
  const response = await dividends.DELETE(jsonRequest("DELETE", { id: "d1" }));
  assert.equal(response.status, 200);

  const [deleted] = db.find("DELETE FROM dividends");
  assert.match(deleted.query, /WHERE id = \? AND user_id = \? AND account_id = \?/);
  assert.deepEqual(deleted.values, ["d1", "user-1", "acc-1"]);
});
