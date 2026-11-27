// 대시보드 서버 컴포넌트
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings, getCostBases, getProfile, getDividends, getDividendCalendar } from "@/lib/queries";
import { getOnboardingFacts } from "@/lib/onboarding";
import { buildOnboardingSteps, isOnboardingComplete, ONBOARDING_HIDDEN_COOKIE } from "@/lib/onboarding-steps";
import { FirstRunGuide } from "@/components/onboarding/first-run-guide";
import { DashboardClient } from "./dashboard-client";

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
  const showFirstRunGuide =
    onboardingFacts !== null &&
    cookieStore.get(ONBOARDING_HIDDEN_COOKIE)?.value !== "1" &&
    !isOnboardingComplete(onboardingFacts);

  const totalDividend = dividends.reduce((s, d) => s + Number(d.amount), 0);

  return (
    <div className="space-y-5 md:space-y-6">
      {showFirstRunGuide && onboardingFacts && <FirstRunGuide steps={buildOnboardingSteps(onboardingFacts)} />}
      <DashboardClient
        initialHoldings={holdings}
        initialCostBases={costBases}
        monthlyBudget={profile?.monthly_budget ?? 300000}
        totalDividend={totalDividend}
        dividendRecords={dividends.map((d) => ({ date: d.date, amount: Number(d.amount) }))}
        lastPriceUpdate={profile?.last_price_update ?? null}
        dividendCalendar={dividendCalendar}
      />
    </div>
  );
}
