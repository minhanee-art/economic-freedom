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
  minBudget: number;     // 이 비중으로 1주 사려면 필요한 월 투자금액
  cycleMonths: number;   // 몇 개월에 1주인지 (1 = 매달 매수)
  monthsSinceLastBuy: number | null; // 마지막 매수 이후 경과 개월 (기록 없으면 null)
  isCycleDue: boolean;   // 이번 달이 적립 회차인지
  isCycleBuy: boolean;   // 이번 계획에서 적립 회차로 1주 편성됐는지
}

export interface BuyPlanResult {
  items: BuyPlanItem[];
  totalCost: number;
  remaining: number;
}

export interface BuyPlanOptions {
  /** 종목별 마지막 매수일 (YYYY-MM-DD). 적립 주기 도래 판정에 사용 */
  lastPurchaseDates?: Record<string, string>;
  /** 기준일 (기본: 오늘 KST) */
  today?: Date;
}

function kstDateParts(date: Date): { year: number; month: number } {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [year, month] = ymd.split("-").map(Number);
  return { year, month };
}

/** 마지막 매수일부터 기준일까지 경과한 개월 수 (달력 기준) */
function monthsBetween(from: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(from);
  if (!m) return null;
  const t = kstDateParts(today);
  const months =
    (t.year - Number(m[1])) * 12 + (t.month - Number(m[2]));
  return Math.max(0, months);
}

export function calculateBuyPlan(
  holdings: Holding[],
  costBases: CostBasis[],
  budget: number,
  options: BuyPlanOptions = {}
): BuyPlanResult {
  const { lastPurchaseDates = {}, today = new Date() } = options;
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
    const minBudget = idealRatio > 0 ? h.current_price / idealRatio : 0;
    const cycleMonths = Math.max(1, Math.ceil(h.current_price / idealAmount));
    const lastBuy = lastPurchaseDates[h.id];
    const monthsSinceLastBuy = lastBuy ? monthsBetween(lastBuy, today) : null;
    // 주기가 2개월 이상이면 매달 1주를 살 수 없으므로 회차로 판정
    const isCycleDue =
      cycleMonths > 1 &&
      quantity === 0 &&
      (monthsSinceLastBuy === null || monthsSinceLastBuy >= cycleMonths);

    return {
      holding: h,
      quantity,
      cost,
      idealRatio,
      currentPct,
      targetPct: h.target_pct,
      gapPct,
      isPriority: gapPct >= 3,
      minBudget,
      cycleMonths,
      monthsSinceLastBuy,
      isCycleDue,
      isCycleBuy: false,
    };
  });

  // 사용한 금액 계산
  let spent = plan.reduce((s, p) => s + p.cost, 0);
  let remaining = budget - spent;

  // 1.5단계: 적립 회차가 도래한 종목(1주 가격 > 월 배분)부터 1주씩 우선 배정
  const dueItems = plan
    .filter((p) => p.isCycleDue)
    .sort((a, b) => b.gapPct - a.gapPct);
  for (const item of dueItems) {
    if (item.holding.current_price <= remaining) {
      item.quantity += 1;
      item.cost += item.holding.current_price;
      spent += item.holding.current_price;
      remaining -= item.holding.current_price;
      item.isCycleBuy = true;
    }
  }

  // 2단계: 남은 예산으로 비중 괴리가 큰 종목부터 추가 1주씩 매수
  const sorted = [...plan].sort((a, b) => b.gapPct - a.gapPct);

  let changed = true;
  while (changed && remaining > 0) {
    changed = false;
    for (const item of sorted) {
      // 적립 주기 종목은 회차가 도래한 1주만 산다 (잔여금으로 추가 매수하지 않음)
      if (item.cycleMonths > 1) continue;
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
