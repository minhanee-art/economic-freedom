import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

import { answerSessionVersion, createFakeSql, jsonRequest, readJson } from "@/test/api-helpers";
import type { CostBasis, Dividend, Holding } from "@/types";

process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";

// ── 스텁 ─────────────────────────────────────
// 토큰 검증 때 나가는 session_version 조회에 답한다(user-1은 버전 0)
const versions = new Map<string, number>();
const db = createFakeSql((query, values) => answerSessionVersion(query, values, versions) ?? []);
const rateLimit = { allow: true, keys: [] as string[] };

const accounts = [{ id: "acc-1", name: "기본 계좌", owner_type: "self" }];
const queriesCalls: { fn: string; args: unknown[] }[] = [];

const holdings: Holding[] = [
  {
    id: "h1",
    user_id: "user-1",
    account_id: "acc-1",
    code: "305050",
    name: "KODEX 200",
    category: "주식",
    sub_category: "국장",
    current_price: 10_000,
    shares: 10,
    target_pct: 50,
    expense_ratio: 0.15,
    created_at: "",
    updated_at: "",
  },
  {
    id: "h2",
    user_id: "user-1",
    account_id: "acc-1",
    code: "458730",
    name: "TIGER 미국배당",
    category: "주식",
    sub_category: "배당",
    current_price: 20_000,
    shares: 5,
    target_pct: 50,
    expense_ratio: 0.3,
    created_at: "",
    updated_at: "",
  },
];

const costBases: CostBasis[] = [
  { id: "cb1", user_id: "user-1", account_id: "acc-1", holding_id: "h1", total_cost: 90_000, total_shares: 10, updated_at: "" },
  { id: "cb2", user_id: "user-1", account_id: "acc-1", holding_id: "h2", total_cost: 110_000, total_shares: 5, updated_at: "" },
];

const now = new Date();
const thisYear = now.getFullYear();
const dividends: Dividend[] = [
  { id: "d1", user_id: "user-1", account_id: "acc-1", holding_id: "h1", amount: 5_000, date: `${thisYear}-02-10`, memo: null, created_at: "" },
  { id: "d2", user_id: "user-1", account_id: "acc-1", holding_id: "h2", amount: 3_000, date: `${thisYear - 3}-02-10`, memo: null, created_at: "" },
];

mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/rate-limit", {
  namedExports: {
    authRateLimit: async (key: string) => {
      rateLimit.keys.push(key);
      return rateLimit.allow;
    },
    clientIp: () => "127.0.0.1",
  },
});
mock.module("@/lib/portfolio-accounts", {
  namedExports: {
    ACCOUNT_COOKIE: "pension-account",
    getPortfolioAccounts: async (userId: string) => {
      queriesCalls.push({ fn: "getPortfolioAccounts", args: [userId] });
      return accounts;
    },
    getActivePortfolioAccountId: async () => accounts[0]?.id ?? null,
  },
});
const retirement = { goal: null as { targetMonthly: number | null } | null };
mock.module("@/lib/pension-data", {
  namedExports: {
    getRetirementGoal: async () => retirement.goal,
  },
});
mock.module("@/lib/queries", {
  namedExports: {
    getHoldings: async (userId: string, accountId: string) => {
      queriesCalls.push({ fn: "getHoldings", args: [userId, accountId] });
      return holdings;
    },
    getCostBases: async (userId: string, accountId: string) => {
      queriesCalls.push({ fn: "getCostBases", args: [userId, accountId] });
      return costBases;
    },
    getProfile: async (userId: string) => {
      queriesCalls.push({ fn: "getProfile", args: [userId] });
      return { id: userId, email: "a@b.com", display_name: "민한", monthly_budget: 500_000 };
    },
    getDividends: async (userId: string, accountId: string) => {
      queriesCalls.push({ fn: "getDividends", args: [userId, accountId] });
      return dividends;
    },
    getDividendCalendar: async (userId: string, accountId: string) => {
      queriesCalls.push({ fn: "getDividendCalendar", args: [userId, accountId] });
      return Array.from({ length: 12 }, (_, index) => ({
        id: `cal-${index}`,
        date: `${thisYear}-01-0${(index % 9) + 1}`,
        stock: "KODEX 200",
        type: "배당",
        note: null,
      }));
    },
  },
});

let login: typeof import("@/app/api/mobile/auth/login/route");
let summary: typeof import("@/app/api/mobile/portfolio-summary/route");
let signToken: typeof import("@/lib/session").signToken;

before(async () => {
  const session = await import("@/lib/session");
  signToken = session.signToken;
  [login, summary] = await Promise.all([
    import("@/app/api/mobile/auth/login/route"),
    import("@/app/api/mobile/portfolio-summary/route"),
  ]);
});

