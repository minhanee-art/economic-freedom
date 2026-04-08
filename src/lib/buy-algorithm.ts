import type { Holding, CostBasis } from "@/types";

export interface BuyPlanItem {
  holding: Holding;
  quantity: number;
  cost: number;
  idealRatio: number;    // 이번 투자에서의 이상적 비중
  currentPct: number;    // 현재 실제 비중
  targetPct: number;     // 목표 비중
  gapPct: number;        // 비중 괴리 (목표 - 현재)
  isPriority: boolean;   // 우선 매수 대상
}

export interface BuyPlanResult {
  items: BuyPlanItem[];
  totalCost: number;
  remaining: number;
}

export function calculateBuyPlan(
  holdings: Holding[],
  costBases: CostBasis[],
  budget: number
): BuyPlanResult {
  if (budget <= 0) {
    return { items: [], totalCost: 0, remaining: budget };
  }

  // 목표 비중이 설정된 종목만 대상
  const targets = holdings.filter((h) => h.target_pct > 0 && h.current_price > 0);
  if (targets.length === 0) {
    return { items: [], totalCost: 0, remaining: budget };
  }

  // 현재 총 평가금액 계산
  const totalCurrentValue = holdings.reduce(
    (s, h) => s + h.current_price * h.shares,
    0
  );

  // 현재 비중 계산
  const currentPctMap = new Map<string, number>();
  holdings.forEach((h) => {
    const pct =
      totalCurrentValue > 0
        ? (h.current_price * h.shares) / totalCurrentValue * 100
        : 0;
    currentPctMap.set(h.id, pct);
  });

  // 전체 목표비중 합
  const totalTargetPct = targets.reduce((s, h) => s + h.target_pct, 0);

  // 1단계: 이상적 배분으로 기본 수량 계산
  const plan = targets.map((h) => {
    const idealRatio = h.target_pct / totalTargetPct;
    const idealAmount = budget * idealRatio;
    const quantity = Math.floor(idealAmount / h.current_price);
    const cost = quantity * h.current_price;
    const currentPct = currentPctMap.get(h.id) ?? 0;
    const gapPct = h.target_pct - currentPct;

    return {
      holding: h,
      quantity,
      cost,
      idealRatio,
      currentPct,
      targetPct: h.target_pct,
      gapPct,
      isPriority: gapPct >= 3,
    };
  });

  // 사용한 금액 계산
  let spent = plan.reduce((s, p) => s + p.cost, 0);
  let remaining = budget - spent;

  // 2단계: 남은 예산으로 비중 괴리가 큰 종목부터 추가 1주씩 매수
  const sorted = [...plan].sort((a, b) => b.gapPct - a.gapPct);

  let changed = true;
  while (changed && remaining > 0) {
    changed = false;
    for (const item of sorted) {
      if (item.holding.current_price <= remaining) {
        item.quantity += 1;
        item.cost += item.holding.current_price;
        spent += item.holding.current_price;
        remaining -= item.holding.current_price;
        changed = true;
      }
    }
  }

  // 수량이 0인 종목 제외하지 않고 모두 반환 (UI에서 0주도 표시)
  // 비중 괴리 큰 순서로 정렬
  plan.sort((a, b) => b.gapPct - a.gapPct);

  return {
    items: plan,
    totalCost: spent,
    remaining,
  };
}
