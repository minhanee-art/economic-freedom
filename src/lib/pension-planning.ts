// 연금 설계 계산 — DB·화면과 분리된 순수 함수만 둔다.
// 모든 결과는 참고용 추정치이며 실제 세액·수령액과 다를 수 있다.
import { isPensionAccountType, type AccountType } from "@/lib/account-types";
import type { PensionRuleSet, SalaryBracket } from "@/lib/pension-rules";

// ── 3. 세액공제 진행률 ─────────────────────────────────────────────

export type ContributionInput = {
  accountType: AccountType;
  /** 해당 연도 납입액 (원) */
  amount: number;
};

export type TaxCreditProgress = {
  pensionSavingsPaid: number;
  /** IRP + DC(본인 추가납입) */
  retirementPaid: number;
  /** 연금계좌(연금저축+퇴직연금) 납입 합계 */
  pensionPaid: number;
  isaPaid: number;
  /** 연금저축 중 공제 대상 (연금저축 한도 적용) */
  creditablePensionSavings: number;
  /** 공제 대상 합계 (합산 한도 적용) */
  creditableTotal: number;
  /** 납입했지만 공제 한도를 넘은 금액 */
  nonCreditablePaid: number;
  /** 합산 한도까지 더 넣을 수 있는 공제 대상 금액 */
  remainingCreditRoom: number;
  /** 그 중 연금저축으로 채울 수 있는 금액 (나머지는 IRP·DC 추가납입으로만 공제) */
  remainingPensionSavingsRoom: number;
  /** 합산 한도 대비 진행률 (0~100) */
  progressPct: number;
  rate: number;
  /** 예상 세액공제액(=환급 기대액의 상한). 결정세액보다 클 수 없음 */
  estimatedCredit: number;
  /** 합산 한도를 다 채웠을 때의 공제액 */
  maxCredit: number;
  /** 연금계좌 연간 납입 한도 초과 여부 */
  overAnnualContributionLimit: boolean;
  /** ISA 연간 납입 한도 초과 여부 */
  overIsaAnnualLimit: boolean;
};

