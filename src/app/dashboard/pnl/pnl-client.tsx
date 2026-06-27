"use client";

import type { Holding, CostBasis, PurchaseRecord } from "@/types";
import { formatKRW, formatPercent, cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/colors";
import { PnLAreaChart } from "@/components/charts/pnl-area-chart";

interface HoldingPnL {
  id: string;
  code: string;
  name: string;
  category: string;
  shares: number;
  currentPrice: number;
  avgPrice: number;
  totalCost: number;
  currentValue: number;
  profitLoss: number;
  profitLossPct: number;
}

interface Props {
  holdings: Holding[];
  costBases: CostBasis[];
  purchaseRecords: PurchaseRecord[];
  totalDividend: number;
}

function computePnL(holdings: Holding[], costBases: CostBasis[]): HoldingPnL[] {
  const cbMap = new Map(costBases.map((cb) => [cb.holding_id, cb]));

  return holdings
    .filter((h) => h.shares > 0)
    .map((h) => {
      const cb = cbMap.get(h.id);
      const totalCost = cb?.total_cost ?? 0;
      const totalShares = cb?.total_shares ?? 0;
      const avgPrice = totalShares > 0 ? Math.round(totalCost / totalShares) : 0;
      const currentValue = h.current_price * h.shares;
      const profitLoss = currentValue - totalCost;
      const profitLossPct = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

      return {
        id: h.id,
        code: h.code,
        name: h.name,
        category: h.category,
        shares: h.shares,
        currentPrice: h.current_price,
        avgPrice,
        totalCost,
        currentValue,
        profitLoss,
        profitLossPct,
      };
    })
    .sort((a, b) => b.profitLoss - a.profitLoss);
}

export function PnLClient({
  holdings,
  costBases,
  purchaseRecords,
  totalDividend,
}: Props) {
  const pnlList = computePnL(holdings, costBases);

  const totalCost = pnlList.reduce((s, h) => s + h.totalCost, 0);
  const totalValue = pnlList.reduce((s, h) => s + h.currentValue, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // 자산군별 손익 요약
  const categoryMap = new Map<
    string,
    { cost: number; value: number; pnl: number }
  >();
  pnlList.forEach((h) => {
    const prev = categoryMap.get(h.category) ?? {
      cost: 0,
      value: 0,
      pnl: 0,
    };
    categoryMap.set(h.category, {
      cost: prev.cost + h.totalCost,
      value: prev.value + h.currentValue,
      pnl: prev.pnl + h.profitLoss,
    });
  });

  // 추이 차트 데이터
  const chartData = buildChartData(purchaseRecords, holdings, costBases);

  const isEmpty = pnlList.length === 0;

  return (
    <div className="space-y-5">
      {/* 총 수익 현황 */}
      <div
        className="rounded-2xl px-6 py-6 text-white shadow-float"
        style={{
          background:
            "linear-gradient(135deg, #1c1e54 0%, #2e2b8c 55%, #533afd 100%)",
        }}
      >
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-medium text-indigo-200 mb-1">총 투입금액</p>
            <p className="text-lg font-semibold tabular-nums tracking-tight">{formatKRW(totalCost)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-indigo-200 mb-1">현재 평가금액</p>
            <p className="text-lg font-semibold tabular-nums tracking-tight">{formatKRW(totalValue)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-indigo-200 mb-1">평가손익</p>
            <p
              className={cn(
                "text-lg font-semibold tabular-nums tracking-tight",
                totalPnL >= 0 ? "text-emerald-300" : "text-red-300"
              )}
            >
              {formatKRW(totalPnL)}
            </p>
            <p
              className={cn(
                "text-xs tabular-nums",
                totalPnL >= 0 ? "text-emerald-300/70" : "text-red-300/70"
              )}
            >
              {formatPercent(totalPnLPct)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-indigo-200 mb-1">누적 배당</p>
            <p className="text-lg font-semibold tabular-nums tracking-tight">{formatKRW(totalDividend)}</p>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-2xl border border-[var(--color-hairline)] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-12 text-center shadow-card">
          <p className="text-sm text-ink-mute dark:text-zinc-400">
            보유 종목이 없습니다. 매수 후 손익이 표시됩니다.
          </p>
        </div>
      ) : (
        <>
          {/* 추이 차트 */}
          {chartData.length >= 2 && (
            <div className="rounded-2xl border border-[var(--color-hairline)] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card transition-shadow hover:shadow-float">
              <h3 className="text-sm font-semibold text-ink mb-3">
                투입 vs 평가 추이
              </h3>
              <PnLAreaChart data={chartData} />
            </div>
          )}

          {/* 자산군별 손익 요약 */}
          <div className="rounded-2xl border border-[var(--color-hairline)] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card transition-shadow hover:shadow-float">
            <h3 className="text-sm font-semibold text-ink mb-3">자산군별 손익</h3>
            <div className="grid grid-cols-2 gap-3">
              {Array.from(categoryMap.entries()).map(([cat, data]) => {
                const pct =
                  data.cost > 0 ? (data.pnl / data.cost) * 100 : 0;
                return (
                  <div
                    key={cat}
                    className="flex items-start gap-2 rounded-xl border border-[var(--color-hairline)] dark:border-zinc-700 bg-canvas-soft dark:bg-zinc-800 px-3 py-2.5"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                      style={{
                        background: getCategoryColor(cat),
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink-mute">{cat}</p>
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          data.pnl >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {formatKRW(data.pnl)}{" "}
                        <span className="text-xs font-normal tabular-nums">
                          ({formatPercent(pct)})
                        </span>
                      </p>
                      <p className="text-[11px] text-zinc-400 tabular-nums">
                        {formatKRW(data.cost)} → {formatKRW(data.value)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 종목별 손익 리스트 */}
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3">
              종목별 손익 ({pnlList.length})
            </h3>
            <div className="space-y-2">
              {pnlList.map((h) => (
                <div
                  key={h.id}
                  className="flex rounded-xl border border-[var(--color-hairline)] dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-card transition-shadow hover:shadow-float"
                >
                  <div
                    className="w-1.5 shrink-0"
                    style={{
                      background:
                        h.profitLoss >= 0 ? "#10b981" : "#ef4444",
                    }}
                  />
                  <div className="flex-1 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-ink">{h.name}</p>
                        <p className="text-xs text-zinc-400 tabular-nums">
                          {h.code} · {h.shares}주
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            h.profitLoss >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {formatKRW(h.profitLoss)}
                        </p>
                        <p
                          className={cn(
                            "text-xs tabular-nums",
                            h.profitLoss >= 0
                              ? "text-emerald-500"
                              : "text-red-500"
                          )}
                        >
                          {formatPercent(h.profitLossPct)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex gap-3 text-xs text-zinc-400 tabular-nums">
                      <span>
                        평균단가 ₩{h.avgPrice.toLocaleString()}
                      </span>
                      <span>→</span>
                      <span>
                        현재가 ₩{h.currentPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** 매수 기록 기반 추이 데이터 생성 */
function buildChartData(
  records: PurchaseRecord[],
  holdings: Holding[],
  costBases: CostBasis[]
) {
  if (records.length === 0) return [];

  // 과거 시점의 실제 시장 평가금액은 당시 시세가 없어 복원할 수 없다.
  // 따라서 과거 구간은 투입원금(원가) 기준선으로 표시하고, 실제 평가금액은
  // 아래에서 현재 시점 한 점으로만 추가한다(여기서 손익 괴리가 드러난다).
  let cumulativeCost = 0;
  const data = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      cumulativeCost += r.total_spent;
      return {
        date: r.date,
        invested: cumulativeCost,
        value: cumulativeCost,
      };
    });

  // 현재 시점 추가
  const currentValue = holdings.reduce(
    (s, h) => s + h.current_price * h.shares,
    0
  );
  const totalInvested = costBases.reduce((s, cb) => s + cb.total_cost, 0);

  if (totalInvested > 0) {
    const today = new Date().toISOString().split("T")[0];
    const lastDate = data[data.length - 1]?.date;
    if (lastDate !== today) {
      data.push({
        date: today,
        invested: totalInvested,
        value: currentValue,
      });
    }
  }

  return data;
}
