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
    if (query.includes("SELECT id FROM holdings")) return [{ id: "h1" }];
    if (query.includes("INSERT INTO dividends")) return [row];
    return [];
  });

  const response = await dividends.POST(
    jsonRequest("POST", { holdingId: "h1", amount: 10_000, date: "2026-01-15", memo: "1분기" })
  );
  assert.equal(response.status, 201);
  assert.deepEqual(await readJson(response), row);

  const [insert] = db.find("INSERT INTO dividends");
  assert.deepEqual(insert.values, ["user-1", "acc-1", "h1", 10_000, "2026-01-15", "1분기"]);
});

test("POST: 메모를 생략하면 NULL로 저장한다", async () => {
  db.setHandler((query) => {
    if (query.includes("SELECT id FROM holdings")) return [{ id: "h1" }];
    return [{ id: "d1" }];
  });

  await dividends.POST(jsonRequest("POST", { holdingId: "h1", amount: 1_000, date: "2026-02-01" }));
  const [insert] = db.find("INSERT INTO dividends");
  assert.equal(insert.values[5], null);
});

test("DELETE: 계좌·사용자 범위로만 지운다", async () => {
  const response = await dividends.DELETE(jsonRequest("DELETE", { id: "d1" }));
  assert.equal(response.status, 200);

  const [deleted] = db.find("DELETE FROM dividends");
  assert.match(deleted.query, /WHERE id = \? AND user_id = \? AND account_id = \?/);
  assert.deepEqual(deleted.values, ["d1", "user-1", "acc-1"]);
});
