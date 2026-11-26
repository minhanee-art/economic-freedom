// 사용자 API 라우트 인증 통합 테스트 — 세션 모듈을 스텁하지 않고 실제 JWT로 검증한다.
// 쿠키(웹)·Bearer(모바일)·무인증·타 사용자 데이터 접근 차단을 라우트 단위로 확인한다.
import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { answerSessionVersion, authRequest, createFakeSql, readJson, type AuthOptions } from "@/test/api-helpers";

process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";

const USER_A = "user-a";
const USER_B = "user-b";

// ── 스텁: DB와 계좌 모듈만 바꾼다(세션은 실제 구현) ─────────────
// 사용자 A만 데이터를 가진 가짜 DB — 쿼리 값에 A의 id가 있을 때만 행을 돌려준다.
const db = createFakeSql();
// 토큰 폐기 확인용 users.session_version — 표에 없는 사용자는 삭제된 사용자
const versions = new Map<string, number>();
function ownerAwareHandler(query: string, values: unknown[]) {
  const version = answerSessionVersion(query, values, versions);
  if (version) return version;
  if (query.includes("COUNT(*)")) return [{ count: values.includes(USER_A) ? 1 : 0 }];
  if (query.includes("FROM portfolio_accounts")) {
    // 계좌 id와 소유자가 맞을 때만 돌려준다
    const owner = Object.keys(accountsByUser).find((userId) => values.includes(userId));
    const account = owner ? accountsByUser[owner].find((item) => values.includes(item.id)) : undefined;
    return account ? [{ ...account, telegram_chat_id: null }] : [];
  }
  const ownedByA = values.includes(USER_A);
  if (!ownedByA) return [];
  if (query.includes("FROM watchlist")) {
    return [{ id: "w-a", name: "A의 관심종목", code: "005930", market: "KR", created_at: "" }];
  }
  if (query.includes("UPDATE children")) {
    return [{ id: "child-a", name: "A의 자녀", birth_date: "2020-01-01", created_at: "" }];
  }
  if (query.includes("FROM children")) {
    return [{ id: "child-a", name: "A의 자녀", birth_date: "2020-01-01", created_at: "" }];
  }
  return [];
}

const accountLookups: string[] = [];
const accountsByUser: Record<string, { id: string; name: string; owner_type: string }[]> = {
  [USER_A]: [{ id: "acc-a", name: "A 계좌", owner_type: "self" }],
  [USER_B]: [{ id: "acc-b", name: "B 계좌", owner_type: "self" }],
};

mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/portfolio-accounts", {
  namedExports: {
    ACCOUNT_COOKIE: "pension-account",
    ACCOUNT_MAX_AGE: 60,
    getActivePortfolioAccountId: async (userId: string) => {
      accountLookups.push(userId);
      return accountsByUser[userId]?.[0]?.id ?? "acc-none";
    },
    getPortfolioAccounts: async (userId: string) => {
      accountLookups.push(userId);
      return accountsByUser[userId] ?? [];
    },
    createPortfolioAccount: async (userId: string, name: string, ownerType: string) => {
      accountLookups.push(userId);
      return { id: "acc-new", name, ownerType };
    },
  },
});

let signToken: typeof import("@/lib/session").signToken;
let tokenA = "";
let tokenB = "";

type RouteCase = { name: string; run: (auth: AuthOptions) => Promise<Response> };
const routes: RouteCase[] = [];

