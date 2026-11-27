// 매수 계획 서버 컴포넌트
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings, getCostBases, getProfile, getLastPurchaseDates } from "@/lib/queries";
import { NoHoldingsState } from "@/components/portfolio/no-holdings-state";
import { BuyClient } from "./buy-client";

export const metadata: Metadata = { title: "적립 배분 계산 · 가족연금계획" };

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

  if (holdings.length === 0) {
    return (
      <NoHoldingsState pageTitle="적립 배분 계산" description="적립 배분 계산은 내가 추가한 종목과 직접 정한 목표 비중으로 월 적립금을 나눠 보는 계산기입니다. 종목을 먼저 추가하면 이 화면에서 계산할 수 있습니다." />
    );
  }

  return (
    <BuyClient
      initialHoldings={holdings}
      initialCostBases={costBases}
      defaultBudget={profile?.monthly_budget ?? 0}
      lastPurchaseDates={lastPurchaseDates}
      userId={userId}
    />
  );
}
