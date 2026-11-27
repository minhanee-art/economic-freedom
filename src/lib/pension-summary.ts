// 연금 설계 요약 — 모바일 앱(GET /api/pension/summary)용.
// 계산은 웹 /dashboard/retirement 와 같은 순수 함수(computeTaxCreditProgress, computeRetirementCashflow)를 쓴다.
// 입력이 비면 값을 지어내지 않고 null 과 이유 코드를 내려준다. 모든 금액은 참고용 추정치(원, 세전)다.
import { isPensionAccountType } from "@/lib/account-types";
import type { AccountSnapshotRow, ContributionRow, IncomeSourceRow, RetirementGoalRow } from "@/lib/pension-data";
import {
  computeFamilyTaxCredit,
  computeRetirementCashflow,
  normalizeAccountOwner,
  type AccountOwner,
  type CashflowExclusionReason,
  type OwnerTaxCredit,
  type RetirementCashflow,
  type TaxCreditExclusionReason,
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

/** only_excluded_owner_accounts: 공제 대상 유형 계좌가 모두 자녀·기타 명의라 계산하지 않음 */
export type TaxCreditUnavailableReason = "no_pension_accounts" | "only_excluded_owner_accounts";
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
  // 한도·공제율은 명의자 개인 기준이라 본인·배우자를 따로 계산해 더한다. 자녀·기타 명의는 제외한다.
  const eligible = accounts.filter((a) => isPensionAccountType(a.account_type) || a.account_type === "isa");
  const paidByAccount = new Map(contributions.map((c) => [c.account_id, c.amount]));
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  let taxCredit:
    | {
        /** 본인 소득 구간 */
        salaryBracket: SalaryBracket;
        /** true면 계산에 넣은 명의자 중 누군가의 소득 구간이 없어 '총급여 5,500만원 초과'로 가정한 것. 명의자별 여부는 byOwner[].salaryBracketAssumed */
        salaryBracketAssumed: boolean;
        /** 계산에 넣은 계좌에 올해 저장된 납입 기록이 하나도 없으면 false (진행률 0은 '기록 없음'일 수 있음) */
        contributionsRecorded: boolean;
        /** 명의자별 결과의 합계 (한도도 명의자 수만큼 합산) */
        progress: TaxCreditProgress;
        /** 명의자별 한도·공제율을 따로 적용한 결과 */
        byOwner: OwnerTaxCredit[];
        /** 자녀·기타 명의라 계산에서 뺀 계좌 */
        excludedAccounts: {
          id: string;
          name: string;
          ownerType: AccountOwner;
          accountType: string;
          paid: number;
          reason: TaxCreditExclusionReason;
        }[];
        accounts: {
          id: string;
          name: string;
          ownerType: string;
          accountType: string;
          paid: number;
          /** false면 excludedAccounts 에 이유가 있다 */
          included: boolean;
        }[];
      }
    | null = null;
  let taxCreditUnavailableReason: TaxCreditUnavailableReason | null = null;

  if (eligible.length === 0) {
    taxCreditUnavailableReason = "no_pension_accounts";
  } else {
    const family = computeFamilyTaxCredit(
      eligible.map((a) => ({
        accountId: a.id,
        ownerType: a.owner_type,
        accountType: a.account_type,
        amount: paidByAccount.get(a.id) ?? 0,
      })),
      // 미입력(null)인 명의자는 낮은 공제율로 가정하고 byOwner[].salaryBracketAssumed 로 알린다
      { self: goal?.salaryBracket ?? null, spouse: goal?.spouseSalaryBracket ?? null },
      rules
    );
    if (family.byOwner.length === 0) {
      taxCreditUnavailableReason = "only_excluded_owner_accounts";
    } else {
      const excludedIds = new Set(family.excluded.map((e) => e.accountId));
      const includedIds = eligible.filter((a) => !excludedIds.has(a.id)).map((a) => a.id);
      taxCredit = {
        salaryBracket: goal?.salaryBracket ?? "high",
        salaryBracketAssumed: family.byOwner.some((o) => o.salaryBracketAssumed),
        contributionsRecorded: includedIds.some((id) => paidByAccount.has(id)),
        progress: family.total,
        byOwner: family.byOwner,
        excludedAccounts: family.excluded.map((e) => ({
          id: e.accountId ?? "",
          name: nameById.get(e.accountId ?? "") ?? "",
          ownerType: e.ownerType,
          accountType: e.accountType,
          paid: e.amount,
          reason: e.reason,
        })),
        accounts: eligible.map((a) => ({
          id: a.id,
          name: a.name,
          ownerType: a.owner_type,
          accountType: a.account_type,
          paid: paidByAccount.get(a.id) ?? 0,
          included: !excludedIds.has(a.id),
        })),
      };
    }
  }

  // ── 은퇴 현금흐름 (웹 RetirementGoalSection 과 같은 입력 구성) ──
  const missing: CashflowMissingField[] = [];
  if (goal?.targetMonthly == null) missing.push("targetMonthly");
  if (goal?.retirementAge == null) missing.push("retirementAge");
  if (goal?.birthYear == null) missing.push("birthYear");

  let cashflow: (Omit<RetirementCashflow, "excludedAccounts"> & {
    /** 자녀·기타 명의, 또는 배우자 출생연도가 없어 현금흐름에서 뺀 계좌 */
    excludedAccounts: {
      id: string;
      name: string;
      ownerType: AccountOwner;
      accountType: string;
      value: number;
      reason: CashflowExclusionReason;
    }[];
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
      accounts.map((a) => ({
        id: a.id,
        ownerType: normalizeAccountOwner(a.owner_type),
        accountType: a.account_type,
        value: a.value,
        annualDividend: a.annual_dividend,
      })),
      { currentYear: year }
    );
    cashflow = {
      ...result,
      excludedAccounts: result.excludedAccounts.map((e) => ({
        id: e.id ?? "",
        name: nameById.get(e.id ?? "") ?? "",
        ownerType: e.ownerType,
        accountType: e.accountType,
        value: e.value,
        reason: e.reason,
      })),
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
      spouseSalaryBracket: null,
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
