// 연금 설계 API 라우트 테스트 — pension-data를 메모리 스텁으로 바꿔 검증·소유권 분기를 본다.
import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { createSessionState, jsonRequest, readJson } from "@/test/api-helpers";

const session = createSessionState("user-1");

type Goal = Record<string, unknown>;
const store = {
  ownedAccounts: new Set(["acc-1"]),
  contributions: [] as { account_id: string; year: number; amount: number; memo: string | null }[],
  sources: [] as { id: string; userId: string; [key: string]: unknown }[],
  /** 사용자별 은퇴 목표(profiles 행). 값이 null이면 프로필 없음 */
  goals: {} as Record<string, Goal | null>,
  saved: [] as Goal[],
};

mock.module("@/lib/session", { namedExports: session.namedExports });
mock.module("@/lib/pension-data", {
  namedExports: {
    getContributions: async (_u: string, year: number) => store.contributions.filter((c) => c.year === year),
    upsertContribution: async (_u: string, accountId: string, year: number, amount: number, memo: string | null) => {
      if (!store.ownedAccounts.has(accountId)) return null;
      const row = { account_id: accountId, year, amount, memo };
      store.contributions = store.contributions.filter((c) => !(c.account_id === accountId && c.year === year));
      store.contributions.push(row);
      return row;
    },
    deleteContribution: async (_u: string, accountId: string, year: number) => {
      const before = store.contributions.length;
      store.contributions = store.contributions.filter((c) => !(c.account_id === accountId && c.year === year));
      return store.contributions.length < before;
    },
    getIncomeSources: async (userId: string) => store.sources.filter((s) => s.userId === userId),
    createIncomeSource: async (userId: string, fields: Record<string, unknown>) => {
      const row = { id: `src-${store.sources.length + 1}`, userId, ...fields };
      store.sources.push(row);
      return row;
    },
    updateIncomeSource: async (userId: string, id: string, fields: Record<string, unknown>) => {
      const row = store.sources.find((s) => s.id === id && s.userId === userId);
      if (!row) return null;
      Object.assign(row, fields);
      return row;
    },
    deleteIncomeSource: async (userId: string, id: string) => {
      const index = store.sources.findIndex((s) => s.id === id && s.userId === userId);
      if (index < 0) return false;
      store.sources.splice(index, 1);
      return true;
    },
    getRetirementGoal: async (userId: string) => store.goals[userId] ?? null,
    patchRetirementGoal: async (userId: string, patch: Goal) => {
      const current = store.goals[userId];
      if (!current) return null;
      store.goals[userId] = { ...current, ...patch };
      store.saved.push(patch);
      return store.goals[userId];
    },
  },
});

let contributions: typeof import("@/app/api/pension/contributions/route");
let sources: typeof import("@/app/api/pension/income-sources/route");
let sourceItem: typeof import("@/app/api/pension/income-sources/[id]/route");
let goal: typeof import("@/app/api/pension/goal/route");

before(async () => {
  [contributions, sources, sourceItem, goal] = await Promise.all([
    import("@/app/api/pension/contributions/route"),
    import("@/app/api/pension/income-sources/route"),
    import("@/app/api/pension/income-sources/[id]/route"),
    import("@/app/api/pension/goal/route"),
  ]);
});

beforeEach(() => {
  session.state.userId = "user-1";
  store.contributions = [];
  store.sources = [];
  store.saved = [];
  const baseGoal = {
    targetMonthly: 3_000_000,
    retirementAge: 60,
    birthYear: 1980,
    spouseBirthYear: null,
    expectedReturnPct: 4,
    salaryBracket: null,
    spouseSalaryBracket: null,
  };
  store.goals = { "user-1": { ...baseGoal }, "user-2": { ...baseGoal } };
});

const year = new Date().getFullYear();
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const urlRequest = (url: string) => new Request(`https://pension.test${url}`);

test("인증이 없으면 모든 연금 API가 401", async () => {
  session.state.userId = null;
  const results = await Promise.all([
    contributions.GET(urlRequest("/api/pension/contributions")),
    contributions.PUT(jsonRequest("PUT", {})),
    contributions.DELETE(jsonRequest("DELETE", {})),
    sources.GET(jsonRequest("GET")),
    sources.POST(jsonRequest("POST", {})),
    sourceItem.PATCH(jsonRequest("PATCH", {}), ctx("x")),
    sourceItem.DELETE(jsonRequest("DELETE"), ctx("x")),
    goal.GET(jsonRequest("GET")),
    goal.PATCH(jsonRequest("PATCH", {})),
  ]);
  for (const response of results) assert.equal(response.status, 401);
});

