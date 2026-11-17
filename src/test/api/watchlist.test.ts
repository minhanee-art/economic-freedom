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

let watchlist: typeof import("@/app/api/watchlist/route");
let watchlistItem: typeof import("@/app/api/watchlist/[id]/route");

before(async () => {
  [watchlist, watchlistItem] = await Promise.all([
    import("@/app/api/watchlist/route"),
    import("@/app/api/watchlist/[id]/route"),
  ]);
});

beforeEach(() => {
  db.reset();
});

test("GET: 현재 계좌 감시 종목을 조회한다", async () => {
  const rows = [{ id: "w1", name: "테슬라", code: "TSLA", market: "US" }];
  db.setHandler((query) => (query.includes("FROM watchlist") ? rows : []));

  const response = await watchlist.GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), rows);

  const [select] = db.find("FROM watchlist");
  assert.deepEqual(select.values, ["user-1", "acc-1"]);
});

test("POST: 종목명이 비면 400", async () => {
  const response = await watchlist.POST(jsonRequest("POST", { name: "   ", market: "US" }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /종목명/);
});

test("POST: 알 수 없는 시장은 KR로 저장한다", async () => {
  db.setHandler(() => [{ id: "w1", name: "삼성전자", code: null, market: "KR" }]);

  const response = await watchlist.POST(jsonRequest("POST", { name: " 삼성전자 ", market: "JP" }));
  assert.equal(response.status, 201);

  const [insert] = db.find("INSERT INTO watchlist");
  assert.deepEqual(insert.values, ["user-1", "acc-1", "삼성전자", null, "KR"]);
});

test("POST: 이미 있는 종목이면 409", async () => {
  db.setHandler(() => []);

  const response = await watchlist.POST(jsonRequest("POST", { name: "테슬라", market: "US" }));
  assert.equal(response.status, 409);
  assert.match((await readJson<{ error: string }>(response)).error, /이미 등록된/);
});

test("POST: 종목코드는 공백을 제거하고 비면 null로 저장한다", async () => {
  db.setHandler(() => [{ id: "w2" }]);

  await watchlist.POST(jsonRequest("POST", { name: "애플", code: "  ", market: "US" }));
  const [insert] = db.find("INSERT INTO watchlist");
  assert.equal(insert.values[3], null);
});

test("DELETE: 사용자 범위로만 지운다", async () => {
  const response = await watchlistItem.DELETE(jsonRequest("DELETE"), {
    params: Promise.resolve({ id: "w1" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true });

  const [deleted] = db.find("DELETE FROM watchlist");
  assert.match(deleted.query, /WHERE id = \? AND user_id = \?/);
  assert.deepEqual(deleted.values, ["w1", "user-1"]);
});
