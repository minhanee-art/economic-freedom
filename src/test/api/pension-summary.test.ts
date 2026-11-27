// GET /api/pension/summary — 인증, 사용자 격리, 빈 입력, 정상 계산
import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { createSessionState, jsonRequest, readJson } from "@/test/api-helpers";

const session = createSessionState("user-1");
const YEAR = new Date().getFullYear();

type Goal = {
  targetMonthly: number | null;
  retirementAge: number | null;
  birthYear: number | null;
  spouseBirthYear: number | null;
  expectedReturnPct: number | null;
  salaryBracket: "low" | "high" | null;
  spouseSalaryBracket: "low" | "high" | null;
};
const emptyGoal: Goal = {
  targetMonthly: null,
  retirementAge: null,
  birthYear: null,
  spouseBirthYear: null,
  expectedReturnPct: null,
  salaryBracket: null,
  spouseSalaryBracket: null,
};

// 사용자별 데이터 — 요청한 userId의 것만 돌려주는 스텁
const data = {
  accounts: {} as Record<string, unknown[]>,
  contributions: {} as Record<string, unknown[]>,
  sources: {} as Record<string, unknown[]>,
  goals: {} as Record<string, Goal | null>,
};

mock.module("@/lib/session", { namedExports: session.namedExports });
mock.module("@/lib/pension-data", {
  namedExports: {
    getAccountSnapshots: async (userId: string) => data.accounts[userId] ?? [],
    getContributions: async (userId: string) => data.contributions[userId] ?? [],
    getIncomeSources: async (userId: string) => data.sources[userId] ?? [],
    getRetirementGoal: async (userId: string) => data.goals[userId] ?? null,
  },
});

let route: typeof import("@/app/api/pension/summary/route");
before(async () => {
  route = await import("@/app/api/pension/summary/route");
});

const account = (id: string, name: string, accountType: string, value = 0, annualDividend = 0) => ({
  id,
  name,
  owner_type: "self",
  account_type: accountType,
  value,
  annual_dividend: annualDividend,
});

beforeEach(() => {
  session.state.userId = "user-1";
  data.accounts = {};
  data.contributions = {};
  data.sources = {};
  data.goals = {};
});

type Summary = {
  year: number;
  rules: {
    year: number;
    exact: boolean;
    taxCredit: { combinedLimit: number; pensionSavingsLimit: number };
    sources: { url: string; verified: boolean }[];
    unverifiedTopics: string[];
  };
  goal: Goal;
  taxCredit: null | {
    salaryBracket: string;
    salaryBracketAssumed: boolean;
    contributionsRecorded: boolean;
    progress: { creditableTotal: number; progressPct: number; estimatedCredit: number; remainingCreditRoom: number };
    accounts: { id: string; paid: number }[];
    byOwner: { ownerType: string; salaryBracket: string; salaryBracketAssumed: boolean; progress: { estimatedCredit: number; rate: number } }[];
  };
  taxCreditUnavailableReason: string | null;
  retirement: {
    cashflow: null | {
      coveragePctAtRetirement: number;
      atRetirement: { age: number; total: number; layers: { public: number; dividend: number }; shortfall: number };
      expectedReturnAssumed: boolean;
    };
    unavailableReason: string | null;
    missingFields: string[];
  };
};

test("인증이 없으면 401", async () => {
  session.state.userId = null;
  const response = await route.GET(jsonRequest("GET"));
  assert.equal(response.status, 401);
});

