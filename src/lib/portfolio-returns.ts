// 계좌별 포트폴리오 기간 수익률 스냅샷/계산
import { sql } from "@/lib/db";

export type ReturnPeriodKey = "day" | "week" | "month";

export type PortfolioReturnPeriod = {
  key: ReturnPeriodKey;
  label: string;
  targetDate: string;
  snapshotDate: string | null;
  valueChange: number | null;
  netContribution: number | null;
  returnAmount: number | null;
  returnPct: number | null;
};

export type PortfolioReturnSummary = {
  accountId: string;
  accountName: string;
  telegramChatId: string | null;
  asOfDate: string;
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPct: number;
  periods: Record<ReturnPeriodKey, PortfolioReturnPeriod>;
};

type SnapshotRow = {
  snapshot_date: string;
  total_value: number | string;
  total_cost: number | string;
};

const PERIODS: { key: ReturnPeriodKey; label: string; days: number }[] = [
  { key: "day", label: "일별", days: 1 },
  { key: "week", label: "주간", days: 7 },
  { key: "month", label: "월간", days: 30 },
];

let schemaReady: Promise<void> | null = null;

export async function ensurePortfolioReturnSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS portfolio_value_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
        snapshot_date DATE NOT NULL,
        total_value NUMERIC NOT NULL DEFAULT 0,
        total_cost NUMERIC NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, account_id, snapshot_date)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_portfolio_value_snapshots_lookup
      ON portfolio_value_snapshots(user_id, account_id, snapshot_date DESC)
    `;
  })();
  await schemaReady;
}

export async function getPortfolioReturnSummary(
  userId: string,
  accountId: string
): Promise<PortfolioReturnSummary> {
  await ensurePortfolioReturnSchema();
  const today = toKstDateKey(new Date());
  const [account] = await sql`
    SELECT id, name, telegram_chat_id
    FROM portfolio_accounts
    WHERE id = ${accountId} AND user_id = ${userId}
  `;
  if (!account) throw new Error("계좌를 찾을 수 없습니다.");

  const current = await getCurrentPortfolioTotals(userId, accountId);
  await upsertPortfolioSnapshot(userId, accountId, today, current.totalValue, current.totalCost);

  const periodEntries = await Promise.all(
    PERIODS.map(async (period) => {
      const targetDate = addDays(today, -period.days);
      const snapshot = await getSnapshotOnOrBefore(userId, accountId, targetDate);
      return [
        period.key,
        buildPeriodReturn(period.key, period.label, targetDate, current, snapshot),
      ] as const;
    })
  );

  const totalPnL = current.totalValue - current.totalCost;
  const totalPnLPct = current.totalCost > 0 ? (totalPnL / current.totalCost) * 100 : 0;

  return {
    accountId,
    accountName: String(account.name),
    telegramChatId: typeof account.telegram_chat_id === "string" ? account.telegram_chat_id : null,
    asOfDate: today,
    totalValue: current.totalValue,
    totalCost: current.totalCost,
    totalPnL,
    totalPnLPct,
    periods: Object.fromEntries(periodEntries) as Record<ReturnPeriodKey, PortfolioReturnPeriod>,
  };
}

export async function updatePortfolioTelegramChatId(
  userId: string,
  accountId: string,
  telegramChatId: string | null
): Promise<void> {
  const cleanChatId = telegramChatId?.trim() || null;
  if (cleanChatId && !/^-?\d{5,20}$/.test(cleanChatId)) {
    throw new Error("텔레그램 chat_id는 숫자만 입력해주세요.");
  }
  await sql`
    UPDATE portfolio_accounts
    SET telegram_chat_id = ${cleanChatId}
    WHERE id = ${accountId} AND user_id = ${userId}
  `;
}

export function formatReturnReport(summary: PortfolioReturnSummary): string {
  const lines = [
    `📊 ${summary.accountName} 수익률 리포트`,
    `📅 ${summary.asOfDate}`,
    "━━━━━━━━━━━━━━━━",
    `💎 평가금액: ${formatKRW(summary.totalValue)}`,
    `💰 총 원가: ${formatKRW(summary.totalCost)}`,
    `📈 누적 손익: ${formatSignedKRW(summary.totalPnL)} (${formatSignedPct(summary.totalPnLPct)})`,
    "",
    "기간별 수익률(입출금/추가매수 원가 변동 보정)",
    formatPeriodLine(summary.periods.day),
    formatPeriodLine(summary.periods.week),
    formatPeriodLine(summary.periods.month),
  ];
  return lines.join("\n");
}

function buildPeriodReturn(
  key: ReturnPeriodKey,
  label: string,
  targetDate: string,
  current: { totalValue: number; totalCost: number },
  snapshot: SnapshotRow | null
): PortfolioReturnPeriod {
  if (!snapshot) {
    return {
      key,
      label,
      targetDate,
      snapshotDate: null,
      valueChange: null,
      netContribution: null,
      returnAmount: null,
      returnPct: null,
    };
  }

  const previousValue = Number(snapshot.total_value);
  const previousCost = Number(snapshot.total_cost);
  const valueChange = current.totalValue - previousValue;
  const netContribution = current.totalCost - previousCost;
  const returnAmount = valueChange - netContribution;
  const returnPct = previousValue > 0 ? (returnAmount / previousValue) * 100 : null;

  return {
    key,
    label,
    targetDate,
    snapshotDate: snapshot.snapshot_date,
    valueChange,
    netContribution,
    returnAmount,
    returnPct,
  };
}

async function getCurrentPortfolioTotals(userId: string, accountId: string) {
  const [row] = await sql`
    SELECT
      COALESCE(SUM(h.shares * h.current_price), 0)::float AS total_value,
      COALESCE(SUM(cb.total_cost), 0)::float AS total_cost
    FROM holdings h
    LEFT JOIN cost_basis cb
      ON cb.holding_id = h.id
     AND cb.user_id = h.user_id
     AND cb.account_id = h.account_id
    WHERE h.user_id = ${userId} AND h.account_id = ${accountId}
  `;
  return {
    totalValue: Number(row?.total_value ?? 0),
    totalCost: Number(row?.total_cost ?? 0),
  };
}

async function upsertPortfolioSnapshot(
  userId: string,
  accountId: string,
  snapshotDate: string,
  totalValue: number,
  totalCost: number
): Promise<void> {
  await sql`
    INSERT INTO portfolio_value_snapshots (user_id, account_id, snapshot_date, total_value, total_cost)
    VALUES (${userId}, ${accountId}, ${snapshotDate}, ${Math.round(totalValue)}, ${Math.round(totalCost)})
    ON CONFLICT (user_id, account_id, snapshot_date)
    DO UPDATE SET total_value = EXCLUDED.total_value,
                  total_cost = EXCLUDED.total_cost,
                  updated_at = NOW()
  `;
}

async function getSnapshotOnOrBefore(
  userId: string,
  accountId: string,
  targetDate: string
): Promise<SnapshotRow | null> {
  const [row] = await sql`
    SELECT snapshot_date::text, total_value::float, total_cost::float
    FROM portfolio_value_snapshots
    WHERE user_id = ${userId}
      AND account_id = ${accountId}
      AND snapshot_date <= ${targetDate}
    ORDER BY snapshot_date DESC
    LIMIT 1
  `;
  return (row ?? null) as SnapshotRow | null;
}

function formatPeriodLine(period: PortfolioReturnPeriod): string {
  if (period.returnPct === null || period.returnAmount === null) {
    return `· ${period.label}: 기준 스냅샷 없음`;
  }
  return `· ${period.label}: ${formatSignedPct(period.returnPct)} (${formatSignedKRW(period.returnAmount)})`;
}

function formatSignedPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedKRW(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatKRW(Math.abs(value))}`;
}

function formatKRW(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function toKstDateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);
  return toKstDateKey(date);
}
