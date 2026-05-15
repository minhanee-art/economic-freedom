// 대시보드 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings, getCostBases, getProfile, getDividends } from "@/lib/queries";
import { DashboardClient } from "./dashboard-client";
import type { Holding, CostBasis } from "@/types";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [holdings, costBases, profile, dividends] = await Promise.all([
    getHoldings(userId),
    getCostBases(userId),
    getProfile(userId),
    getDividends(userId),
  ]);

  const totalDividend = (dividends as any[]).reduce(
    (s: number, d: any) => s + Number(d.amount),
    0
  );

  return (
    <DashboardClient
      initialHoldings={holdings as unknown as Holding[]}
      initialCostBases={costBases as unknown as CostBasis[]}
      monthlyBudget={(profile as any)?.monthly_budget ?? 300000}
      totalDividend={totalDividend}
      lastPriceUpdate={(profile as any)?.last_price_update ?? null}
    />
  );
}
