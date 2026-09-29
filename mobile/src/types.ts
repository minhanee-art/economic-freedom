export type AccountSummary = {
  id: string;
  name: string;
  ownerType: string;
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
