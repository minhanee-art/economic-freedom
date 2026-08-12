"use client";

import { formatKRW, formatPercent } from "@/lib/utils";

interface SummaryHeaderProps {
  totalValue: number;
  totalCost: number;
  totalDividend: number;
  monthlyBudget: number;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function SummaryHeader({
  totalValue,
  totalCost,
  totalDividend,
  monthlyBudget,
  onRefresh,
  isRefreshing,
}: SummaryHeaderProps) {
  const pnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  return (
    <div
      className="px-5 py-5 text-white shadow-float sm:px-6 sm:py-6"
      style={{
        background:
          "linear-gradient(135deg, #1c1e54 0%, #2e2b8c 55%, #533afd 100%)",
      }}
    >
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-200 mb-1.5">
            총 평가금액
          </p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
            {formatKRW(totalValue)}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex min-h-10 w-full items-center justify-center border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20 active:scale-[0.98] disabled:opacity-50 sm:w-auto"
        >
          {isRefreshing ? "갱신 중..." : "시세 새로고침"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div>
          <p className="text-xs text-indigo-200 mb-0.5">총 손익</p>
          <p
            className={`text-sm font-semibold tabular-nums ${
              pnl >= 0 ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {formatKRW(pnl)}
          </p>
          <p
            className={`text-xs tabular-nums ${
              pnl >= 0 ? "text-emerald-300/70" : "text-red-300/70"
            }`}
          >
            {formatPercent(pnlPct)}
          </p>
        </div>
        <div>
          <p className="text-xs text-indigo-200 mb-0.5">누적 배당</p>
          <p className="text-sm font-semibold tabular-nums">{formatKRW(totalDividend)}</p>
        </div>
        <div>
          <p className="text-xs text-indigo-200 mb-0.5">월 적립금</p>
          <p className="text-sm font-semibold tabular-nums">{formatKRW(monthlyBudget)}</p>
        </div>
      </div>
    </div>
  );
}
