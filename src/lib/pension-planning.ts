// 연금 설계 계산 — DB·화면과 분리된 순수 함수만 둔다.
// 모든 결과는 참고용 추정치이며 실제 세액·수령액과 다를 수 있다.
import { isPensionAccountType, type AccountType } from "@/lib/account-types";
import { PENSION_WITHDRAWAL_MIN_AGE, type PensionRuleSet, type SalaryBracket } from "@/lib/pension-rules";

// ── 계좌 명의자 ───────────────────────────────────────────────────
// 세액공제 한도·공제율·연금수령 나이는 모두 명의자(가입자) 개인 기준이다.
// 가족 계좌를 한 사람처럼 합치지 않도록 계산은 명의자별로 하고 합계는 그 뒤에 더한다.

export type AccountOwner = "self" | "spouse" | "child" | "other";

export const ACCOUNT_OWNER_LABELS: Record<AccountOwner, string> = {
  self: "본인",
  spouse: "배우자",
  child: "자녀",
  other: "기타",
};

/** DB의 owner_type 문자열을 명의자로 바꾼다. 알 수 없는 값은 '기타'로 본다(계산에서 제외). */
export function normalizeAccountOwner(value: string | null | undefined): AccountOwner {
  return value === "self" || value === "spouse" || value === "child" || value === "other" ? value : "other";
}

/** 계산에 넣는 명의자. 자녀·기타는 출생연도·소득 구간 입력이 없어 제외한다. */
export type ModeledOwner = "self" | "spouse";

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

export type OwnedContributionInput = ContributionInput & {
  /** portfolio_accounts.owner_type */
  ownerType: string;
  accountId?: string;
};

export type OwnerTaxCredit = {
  ownerType: ModeledOwner;
  salaryBracket: SalaryBracket;
  /** true면 소득 구간 입력이 없어 '총급여 5,500만원 초과'(낮은 공제율)로 가정한 것 */
  salaryBracketAssumed: boolean;
  progress: TaxCreditProgress;
};

export type TaxCreditExclusionReason = "child_or_other_owner";

export type TaxCreditExclusion = {
  accountId?: string;
  ownerType: AccountOwner;
  accountType: AccountType;
  amount: number;
  reason: TaxCreditExclusionReason;
};

export type FamilyTaxCredit = {
  /** 명의자별 결과의 합계. 한도(maxCredit·remainingCreditRoom)도 명의자 수만큼 더해진다 */
  total: TaxCreditProgress;
  /** 공제 대상 계좌가 있는 명의자만 (본인 → 배우자 순) */
  byOwner: OwnerTaxCredit[];
  /** 자녀·기타 명의라 계산에서 뺀 계좌 */
  excluded: TaxCreditExclusion[];
};

/**
 * 가족 세액공제: 명의자(본인·배우자)마다 한도·공제율을 따로 적용한 뒤 더한다.
 * 소득 구간이 없는 명의자는 낮은 공제율('high' 구간)로 가정하고 salaryBracketAssumed로 알린다.
 * 자녀·기타 명의 계좌는 소득 구간·근로소득 여부를 알 수 없어 제외한다.
 */
export function computeFamilyTaxCredit(
  contributions: OwnedContributionInput[],
  salaryBrackets: Record<ModeledOwner, SalaryBracket | null>,
  rules: PensionRuleSet
): FamilyTaxCredit {
  const byOwner: OwnerTaxCredit[] = [];
  const excluded: TaxCreditExclusion[] = [];
  const grouped: Record<ModeledOwner, ContributionInput[]> = { self: [], spouse: [] };
  const present: Record<ModeledOwner, boolean> = { self: false, spouse: false };

  for (const item of contributions) {
    const owner = normalizeAccountOwner(item.ownerType);
    if (owner === "self" || owner === "spouse") {
      grouped[owner].push({ accountType: item.accountType, amount: item.amount });
      present[owner] = true;
    } else {
      excluded.push({
        accountId: item.accountId,
        ownerType: owner,
        accountType: item.accountType,
        amount: positive(item.amount),
        reason: "child_or_other_owner",
      });
    }
  }

  for (const owner of ["self", "spouse"] as const) {
    if (!present[owner]) continue;
    const bracket = salaryBrackets[owner] ?? "high";
    byOwner.push({
      ownerType: owner,
      salaryBracket: bracket,
      salaryBracketAssumed: salaryBrackets[owner] == null,
      progress: computeTaxCreditProgress(grouped[owner], bracket, rules),
    });
  }

  return { total: sumTaxCreditProgress(byOwner.map((o) => o.progress), rules), byOwner, excluded };
}