beforeEach(() => {
  db.reset();
  versions.clear();
  versions.set("user-1", 0);
  rateLimit.allow = true;
  rateLimit.keys.length = 0;
  queriesCalls.length = 0;
  retirement.goal = null;
});

// ── mobile 로그인 ────────────────────────────
test("mobile 로그인: 값이 없으면 400", async () => {
  const response = await login.POST(jsonRequest("POST", { email: "a@b.com" }));
  assert.equal(response.status, 400);
});

test("mobile 로그인: 시도가 많으면 429", async () => {
  rateLimit.allow = false;

  const response = await login.POST(jsonRequest("POST", { email: "a@b.com", password: "secret123" }));
  assert.equal(response.status, 429);
});

test("mobile 로그인: 없는 계정이나 비밀번호 불일치는 401", async () => {
  db.setHandler(() => []);
  assert.equal(
    (await login.POST(jsonRequest("POST", { email: "none@b.com", password: "secret123" }))).status,
    401
  );

  const hash = await bcrypt.hash("right-password", 4);
  db.setHandler(() => [{ id: "user-1", password_hash: hash, session_version: 0, display_name: "민한" }]);
  assert.equal(
    (await login.POST(jsonRequest("POST", { email: "a@b.com", password: "wrong" }))).status,
    401
  );
});

test("mobile 로그인: 성공하면 토큰을 본문으로 돌려준다", async () => {
  const hash = await bcrypt.hash("right-password", 4);
  db.setHandler(() => [{ id: "user-1", password_hash: hash, session_version: 2, display_name: "민한" }]);

  const response = await login.POST(
    jsonRequest("POST", { email: " A@B.com ", password: "right-password" })
  );
  assert.equal(response.status, 200);

  const body = await readJson<{ ok: boolean; token: string; user: { email: string; displayName: string } }>(response);
  assert.equal(body.ok, true);
  assert.ok(body.token.split(".").length === 3, "JWT 형식");
  assert.equal(body.user.email, "a@b.com", "소문자 정규화");
  assert.equal(body.user.displayName, "민한");
  assert.equal(response.headers.get("set-cookie"), null, "앱 로그인은 쿠키를 쓰지 않는다");
  assert.ok(rateLimit.keys[0]?.includes("mobile-login:"));
  // 토큰에 현재 세션 버전을 담는다
  const { decodeJwt } = await import("jose");
  assert.equal(decodeJwt(body.token).sv, 2);
});

// ── mobile 포트폴리오 요약 ───────────────────
test("summary: Bearer 토큰이 없으면 401", async () => {
  const response = await summary.GET(new Request("https://pension.test/api/mobile/portfolio-summary"));
  assert.equal(response.status, 401);
});

test("summary: 계좌가 없으면 404", async () => {
  accounts.length = 0;
  const token = await signToken("user-1", 0);

  try {
    const response = await summary.GET(
      new Request("https://pension.test/api/mobile/portfolio-summary", {
        headers: { authorization: `Bearer ${token}` },
      })
    );
    assert.equal(response.status, 404);
  } finally {
    accounts.push({ id: "acc-1", name: "기본 계좌", owner_type: "self" });
  }
});

test("summary: 합계·손익·카테고리·배당을 계산한다", async () => {
  const token = await signToken("user-1", 0);

  const response = await summary.GET(
    new Request("https://pension.test/api/mobile/portfolio-summary", {
      headers: { authorization: `Bearer ${token}` },
    })
  );
  assert.equal(response.status, 200);

  const body = await readJson<{
    account: { id: string; name: string; ownerType: string };
    totalValue: number;
    totalCost: number;
    totalPnL: number;
    totalPnLPct: number;
    totalDividend: number;
    monthlyBudget: number;
    targetMonthlyCashflow: number;
    expectedAnnualDividend: number;
    categories: unknown[];
    holdings: { code: string; currentValue: number; profitLoss: number; allocationPct: number }[];
    dividends: { month: string; amount: number }[];
    dividendCalendar: unknown[];
  }>(response);

  assert.equal(body.account.id, "acc-1");
  assert.equal(body.account.ownerType, "self");
  assert.equal(body.totalValue, 200_000);
  assert.equal(body.totalCost, 200_000);
  assert.equal(body.totalPnL, 0);
  assert.equal(body.totalPnLPct, 0);
  assert.equal(body.totalDividend, 8_000);
  assert.equal(body.monthlyBudget, 500_000);
  assert.equal(body.targetMonthlyCashflow, 3_000_000);
  assert.equal(body.expectedAnnualDividend, 5_000, "1년 이내 배당만");
  assert.equal(body.holdings.length, 2);
  assert.equal(body.holdings[0].currentValue, 100_000);
  assert.equal(body.holdings[0].profitLoss, 10_000);
  assert.equal(body.holdings[0].allocationPct, 50);
  assert.equal(body.dividends.length, 12);
  assert.equal(body.dividends[1].amount, 5_000, "2월 배당");
  assert.equal(body.dividendCalendar.length, 10, "달력은 10건으로 자른다");
  assert.deepEqual(queriesCalls.find((call) => call.fn === "getHoldings")?.args, ["user-1", "acc-1"]);
});

