// 포트폴리오 파생값 계산 — 손익/비중/리밸런싱 (순수 함수)
import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORY_THRESHOLD,
  HOLDING_THRESHOLD,
  computeCategoryBalances,
  computeHoldingsWithPnL,
  computeRebalance,
  getCategoryAdvice,
} from "@/lib/portfolio";
import type { CostBasis, Holding } from "@/types";

function makeHolding(over: Partial<Holding> = {}): Holding {
  return {
    id: "h1",
    user_id: "u1",
    code: "069500",
    name: "KODEX 200",
    category: "주식",
    sub_category: "국장",
    current_price: 40000,
    shares: 10,
    target_pct: 50,
    expense_ratio: 0.15,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...over,
  };
}

function makeCost(over: Partial<CostBasis> = {}): CostBasis {
  return {
    id: "c1",
    user_id: "u1",
    holding_id: "h1",
    total_cost: 300000,
    total_shares: 10,
    updated_at: "2026-01-01",
    ...over,
  };
}

test("computeHoldingsWithPnL — 평가금액·평단·손익·비중을 계산한다", () => {
  const [row] = computeHoldingsWithPnL([makeHolding()], [makeCost()]);
  assert.equal(row.current_value, 400000);
  assert.equal(row.avg_price, 30000);
  assert.equal(row.profit_loss, 100000);
  assert.equal(row.profit_loss_pct, 100000 / 300000 * 100);
  assert.equal(row.actual_pct, 100);
});

test("computeHoldingsWithPnL — 매입원가가 없는 종목은 0으로 두고 손익률 0", () => {
  const [row] = computeHoldingsWithPnL(
    [makeHolding({ current_price: 5000, shares: 2 })],
    []
  );
  assert.equal(row.total_cost, 0);
  assert.equal(row.avg_price, 0);
  assert.equal(row.current_value, 10000);
  assert.equal(row.profit_loss, 10000);
  assert.equal(row.profit_loss_pct, 0);
});

test("computeHoldingsWithPnL — 평가금액 0이면 비중 0 (0으로 나누지 않는다)", () => {
  const rows = computeHoldingsWithPnL(
    [makeHolding({ current_price: 0, shares: 0 })],
    [makeCost({ total_cost: 0, total_shares: 0 })]
  );
  assert.equal(rows[0].actual_pct, 0);
});

test("computeHoldingsWithPnL — 종목별 비중 합은 100에 근접한다", () => {
  const rows = computeHoldingsWithPnL(
    [
      makeHolding({ id: "a", current_price: 1000, shares: 30 }),
      makeHolding({ id: "b", code: "360750", current_price: 2000, shares: 20 }),
      makeHolding({ id: "c", code: "458730", current_price: 500, shares: 60 }),
    ],
    [
      makeCost({ holding_id: "a", total_cost: 24000, total_shares: 30 }),
      makeCost({ id: "c2", holding_id: "b", total_cost: 38000, total_shares: 20 }),
      makeCost({ id: "c3", holding_id: "c", total_cost: 24000, total_shares: 60 }),
    ]
  );
  const total = rows.reduce((s, r) => s + r.actual_pct, 0);
  assert.ok(Math.abs(total - 100) < 1e-9, `합계=${total}`);
  assert.equal(rows[0].actual_pct, 30000 / 100000 * 100);
});

test("computeCategoryBalances — 자산군별 목표/현재를 합산하고 차이 큰 순으로 정렬", () => {
  const rows = computeHoldingsWithPnL(
    [
      makeHolding({ id: "a", category: "주식", current_price: 6000, shares: 10, target_pct: 40 }),
      makeHolding({ id: "b", category: "주식", current_price: 2000, shares: 10, target_pct: 10 }),
      makeHolding({ id: "c", category: "채권", current_price: 2000, shares: 10, target_pct: 50 }),
    ],
    [
      makeCost({ holding_id: "a", total_cost: 40000, total_shares: 10 }),
      makeCost({ id: "c2", holding_id: "b", total_cost: 20000, total_shares: 10 }),
      makeCost({ id: "c3", holding_id: "c", total_cost: 18000, total_shares: 10 }),
    ]
  );
  const cats = computeCategoryBalances(rows);
  assert.deepEqual(cats.map((c) => c.name), ["주식", "채권"]);
  const stock = cats.find((c) => c.name === "주식")!;
  assert.equal(stock.target, 50);
  assert.equal(stock.current, 80);
  assert.equal(stock.diff, 30);
  const bond = cats.find((c) => c.name === "채권")!;
  assert.equal(bond.target, 50);
  assert.equal(bond.current, 20);
  assert.equal(bond.diff, -30);
});

test("computeCategoryBalances — 목표·현재가 모두 0인 자산군은 제외한다", () => {
  const rows = computeHoldingsWithPnL(
    [makeHolding({ current_price: 0, shares: 0, target_pct: 0 })],
    []
  );
  assert.deepEqual(computeCategoryBalances(rows), []);
});

test("computeRebalance — 임계치(자산군 3%p, 종목 5%p)를 넘은 항목만 알림으로", () => {
  const rows = computeHoldingsWithPnL(
    [
      makeHolding({ id: "a", category: "주식", current_price: 8000, shares: 10, target_pct: 40 }),
      makeHolding({ id: "b", category: "채권", current_price: 2000, shares: 10, target_pct: 60 }),
    ],
    [
      makeCost({ holding_id: "a", total_cost: 60000, total_shares: 10 }),
      makeCost({ id: "c2", holding_id: "b", total_cost: 20000, total_shares: 10 }),
    ]
  );
  const result = computeRebalance(rows);
  assert.equal(CATEGORY_THRESHOLD, 3);
  assert.equal(HOLDING_THRESHOLD, 5);
  assert.deepEqual(result.categoryAlerts.map((c) => c.name), ["주식", "채권"]);
  // 주식 80% vs 40% → +40%p, 채권 20% vs 60% → -40%p, 정렬은 절대값 기준
  assert.deepEqual(result.holdingAlerts.map((h) => h.id), ["a", "b"]);
  assert.equal(result.holdingAlerts[0].diff, 40);
  assert.equal(result.holdingAlerts[1].diff, -40);
});

test("computeRebalance — 목표 비중 0인 종목은 종목 알림에서 제외한다", () => {
  const rows = computeHoldingsWithPnL(
    [
      makeHolding({ id: "a", current_price: 9000, shares: 10, target_pct: 100 }),
      makeHolding({ id: "b", code: "458730", current_price: 1000, shares: 10, target_pct: 0 }),
    ],
    []
  );
  const result = computeRebalance(rows);
  assert.deepEqual(result.holdingAlerts.map((h) => h.id), ["a"]);
});

test("computeRebalance — 임계치 미만이면 알림이 비어 있다", () => {
  const rows = computeHoldingsWithPnL(
    [makeHolding({ current_price: 5000, shares: 10, target_pct: 100 })],
    [makeCost({ total_cost: 50000, total_shares: 10 })]
  );
  const result = computeRebalance(rows);
  assert.deepEqual(result.categoryAlerts, []);
  assert.deepEqual(result.holdingAlerts, []);
  assert.equal(result.categories.length, 1);
});

test("getCategoryAdvice — 초과/부족에 따라 매수 방향 문구가 다르다", () => {
  assert.equal(getCategoryAdvice("주식", 5), "주식 신규 매수 자제, 다른 자산군 우선 매수");
  assert.equal(getCategoryAdvice("채권", -5), "채권 ETF 추가 매수 고려");
  assert.equal(getCategoryAdvice("금", 0), "금 ETF 추가 매수 고려");
});