function positive(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function computeTaxCreditProgress(
  contributions: ContributionInput[],
  salaryBracket: SalaryBracket,
  rules: PensionRuleSet
): TaxCreditProgress {
  const sumBy = (types: AccountType[]) =>
    contributions
      .filter((item) => types.includes(item.accountType))
      .reduce((sum, item) => sum + positive(item.amount), 0);

  const pensionSavingsPaid = sumBy(["pension_savings"]);
  const retirementPaid = sumBy(["irp", "dc"]);
  const pensionPaid = pensionSavingsPaid + retirementPaid;
  const isaPaid = sumBy(["isa"]);

  const { pensionSavingsLimit, combinedLimit, rates } = rules.taxCredit;
  const creditablePensionSavings = Math.min(pensionSavingsPaid, pensionSavingsLimit);
  const creditableTotal = Math.min(creditablePensionSavings + retirementPaid, combinedLimit);
  const remainingCreditRoom = combinedLimit - creditableTotal;
  const remainingPensionSavingsRoom = Math.min(
    remainingCreditRoom,
    Math.max(0, pensionSavingsLimit - pensionSavingsPaid)
  );
  const rate = rates[salaryBracket].rate;

  return {
    pensionSavingsPaid,
    retirementPaid,
    pensionPaid,
    isaPaid,
    creditablePensionSavings,
    creditableTotal,
    nonCreditablePaid: pensionPaid - creditableTotal,
    remainingCreditRoom,
    remainingPensionSavingsRoom,
    progressPct: combinedLimit > 0 ? Math.min(100, (creditableTotal / combinedLimit) * 100) : 0,
    rate,
    // 세액은 원 단위 미만 절사
    estimatedCredit: Math.floor(creditableTotal * rate),
    maxCredit: Math.floor(combinedLimit * rate),
    overAnnualContributionLimit: pensionPaid > rules.annualContributionLimit,
    overIsaAnnualLimit: isaPaid > rules.isa.annualLimit,
  };
}

// ── 5. 은퇴 현금흐름 ──────────────────────────────────────────────

export type FamilyMember = "self" | "spouse";
export type IncomeSourceType = "national_pension" | "retirement_pension" | "pension_insurance";

export const INCOME_SOURCE_LABELS: Record<IncomeSourceType, string> = {
  national_pension: "국민연금",
  retirement_pension: "퇴직연금",
  pension_insurance: "연금보험",
};

export const FAMILY_MEMBER_LABELS: Record<FamilyMember, string> = {
  self: "본인",
  spouse: "배우자",
};

export type IncomeSourceInput = {
  member: FamilyMember;
  sourceType: IncomeSourceType;
  /** 예상 월 수령액 (원, 세전) */
  monthlyAmount: number;
  /** 수령 개시 나이 (해당 구성원 나이) */
  startAge: number;
  /** 수령 종료 나이. null이면 종신 */
  endAge: number | null;
};

export type RetirementGoal = {
  targetMonthly: number;
  retirementAge: number;
  birthYear: number;
  spouseBirthYear: number | null;
  /** 연 기대수익률 (%) — 계좌 평가액 증가·연금화 계산에 사용 */
  expectedReturnPct: number;
};

export type AccountSnapshot = {
  accountType: AccountType;
  /** 현재 평가액 (원) */
  value: number;
  /** 최근 1년 배당 합계 (원, 세전) */
  annualDividend: number;
};

export type CashflowLayers = {
  /** 1층: 국민연금 */
  public: number;
  /** 2층: 퇴직연금 (수동 입력 + DC 계좌 연금화) */
  retirement: number;
  /** 3층: 개인연금 (연금보험 + 연금저축·IRP 계좌 연금화) */
  private: number;
  /** 연금계좌 밖 계좌의 배당 */
  dividend: number;
};

export type CashflowRow = {
  /** 본인 나이 */
  age: number;
  layers: CashflowLayers;
  total: number;
  shortfall: number;
};

export type RetirementCashflow = {
  currentAge: number;
  yearsToRetirement: number;
  /** 은퇴 시점 추정 평가액 */
  projectedBalances: { retirement: number; private: number };
  /** 계좌 연금화 시작 나이·기간 */
  annuity: { startAge: number; years: number; monthlyRetirement: number; monthlyPrivate: number };
  atRetirement: CashflowRow;
  rows: CashflowRow[];
  /** 목표를 처음 채우는 본인 나이 (없으면 null) */
  firstCoveredAge: number | null;
  /** 은퇴 후 가장 큰 월 부족액 */
  maxShortfall: number;
  coveragePctAtRetirement: number;
};

/** 연금계좌 연금수령이 가능한 최소 나이 */
const MIN_PENSION_AGE = 55;

export type CashflowOptions = {
  currentYear: number;
  /** 계좌 평가액을 나눠 받는 기간 (년) */
  payoutYears?: number;
  /** 표를 계산할 마지막 본인 나이 */
  horizonAge?: number;
};

/** 원리금균등 월 지급액: 잔액 pv를 months개월 동안 월 이율 i로 나눠 받을 때 */
export function monthlyAnnuityPayment(pv: number, annualRatePct: number, years: number): number {
  const months = Math.round(years * 12);
  if (pv <= 0 || months <= 0) return 0;
  const i = annualRatePct / 100 / 12;
  if (i === 0) return Math.round(pv / months);
  return Math.round((pv * i) / (1 - Math.pow(1 + i, -months)));
}

/** 현재 금액을 years년 동안 연 annualRatePct로 굴린 값 */
export function futureValue(pv: number, annualRatePct: number, years: number): number {
  if (pv <= 0) return 0;
  return Math.round(pv * Math.pow(1 + annualRatePct / 100, Math.max(0, years)));
}

function activeAt(source: IncomeSourceInput, memberAge: number): boolean {
  return memberAge >= source.startAge && (source.endAge === null || memberAge <= source.endAge);
}

export function computeRetirementCashflow(
  goal: RetirementGoal,
  sources: IncomeSourceInput[],
  accounts: AccountSnapshot[],
  options: CashflowOptions
): RetirementCashflow {
  const payoutYears = options.payoutYears ?? 20;
  const currentAge = options.currentYear - goal.birthYear;
  const yearsToRetirement = Math.max(0, goal.retirementAge - currentAge);
  const horizonAge = Math.max(options.horizonAge ?? 90, goal.retirementAge, currentAge);
  // 배우자 나이 = 본인 나이 + (본인 출생연도 − 배우자 출생연도). 미입력이면 동갑으로 본다.
  const spouseOffset = goal.spouseBirthYear === null ? 0 : goal.birthYear - goal.spouseBirthYear;

  const sumValue = (types: AccountType[]) =>
    accounts.filter((a) => types.includes(a.accountType)).reduce((s, a) => s + positive(a.value), 0);

  const projectedRetirement = futureValue(sumValue(["dc"]), goal.expectedReturnPct, yearsToRetirement);
  const projectedPrivate = futureValue(
    sumValue(["pension_savings", "irp"]),
    goal.expectedReturnPct,
    yearsToRetirement
  );
  const annuityStartAge = Math.max(goal.retirementAge, MIN_PENSION_AGE);
  // 은퇴 후 연금 개시 전까지도 같은 수익률로 굴러간다고 본다
  const waitYears = annuityStartAge - Math.max(currentAge, goal.retirementAge);
  const monthlyRetirement = monthlyAnnuityPayment(
    futureValue(projectedRetirement, goal.expectedReturnPct, waitYears),
    goal.expectedReturnPct,
    payoutYears
  );
  const monthlyPrivate = monthlyAnnuityPayment(
    futureValue(projectedPrivate, goal.expectedReturnPct, waitYears),
    goal.expectedReturnPct,
    payoutYears
  );

  const monthlyDividend = Math.round(
    accounts
      .filter((a) => !isPensionAccountType(a.accountType))
      .reduce((s, a) => s + positive(a.annualDividend), 0) / 12
  );

  const rows: CashflowRow[] = [];
  // 이미 은퇴 나이를 지났다면 올해 나이부터 계산한다
  const firstAge = Math.max(goal.retirementAge, currentAge);
  for (let age = firstAge; age <= horizonAge; age++) {
    const layers: CashflowLayers = { public: 0, retirement: 0, private: 0, dividend: monthlyDividend };
    for (const source of sources) {
      const memberAge = source.member === "self" ? age : age + spouseOffset;
      if (!activeAt(source, memberAge)) continue;
      const amount = positive(source.monthlyAmount);
      if (source.sourceType === "national_pension") layers.public += amount;
      else if (source.sourceType === "retirement_pension") layers.retirement += amount;
      else layers.private += amount;
    }
    const annuityActive = age >= annuityStartAge && age < annuityStartAge + payoutYears;
    if (annuityActive) {
      layers.retirement += monthlyRetirement;
      layers.private += monthlyPrivate;
    }
    const total = layers.public + layers.retirement + layers.private + layers.dividend;
    rows.push({ age, layers, total, shortfall: Math.max(0, goal.targetMonthly - total) });
  }

  const atRetirement = rows[0];
  const covered = rows.find((row) => row.shortfall === 0);

  return {
    currentAge,
    yearsToRetirement,
    projectedBalances: { retirement: projectedRetirement, private: projectedPrivate },
    annuity: { startAge: annuityStartAge, years: payoutYears, monthlyRetirement, monthlyPrivate },
    atRetirement,
    rows,
    firstCoveredAge: covered ? covered.age : null,
    maxShortfall: rows.reduce((max, row) => Math.max(max, row.shortfall), 0),
    coveragePctAtRetirement:
      goal.targetMonthly > 0 ? Math.round((atRetirement.total / goal.targetMonthly) * 100) : 0,
  };
}