before(async () => {
  const session = await import("@/lib/session");
  signToken = session.signToken;
  tokenA = await signToken(USER_A, 0);
  tokenB = await signToken(USER_B, 0);

  const [
    holdings,
    watchlist,
    watchlistItem,
    accounts,
    settings,
    priceUpdate,
    dangerPurchases,
    dangerDividends,
    dividends,
    dividendsBatch,
    dividendCalendar,
    dividendCalendarItem,
    trades,
    purchases,
    children,
    child,
    childGifts,
    childGift,
    childHoldings,
    childHolding,
    importRoute,
    portfolioReturns,
    etfDividend,
    mobileSummary,
  ] = await Promise.all([
    import("@/app/api/holdings/route"),
    import("@/app/api/watchlist/route"),
    import("@/app/api/watchlist/[id]/route"),
    import("@/app/api/accounts/route"),
    import("@/app/api/settings/route"),
    import("@/app/api/settings/price-update/route"),
    import("@/app/api/danger/purchases/route"),
    import("@/app/api/danger/dividends/route"),
    import("@/app/api/dividends/route"),
    import("@/app/api/dividends/batch/route"),
    import("@/app/api/dividend-calendar/route"),
    import("@/app/api/dividend-calendar/[id]/route"),
    import("@/app/api/trades/route"),
    import("@/app/api/purchases/route"),
    import("@/app/api/children/route"),
    import("@/app/api/children/[id]/route"),
    import("@/app/api/children/[id]/gifts/route"),
    import("@/app/api/children/[id]/gifts/[gid]/route"),
    import("@/app/api/children/[id]/holdings/route"),
    import("@/app/api/children/[id]/holdings/[hid]/route"),
    import("@/app/api/import/route"),
    import("@/app/api/portfolio-returns/route"),
    import("@/app/api/market/etf-dividend/route"),
    import("@/app/api/mobile/portfolio-summary/route"),
  ]);

  const id = { params: Promise.resolve({ id: "item-1" }) };
  const childId = { params: Promise.resolve({ id: "child-a" }) };
  const giftId = { params: Promise.resolve({ id: "child-a", gid: "gift-1" }) };
  const holdingId = { params: Promise.resolve({ id: "child-a", hid: "ch-1" }) };
  const req = (method: string, auth: AuthOptions, body?: unknown, url?: string) =>
    authRequest(method, { ...auth, body, url: url ?? auth.url });

  routes.push(
    { name: "GET /holdings", run: (a) => holdings.GET(req("GET", a)) },
    { name: "DELETE /holdings", run: (a) => holdings.DELETE(req("DELETE", a, { id: "h1" })) },
    { name: "GET /watchlist", run: (a) => watchlist.GET(req("GET", a)) },
    { name: "DELETE /watchlist/[id]", run: (a) => watchlistItem.DELETE(req("DELETE", a), id) },
    { name: "GET /accounts", run: (a) => accounts.GET(req("GET", a)) },
    { name: "PATCH /settings", run: (a) => settings.PATCH(req("PATCH", a, { monthlyBudget: 100000 })) },
    { name: "POST /settings/price-update", run: (a) => priceUpdate.POST(req("POST", a)) },
    { name: "DELETE /danger/purchases", run: (a) => dangerPurchases.DELETE(req("DELETE", a)) },
    { name: "DELETE /danger/dividends", run: (a) => dangerDividends.DELETE(req("DELETE", a)) },
    { name: "GET /dividends", run: (a) => dividends.GET(req("GET", a)) },
    { name: "DELETE /dividends", run: (a) => dividends.DELETE(req("DELETE", a, { id: "d1" })) },
    { name: "POST /dividends/batch", run: (a) => dividendsBatch.POST(req("POST", a, { items: [] })) },
    { name: "GET /dividend-calendar", run: (a) => dividendCalendar.GET(req("GET", a)) },
    { name: "DELETE /dividend-calendar/[id]", run: (a) => dividendCalendarItem.DELETE(req("DELETE", a), id) },
    { name: "POST /trades", run: (a) => trades.POST(req("POST", a, { holdingId: "h1", action: "buy", quantity: 1, price: 1000 })) },
    { name: "GET /purchases", run: (a) => purchases.GET(req("GET", a)) },
    { name: "GET /children", run: (a) => children.GET(req("GET", a)) },
    { name: "PATCH /children/[id]", run: (a) => child.PATCH(req("PATCH", a, { name: "새 이름" }), childId) },
    { name: "DELETE /children/[id]", run: (a) => child.DELETE(req("DELETE", a), childId) },
    { name: "GET /children/[id]/gifts", run: (a) => childGifts.GET(req("GET", a), childId) },
    { name: "DELETE /children/[id]/gifts/[gid]", run: (a) => childGift.DELETE(req("DELETE", a), giftId) },
    { name: "GET /children/[id]/holdings", run: (a) => childHoldings.GET(req("GET", a), childId) },
    { name: "DELETE /children/[id]/holdings/[hid]", run: (a) => childHolding.DELETE(req("DELETE", a), holdingId) },
    { name: "POST /import", run: (a) => importRoute.POST(req("POST", a, { items: [] })) },
    { name: "GET /portfolio-returns", run: (a) => portfolioReturns.GET(req("GET", a)) },
    { name: "GET /market/etf-dividend", run: (a) => etfDividend.GET(req("GET", a, undefined, "https://pension.test/api/market/etf-dividend")) },
    { name: "GET /mobile/portfolio-summary", run: (a) => mobileSummary.GET(req("GET", a)) },
  );
});

beforeEach(() => {
  db.reset();
  db.setHandler(ownerAwareHandler);
  accountLookups.length = 0;
  versions.clear();
  versions.set(USER_A, 0);
  versions.set(USER_B, 0);
});

/** 이 요청 처리 중 라우트가 참조한 사용자 id 집합(SQL 값 + 계좌 조회) */
function referencedUsers(): Set<string> {
  const ids = new Set<string>(accountLookups);
  for (const call of db.calls) {
    const values = call.query === "<transaction>" ? [] : call.values;
    for (const value of values) {
      if (value === USER_A || value === USER_B) ids.add(value);
    }
  }
  return ids;
}

