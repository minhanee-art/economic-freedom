// 대시보드 서버 컴포넌트
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings, getCostBases, getProfile, getDividends, getDividendCalendar } from "@/lib/queries";
import { getOnboardingFacts } from "@/lib/onboarding";
import {
  buildOnboardingSteps,
  isOnboardingComplete,
  ONBOARDING_DONE_SEEN_COOKIE,
  ONBOARDING_HIDDEN_COOKIE,
  ONBOARDING_STARTED_COOKIE,
} from "@/lib/onboarding-steps";
import { FirstRunComplete, FirstRunGuide } from "@/components/onboarding/first-run-guide";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = { title: "홈 · 가족연금계획" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [holdings, costBases, profile, dividends, dividendCalendar, onboardingFacts, cookieStore] = await Promise.all([
    getHoldings(userId),
    getCostBases(userId),
    getProfile(userId),
    getDividends(userId),
    getDividendCalendar(userId).catch(() => []),
    // 안내를 못 그려도 홈은 떠야 한다
    getOnboardingFacts(userId).catch(() => null),
    cookies(),
  ]);
  const guideHidden = cookieStore.get(ONBOARDING_HIDDEN_COOKIE)?.value === "1";
  const complete = onboardingFacts !== null && isOnboardingComplete(onboardingFacts);
  const showFirstRunGuide = onboardingFacts !== null && !guideHidden && !complete;
  // 진행 중인 안내를 본 적이 있는 사람이 세 단계를 마쳤을 때만 한 번 보여 준다(기존 사용자에게는 나오지 않는다)
  const showFirstRunComplete =
    complete &&
    !guideHidden &&
    cookieStore.get(ONBOARDING_STARTED_COOKIE)?.value === "1" &&
    cookieStore.get(ONBOARDING_DONE_SEEN_COOKIE)?.value !== "1";

  const totalDividend = dividends.reduce((s, d) => s + Number(d.amount), 0);

  return (
    <DashboardClient
        firstRun={
          showFirstRunGuide && onboardingFacts ? (
            <FirstRunGuide steps={buildOnboardingSteps(onboardingFacts)} />
          ) : showFirstRunComplete ? (
            <FirstRunComplete />
          ) : null
        }
        initialHoldings={holdings}
        initialCostBases={costBases}
        monthlyBudget={profile?.monthly_budget ?? 0}
        totalDividend={totalDividend}
        dividendRecords={dividends.map((d) => ({ date: d.date, amount: Number(d.amount) }))}
        lastPriceUpdate={profile?.last_price_update ?? null}
        dividendCalendar={dividendCalendar}
      />
  );
}