function sumTaxCreditProgress(items: TaxCreditProgress[], rules: PensionRuleSet): TaxCreditProgress {
  const sum = (key: keyof TaxCreditProgress) => items.reduce((s, p) => s + Number(p[key]), 0);
  const totalLimit = rules.taxCredit.combinedLimit * items.length;
  const creditableTotal = sum("creditableTotal");
  const maxCredit = sum("maxCredit");
  const rates = [...new Set(items.map((p) => p.rate))];
  return {
    pensionSavingsPaid: sum("pensionSavingsPaid"),
    retirementPaid: sum("retirementPaid"),
    pensionPaid: sum("pensionPaid"),
    isaPaid: sum("isaPaid"),
    creditablePensionSavings: sum("creditablePensionSavings"),
    creditableTotal,
    nonCreditablePaid: sum("nonCreditablePaid"),
    remainingCreditRoom: sum("remainingCreditRoom"),
    remainingPensionSavingsRoom: sum("remainingPensionSavingsRoom"),
    progressPct: totalLimit > 0 ? Math.min(100, (creditableTotal / totalLimit) * 100) : 0,
    // 명의자별 공제율이 다르면 한도 기준 가중 평균
    rate: rates.length === 1 ? rates[0] : totalLimit > 0 ? Math.round((maxCredit / totalLimit) * 10000) / 10000 : 0,
    estimatedCredit: sum("estimatedCredit"),
    maxCredit,
    overAnnualContributionLimit: items.some((p) => p.overAnnualContributionLimit),
    overIsaAnnualLimit: items.some((p) => p.overIsaAnnualLimit),
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
  id?: string;
  /** portfolio_accounts.owner_type. 생략하면 본인 계좌로 본다 */
  ownerType?: string;
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

export type OwnerAnnuity = {
  ownerType: ModeledOwner;
  /** 연금화 시작 시점 (본인 나이 기준 — rows.age 와 같은 축) */
  startAge: number;
  /** 연금화 시작 시점의 명의자 본인 나이 */
  ownerStartAge: number;
  years: number;
  /** 현재 평가액 (DC / 연금저축·IRP) */
  currentBalances: { retirement: number; private: number };
  monthlyRetirement: number;
  monthlyPrivate: number;
};

export type CashflowExclusionReason = "child_or_other_owner" | "spouse_birth_year_missing";

export type CashflowExclusion = {
  id?: string;
  ownerType: AccountOwner;
  accountType: AccountType;
  value: number;
  reason: CashflowExclusionReason;
};

export type RetirementCashflow = {
  currentAge: number;
  yearsToRetirement: number;
  /** 은퇴 시점 추정 평가액 (계산에 넣은 본인·배우자 계좌 합계) */
  projectedBalances: { retirement: number; private: number };
  /** 본인 명의 계좌 연금화 시작 나이·기간 (기존 필드. 배우자 몫은 annuities 참고) */
  annuity: { startAge: number; years: number; monthlyRetirement: number; monthlyPrivate: number };
  /** 명의자별 계좌 연금화. 연금계좌가 있는 명의자만 */
  annuities: OwnerAnnuity[];
  /** 자녀·기타 명의, 또는 배우자 출생연도가 없어 뺀 계좌 */
  excludedAccounts: CashflowExclusion[];
  atRetirement: CashflowRow;
  rows: CashflowRow[];
  /** 목표를 처음 채우는 본인 나이 (없으면 null) */
  firstCoveredAge: number | null;
  /** 은퇴 후 가장 큰 월 부족액 */
  maxShortfall: number;
  coveragePctAtRetirement: number;
};

/** 연금계좌 연금수령이 가능한 최소 나이 — 출처는 pension-rules.ts */
const MIN_PENSION_AGE = PENSION_WITHDRAWAL_MIN_AGE;

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
  // 배우자 나이 = 본인 나이 + (본인 출생연도 − 배우자 출생연도).
  // 미입력이면 수동 입력 소득원(기존 동작)은 동갑으로 보고, 배우자 명의 연금계좌는 수령 시점을 정할 수 없어 제외한다.
  const spouseOffset = goal.spouseBirthYear === null ? 0 : goal.birthYear - goal.spouseBirthYear;

  const r = goal.expectedReturnPct;
  // 이미 은퇴 나이를 지났다면 올해 나이부터 계산한다
  const firstAge = Math.max(goal.retirementAge, currentAge);

  // 명의자별로 계좌를 나눈다. 자녀·기타는 제외, 배우자 연금계좌는 배우자 나이를 알아야 수령 시점을 정할 수 있다.
  const excludedAccounts: CashflowExclusion[] = [];
  const owned: Record<ModeledOwner, AccountSnapshot[]> = { self: [], spouse: [] };
  for (const account of accounts) {
    const owner = account.ownerType === undefined ? "self" : normalizeAccountOwner(account.ownerType);
    const exclude = (reason: CashflowExclusionReason) =>
      excludedAccounts.push({ id: account.id, ownerType: owner, accountType: account.accountType, value: positive(account.value), reason });
    if (owner === "child" || owner === "other") exclude("child_or_other_owner");
    else if (owner === "spouse" && goal.spouseBirthYear === null && isPensionAccountType(account.accountType))
      exclude("spouse_birth_year_missing");
    else owned[owner].push(account);
  }
  const included = [...owned.self, ...owned.spouse];

  const sumValue = (list: AccountSnapshot[], types: AccountType[]) =>
    list.filter((a) => types.includes(a.accountType)).reduce((s, a) => s + positive(a.value), 0);

  const projectedRetirement = futureValue(sumValue(included, ["dc"]), r, yearsToRetirement);
  const projectedPrivate = futureValue(sumValue(included, ["pension_savings", "irp"]), r, yearsToRetirement);

  // 연금화 시작(본인 나이 기준): 가구 은퇴 시점(또는 올해) 이후이면서 명의자가 최소 수령 나이에 이른 뒤.
  // 배우자 은퇴 나이는 입력이 없으므로 따로 가정하지 않는다.
  const annuities: OwnerAnnuity[] = [];
  for (const owner of ["self", "spouse"] as const) {
    const list = owned[owner].filter((a) => isPensionAccountType(a.accountType));
    if (owner === "spouse" && list.length === 0) continue;
    const offset = owner === "self" ? 0 : spouseOffset;
    const startAge = Math.max(firstAge, MIN_PENSION_AGE - offset);
    const growYears = startAge - currentAge;
    const retirementBalance = sumValue(list, ["dc"]);
    const privateBalance = sumValue(list, ["pension_savings", "irp"]);
    annuities.push({
      ownerType: owner,
      startAge,
      ownerStartAge: startAge + offset,
      years: payoutYears,
      currentBalances: { retirement: retirementBalance, private: privateBalance },
      monthlyRetirement: monthlyAnnuityPayment(futureValue(retirementBalance, r, growYears), r, payoutYears),
      monthlyPrivate: monthlyAnnuityPayment(futureValue(privateBalance, r, growYears), r, payoutYears),
    });
  }
  const selfAnnuity = annuities[0];

  const monthlyDividend = Math.round(
    included
      .filter((a) => !isPensionAccountType(a.accountType))
      .reduce((s, a) => s + positive(a.annualDividend), 0) / 12
  );

  const rows: CashflowRow[] = [];
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
    for (const annuity of annuities) {
      if (age < annuity.startAge || age >= annuity.startAge + annuity.years) continue;
      layers.retirement += annuity.monthlyRetirement;
      layers.private += annuity.monthlyPrivate;
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
    annuity: {
      startAge: selfAnnuity.startAge,
      years: selfAnnuity.years,
      monthlyRetirement: selfAnnuity.monthlyRetirement,
      monthlyPrivate: selfAnnuity.monthlyPrivate,
    },
    annuities,
    excludedAccounts,
    atRetirement,
    rows,
    firstCoveredAge: covered ? covered.age : null,
    maxShortfall: rows.reduce((max, row) => Math.max(max, row.shortfall), 0),
    coveragePctAtRetirement:
      goal.targetMonthly > 0 ? Math.round((atRetirement.total / goal.targetMonthly) * 100) : 0,
  };
}
