import test from "node:test";
import assert from "node:assert/strict";

import { calculateBuyPlan, calculateAnnualPlan } from "@/lib/buy-algorithm";
import type { Holding } from "@/types";

function holding(overrides: Partial<Holding> & Pick<Holding, "id" | "current_price" | "target_pct">): Holding {
  return {
    user_id: "user-1",
    code: overrides.id,
    name: overrides.id,
    category: "주식",
    sub_category: "국장",
    shares: 0,
    expense_ratio: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

test("calculateBuyPlan: 예산이 0 이하면 아무것도 사지 않는다", () => {
  const result = calculateBuyPlan([holding({ id: "A", current_price: 10_000, target_pct: 100 })], [], 0);
  assert.deepEqual(result, { items: [], totalCost: 0, remaining: 0 });
});

test("calculateBuyPlan: 목표 비중이 있는 종목이 없으면 빈 계획", () => {
  const result = calculateBuyPlan([holding({ id: "A", current_price: 10_000, target_pct: 0 })], [], 100_000);
  assert.deepEqual(result, { items: [], totalCost: 0, remaining: 100_000 });
});

test("calculateBuyPlan: 목표 비중대로 예산을 나눠 정수 수량을 산다", () => {
  const holdings = [
    holding({ id: "A", current_price: 10_000, target_pct: 50 }),
    holding({ id: "B", current_price: 10_000, target_pct: 50 }),
  ];
  const result = calculateBuyPlan(holdings, [], 100_000);
  assert.equal(result.items.length, 2);
  assert.equal(result.totalCost, 100_000);
  assert.equal(result.remaining, 0);
  for (const item of result.items) {
    assert.equal(item.quantity, 5);
    assert.equal(item.cost, 50_000);
    assert.equal(item.idealRatio, 0.5);
    assert.equal(item.currentPct, 0);
    assert.equal(item.isPriority, true);
    assert.equal(item.cycleMonths, 1);
  }
});

test("calculateBuyPlan: 남은 예산은 괴리가 큰 종목에 우선 배정한다", () => {
  const holdings = [
    holding({ id: "A", current_price: 30_000, target_pct: 50 }),
    holding({ id: "B", current_price: 10_000, target_pct: 50 }),
  ];
  const result = calculateBuyPlan(holdings, [], 100_000);
  const byId = Object.fromEntries(result.items.map((i) => [i.holding.id, i]));
  assert.equal(byId.A.quantity, 1);
  assert.equal(byId.B.quantity, 7);
  assert.equal(result.totalCost, 100_000);
  assert.equal(result.remaining, 0);
});

test("calculateBuyPlan: 초과 비중 종목은 우선순위에서 빠진다", () => {
  const holdings = [
    holding({ id: "A", current_price: 10_000, target_pct: 50, shares: 90 }),
    holding({ id: "B", current_price: 10_000, target_pct: 50, shares: 10 }),
  ];
  const result = calculateBuyPlan(holdings, [], 100_000);
  const byId = Object.fromEntries(result.items.map((i) => [i.holding.id, i]));
  assert.equal(byId.A.currentPct, 90);
  assert.equal(byId.B.currentPct, 10);
  assert.equal(byId.A.isPriority, false);
  assert.equal(byId.B.isPriority, true);
  assert.ok(byId.B.gapPct > byId.A.gapPct);
});

test("calculateBuyPlan: 1주 가격이 월 배분보다 크면 적립 회차로 1주만 산다", () => {
  const holdings = [
    holding({ id: "A", current_price: 100_000, target_pct: 10 }),
    holding({ id: "B", current_price: 500_000, target_pct: 90 }),
  ];
  const result = calculateBuyPlan(holdings, [], 200_000);
  const byId = Object.fromEntries(result.items.map((i) => [i.holding.id, i]));
  assert.equal(byId.A.cycleMonths, 5);
  assert.equal(byId.A.minBudget, 1_000_000);
  assert.equal(byId.A.isCycleDue, true);
  assert.equal(byId.A.isCycleBuy, true);
  assert.equal(byId.A.quantity, 1);
  assert.equal(byId.B.quantity, 0);
  assert.equal(result.totalCost, 100_000);
  assert.equal(result.remaining, 100_000);
});

test("calculateBuyPlan: 최근에 산 종목은 적립 회차가 아니다", () => {
  const holdings = [
    holding({ id: "A", current_price: 100_000, target_pct: 10 }),
    holding({ id: "B", current_price: 500_000, target_pct: 90 }),
  ];
  const result = calculateBuyPlan(holdings, [], 200_000, {
    today: new Date(2026, 2, 15),
    lastPurchaseDates: { A: "2026-01-20" },
  });
  const a = result.items.find((i) => i.holding.id === "A")!;
  assert.equal(a.monthsSinceLastBuy, 2);
  assert.equal(a.isCycleDue, false);
  assert.equal(a.isCycleBuy, false);
  assert.equal(a.quantity, 0);
});

test("calculateBuyPlan: 회차가 지나면 다시 1주 산다", () => {
  const holdings = [
    holding({ id: "A", current_price: 100_000, target_pct: 10 }),
    holding({ id: "B", current_price: 500_000, target_pct: 90 }),
  ];
  const result = calculateBuyPlan(holdings, [], 200_000, {
    today: new Date(2026, 7, 1),
    lastPurchaseDates: { A: "2026-01-20" },
  });
  const a = result.items.find((i) => i.holding.id === "A")!;
  assert.equal(a.monthsSinceLastBuy, 7);
  assert.equal(a.isCycleDue, true);
  assert.equal(a.isCycleBuy, true);
});

test("calculateBuyPlan: 잘못된 매수일은 경과 개월을 알 수 없다", () => {
  const holdings = [
    holding({ id: "A", current_price: 100_000, target_pct: 10 }),
    holding({ id: "B", current_price: 500_000, target_pct: 90 }),
  ];
  const result = calculateBuyPlan(holdings, [], 200_000, {
    today: new Date(2026, 7, 1),
    lastPurchaseDates: { A: "2026/01/20" },
  });
  const a = result.items.find((i) => i.holding.id === "A")!;
  assert.equal(a.monthsSinceLastBuy, null);
  assert.equal(a.isCycleDue, true);
});

test("calculateBuyPlan: 예산을 넘겨 사지 않고 괴리 큰 순으로 정렬한다", () => {
  const holdings = [
    holding({ id: "A", current_price: 7_000, target_pct: 20 }),
    holding({ id: "B", current_price: 11_000, target_pct: 30 }),
    holding({ id: "C", current_price: 3_000, target_pct: 50 }),
  ];
  const result = calculateBuyPlan(holdings, [], 123_456);
  assert.ok(result.totalCost <= 123_456);
  assert.ok(result.remaining >= 0);
  assert.equal(result.totalCost + result.remaining, 123_456);
  const sumCost = result.items.reduce((s, i) => s + i.cost, 0);
  assert.equal(sumCost, result.totalCost);
  for (const item of result.items) {
    assert.equal(item.cost, item.quantity * item.holding.current_price);
  }
  const gaps = result.items.map((i) => i.gapPct);
  assert.deepEqual(gaps, [...gaps].sort((a, b) => b - a));
});

test("calculateAnnualPlan: 연간 예산을 목표 비중대로 나눈다", () => {
  const holdings = [
    holding({ id: "A", current_price: 30_000, target_pct: 50 }),
    holding({ id: "B", current_price: 10_000, target_pct: 50 }),
  ];
  const result = calculateAnnualPlan(holdings, 100_000);
  assert.equal(result.annualBudget, 1_200_000);
  const byId = Object.fromEntries(result.items.map((i) => [i.holding.id, i]));
  assert.equal(byId.A.quantity, 20);
  assert.equal(byId.B.quantity, 60);
  assert.equal(result.totalCost, 1_200_000);
  assert.equal(result.leftover, 0);
  assert.equal(byId.A.monthsPerShare, 0.6);
  assert.equal(byId.B.monthsPerShare, 0.2);
});

test("calculateAnnualPlan: 남은 금액으로 부족한 종목에 1주씩 더한다", () => {
  const holdings = [
    holding({ id: "A", current_price: 130_000, target_pct: 50 }),
    holding({ id: "B", current_price: 130_000, target_pct: 50 }),
  ];
  const result = calculateAnnualPlan(holdings, 100_000);
  const byId = Object.fromEntries(result.items.map((i) => [i.holding.id, i]));
  assert.equal(byId.A.quantity, 5);
  assert.equal(byId.B.quantity, 4);
  assert.equal(result.totalCost, 1_170_000);
  assert.equal(result.leftover, 30_000);
});

test("calculateAnnualPlan: 예산이 0이면 빈 계획", () => {
  const result = calculateAnnualPlan([holding({ id: "A", current_price: 10_000, target_pct: 100 })], 0);
  assert.deepEqual(result, { items: [], annualBudget: 0, totalCost: 0, leftover: 0 });
});