test("무인증 요청은 모든 사용자 API에서 401이고 DB를 건드리지 않는다", async (t) => {
  assert.ok(routes.length >= 25, `검사 대상 ${routes.length}개`);
  for (const route of routes) {
    await t.test(route.name, async () => {
      db.reset();
      const response = await route.run({});
      assert.equal(response.status, 401);
      assert.equal(typeof (await readJson(response)).error, "string");
      assert.equal(db.calls.length, 0, "인증 전 쿼리 실행 금지");
    });
  }
});

test("변조·타 비밀키 토큰은 쿠키든 Bearer든 401", async (t) => {
  const { SignJWT } = await import("jose");
  const foreign = await new SignJWT({ sub: USER_A })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("another-secret"));
  for (const route of routes) {
    await t.test(route.name, async () => {
      assert.equal((await route.run({ cookie: `${tokenA}x` })).status, 401);
      assert.equal((await route.run({ bearer: foreign })).status, 401);
    });
  }
});

for (const mode of ["cookie", "bearer"] as const) {
  test(`${mode} 인증: 모든 사용자 API가 토큰 주인의 데이터로만 동작한다`, async (t) => {
    for (const route of routes) {
      await t.test(route.name, async () => {
        db.reset();
        db.setHandler(ownerAwareHandler);
        accountLookups.length = 0;
        const response = await route.run({ [mode]: tokenB });
        assert.notEqual(response.status, 401, `${route.name} 상태 ${response.status}`);
        if (response.status >= 500) assert.fail(`${route.name} 상태 ${response.status}: ${JSON.stringify(await readJson(response))}`);
        const users = referencedUsers();
        assert.ok(!users.has(USER_A), "다른 사용자 id로 조회하면 안 된다");
        // 입력 검증에서 일찍 끝나는 라우트(예: 빈 목록)는 조회가 없을 수 있다.
        if (users.size > 0) assert.deepEqual([...users], [USER_B]);
      });
    }
  });
}

// ── 타 사용자 데이터 접근 차단 (구체 시나리오) ──────────────

test("Bearer: 사용자 B는 A의 관심종목을 볼 수 없다", async () => {
  const watchlist = await import("@/app/api/watchlist/route");

  const asA = await watchlist.GET(authRequest("GET", { bearer: tokenA }));
  assert.equal((await readJson<unknown[]>(asA)).length, 1);

  const asB = await watchlist.GET(authRequest("GET", { bearer: tokenB }));
  assert.deepEqual(await readJson(asB), []);
});

test("Bearer: 사용자 B가 A의 자녀를 수정하면 404", async () => {
  const child = await import("@/app/api/children/[id]/route");
  const params = { params: Promise.resolve({ id: "child-a" }) };

  const asB = await child.PATCH(authRequest("PATCH", { bearer: tokenB, body: { name: "탈취" } }), params);
  assert.equal(asB.status, 404);
  const update = db.find("UPDATE children");
  assert.equal(update.length, 1);
  assert.ok(update[0].values.includes(USER_B));
  assert.ok(!update[0].values.includes(USER_A));

  const asA = await child.PATCH(authRequest("PATCH", { cookie: tokenA, body: { name: "새 이름" } }), params);
  assert.equal(asA.status, 200);
});

test("Bearer: 모바일 요약에서 남의 accountId를 지정하면 404이고 A의 데이터를 조회하지 않는다", async () => {
  const summary = await import("@/app/api/mobile/portfolio-summary/route");
  const response = await summary.GET(
    authRequest("GET", { bearer: tokenB, url: "https://pension.test/api/mobile/portfolio-summary?accountId=acc-a" })
  );
  assert.equal(response.status, 404);
  assert.ok(!referencedUsers().has(USER_A));
});

test("쿠키와 Bearer가 함께 오면 쿠키 사용자로 처리한다", async () => {
  const watchlist = await import("@/app/api/watchlist/route");
  const response = await watchlist.GET(authRequest("GET", { cookie: tokenA, bearer: tokenB }));
  assert.equal((await readJson<unknown[]>(response)).length, 1);
  assert.deepEqual([...referencedUsers()], [USER_A]);
});

// ── 토큰 폐기: 모든 사용자 API ─────────────────────────

test("세션 버전이 바뀐(비밀번호 변경·Google 연결로 폐기된) 토큰은 모든 사용자 API에서 401", async (t) => {
  for (const route of routes) {
    await t.test(route.name, async () => {
      versions.set(USER_B, 1);
      for (const mode of ["cookie", "bearer"] as const) {
        const response = await route.run({ [mode]: tokenB });
        assert.equal(response.status, 401, mode);
      }
      // 세션 버전 조회 외에는 아무 쿼리도 실행하지 않는다
      assert.ok(db.calls.length > 0);
      assert.ok(db.calls.every((call) => call.query.startsWith("SELECT session_version FROM users")));
    });
  }
});

