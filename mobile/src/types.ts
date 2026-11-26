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
