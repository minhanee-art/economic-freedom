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
const accounts = createAccountsState([
  { id: "acc-1", name: "기본 계좌", ownerType: "self" },
  { id: "acc-2", name: "배우자 계좌", ownerType: "spouse" },
]);

mock.module("@/lib/session", { namedExports: session.namedExports });
mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/portfolio-accounts", { namedExports: accounts.namedExports });

let route: typeof import("@/app/api/accounts/route");

before(async () => {
  route = await import("@/app/api/accounts/route");
});

beforeEach(() => {
  db.reset();
  accounts.state.created.length = 0;
  accounts.state.failCreate = null;
  accounts.state.activeAccountId = "acc-1";
  accounts.state.accounts = [
    { id: "acc-1", name: "기본 계좌", ownerType: "self" },
    { id: "acc-2", name: "배우자 계좌", ownerType: "spouse" },
  ];
});

test("GET: 계좌 목록과 활성 계좌를 돌려준다", async () => {
  const response = await route.GET(jsonRequest("GET"));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    accounts: accounts.state.accounts,
    activeAccountId: "acc-1",
  });
});

test("POST: 알 수 없는 명의 구분은 other로 저장한다", async () => {
  const response = await route.POST(jsonRequest("POST", { name: "새 계좌", ownerType: "friend" }));
  assert.equal(response.status, 201);
  assert.equal(accounts.state.created[0].ownerType, "other");
  assert.equal(accounts.state.created[0].name, "새 계좌");
});

test("POST: 명의 구분을 그대로 전달한다", async () => {
  await route.POST(jsonRequest("POST", { name: "자녀 계좌", ownerType: "child" }));
  assert.equal(accounts.state.created[0].ownerType, "child");
});

test("POST: 계좌를 만들면 활성 계좌 쿠키를 내려준다", async () => {
  const response = await route.POST(jsonRequest("POST", { name: "새 계좌", ownerType: "self" }));
  assert.equal(response.status, 201);

  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /pension-account=/);
  assert.match(cookie, /HttpOnly/i);
  const body = await readJson<{ account: { id: string } }>(response);
  assert.match(cookie, new RegExp(body.account.id));
});

test("POST: 계좌 생성이 실패하면 400과 메시지를 돌려준다", async () => {
  accounts.state.failCreate = new Error("계좌 이름이 필요합니다.");

  const response = await route.POST(jsonRequest("POST", { name: "" }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /계좌 이름/);
});

test("PATCH: 없는 계좌로 전환하면 404", async () => {
  const response = await route.PATCH(jsonRequest("PATCH", { accountId: "acc-404" }));
  assert.equal(response.status, 404);
  assert.match((await readJson<{ error: string }>(response)).error, /찾을 수 없습니다/);
});

test("PATCH: 있는 계좌로 전환하면 쿠키를 갱신한다", async () => {
  const response = await route.PATCH(jsonRequest("PATCH", { accountId: "acc-2" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, activeAccountId: "acc-2" });

  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /pension-account=acc-2/);
});

test("PATCH: 본문이 비어도 404로 안전하게 처리한다", async () => {
  const response = await route.PATCH(jsonRequest("PATCH"));
  assert.equal(response.status, 404);
});