test("삭제된 사용자의 토큰은 모든 사용자 API에서 401", async (t) => {
  for (const route of routes) {
    await t.test(route.name, async () => {
      versions.delete(USER_B);
      assert.equal((await route.run({ bearer: tokenB })).status, 401);
      assert.ok(db.calls.every((call) => call.query.startsWith("SELECT session_version FROM users")));
    });
  }
});

// ── Bearer 클라이언트의 계좌 지정(헤더/쿼리) — 소유권 검증 ─────────────

const ACCOUNT_SCOPED = new Set([
  "GET /holdings",
  "DELETE /holdings",
  "GET /watchlist",
  "GET /accounts",
  "DELETE /danger/purchases",
  "DELETE /danger/dividends",
  "GET /dividends",
  "DELETE /dividends",
  "POST /dividends/batch",
  "GET /dividend-calendar",
  "DELETE /dividend-calendar/[id]",
  "POST /trades",
  "GET /purchases",
  "POST /import",
  "GET /portfolio-returns",
  "GET /mobile/portfolio-summary",
]);

/** SQL 값에 특정 계좌 id가 쓰였는지 */
function usedAccount(accountId: string): boolean {
  return db.calls.some((call) => call.query !== "<transaction>" && call.values.includes(accountId));
}

for (const via of ["header", "query"] as const) {
  const withAccount = (auth: AuthOptions, accountId: string): AuthOptions =>
    via === "header"
      ? { ...auth, headers: { "x-portfolio-account-id": accountId } }
      : { ...auth, url: `https://pension.test/api/route?accountId=${accountId}` };

  test(`계좌 지정(${via}): 남의 계좌 id면 계좌 범위 API가 404이고 그 계좌로 쿼리하지 않는다`, async (t) => {
    const scoped = routes.filter((route) => ACCOUNT_SCOPED.has(route.name));
    assert.equal(scoped.length, ACCOUNT_SCOPED.size, "목록의 라우트가 모두 있어야 한다");
    for (const route of scoped) {
      await t.test(route.name, async () => {
        db.reset();
        db.setHandler(ownerAwareHandler);
        accountLookups.length = 0;
        const response = await route.run(withAccount({ bearer: tokenB }, "acc-a"));
        assert.equal(response.status, 404, `${route.name} 상태 ${response.status}`);
        assert.ok(!usedAccount("acc-a"), "남의 계좌 id로 쿼리하면 안 된다");
        assert.ok(!referencedUsers().has(USER_A));
      });
    }
  });

  test(`계좌 지정(${via}): 자기 계좌 id면 그 계좌로 동작한다`, async (t) => {
    for (const route of routes.filter((item) => ACCOUNT_SCOPED.has(item.name))) {
      await t.test(route.name, async () => {
        db.reset();
        db.setHandler(ownerAwareHandler);
        const response = await route.run(withAccount({ bearer: tokenB }, "acc-b"));
        assert.notEqual(response.status, 401);
        assert.ok(response.status < 500, `${route.name} 상태 ${response.status}`);
        const body = await readJson<{ error?: string }>(response.clone());
        assert.doesNotMatch(String(body?.error ?? ""), /^(계좌를 찾을 수 없습니다|포트폴리오 계좌가 없습니다)/, "계좌 선택에서 거절되면 안 된다");
        if (db.calls.some((call) => call.query.includes("account_id"))) assert.ok(usedAccount("acc-b"), "지정한 계좌로 쿼리");
      });
    }
  });
}

test("계좌 지정: 헤더와 쿼리가 다르면 400", async () => {
  const holdings = await import("@/app/api/holdings/route");
  const response = await holdings.GET(
    authRequest("GET", {
      bearer: tokenB,
      url: "https://pension.test/api/holdings?accountId=acc-b",
      headers: { "x-portfolio-account-id": "acc-a" },
    })
  );
  assert.equal(response.status, 400);
  assert.ok(!usedAccount("acc-a"));
});

test("계좌 지정: GET /accounts는 지정한 계좌를 activeAccountId로 돌려준다", async () => {
  accountsByUser[USER_B].push({ id: "acc-b2", name: "B 자녀", owner_type: "child" });
  try {
    const accounts = await import("@/app/api/accounts/route");
    const response = await accounts.GET(
      authRequest("GET", { bearer: tokenB, headers: { "x-portfolio-account-id": "acc-b2" } })
    );
    const body = await readJson<{ activeAccountId: string; accounts: { id: string }[] }>(response);
    assert.equal(body.activeAccountId, "acc-b2");
    assert.deepEqual(body.accounts.map((item) => item.id), ["acc-b", "acc-b2"]);
  } finally {
    accountsByUser[USER_B].pop();
  }
});
