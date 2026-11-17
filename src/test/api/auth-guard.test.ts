import test, { before, mock } from "node:test";
import assert from "node:assert/strict";

import { createAccountsState, createFakeSql, createSessionState, jsonRequest } from "@/test/api-helpers";

const session = createSessionState(null);
const db = createFakeSql();
const accounts = createAccountsState();

mock.module("@/lib/session", { namedExports: session.namedExports });
mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/portfolio-accounts", { namedExports: accounts.namedExports });

type Case = { name: string; run: () => Promise<Response> };

const cases: Case[] = [];

before(async () => {
  const [
    me,
    holdings,
    watchlist,
    watchlistItem,
    accountsRoute,
    settings,
    dividends,
    dividendCalendar,
    trades,
    purchases,
    children,
    importRoute,
    portfolioReturns,
    mobileSummary,
  ] = await Promise.all([
    import("@/app/api/me/route"),
    import("@/app/api/holdings/route"),
    import("@/app/api/watchlist/route"),
    import("@/app/api/watchlist/[id]/route"),
    import("@/app/api/accounts/route"),
    import("@/app/api/settings/route"),
    import("@/app/api/dividends/route"),
    import("@/app/api/dividend-calendar/route"),
    import("@/app/api/trades/route"),
    import("@/app/api/purchases/route"),
    import("@/app/api/children/route"),
    import("@/app/api/import/route"),
    import("@/app/api/portfolio-returns/route"),
    import("@/app/api/mobile/portfolio-summary/route"),
  ]);

  const idParams = { params: Promise.resolve({ id: "item-1" }) };

  cases.push(
    { name: "GET /me", run: () => me.GET() },
    { name: "GET /holdings", run: () => holdings.GET() },
    { name: "POST /holdings", run: () => holdings.POST(jsonRequest("POST", { code: "305050", name: "ACE 코스피" })) },
    { name: "PATCH /holdings", run: () => holdings.PATCH(jsonRequest("PATCH", { id: "h1" })) },
    { name: "DELETE /holdings", run: () => holdings.DELETE(jsonRequest("DELETE", { id: "h1" })) },
    { name: "GET /watchlist", run: () => watchlist.GET() },
    { name: "POST /watchlist", run: () => watchlist.POST(jsonRequest("POST", { name: "테슬라", market: "US" })) },
    { name: "DELETE /watchlist/[id]", run: () => watchlistItem.DELETE(jsonRequest("DELETE"), idParams) },
    { name: "GET /accounts", run: () => accountsRoute.GET() },
    { name: "POST /accounts", run: () => accountsRoute.POST(jsonRequest("POST", { name: "새 계좌" })) },
    { name: "PATCH /accounts", run: () => accountsRoute.PATCH(jsonRequest("PATCH", { accountId: "acc-1" })) },
    { name: "PATCH /settings", run: () => settings.PATCH(jsonRequest("PATCH", { monthlyBudget: 100000 })) },
    { name: "DELETE /settings", run: () => settings.DELETE() },
    { name: "GET /dividends", run: () => dividends.GET() },
    { name: "POST /dividends", run: () => dividends.POST(jsonRequest("POST", { holdingId: "h1", amount: 1, date: "2026-01-01" })) },
    { name: "DELETE /dividends", run: () => dividends.DELETE(jsonRequest("DELETE", { id: "d1" })) },
    { name: "GET /dividend-calendar", run: () => dividendCalendar.GET() },
    { name: "POST /trades", run: () => trades.POST(jsonRequest("POST", { holdingId: "h1", action: "buy", quantity: 1, price: 1000 })) },
    { name: "GET /purchases", run: () => purchases.GET(jsonRequest("GET")) },
    { name: "GET /children", run: () => children.GET() },
    { name: "POST /import", run: () => importRoute.POST(jsonRequest("POST", {})) },
    { name: "GET /portfolio-returns", run: () => portfolioReturns.GET() },
    { name: "GET /mobile/portfolio-summary", run: () => mobileSummary.GET(jsonRequest("GET")) },
  );
});

test("인증 없이 호출하면 모든 보호 라우트가 401을 돌려준다", async (t) => {
  assert.ok(cases.length >= 20, `검사 대상 ${cases.length}개`);
  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const response = await testCase.run();
      assert.equal(response.status, 401, `${testCase.name} 상태 코드`);
      const body = await response.json();
      assert.equal(typeof body.error, "string");
    });
  }
});
