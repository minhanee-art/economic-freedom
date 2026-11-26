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
// 실제 DB 행처럼 user_id·telegram_chat_id까지 들어 있는 전체 행을 돌려주는 스텁
type FullRow = {
  id: string;
  user_id: string;
  name: string;
  owner_type: string;
  account_type: string;
  telegram_chat_id: string | null;
  display_order: number;
  created_at: string;
};
const fullRow = (id: string, name: string, ownerType: string, accountType = "general"): FullRow => ({
  id,
  user_id: "user-1",
  name,
  owner_type: ownerType,
  account_type: accountType,
  telegram_chat_id: "123456789",
  display_order: 0,
  created_at: "2026-01-01 00:00:00+00",
});
const rows: FullRow[] = [];
const resetRows = () => {
  rows.length = 0;
  rows.push(fullRow("acc-1", "기본 계좌", "self"), fullRow("acc-2", "배우자 계좌", "spouse"));
};
resetRows();

mock.module("@/lib/portfolio-accounts", {
  namedExports: {
    ...accounts.namedExports,
    getPortfolioAccounts: async () => rows,
    createPortfolioAccount: async (...args: [string, string, string, string?]) => {
      const [, name, ownerType, accountType] = args;
      if (accounts.state.failCreate) throw accounts.state.failCreate;
      accounts.state.created.push({ id: "x", name, ownerType, accountType });
      return fullRow(`acc-${accounts.state.created.length + 2}`, name, ownerType, accountType ?? "general");
    },
    updatePortfolioAccount: async (_u: string, id: string, changes: { accountType?: string }) => {
      const row = rows.find((item) => item.id === id);
      if (!row) return null;
      if (changes.accountType) row.account_type = changes.accountType;
      return row;
    },
  },
});

let route: typeof import("@/app/api/accounts/route");
let itemRoute: typeof import("@/app/api/accounts/[id]/route");

before(async () => {
  route = await import("@/app/api/accounts/route");
  itemRoute = await import("@/app/api/accounts/[id]/route");
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  db.reset();
  accounts.state.created.length = 0;
  accounts.state.failCreate = null;
  accounts.state.activeAccountId = "acc-1";
  resetRows();
});

test("GET: 계좌 목록과 활성 계좌를 돌려준다", async () => {
  const response = await route.GET(jsonRequest("GET"));
  assert.equal(response.status, 200);
  const body = await readJson<{ accounts: Record<string, unknown>[]; activeAccountId: string }>(response);
  assert.equal(body.activeAccountId, "acc-1");
  assert.deepEqual(
    body.accounts.map((item) => item.id),
    ["acc-1", "acc-2"]
  );
  assert.deepEqual(Object.keys(body.accounts[0]).sort(), ["account_type", "display_order", "id", "name", "owner_type"]);
});

test("GET/POST/PATCH: 응답에 user_id·telegram_chat_id를 내리지 않는다", async () => {
  const list = await route.GET(jsonRequest("GET"));
  const created = await route.POST(jsonRequest("POST", { name: "새 계좌", ownerType: "self" }));
  const updated = await itemRoute.PATCH(jsonRequest("PATCH", { accountType: "irp" }), ctx("acc-2"));
  for (const response of [list, created, updated]) {
    const text = JSON.stringify(await readJson(response));
    assert.doesNotMatch(text, /user_id|telegram_chat_id|123456789|created_at/);
  }
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

test("POST: 세제 유형을 전달하고, 모르는 값은 general로 저장한다", async () => {
  await route.POST(jsonRequest("POST", { name: "연금저축", ownerType: "self", accountType: "pension_savings" }));
  await route.POST(jsonRequest("POST", { name: "기타", ownerType: "self", accountType: "crypto" }));
  await route.POST(jsonRequest("POST", { name: "미지정", ownerType: "self" }));
  assert.deepEqual(
    accounts.state.created.map((item) => item.accountType),
    ["pension_savings", "general", "general"]
  );
});

test("PATCH /accounts/[id]: 세제 유형을 바꾼다", async () => {
  const response = await itemRoute.PATCH(jsonRequest("PATCH", { accountType: "irp" }), ctx("acc-2"));
  assert.equal(response.status, 200);
  const body = await readJson<{ account: { id: string; account_type: string } }>(response);
  assert.equal(body.account.id, "acc-2");
  assert.equal(body.account.account_type, "irp");
});

test("PATCH /accounts/[id]: 잘못된 유형·빈 이름·빈 본문은 400", async () => {
  assert.equal((await itemRoute.PATCH(jsonRequest("PATCH", { accountType: "crypto" }), ctx("acc-1"))).status, 400);
  assert.equal((await itemRoute.PATCH(jsonRequest("PATCH", { name: "  " }), ctx("acc-1"))).status, 400);
  assert.equal((await itemRoute.PATCH(jsonRequest("PATCH", {}), ctx("acc-1"))).status, 400);
  assert.equal((await itemRoute.PATCH(jsonRequest("PATCH", { ownerType: "friend" }), ctx("acc-1"))).status, 400);
});

test("PATCH /accounts/[id]: 남의 계좌·없는 계좌는 404", async () => {
  const response = await itemRoute.PATCH(jsonRequest("PATCH", { accountType: "isa" }), ctx("acc-404"));
  assert.equal(response.status, 404);
});
