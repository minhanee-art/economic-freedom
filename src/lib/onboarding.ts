// 홈 첫 사용 안내 — 완료 여부를 기존 데이터에서 읽는다(서버 전용).
import { sql } from "@/lib/db";
import { getPortfolioAccounts } from "@/lib/portfolio-accounts";
import { isPensionAccountType, normalizeAccountType } from "@/lib/account-types";
import { getRetirementGoal } from "@/lib/pension-data";
import type { OnboardingFacts } from "@/lib/onboarding-steps";

export async function getOnboardingFacts(userId: string): Promise<OnboardingFacts> {
  const [accounts, goal, [row]] = await Promise.all([
    getPortfolioAccounts(userId),
    getRetirementGoal(userId),
    sql`
      SELECT EXISTS (SELECT 1 FROM holdings WHERE user_id = ${userId}) AS has_holdings,
             (EXISTS (SELECT 1 FROM purchase_records WHERE user_id = ${userId})
               OR EXISTS (SELECT 1 FROM holdings WHERE user_id = ${userId} AND shares > 0)) AS has_purchase
    `,
  ]);
  return {
    hasPensionAccount: accounts.some((account) => isPensionAccountType(normalizeAccountType(account.account_type))),
    hasHoldings: Boolean(row?.has_holdings),
    hasPurchase: Boolean(row?.has_purchase),
    hasRetirementGoal: goal?.targetMonthly != null,
  };
}
