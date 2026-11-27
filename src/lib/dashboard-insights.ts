// 대시보드 요약 지표(배당률·일간 변동·히트맵 배치) 순수 계산 함수
import type { HoldingWithPnL } from "@/types";

export type DividendRecordLite = { date: string; amount: number | string };

export type DividendYields = {
  /** 최근 12개월 실수령 배당 합계 */
  trailing12mTotal: number;
  /** 투자 배당률(%): 합계 ÷ 총 매입원가. 분모가 0 이하이면 null */
  costYieldPct: number | null;
  /** 시가 배당률(%): 합계 ÷ 현재 평가금액. 분모가 0 이하이면 null */
  marketYieldPct: number | null;
  /** 배당 기록이 12개월 미만이면 true */
  isPartialYear: boolean;
  /** 가장 오래된 배당 기록 이후 경과 개월(0~12, 내림) */
  coveredMonths: number;
  hasRecords: boolean;
};

function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function monthsBetween(from: { y: number; m: number; d: number }, to: { y: number; m: number; d: number }) {
  let months = (to.y - from.y) * 12 + (to.m - from.m);
  if (to.d < from.d) months -= 1;
  return months;
}

export function toKstDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * 최근 12개월(오늘 포함, 12개월 전 같은 날짜 초과) 배당 합계로 투자/시가 배당률을 계산한다.
 * 기록이 12개월에 못 미치면 isPartialYear=true — 연환산하지 않고 실제 합계만 쓴다.
 */
export function computeDividendYields(
  records: DividendRecordLite[],
  totalCost: number,
  totalValue: number,
  now: Date = new Date()
): DividendYields {
  const today = parseDateKey(toKstDateKey(now))!;
  const windowStart = `${String(today.y - 1).padStart(4, "0")}-${String(today.m).padStart(2, "0")}-${String(today.d).padStart(2, "0")}`;
  const todayKey = toKstDateKey(now);

  const valid = records
    .map((r) => ({ date: String(r.date).slice(0, 10), amount: Number(r.amount) }))
    .filter((r) => parseDateKey(r.date) && Number.isFinite(r.amount));

  const hasRecords = valid.length > 0;
  const trailing12mTotal = valid
    .filter((r) => r.date > windowStart && r.date <= todayKey)
    .reduce((sum, r) => sum + r.amount, 0);

  let coveredMonths = 0;
  let isPartialYear = false;
  if (hasRecords) {
    const earliest = valid.map((r) => r.date).sort()[0];
    const parsed = parseDateKey(earliest)!;
    coveredMonths = Math.max(0, Math.min(12, monthsBetween(parsed, today)));
    isPartialYear = earliest > windowStart;
  }

  return {
    trailing12mTotal,
    costYieldPct: totalCost > 0 ? (trailing12mTotal / totalCost) * 100 : null,
    marketYieldPct: totalValue > 0 ? (trailing12mTotal / totalValue) * 100 : null,
    isPartialYear,
    coveredMonths,
    hasRecords,
  };
}

export type DailyChange = { amount: number; pct: number | null; baseDate: string; includesContribution: boolean };

type DayPeriodLike = {
  snapshotDate?: string | null;
  valueChange?: number | null;
  netContribution?: number | null;
  returnPct?: number | null;
} | null | undefined;

/** 전일(이전 스냅샷) 대비 총 평가금액 변동. 기준 스냅샷이 없으면 null */
export function computeDailyChange(period: DayPeriodLike, currentValue: number): DailyChange | null {
  if (!period || period.valueChange == null || period.snapshotDate == null) return null;
  const previousValue = currentValue - period.valueChange;
  return {
    amount: period.valueChange,
    pct: previousValue > 0 ? (period.valueChange / previousValue) * 100 : null,
    baseDate: period.snapshotDate,
    includesContribution: (period.netContribution ?? 0) !== 0,
  };
}

// ── 히트맵 ──────────────────────────────────────────────

export type HeatmapItem = {
  id: string;
  name: string;
  value: number;
  returnPct: number;
  hasCost: boolean;
  /** "기타" 묶음 칸일 때만 있다: 묶인 종목 수 */
  groupedCount?: number;
};

export type HeatmapRect = HeatmapItem & { x: number; y: number; w: number; h: number; sharePct: number };

