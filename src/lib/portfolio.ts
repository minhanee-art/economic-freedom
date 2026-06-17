// 포트폴리오 계산 로직 — 대시보드 클라이언트와 월간 리포트(Cron)가 공유
import type { Holding, CostBasis, HoldingWithPnL } from "@/types";

/** 보유 종목 + 매입원가 → 손익/비중 파생값 계산 */
export function computeHoldingsWithPnL(
  holdings: Holding[],
  costBases: CostBasis[]
): HoldingWithPnL[] {
  const cbMap = new Map(costBases.map((cb) => [cb.holding_id, cb]));
  const totalValue = holdings.reduce(
    (s, h) => s + h.current_price * h.shares,
    0
  );

  return holdings.map((h) => {
    const cb = cbMap.get(h.id);
    const currentValue = h.current_price * h.shares;
    const totalCost = cb?.total_cost ?? 0;
    const totalShares = cb?.total_shares ?? 0;
    const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
    const profitLoss = currentValue - totalCost;
    const profitLossPct = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;
    const actualPct = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;

    return {
      ...h,
      total_cost: totalCost,
      avg_price: avgPrice,
      current_value: currentValue,
      profit_loss: profitLoss,
      profit_loss_pct: profitLossPct,
      actual_pct: actualPct,
    };
  });
}

export interface CategoryBalance {
  name: string;
  target: number;   // 목표 비중 합
  current: number;  // 현재 비중 합
  diff: number;     // 현재 - 목표 (%p)
}

/** 자산군별 목표 vs 현재 비중 (대시보드 barData / RebalanceAlert categoryRows와 동일) */
export function computeCategoryBalances(
  holdings: HoldingWithPnL[]
): CategoryBalance[] {
  const targetMap = new Map<string, number>();
  const currentMap = new Map<string, number>();
  for (const h of holdings) {
    targetMap.set(h.category, (targetMap.get(h.category) ?? 0) + h.target_pct);
    currentMap.set(h.category, (currentMap.get(h.category) ?? 0) + h.actual_pct);
  }
  return Array.from(new Set([...targetMap.keys(), ...currentMap.keys()]))
    .map((name) => {
      const target = targetMap.get(name) ?? 0;
      const current = +(currentMap.get(name) ?? 0).toFixed(1);
      return { name, target, current, diff: +(current - target).toFixed(1) };
    })
    .filter((c) => c.target > 0 || c.current > 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

// 리밸런싱 임계치 (RebalanceAlert와 동일)
export const CATEGORY_THRESHOLD = 3;
export const HOLDING_THRESHOLD = 5;

export interface RebalanceResult {
  categories: CategoryBalance[];
  categoryAlerts: CategoryBalance[];
  holdingAlerts: (HoldingWithPnL & { diff: number })[];
}

/** 리밸런싱 분석 — 임계치를 넘은 자산군/종목 추출 */
export function computeRebalance(holdings: HoldingWithPnL[]): RebalanceResult {
  const categories = computeCategoryBalances(holdings);

  const categoryAlerts = categories.filter(
    (c) => c.target > 0 && Math.abs(c.diff) >= CATEGORY_THRESHOLD
  );

  const holdingAlerts = holdings
    .filter(
      (h) =>
        h.target_pct > 0 &&
        Math.abs(h.actual_pct - h.target_pct) >= HOLDING_THRESHOLD
    )
    .map((h) => ({ ...h, diff: +(h.actual_pct - h.target_pct).toFixed(1) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return { categories, categoryAlerts, holdingAlerts };
}

/** 자산군 조언 문구 (RebalanceAlert getCategoryAdvice와 동일) */
export function getCategoryAdvice(name: string, diff: number): string {
  if (diff > 0) return `${name} 신규 매수 자제, 다른 자산군 우선 매수`;
  return `${name} ETF 추가 매수 고려`;
}
