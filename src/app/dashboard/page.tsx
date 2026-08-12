// 대시보드 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings, getCostBases, getProfile, getDividends, getDividendCalendar } from "@/lib/queries";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [holdings, costBases, profile, dividends, dividendCalendar] = await Promise.all([
    getHoldings(userId),
    getCostBases(userId),
    getProfile(userId),
    getDividends(userId),
    getDividendCalendar(userId),
  ]);

  const totalDividend = dividends.reduce((s, d) => s + Number(d.amount), 0);

  return (
    <DashboardClient
      initialHoldings={holdings}
      initialCostBases={costBases}
      monthlyBudget={profile?.monthly_budget ?? 300000}
      totalDividend={totalDividend}
      lastPriceUpdate={profile?.last_price_update ?? null}
      dividendCalendar={dividendCalendar}
    />
  );
}
