// 연금 설계 요약 — 모바일 앱(GET /api/pension/summary)용.
// 계산은 웹 /dashboard/retirement 와 같은 순수 함수(computeTaxCreditProgress, computeRetirementCashflow)를 쓴다.
// 입력이 비면 값을 지어내지 않고 null 과 이유 코드를 내려준다. 모든 금액은 참고용 추정치(원, 세전)다.
import { isPensionAccountType } from "@/lib/account-types";
import type { AccountSnapshotRow, ContributionRow, IncomeSourceRow, RetirementGoalRow } from "@/lib/pension-data";
import {
  computeRetirementCashflow,
  computeTaxCreditProgress,
  type RetirementCashflow,
  type TaxCreditProgress,
} from "@/lib/pension-planning";
import {
  getPensionRules,
  pensionIncomeTaxRate,
  unverifiedRuleTopics,
  type SalaryBracket,
} from "@/lib/pension-rules";

export type PensionSummaryInput = {
  year: number;
  asOf: string;
  accounts: AccountSnapshotRow[];
  contributions: ContributionRow[];
  sources: IncomeSourceRow[];
  goal: RetirementGoalRow | null;
};

export type TaxCreditUnavailableReason = "no_pension_accounts";
export type CashflowUnavailableReason = "goal_incomplete";
export type CashflowMissingField = "targetMonthly" | "retirementAge" | "birthYear";

export function buildPensionSummary(input: PensionSummaryInput) {
  const { year, accounts, contributions, sources, goal } = input;
  const rules = getPensionRules(year);

  // ── 규칙 ──
  const rulesOut = {
    requestedYear: year,
    year: rules.year,
    /** false면 요청 연도 수치가 등록되지 않아 가까운 연도(year) 값을 쓴 것 */
    exact: rules.exact,
    taxCredit: {
      pensionSavingsLimit: rules.taxCredit.pensionSavingsLimit,
      combinedLimit: rules.taxCredit.combinedLimit,
      rates: rules.taxCredit.rates,
    },
    annualContributionLimit: rules.annualContributionLimit,
    isa: rules.isa,
    pensionIncomeTax: rules.pensionIncomeTax,
    /** 출처 URL과 공식 출처 직접 확인 여부. verified=false 는 '미확인' */
    sources: rules.sources,
    unverifiedTopics: unverifiedRuleTopics(rules),
  };

  // ── 세액공제 진행률 (웹 ContributionSection 과 같은 입력 구성) ──
  const eligible = accounts.filter((a) => isPensionAccountType(a.account_type) || a.account_type === "isa");
  const paidByAccount = new Map(contributions.map((c) => [c.account_id, c.amount]));
  let taxCredit:
    | {
        salaryBracket: SalaryBracket;
        /** true면 저장된 소득 구간이 없어 웹과 같이 '총급여 5,500만원 초과'로 가정한 것 */
        salaryBracketAssumed: boolean;
        /** 올해 저장된 납입 기록이 하나도 없으면 false (진행률 0은 '기록 없음'일 수 있음) */
        contributionsRecorded: boolean;
        progress: TaxCreditProgress;
        accounts: { id: string; name: string; ownerType: string; accountType: string; paid: number }[];
      }
    | null = null;
  let taxCreditUnavailableReason: TaxCreditUnavailableReason | null = null;

  if (eligible.length === 0) {
    taxCreditUnavailableReason = "no_pension_accounts";
  } else {
    const bracket: SalaryBracket = goal?.salaryBracket ?? "high";
    taxCredit = {
      salaryBracket: bracket,
      salaryBracketAssumed: goal?.salaryBracket == null,
      contributionsRecorded: contributions.length > 0,
      progress: computeTaxCreditProgress(
        eligible.map((a) => ({ accountType: a.account_type, amount: paidByAccount.get(a.id) ?? 0 })),
        bracket,
        rules
      ),
      accounts: eligible.map((a) => ({
        id: a.id,
        name: a.name,
        ownerType: a.owner_type,
        accountType: a.account_type,
        paid: paidByAccount.get(a.id) ?? 0,
      })),
    };
  }

  // ── 은퇴 현금흐름 (웹 RetirementGoalSection 과 같은 입력 구성) ──
  const missing: CashflowMissingField[] = [];
  if (goal?.targetMonthly == null) missing.push("targetMonthly");
  if (goal?.retirementAge == null) missing.push("retirementAge");
  if (goal?.birthYear == null) missing.push("birthYear");

  let cashflow: (RetirementCashflow & {
    /** 은퇴 시점 연금소득세율(지방소득세 포함). 연금수령 55세 미만 계산은 55세 기준 */
    pensionIncomeTaxRateAtRetirement: number | null;
    /** true면 연 기대수익률이 비어 0%로 계산한 것 */
    expectedReturnAssumed: boolean;
  }) | null = null;
  let cashflowUnavailableReason: CashflowUnavailableReason | null = null;

  if (missing.length > 0 || !goal) {
    cashflowUnavailableReason = "goal_incomplete";
  } else {
    const result = computeRetirementCashflow(
      {
        targetMonthly: goal.targetMonthly ?? 0,
        retirementAge: goal.retirementAge ?? 60,
        birthYear: goal.birthYear ?? year,
        spouseBirthYear: goal.spouseBirthYear,
        expectedReturnPct: goal.expectedReturnPct ?? 0,
      },
      sources.map((s) => ({
        member: s.member,
        sourceType: s.source_type,
        monthlyAmount: s.monthly_amount,
        startAge: s.start_age,
        endAge: s.end_age,
      })),
      accounts.map((a) => ({ accountType: a.account_type, value: a.value, annualDividend: a.annual_dividend })),
      { currentYear: year }
    );
    cashflow = {
      ...result,
      pensionIncomeTaxRateAtRetirement: pensionIncomeTaxRate(rules, Math.max(result.atRetirement.age, 55)),
      expectedReturnAssumed: goal.expectedReturnPct == null,
    };
  }

  return {
    year,
    asOf: input.asOf,
    rules: rulesOut,
    goal: goal ?? {
      targetMonthly: null,
      retirementAge: null,
      birthYear: null,
      spouseBirthYear: null,
      expectedReturnPct: null,
      salaryBracket: null,
    },
    taxCredit,
    taxCreditUnavailableReason,
    retirement: {
      cashflow,
      unavailableReason: cashflowUnavailableReason,
      /** unavailableReason 이 있을 때 비어 있는 필수 입력 */
      missingFields: missing,
      incomeSourceCount: sources.length,
    },
    disclaimer: "참고용 추정치이며 실제 세액·수령액과 다를 수 있습니다. 세전·현재 가치 기준이며 물가상승은 반영하지 않았습니다.",
  };
}
