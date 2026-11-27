export type AccountSummary = {
  id: string;
  name: string;
  ownerType: string;
  /** 세제 유형(pension_savings, irp, dc, isa, general, child). GET /api/accounts 응답에서만 온다. */
  accountType?: string;
};

export type Holding = {
  id: string;
  code: string;
  name: string;
  category: string;
  subCategory?: string;
  shares?: number;
  currentPrice?: number;
  avgPrice?: number;
  currentValue: number;
  totalCost: number;
  profitLoss: number;
  profitLossPct: number;
  allocationPct: number;
  targetPct?: number;
};

export type DividendMonth = {
  month: string;
  amount: number;
};

export type CategoryBalance = {
  name: string;
  currentPct: number;
  targetPct: number;
  diffPct: number;
};

export type DividendCalendarItem = {
  id: string;
  date: string;
  stock: string;
  type: string;
  note: string | null;
};

export type PortfolioSummary = {
  account?: AccountSummary;
  accounts?: AccountSummary[];
  asOf?: string;
  totalValue: number;
  totalCost: number;
  totalPnL?: number;
  totalPnLPct?: number;
  totalDividend: number;
  monthlyBudget: number;
  targetMonthlyCashflow: number;
  expectedAnnualDividend: number;
  categories?: CategoryBalance[];
  holdings: Holding[];
  dividends: DividendMonth[];
  dividendCalendar?: DividendCalendarItem[];
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type ContributionRecord = {
  accountId: string;
  year: number;
  amount: number;
  memo: string | null;
};

export type RetirementGoal = {
  targetMonthly: number | null;
  retirementAge: number | null;
  birthYear: number | null;
  spouseBirthYear: number | null;
  expectedReturnPct: number | null;
  salaryBracket: "low" | "high" | null;
  /** 배우자 총급여 구간(웹 연금 설계 화면에서 입력). 이 필드가 없는 이전 서버 응답이면 null 로 채운다(api/pension.ts) */
  spouseSalaryBracket: "low" | "high" | null;
};

export type IncomeSource = {
  id: string;
  member: string;
  sourceType: string;
  label: string | null;
  monthlyAmount: number;
  startAge: number;
  endAge: number | null;
  memo: string | null;
};

export type RetirementPlan = {
  year: number;
  accounts: AccountSummary[];
  contributions: ContributionRecord[];
  goal: RetirementGoal;
  sources: IncomeSource[];
};

/** GET /api/pension/summary 응답(필요한 필드만). 금액은 원·세전·현재 가치 기준 참고용 추정치. 사용자 전체(가족 계좌 합산) 기준. */
export type PensionLayers = { public: number; retirement: number; private: number; dividend: number };

/** 계좌 명의자. 세액공제 한도·공제율·연금수령 나이는 명의자 개인 기준이다. */
export type AccountOwner = "self" | "spouse" | "child" | "other";

/** 서버 TaxCreditProgress 중 화면에 쓰는 필드. 금액은 원. */
export type TaxCreditProgress = {
  pensionSavingsPaid: number;
  retirementPaid: number;
  /** 연금계좌(연금저축+IRP·DC) 납입 합계 */
  pensionPaid: number;
  isaPaid: number;
  /** 공제 대상 합계(합산 한도 적용) */
  creditableTotal: number;
  nonCreditablePaid: number;
  remainingCreditRoom: number;
  progressPct: number;
  rate: number;
  estimatedCredit: number;
  maxCredit: number;
};

/** 명의자별 세액공제 결과(본인 → 배우자 순, 공제 대상 계좌가 있는 명의자만). */
export type OwnerTaxCredit = {
  ownerType: "self" | "spouse";
  salaryBracket: "low" | "high";
  /** true면 이 명의자의 소득 구간 입력이 없어 낮은 공제율로 가정한 것. 본인·배우자 모두 웹 연금 설계 화면에서 입력한다 */
  salaryBracketAssumed: boolean;
  progress: TaxCreditProgress;
};

export type TaxCreditExcludedAccount = {
  id: string;
  name: string;
  ownerType: AccountOwner;
  accountType: string;
  paid: number;
  reason: "child_or_other_owner";
};

export type CashflowExcludedAccount = {
  id: string;
  name: string;
  ownerType: AccountOwner;
  accountType: string;
  value: number;
  reason: "child_or_other_owner" | "spouse_birth_year_missing";
};

/**
 * no_pension_accounts: 연금저축·IRP·DC·ISA 계좌가 없음
 * only_excluded_owner_accounts: 그런 계좌가 모두 자녀·기타 명의라 계산하지 않음
 */
export type TaxCreditUnavailableReason = "no_pension_accounts" | "only_excluded_owner_accounts";

export type PensionSummary = {
  year: number;
  rules: {
    year: number;
    exact: boolean;
    /** 명의자 1인 기준 한도 */
    taxCredit?: { pensionSavingsLimit: number; combinedLimit: number };
    unverifiedTopics: string[];
  };
  taxCredit: {
    salaryBracketAssumed: boolean;
    contributionsRecorded: boolean;
    /** 명의자별 결과의 합계(한도도 명의자 수만큼 합산) */
    progress: TaxCreditProgress;
    /** 명의자별 한도·공제율을 따로 적용한 결과. PR #40 이전 서버 응답이면 빈 배열로 채운다(api/pension.ts) */
    byOwner: OwnerTaxCredit[];
    /** 자녀·기타 명의라 계산에서 뺀 계좌. PR #40 이전 서버 응답이면 빈 배열 */
    excludedAccounts: TaxCreditExcludedAccount[];
  } | null;
  taxCreditUnavailableReason: TaxCreditUnavailableReason | (string & {}) | null;
  retirement: {
    cashflow: {
      atRetirement: { age: number; layers: PensionLayers; total: number; shortfall: number };
      coveragePctAtRetirement: number;
      expectedReturnAssumed: boolean;
      /** 자녀·기타 명의, 또는 배우자 출생연도가 없어 현금흐름에서 뺀 계좌 */
      excludedAccounts: CashflowExcludedAccount[];
    } | null;
    unavailableReason: string | null;
    missingFields: string[];
  };
  disclaimer: string;
};

/** GET /api/purchases 의 매수 기록 한 건(항목 포함). 삭제 API는 서버에 없다. */
export type PurchaseItem = {
  code: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
};

export type PurchaseRecord = {
  id: string;
  date: string;
  totalSpent: number;
  items: PurchaseItem[];
};

export type DividendRecord = {
  id: string;
  holdingId: string;
  holdingName: string | null;
  holdingCode: string | null;
  amount: number;
  date: string;
  memo: string | null;
};