test("납입 기록: 저장 → 조회 → 덮어쓰기 → 삭제", async () => {
  const put = await contributions.PUT(jsonRequest("PUT", { accountId: "acc-1", year, amount: 3_000_000 }));
  assert.equal(put.status, 200);
  await contributions.PUT(jsonRequest("PUT", { accountId: "acc-1", year, amount: 4_000_000 }));

  const got = await readJson<{ year: number; contributions: { amount: number }[] }>(
    await contributions.GET(urlRequest(`/api/pension/contributions?year=${year}`))
  );
  assert.equal(got.year, year);
  assert.deepEqual(got.contributions.map((c) => c.amount), [4_000_000]);

  assert.equal((await contributions.DELETE(jsonRequest("DELETE", { accountId: "acc-1", year }))).status, 200);
  assert.equal((await contributions.DELETE(jsonRequest("DELETE", { accountId: "acc-1", year }))).status, 404);
});

test("납입 기록: 남의 계좌는 404, 잘못된 값·연도는 400", async () => {
  assert.equal(
    (await contributions.PUT(jsonRequest("PUT", { accountId: "acc-other", year, amount: 1 }))).status,
    404
  );
  assert.equal((await contributions.PUT(jsonRequest("PUT", { accountId: "acc-1", year, amount: -1 }))).status, 400);
  assert.equal((await contributions.GET(urlRequest("/api/pension/contributions?year=abc"))).status, 400);
});

test("연금 항목: 만들고, 수정하고, 지운다", async () => {
  const created = await sources.POST(
    jsonRequest("POST", { member: "self", sourceType: "national_pension", monthlyAmount: 1_100_000, startAge: 65 })
  );
  assert.equal(created.status, 201);
  const { source } = await readJson<{ source: { id: string } }>(created);

  const patched = await sourceItem.PATCH(
    jsonRequest("PATCH", { member: "self", sourceType: "national_pension", monthlyAmount: 1_200_000, startAge: 64 }),
    ctx(source.id)
  );
  assert.equal(patched.status, 200);
  assert.equal((await readJson<{ source: { monthlyAmount: number } }>(patched)).source.monthlyAmount, 1_200_000);

  assert.equal((await sourceItem.DELETE(jsonRequest("DELETE"), ctx(source.id))).status, 200);
  assert.equal((await sourceItem.DELETE(jsonRequest("DELETE"), ctx(source.id))).status, 404);
});

test("연금 항목: 잘못된 값은 400, 다른 사용자 항목은 404", async () => {
  assert.equal((await sources.POST(jsonRequest("POST", { member: "self", sourceType: "x" }))).status, 400);
  await sources.POST(
    jsonRequest("POST", { member: "spouse", sourceType: "pension_insurance", monthlyAmount: 1, startAge: 60 })
  );
  session.state.userId = "user-2";
  const response = await sourceItem.PATCH(
    jsonRequest("PATCH", { member: "self", sourceType: "pension_insurance", monthlyAmount: 1, startAge: 60 }),
    ctx("src-1")
  );
  assert.equal(response.status, 404);
});

test("은퇴 목표: 보낸 항목만 바꾸고 나머지는 유지한다", async () => {
  const response = await goal.PATCH(jsonRequest("PATCH", { salaryBracket: "low" }));
  assert.equal(response.status, 200);
  const body = await readJson<{ goal: Goal }>(response);
  assert.equal(body.goal.salaryBracket, "low");
  assert.equal(body.goal.targetMonthly, 3_000_000);
  assert.equal(body.goal.retirementAge, 60);
});

test("은퇴 목표: 저장 함수에는 보낸 키만 넘긴다 — null은 지우기, 키 없음은 유지 (읽고 병합해 전체를 쓰지 않는다)", async () => {
  const response = await goal.PATCH(jsonRequest("PATCH", { retirementAge: 65, expectedReturnPct: null }));
  assert.equal(response.status, 200);
  assert.deepEqual(store.saved, [{ retirementAge: 65, expectedReturnPct: null }]);
  const body = await readJson<{ goal: Goal }>(response);
  assert.equal(body.goal.retirementAge, 65);
  assert.equal(body.goal.expectedReturnPct, null);
  assert.equal(body.goal.targetMonthly, 3_000_000, "보내지 않은 항목은 그대로");
});

