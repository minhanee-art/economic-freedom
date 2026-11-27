// 대시보드 홈 상단 '한 줄 상태'와 다가오는 배당 일정 — 새 계산을 만들지 않고
// /api/pension/summary 응답(buildPensionSummary)과 사용자가 등록한 배당 일정만 읽어 정리한다.

export type PensionSummaryLite = {
  year: number;
  goal?: { targetMonthly: number | null } | null;
  taxCredit?: { progress: { progressPct: number; remainingCreditRoom: number } } | null;
  taxCreditUnavailableReason?: string | null;
  retirement?: {
    cashflow: {
      atRetirement: { age: number; total: number };
      coveragePctAtRetirement: number;
    } | null;
    unavailableReason?: string | null;
  } | null;
};

export type HomeTaxCreditStatus =
  | { kind: "ready"; year: number; progressPct: number; remaining: number }
  | { kind: "unavailable"; year: number };

export type HomeCashflowStatus =
  | { kind: "ready"; age: number; monthly: number; target: number; coveragePct: number }
  | { kind: "unavailable" };

export function homeTaxCreditStatus(summary: PensionSummaryLite): HomeTaxCreditStatus {
  const progress = summary.taxCredit?.progress;
  if (!progress) return { kind: "unavailable", year: summary.year };
  return {
    kind: "ready",
    year: summary.year,
    progressPct: Math.round(progress.progressPct),
    remaining: Math.max(0, progress.remainingCreditRoom),
  };
}

export function homeCashflowStatus(summary: PensionSummaryLite): HomeCashflowStatus {
  const cashflow = summary.retirement?.cashflow;
  const target = summary.goal?.targetMonthly;
  if (!cashflow || target == null) return { kind: "unavailable" };
  return {
    kind: "ready",
    age: cashflow.atRetirement.age,
    monthly: cashflow.atRetirement.total,
    target,
    coveragePct: Math.round(cashflow.coveragePctAtRetirement),
  };
}

export type DividendScheduleItem = { id: string; date: string; stock: string; type: string; note: string };

/** 사용자가 등록한 배당 일정 중 오늘(포함) 이후 가까운 순 limit 개. 일반론 일정은 만들지 않는다. */
export function upcomingDividendSchedule<T extends DividendScheduleItem>(
  calendar: T[],
  todayKey: string,
  limit = 3
): T[] {
  return calendar
    .filter((item) => item.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

/** 로컬 날짜 YYYY-MM-DD */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