test("summary: accountId 쿼리로 다른 계좌를 지정한다", async () => {
  const token = await signToken("user-1", 0);
  accounts.push({ id: "acc-2", name: "자녀 계좌", owner_type: "child" });

  try {
    const body = await readJson<{ account: { id: string } }>(
      await summary.GET(
        new Request("https://pension.test/api/mobile/portfolio-summary?accountId=acc-2", {
          headers: { authorization: `Bearer ${token}` },
        })
      )
    );
    assert.equal(body.account.id, "acc-2");
    assert.deepEqual(queriesCalls.find((call) => call.fn === "getHoldings")?.args, ["user-1", "acc-2"]);
  } finally {
    accounts.pop();
  }
});

const summaryRequest = (token: string, url = "https://pension.test/api/mobile/portfolio-summary", headers: Record<string, string> = {}) =>
  new Request(url, { headers: { authorization: `Bearer ${token}`, ...headers } });

test("summary: X-Portfolio-Account-Id 헤더로 계좌를 지정한다", async () => {
  const token = await signToken("user-1", 0);
  accounts.push({ id: "acc-2", name: "자녀 계좌", owner_type: "child" });
  try {
    const response = await summary.GET(summaryRequest(token, undefined, { "x-portfolio-account-id": "acc-2" }));
    assert.equal((await readJson<{ account: { id: string } }>(response)).account.id, "acc-2");
    assert.deepEqual(queriesCalls.find((call) => call.fn === "getHoldings")?.args, ["user-1", "acc-2"]);
  } finally {
    accounts.pop();
  }
});

test("summary: 소유하지 않은 계좌를 지정하면 첫 계좌로 바꾸지 않고 404", async () => {
  const token = await signToken("user-1", 0);
  for (const request of [
    summaryRequest(token, "https://pension.test/api/mobile/portfolio-summary?accountId=acc-other"),
    summaryRequest(token, undefined, { "x-portfolio-account-id": "acc-other" }),
  ]) {
    const response = await summary.GET(request);
    assert.equal(response.status, 404);
    assert.match((await readJson<{ error: string }>(response)).error, /계좌를 찾을 수 없습니다/);
  }
  assert.equal(queriesCalls.filter((call) => call.fn === "getHoldings").length, 0, "데이터 조회 없음");
});

test("summary: 헤더와 쿼리가 서로 다른 계좌면 400", async () => {
  const token = await signToken("user-1", 0);
  const response = await summary.GET(
    summaryRequest(token, "https://pension.test/api/mobile/portfolio-summary?accountId=acc-1", {
      "x-portfolio-account-id": "acc-2",
    })
  );
  assert.equal(response.status, 400);
});

test("summary: 폐기된 토큰(세션 버전 변경)이나 삭제된 사용자의 토큰은 401", async () => {
  const token = await signToken("user-1", 0);
  versions.set("user-1", 1);
  assert.equal((await summary.GET(summaryRequest(token))).status, 401);
  versions.delete("user-1");
  assert.equal((await summary.GET(summaryRequest(token))).status, 401);
  assert.equal(queriesCalls.length, 0);
});

test("summary: 저장한 은퇴 목표 월 생활비를 targetMonthlyCashflow로 보낸다", async () => {
  const token = await signToken("user-1", 0);
  const request = () =>
    new Request("https://pension.test/api/mobile/portfolio-summary", {
      headers: { authorization: `Bearer ${token}` },
    });

  retirement.goal = { targetMonthly: 4_200_000 };
  const saved = await readJson<{ targetMonthlyCashflow: number; targetMonthlyCashflowIsDefault: boolean }>(
    await summary.GET(request())
  );
  assert.equal(saved.targetMonthlyCashflow, 4_200_000);
  assert.equal(saved.targetMonthlyCashflowIsDefault, false);

  retirement.goal = { targetMonthly: null };
  const unset = await readJson<{ targetMonthlyCashflow: number; targetMonthlyCashflowIsDefault: boolean }>(
    await summary.GET(request())
  );
  assert.equal(unset.targetMonthlyCashflow, 3_000_000, "미설정이면 기존 기본값");
  assert.equal(unset.targetMonthlyCashflowIsDefault, true);
});