test("은퇴 목표: 프로필이 없으면 GET은 빈 목표, PATCH는 404", async () => {
  store.goals["user-1"] = null;
  const got = await readJson<{ goal: Goal }>(await goal.GET(jsonRequest("GET")));
  assert.equal(got.goal.targetMonthly, null);
  assert.equal((await goal.PATCH(jsonRequest("PATCH", { targetMonthly: 1 }))).status, 404);
  assert.equal((await goal.PATCH(jsonRequest("PATCH", { retirementAge: 5 }))).status, 400);
});

test("은퇴 목표: 배우자 총급여 구간을 저장·재조회하고 null로 지운다", async () => {
  const saved = await goal.PATCH(jsonRequest("PATCH", { spouseSalaryBracket: "low" }));
  assert.equal(saved.status, 200);
  assert.deepEqual(store.saved, [{ spouseSalaryBracket: "low" }], "보낸 배우자 구간만 넘긴다");
  const body = await readJson<{ goal: Goal }>(saved);
  assert.equal(body.goal.spouseSalaryBracket, "low");
  assert.equal(body.goal.salaryBracket, null, "본인 구간은 그대로");

  const got = await readJson<{ goal: Goal }>(await goal.GET(jsonRequest("GET")));
  assert.equal(got.goal.spouseSalaryBracket, "low");

  const cleared = await readJson<{ goal: Goal }>(await goal.PATCH(jsonRequest("PATCH", { spouseSalaryBracket: null })));
  assert.equal(cleared.goal.spouseSalaryBracket, null);
  const emptied = await readJson<{ goal: Goal }>(await goal.PATCH(jsonRequest("PATCH", { spouseSalaryBracket: "" })));
  assert.equal(emptied.goal.spouseSalaryBracket, null, "빈 문자열도 지우기");
});

test("은퇴 목표: 배우자 총급여 구간이 low·high·null이 아니면 400이고 저장하지 않는다", async () => {
  for (const bad of ["mid", "LOW", 1, true, {}]) {
    const response = await goal.PATCH(jsonRequest("PATCH", { spouseSalaryBracket: bad }));
    assert.equal(response.status, 400, `값 ${JSON.stringify(bad)}`);
    const body = await readJson<{ error: string }>(response);
    assert.match(body.error, /배우자 총급여 구간/);
  }
  // 다른 항목과 함께 보내도 하나라도 틀리면 전체를 저장하지 않는다
  assert.equal((await goal.PATCH(jsonRequest("PATCH", { salaryBracket: "low", spouseSalaryBracket: "x" }))).status, 400);
  assert.deepEqual(store.saved, []);
  assert.equal(store.goals["user-1"]?.salaryBracket, null);
});

test("은퇴 목표: 배우자 총급여 구간은 로그인한 사용자 자신의 프로필에만 저장된다", async () => {
  assert.equal((await goal.PATCH(jsonRequest("PATCH", { spouseSalaryBracket: "high" }))).status, 200);
  assert.equal(store.goals["user-1"]?.spouseSalaryBracket, "high");
  assert.equal(store.goals["user-2"]?.spouseSalaryBracket, null, "다른 사용자 프로필은 그대로");

  session.state.userId = "user-2";
  const other = await readJson<{ goal: Goal }>(await goal.GET(jsonRequest("GET")));
  assert.equal(other.goal.spouseSalaryBracket, null, "다른 사용자에게 보이지 않는다");
  assert.equal((await goal.PATCH(jsonRequest("PATCH", { spouseSalaryBracket: "low" }))).status, 200);
  assert.equal(store.goals["user-1"]?.spouseSalaryBracket, "high", "user-2 저장이 user-1을 덮지 않는다");
});

test("은퇴 목표: 프로필이 없으면 GET 빈 목표에도 spouseSalaryBracket 키가 null로 있다", async () => {
  store.goals["user-1"] = null;
  const got = await readJson<{ goal: Goal }>(await goal.GET(jsonRequest("GET")));
  assert.ok(Object.prototype.hasOwnProperty.call(got.goal, "spouseSalaryBracket"));
  assert.equal(got.goal.spouseSalaryBracket, null);
});
