// 매수 계획 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings, getCostBases, getProfile } from "@/lib/queries";
import { BuyClient } from "./buy-client";
import type { Holding, CostBasis } from "@/types";

export default async function BuyPlanPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [holdings, costBases, profile] = await Promise.all([
    getHoldings(userId),
    getCostBases(userId),
    getProfile(userId),
  ]);

  return (
    <BuyClient
      initialHoldings={holdings as unknown as Holding[]}
      initialCostBases={costBases as unknown as CostBasis[]}
      defaultBudget={(profile as any)?.monthly_budget ?? 300000}
      userId={userId}
    />
  );
}
