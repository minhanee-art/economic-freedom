// 대시보드 클라이언트 — 시세 자동 갱신, 테마별 그룹·정렬, 차트
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Holding, CostBasis, HoldingWithPnL } from "@/types";
import { usePortfolioStore } from "@/stores/portfolio-store";
import { computeHoldingsWithPnL } from "@/lib/portfolio";
import { SummaryHeader } from "@/components/portfolio/summary-header";
import { RebalanceAlert } from "@/components/portfolio/rebalance-alert";
import { HoldingCard } from "@/components/portfolio/holding-card";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { AllocationBarChart } from "@/components/charts/allocation-bar-chart";
import { getCategoryColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

interface Props {
  initialHoldings: Holding[];
  initialCostBases: CostBasis[];
  monthlyBudget: number;
  totalDividend: number;
  lastPriceUpdate: string | null;
}

type GroupBy = "none" | "category" | "sub_category";
type SortBy = "default" | "weight_desc" | "pnl_desc" | "pnl_asc";

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
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [sortBy, setSortBy] = useState<SortBy>("default");
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

      await fetch("/api/settings/price-update", { method: "POST" });

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

  // 정렬
  const sortedHoldings = useMemo(() => {
    return [...activeHoldings].sort((a, b) => {
      if (sortBy === "pnl_desc") return b.profit_loss_pct - a.profit_loss_pct;
      if (sortBy === "pnl_asc") return a.profit_loss_pct - b.profit_loss_pct;
      if (sortBy === "weight_desc") return b.actual_pct - a.actual_pct;
      return b.target_pct - a.target_pct;
    });
  }, [activeHoldings, sortBy]);

  // 그룹핑
  const holdingGroups = useMemo(() => {
    if (groupBy === "none") return [{ label: "", items: sortedHoldings }];
    const key = groupBy === "category" ? "category" : "sub_category";
    const map = new Map<string, HoldingWithPnL[]>();
    for (const h of sortedHoldings) {
      const k = String(h[key] || "기타");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(h);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [sortedHoldings, groupBy]);

  // 파이차트 데이터
  const categoryMap = new Map<string, number>();
  holdingsWithPnL.forEach((h) => {
    if (h.current_value > 0) {
      categoryMap.set(h.category, (categoryMap.get(h.category) ?? 0) + h.current_value);
    }
  });
  const pieData = Array.from(categoryMap.entries()).map(([name, value]) => ({
    name,
    value,
    pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
  }));

  // 바차트 데이터
  const categoryTargetMap = new Map<string, number>();
  const categoryCurrentMap = new Map<string, number>();
  holdingsWithPnL.forEach((h) => {
    categoryTargetMap.set(h.category, (categoryTargetMap.get(h.category) ?? 0) + h.target_pct);
    categoryCurrentMap.set(h.category, (categoryCurrentMap.get(h.category) ?? 0) + h.actual_pct);
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

      <SummaryHeader
        totalValue={totalValue}
        totalCost={totalCost}
        totalDividend={totalDividend}
        monthlyBudget={monthlyBudget}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <RebalanceAlert holdings={holdingsWithPnL} categoryData={barData} />

      {totalValue > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h3 className="text-sm font-semibold mb-3">자산군별 비중</h3>
            <CategoryPieChart data={pieData} />
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h3 className="text-sm font-semibold mb-3">현재 vs 목표 비중</h3>
            <AllocationBarChart data={barData} />
          </div>
        </div>
      )}

      {/* 종목 리스트 */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">
            보유 종목 ({activeHoldings.length})
          </h3>

          {activeHoldings.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* 그룹 컨트롤 */}
              <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
                <span className="px-2 py-1 text-zinc-400 shrink-0 border-r border-zinc-200 dark:border-zinc-700">그룹</span>
                {(
                  [
                    { value: "none", label: "전체" },
                    { value: "category", label: "자산군" },
                    { value: "sub_category", label: "세부테마" },
                  ] as { value: GroupBy; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGroupBy(opt.value)}
                    className={cn(
                      "px-2 py-1 transition-colors",
                      groupBy === opt.value
                        ? "bg-indigo-500 text-white"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* 정렬 컨트롤 */}
              <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
                <span className="px-2 py-1 text-zinc-400 shrink-0 border-r border-zinc-200 dark:border-zinc-700">정렬</span>
                {(
                  [
                    { value: "default", label: "목표비중" },
                    { value: "weight_desc", label: "현재비중" },
                    { value: "pnl_desc", label: "수익↓" },
                    { value: "pnl_asc", label: "수익↑" },
                  ] as { value: SortBy; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={cn(
                      "px-2 py-1 transition-colors",
                      sortBy === opt.value
                        ? "bg-indigo-500 text-white"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeHoldings.length === 0 ? (
          <p className="text-sm text-zinc-400 py-8 text-center">
            아직 보유 종목이 없습니다. 매수 계획에서 첫 매수를 시작해보세요.
          </p>
        ) : (
          <div className="space-y-4">
            {holdingGroups.map((group) => (
              <div key={group.label || "_all"}>
                {group.label && (
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: getCategoryColor(group.label) }}
                    />
                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                    <span className="text-xs text-zinc-400">{group.items.length}종목</span>
                  </div>
                )}
                <div className="space-y-2">
                  {group.items.map((h) => (
                    <HoldingCard key={h.id} holding={h} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
