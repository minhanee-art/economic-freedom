"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Holding, CostBasis, HoldingWithPnL } from "@/types";
import { usePortfolioStore } from "@/stores/portfolio-store";
import { SummaryHeader } from "@/components/portfolio/summary-header";
import { RebalanceAlert } from "@/components/portfolio/rebalance-alert";
import { HoldingCard } from "@/components/portfolio/holding-card";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { AllocationBarChart } from "@/components/charts/allocation-bar-chart";

interface Props {
  initialHoldings: Holding[];
  initialCostBases: CostBasis[];
  monthlyBudget: number;
  totalDividend: number;
  lastPriceUpdate: string | null;
}

function computeHoldingsWithPnL(
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

export function DashboardClient({
  initialHoldings,
  initialCostBases,
  monthlyBudget,
  totalDividend,
  lastPriceUpdate,
}: Props) {
  const { setHoldings, setCostBases } = usePortfolioStore();
  const [holdings, setLocalHoldings] = useState(initialHoldings);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState("");
  const router = useRouter();

  useEffect(() => {
    setHoldings(initialHoldings);
    setCostBases(initialCostBases);
  }, [initialHoldings, initialCostBases, setHoldings, setCostBases]);

  // 마지막 업데이트가 1일 이상 지났으면 자동 새로고침
  useEffect(() => {
    if (!lastPriceUpdate) return;
    const lastUpdate = new Date(lastPriceUpdate).getTime();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (lastUpdate < oneDayAgo) {
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshResult("");

    try {
      const codes = holdings.map((h) => h.code);
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });

      if (!res.ok) throw new Error("API 호출 실패");

      const { prices, errors } = (await res.json()) as {
        prices: Record<string, number>;
        errors: string[];
      };

      const updatedCodes = Object.keys(prices);
      if (updatedCodes.length === 0) {
        setRefreshResult("시세 조회 실패 — 잠시 후 다시 시도해주세요");
        setIsRefreshing(false);
        return;
      }

      // DB 일괄 업데이트
      const updatePromises = holdings
        .filter((h) => prices[h.code] && prices[h.code] !== h.current_price)
        .map((h) =>
          fetch("/api/holdings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: h.id, current_price: prices[h.code] }),
          })
        );
      await Promise.all(updatePromises);

      // last_price_update 저장
      await fetch("/api/settings/price-update", { method: "POST" });

      // 로컬 state 갱신
      const updatedHoldings = holdings.map((h) =>
        prices[h.code] ? { ...h, current_price: prices[h.code] } : h
      );
      setLocalHoldings(updatedHoldings);
      setHoldings(updatedHoldings);

      const failCount = errors.length;
      setRefreshResult(
        `${updatedCodes.length}개 종목 시세 업데이트 완료${
          failCount > 0 ? ` (${failCount}개 실패)` : ""
        }`
      );

      // 서버 데이터도 리프레시
      router.refresh();
    } catch (err) {
      setRefreshResult(`시세 조회 실패: ${(err as Error).message}`);
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshResult(""), 4000);
    }
  }, [holdings, router, setHoldings]);

  const holdingsWithPnL = computeHoldingsWithPnL(holdings, initialCostBases);

  const totalValue = holdingsWithPnL.reduce((s, h) => s + h.current_value, 0);
  const totalCost = holdingsWithPnL.reduce((s, h) => s + h.total_cost, 0);

  const activeHoldings = holdingsWithPnL.filter(
    (h) => h.shares > 0 || h.target_pct > 0
  );

  // 자산군별 파이차트 데이터
  const categoryMap = new Map<string, number>();
  holdingsWithPnL.forEach((h) => {
    if (h.current_value > 0) {
      categoryMap.set(
        h.category,
        (categoryMap.get(h.category) ?? 0) + h.current_value
      );
    }
  });
  const pieData = Array.from(categoryMap.entries()).map(([name, value]) => ({
    name,
    value,
    pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
  }));

  // 자산군별 비중 비교 바 차트 데이터
  const categoryTargetMap = new Map<string, number>();
  const categoryCurrentMap = new Map<string, number>();
  holdingsWithPnL.forEach((h) => {
    categoryTargetMap.set(
      h.category,
      (categoryTargetMap.get(h.category) ?? 0) + h.target_pct
    );
    categoryCurrentMap.set(
      h.category,
      (categoryCurrentMap.get(h.category) ?? 0) + h.actual_pct
    );
  });
  const barData = Array.from(
    new Set([...categoryTargetMap.keys(), ...categoryCurrentMap.keys()])
  ).map((name) => ({
    name,
    target: categoryTargetMap.get(name) ?? 0,
    current: Number((categoryCurrentMap.get(name) ?? 0).toFixed(1)),
  }));

  return (
    <div className="space-y-5">
      {/* 시세 업데이트 결과 */}
      {refreshResult && (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
            refreshResult.includes("실패")
              ? "bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
              : "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
          }`}
        >
          {refreshResult}
        </div>
      )}

      {/* 요약 헤더 */}
      <SummaryHeader
        totalValue={totalValue}
        totalCost={totalCost}
        totalDividend={totalDividend}
        monthlyBudget={monthlyBudget}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* 리밸런싱 알림 */}
      <RebalanceAlert holdings={holdingsWithPnL} />

      {/* 차트 영역 */}
      {totalValue > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h3 className="text-sm font-semibold mb-3">자산군별 비중</h3>
            <CategoryPieChart data={pieData} />
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h3 className="text-sm font-semibold mb-3">
              현재 vs 목표 비중
            </h3>
            <AllocationBarChart data={barData} />
          </div>
        </div>
      )}

      {/* 종목 리스트 */}
      <div>
        <h3 className="text-sm font-semibold mb-3">
          보유 종목 ({activeHoldings.length})
        </h3>
        <div className="space-y-2">
          {activeHoldings.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center">
              아직 보유 종목이 없습니다. 매수 계획에서 첫 매수를 시작해보세요.
            </p>
          ) : (
            activeHoldings.map((h) => <HoldingCard key={h.id} holding={h} />)
          )}
        </div>
      </div>
    </div>
  );
}