export function toHeatmapItems(holdings: HoldingWithPnL[]): HeatmapItem[] {
  return holdings
    .filter((h) => h.current_value > 0)
    .map((h) => ({
      id: h.id,
      name: h.name,
      value: h.current_value,
      returnPct: h.profit_loss_pct,
      hasCost: h.total_cost > 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/** 이 비중(%) 미만 종목은 "기타 N종목" 한 칸으로 묶는다(정확히 이 값이면 묶지 않는다) */
export const HEATMAP_OTHER_BELOW_PCT = 2;
export const HEATMAP_OTHER_ID = "__heatmap-other__";
// 종목이 이보다 적으면 면적 비교가 의미 없고, 화면 전체를 덮는 한 가지 색 사각형이 오류처럼 보인다
export const HEATMAP_MIN_TILES = 3;

export type HeatmapGrouping = {
  /** 그릴 칸: 큰 종목 + (있으면) "기타" 칸 */
  tiles: HeatmapItem[];
  /** "기타"로 묶인 종목. 묶지 않았으면 빈 배열 */
  grouped: HeatmapItem[];
};

/**
 * 비중이 아주 작은 종목을 "기타 N종목" 칸 하나로 묶는다.
 * - 묶을 종목이 1개뿐이면 묶지 않는다(이름 없는 칸이 되어 오히려 정보가 줄어든다).
 * - 묶은 뒤 칸이 HEATMAP_MIN_TILES 개 미만이면(거의 전부 작은 종목) 묶지 않는다.
 * - 기타 칸은 원가 없음(hasCost=false)으로 두어 중립(보합) 색이 된다. 여러 종목의 수익률을 한 색으로 말하지 않는다.
 */
export function groupSmallHoldings(items: HeatmapItem[], belowPct = HEATMAP_OTHER_BELOW_PCT): HeatmapGrouping {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, i) => s + i.value, 0);
  const none: HeatmapGrouping = { tiles: sorted, grouped: [] };
  if (total <= 0) return none;

  // 부동소수점 오차를 피하려고 나눗셈 대신 곱셈으로 비교한다
  const big = sorted.filter((i) => i.value * 100 >= total * belowPct);
  const small = sorted.filter((i) => i.value * 100 < total * belowPct);
  if (small.length < 2 || big.length + 1 < HEATMAP_MIN_TILES) return none;

  const other: HeatmapItem = {
    id: HEATMAP_OTHER_ID,
    name: `기타 ${small.length}종목`,
    value: small.reduce((s, i) => s + i.value, 0),
    returnPct: 0,
    hasCost: false,
    groupedCount: small.length,
  };
  return { tiles: [...big, other].sort((a, b) => b.value - a.value), grouped: small };
}

/** 히트맵 영역의 실제 크기(px)에서 배치 비율(가로/세로)을 구한다. 측정 전·잘못된 값은 기본(폰) 비율 */
export const HEATMAP_DEFAULT_ASPECT = 1.6;
export function heatmapAspect(widthPx: number, heightPx: number): number {
  if (!(widthPx > 0) || !(heightPx > 0)) return HEATMAP_DEFAULT_ASPECT;
  return widthPx / heightPx;
}

export type HeatmapLabelLevel = "two-line" | "one-line" | "none";

// 칸 글자는 12px(text-xs, 줄 높이 15px)로 고정하고, 칸 안쪽 여백은 4px.
// 두 줄: 이름은 한글 4~5자쯤 보여야 뜻이 남는다(72px), 높이는 15×2+8 = 38 → 40px.
export const HEATMAP_TWO_LINE_MIN_W = 72;
export const HEATMAP_TWO_LINE_MIN_H = 40;
// 한 줄: "-100.00%"·"원가 없음"이 잘리지 않을 너비(≈58px + 여백 8px = 66 → 68px), 높이 15+8 → 24px.
export const HEATMAP_ONE_LINE_MIN_W = 68;
export const HEATMAP_ONE_LINE_MIN_H = 24;

/** 칸의 실제 px 크기로 글자를 얼마나 넣을지 정한다 */
export function heatmapLabelLevel(widthPx: number, heightPx: number): HeatmapLabelLevel {
  if (widthPx >= HEATMAP_TWO_LINE_MIN_W && heightPx >= HEATMAP_TWO_LINE_MIN_H) return "two-line";
  if (widthPx >= HEATMAP_ONE_LINE_MIN_W && heightPx >= HEATMAP_ONE_LINE_MIN_H) return "one-line";
  return "none";
}

/** 정사각형에 가깝게 쪼개는 squarify 배치. 결과 좌표는 0~100(%) */
export function layoutHeatmap(items: HeatmapItem[], aspect = HEATMAP_DEFAULT_ASPECT): HeatmapRect[] {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];

  const out: HeatmapRect[] = [];
  // 가로 aspect × 세로 1 공간에서 계산 후 퍼센트로 환산
  let rect = { x: 0, y: 0, w: aspect, h: 1 };
  const area = aspect;
  const scaled = sorted.map((i) => ({ item: i, a: (i.value / total) * area }));

  const worst = (row: number[], side: number) => {
    const s = row.reduce((x, y) => x + y, 0);
    const max = Math.max(...row);
    const min = Math.min(...row);
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };

  let i = 0;
  while (i < scaled.length) {
    const side = Math.min(rect.w, rect.h);
    const row: typeof scaled = [];
    while (i < scaled.length) {
      const next = [...row, scaled[i]];
      if (row.length === 0 || worst(next.map((r) => r.a), side) <= worst(row.map((r) => r.a), side)) {
        row.push(scaled[i]);
        i += 1;
      } else break;
    }
    const rowArea = row.reduce((s, r) => s + r.a, 0);
    const horizontal = rect.w >= rect.h; // 짧은 변 기준으로 세로 열을 쌓는다
    if (horizontal) {
      const colW = rowArea / rect.h;
      let y = rect.y;
      for (const r of row) {
        const h = r.a / colW;
        out.push(place(r.item, rect.x, y, colW, h, aspect, total));
        y += h;
      }
      rect = { x: rect.x + colW, y: rect.y, w: rect.w - colW, h: rect.h };
    } else {
      const rowH = rowArea / rect.w;
      let x = rect.x;
      for (const r of row) {
        const w = r.a / rowH;
        out.push(place(r.item, x, rect.y, w, rowH, aspect, total));
        x += w;
      }
      rect = { x: rect.x, y: rect.y + rowH, w: rect.w, h: rect.h - rowH };
    }
  }
  return out;
}

function place(item: HeatmapItem, x: number, y: number, w: number, h: number, aspect: number, total: number): HeatmapRect {
  return {
    ...item,
    x: (x / aspect) * 100,
    y: y * 100,
    w: (w / aspect) * 100,
    h: h * 100,
    sharePct: (item.value / total) * 100,
  };
}

export type HeatmapTone = "gain-strong" | "gain" | "flat" | "loss" | "loss-strong";

export function heatmapTone(returnPct: number, hasCost = true): HeatmapTone {
  if (!hasCost || Math.abs(returnPct) < 0.5) return "flat";
  if (returnPct >= 10) return "gain-strong";
  if (returnPct > 0) return "gain";
  if (returnPct <= -10) return "loss-strong";
  return "loss";
}