test("입력이 비어 있으면 null과 이유를 준다 (값을 지어내지 않음)", async () => {
  const response = await route.GET(jsonRequest("GET"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const body = await readJson<Summary>(response);

  assert.equal(body.year, YEAR);
  assert.deepEqual(body.goal, emptyGoal);
  assert.equal(body.taxCredit, null);
  assert.equal(body.taxCreditUnavailableReason, "no_pension_accounts");
  assert.equal(body.retirement.cashflow, null);
  assert.equal(body.retirement.unavailableReason, "goal_incomplete");
  assert.deepEqual(body.retirement.missingFields, ["targetMonthly", "retirementAge", "birthYear"]);
  // 규칙은 입력과 무관하게 내려간다
  assert.equal(body.rules.taxCredit.combinedLimit, 9_000_000);
  assert.ok(body.rules.sources.every((s) => s.url.startsWith("https://")));
  assert.ok(body.rules.sources.some((s) => s.verified === false));
  assert.ok(body.rules.unverifiedTopics.length > 0);
});

test("목표가 일부만 있으면 빠진 항목을 알려준다", async () => {
  data.goals["user-1"] = { ...emptyGoal, targetMonthly: 3_000_000 };
  const body = await readJson<Summary>(await route.GET(jsonRequest("GET")));
  assert.equal(body.retirement.cashflow, null);
  assert.deepEqual(body.retirement.missingFields, ["retirementAge", "birthYear"]);
});

test("연금 계좌만 있고 납입 기록이 없으면 진행률 0과 기록 없음 표시", async () => {
  data.accounts["user-1"] = [account("a1", "연금저축", "pension_savings")];
  const body = await readJson<Summary>(await route.GET(jsonRequest("GET")));
  assert.ok(body.taxCredit);
  assert.equal(body.taxCredit.contributionsRecorded, false);
  assert.equal(body.taxCredit.salaryBracketAssumed, true);
  assert.equal(body.taxCredit.progress.progressPct, 0);
});

test("정상 계산: 세액공제 진행률", async () => {
  data.accounts["user-1"] = [
    account("a1", "연금저축", "pension_savings"),
    account("a2", "IRP", "irp"),
    account("a3", "일반", "general"),
  ];
  data.contributions["user-1"] = [
    { id: "c1", account_id: "a1", year: YEAR, amount: 4_000_000, memo: null, updated_at: "" },
    { id: "c2", account_id: "a2", year: YEAR, amount: 2_000_000, memo: null, updated_at: "" },
  ];
  data.goals["user-1"] = { ...emptyGoal, salaryBracket: "low" };

  const body = await readJson<Summary>(await route.GET(jsonRequest("GET")));
  assert.ok(body.taxCredit);
  assert.equal(body.taxCredit.salaryBracket, "low");
  assert.equal(body.taxCredit.salaryBracketAssumed, false);
  assert.equal(body.taxCredit.contributionsRecorded, true);
  assert.equal(body.taxCredit.progress.creditableTotal, 6_000_000);
  assert.equal(body.taxCredit.progress.remainingCreditRoom, 3_000_000);
  assert.ok(Math.abs(body.taxCredit.progress.progressPct - (6 / 9) * 100) < 1e-9);
  assert.equal(body.taxCredit.progress.estimatedCredit, Math.floor(6_000_000 * 0.165));
  // 공제 대상이 아닌 일반 계좌는 목록에 없다
  assert.deepEqual(body.taxCredit.accounts.map((a) => a.id), ["a1", "a2"]);
});

test("정상 계산: 은퇴 시점 월 현금흐름과 목표 충족률", async () => {
  data.accounts["user-1"] = [account("a9", "일반", "general", 50_000_000, 2_400_000)];
  data.sources["user-1"] = [
    { id: "s1", member: "self", source_type: "national_pension", label: null, monthly_amount: 1_000_000, start_age: 65, end_age: null, memo: null },
  ];
  data.goals["user-1"] = {
    targetMonthly: 2_000_000,
    retirementAge: 65,
    birthYear: YEAR - 50,
    spouseBirthYear: null,
    expectedReturnPct: null,
    salaryBracket: null,
    spouseSalaryBracket: null,
  };

  const body = await readJson<Summary>(await route.GET(jsonRequest("GET")));
  const cashflow = body.retirement.cashflow;
  assert.ok(cashflow);
  assert.equal(body.retirement.unavailableReason, null);
  assert.equal(cashflow.atRetirement.age, 65);
  assert.equal(cashflow.atRetirement.layers.public, 1_000_000);
  assert.equal(cashflow.atRetirement.layers.dividend, 200_000); // 연 240만원 ÷ 12
  assert.equal(cashflow.atRetirement.total, 1_200_000);
  assert.equal(cashflow.atRetirement.shortfall, 800_000);
  assert.equal(cashflow.coveragePctAtRetirement, 60);
  assert.equal(cashflow.expectedReturnAssumed, true);
});

test("다른 사용자의 데이터는 내려가지 않는다", async () => {
  data.accounts["user-2"] = [account("b1", "남의 연금저축", "pension_savings", 99_000_000)];
  data.contributions["user-2"] = [{ id: "c9", account_id: "b1", year: YEAR, amount: 6_000_000, memo: null, updated_at: "" }];
  data.sources["user-2"] = [
    { id: "s9", member: "self", source_type: "national_pension", label: null, monthly_amount: 5_000_000, start_age: 60, end_age: null, memo: null },
  ];
  data.goals["user-2"] = { ...emptyGoal, targetMonthly: 7_777_777, retirementAge: 60, birthYear: 1970, salaryBracket: "low" };

  const body = await readJson<Summary>(await route.GET(jsonRequest("GET")));
  assert.equal(body.taxCredit, null);
  assert.equal(body.retirement.cashflow, null);
  assert.deepEqual(body.goal, emptyGoal);
  assert.doesNotMatch(JSON.stringify(body), /남의|7777777|b1|user-2/);

  // user-2 로 요청하면 user-2의 값이 나온다
  session.state.userId = "user-2";
  const own = await readJson<Summary>(await route.GET(jsonRequest("GET")));
  assert.equal(own.goal.targetMonthly, 7_777_777);
  assert.equal(own.taxCredit?.progress.creditableTotal, 6_000_000);
});

test("배우자 총급여 구간: 저장된 사용자 자신의 값으로 배우자 공제율을 계산한다", async () => {
  const spouseAccount = { ...account("s1", "배우자 연금저축", "pension_savings"), owner_type: "spouse" };
  data.accounts["user-1"] = [spouseAccount];
  data.contributions["user-1"] = [{ id: "c1", account_id: "s1", year: YEAR, amount: 6_000_000, memo: null, updated_at: "" }];
  data.goals["user-1"] = { ...emptyGoal, salaryBracket: "high", spouseSalaryBracket: null };
  // 다른 사용자는 배우자 구간을 'low'로 저장해 두었다 — user-1 계산에 섞이면 안 된다
  data.accounts["user-2"] = [{ ...spouseAccount, id: "s2" }];
  data.contributions["user-2"] = [{ id: "c2", account_id: "s2", year: YEAR, amount: 6_000_000, memo: null, updated_at: "" }];
  data.goals["user-2"] = { ...emptyGoal, spouseSalaryBracket: "low" };

  const missing = await readJson<Summary>(await route.GET(jsonRequest("GET")));
  assert.equal(missing.goal.spouseSalaryBracket, null);
  assert.ok(missing.taxCredit);
  assert.deepEqual(
    missing.taxCredit.byOwner.map((o) => [o.ownerType, o.salaryBracket, o.salaryBracketAssumed]),
    [["spouse", "high", true]]
  );
  assert.equal(missing.taxCredit.salaryBracketAssumed, true);

  data.goals["user-1"] = { ...emptyGoal, salaryBracket: "high", spouseSalaryBracket: "low" };
  const entered = await readJson<Summary>(await route.GET(jsonRequest("GET")));
  assert.ok(entered.taxCredit);
  const [spouse] = entered.taxCredit.byOwner;
  assert.equal(spouse.salaryBracket, "low");
  assert.equal(spouse.salaryBracketAssumed, false);
  assert.ok(spouse.progress.estimatedCredit > missing.taxCredit.byOwner[0].progress.estimatedCredit);
  assert.equal(entered.taxCredit.salaryBracketAssumed, false);

  session.state.userId = "user-2";
  const other = await readJson<Summary>(await route.GET(jsonRequest("GET")));
  assert.equal(other.goal.spouseSalaryBracket, "low");
  assert.equal(other.taxCredit?.byOwner[0].salaryBracket, "low", "user-2 는 자기 배우자 구간으로 계산");
  assert.equal(other.taxCredit?.salaryBracketAssumed, false, "배우자 명의 계좌만 있고 배우자 구간이 입력됨");
});
