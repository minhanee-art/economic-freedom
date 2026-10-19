// 매수 계획 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings, getCostBases, getProfile, getLastPurchaseDates } from "@/lib/queries";
import { BuyClient } from "./buy-client";

export const dynamic = "force-dynamic";

export default async function BuyPlanPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [holdings, costBases, profile, lastPurchaseDates] = await Promise.all([
    getHoldings(userId),
    getCostBases(userId),
    getProfile(userId),
    getLastPurchaseDates(userId),
  ]);

  return (
    <BuyClient
      initialHoldings={holdings}
      initialCostBases={costBases}
      defaultBudget={profile?.monthly_budget ?? 300000}
      lastPurchaseDates={lastPurchaseDates}
      userId={userId}
    />
  );
}
