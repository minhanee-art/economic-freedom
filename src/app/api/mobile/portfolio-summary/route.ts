import { NextResponse } from "next/server";
import { getBearerSession } from "@/lib/session";
import { getCostBases, getDividendCalendar, getDividends, getHoldings, getProfile } from "@/lib/queries";
import { getPortfolioAccounts } from "@/lib/portfolio-accounts";
import { computeCategoryBalances, computeHoldingsWithPnL } from "@/lib/portfolio";

export async function GET(request: Request) {
  const session = await getBearerSession(request);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const accounts = await getPortfolioAccounts(session.userId);
  const accountId = new URL(request.url).searchParams.get("accountId") ?? accounts[0]?.id;
  const account = accounts.find((item) => item.id === accountId) ?? accounts[0];
  if (!account) {
    return NextResponse.json({ error: "포트폴리오 계좌가 없습니다." }, { status: 404 });
  }

  const [holdings, costBases, profile, dividends, dividendCalendar] = await Promise.all([
    getHoldings(session.userId, account.id),
    getCostBases(session.userId, account.id),
    getProfile(session.userId),
    getDividends(session.userId, account.id),
    getDividendCalendar(session.userId, account.id).catch(() => []),
  ]);

  const holdingsWithPnL = computeHoldingsWithPnL(holdings, costBases);
  const totalValue = holdingsWithPnL.reduce((sum, item) => sum + item.current_value, 0);
  const totalCost = holdingsWithPnL.reduce((sum, item) => sum + item.total_cost, 0);
  const totalDividend = dividends.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const expectedAnnualDividend = estimateAnnualDividend(dividends);
  const targetMonthlyCashflow = 3_000_000;

  return NextResponse.json({
    account: {
      id: account.id,
      name: account.name,
      ownerType: account.owner_type,
    },
    accounts: accounts.map((item) => ({ id: item.id, name: item.name, ownerType: item.owner_type })),
    asOf: new Date().toISOString(),
    totalValue,
    totalCost,
    totalPnL,
    totalPnLPct,
    totalDividend,
    monthlyBudget: profile?.monthly_budget ?? 300000,
    targetMonthlyCashflow,
    expectedAnnualDividend,
    categories: computeCategoryBalances(holdingsWithPnL).map((item) => ({
      name: item.name,
      currentPct: item.current,
      targetPct: item.target,
      diffPct: item.diff,
    })),
    holdings: holdingsWithPnL.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      subCategory: item.sub_category,
      shares: item.shares,
      currentPrice: item.current_price,
      avgPrice: item.avg_price,
      currentValue: item.current_value,
      totalCost: item.total_cost,
      profitLoss: item.profit_loss,
      profitLossPct: item.profit_loss_pct,
      allocationPct: item.actual_pct,
      targetPct: item.target_pct,
    })),
    dividends: buildMonthlyDividends(dividends),
    dividendCalendar: dividendCalendar.slice(0, 10).map((item) => ({
      id: item.id,
      date: item.date,
      stock: item.stock,
      type: item.type,
      note: item.note,
    })),
  });
}

function estimateAnnualDividend(dividends: { amount: number; date: string }[]): number {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const trailingYear = dividends.filter((item) => new Date(item.date) >= oneYearAgo);
  return trailingYear.reduce((sum, item) => sum + Number(item.amount), 0);
}

function buildMonthlyDividends(dividends: { amount: number; date: string }[]) {
  const year = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const amount = dividends
      .filter((item) => {
        const date = new Date(item.date);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
      })
      .reduce((sum, item) => sum + Number(item.amount), 0);
    return { month: `${month}월`, amount };
  });
}
