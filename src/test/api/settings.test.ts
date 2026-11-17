import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import {
  createAccountsState,
  createFakeSql,
  createSessionState,
  jsonRequest,
  readJson,
} from "@/test/api-helpers";
import { DEFAULT_HOLDINGS } from "@/lib/constants";

const session = createSessionState("user-1");
const db = createFakeSql();
const accounts = createAccountsState();

mock.module("@/lib/session", { namedExports: session.namedExports });
mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/portfolio-accounts", { namedExports: accounts.namedExports });

let settings: typeof import("@/app/api/settings/route");

before(async () => {
  settings = await import("@/app/api/settings/route");
});

beforeEach(() => {
  db.reset();
});

test("PATCH: 월 투자금액이 정수가 아니면 400", async () => {
  const response = await settings.PATCH(jsonRequest("PATCH", { monthlyBudget: "10000" }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /monthlyBudget/);
});

test("PATCH: 월 투자금액이 음수면 400", async () => {
  const response = await settings.PATCH(jsonRequest("PATCH", { monthlyBudget: -1 }));
  assert.equal(response.status, 400);
});

test("PATCH: 표시 이름을 안 보내면 예산만 갱신한다", async () => {
  const response = await settings.PATCH(jsonRequest("PATCH", { monthlyBudget: 300_000 }));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true });

  const updates = db.find("UPDATE profiles");
  assert.equal(updates.length, 1);
  assert.doesNotMatch(updates[0].query, /display_name/);
  assert.deepEqual(updates[0].values, [300_000, "user-1"]);
});

test("PATCH: 표시 이름은 앞뒤 공백을 제거해 저장한다", async () => {
  await settings.PATCH(jsonRequest("PATCH", { displayName: "  홍길동  " }));

  const [update] = db.find("UPDATE profiles");
  assert.match(update.query, /display_name/);
  assert.deepEqual(update.values, [null, "홍길동", "user-1"]);
});

test("PATCH: 빈 표시 이름은 NULL로 초기화한다", async () => {
  await settings.PATCH(jsonRequest("PATCH", { displayName: "   " }));

  const [update] = db.find("UPDATE profiles");
  assert.deepEqual(update.values, [null, null, "user-1"]);
});

test("PATCH: 표시 이름은 50자로 자른다", async () => {
  await settings.PATCH(jsonRequest("PATCH", { displayName: "가".repeat(80) }));

  const [update] = db.find("UPDATE profiles");
  assert.equal(String(update.values[1]).length, 50);
});

test("DELETE: 원가·종목을 지우고 기본 종목을 다시 만든다", async () => {
  const response = await settings.DELETE();
  assert.equal(response.status, 200);

  assert.equal(db.find("DELETE FROM cost_basis").length, 1);
  assert.equal(db.find("DELETE FROM holdings").length, 1);

  const inserts = db.find("INSERT INTO holdings");
  assert.equal(inserts.length, DEFAULT_HOLDINGS.length);
  // values: [user, account, code, name, category, sub_category, price, target_pct]
  assert.deepEqual(inserts[0].values.slice(0, 4), ["user-1", "acc-1", DEFAULT_HOLDINGS[0].code, DEFAULT_HOLDINGS[0].name]);
  assert.equal(inserts[0].values[7], DEFAULT_HOLDINGS[0].target_pct);
});
