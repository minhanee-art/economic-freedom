import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";
import { getCostBases, getDividendCalendar, getDividends, getHoldings, getProfile } from "@/lib/queries";
import { selectRequestAccount } from "@/lib/account-selection";
import { computeCategoryBalances, computeHoldingsWithPnL } from "@/lib/portfolio";
import { getRetirementGoal } from "@/lib/pension-data";

/** 은퇴 목표를 아직 저장하지 않은 사용자에게 보여줄 기본 목표 월 현금흐름 (기존 앱 화면 유지용) */
const DEFAULT_TARGET_MONTHLY_CASHFLOW = 3_000_000;

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // ?accountId= 또는 X-Portfolio-Account-Id — 소유하지 않은 계좌면 첫 계좌로 바꾸지 않고 404
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const { account, accounts } = selected;

  const [holdings, costBases, profile, dividends, dividendCalendar, retirementGoal] = await Promise.all([
    getHoldings(session.userId, account.id),
    getCostBases(session.userId, account.id),
    getProfile(session.userId),
    getDividends(session.userId, account.id),
    getDividendCalendar(session.userId, account.id).catch(() => []),
    getRetirementGoal(session.userId).catch(() => null),
  ]);

  const holdingsWithPnL = computeHoldingsWithPnL(holdings, costBases);
  const totalValue = holdingsWithPnL.reduce((sum, item) => sum + item.current_value, 0);
  const totalCost = holdingsWithPnL.reduce((sum, item) => sum + item.total_cost, 0);
  const totalDividend = dividends.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const expectedAnnualDividend = estimateAnnualDividend(dividends);
  const savedTarget = retirementGoal?.targetMonthly ?? null;
  const targetMonthlyCashflow = savedTarget ?? DEFAULT_TARGET_MONTHLY_CASHFLOW;

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
    /** true면 사용자가 저장한 목표가 없어 기본값을 보낸 것 */
    targetMonthlyCashflowIsDefault: savedTarget === null,
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
