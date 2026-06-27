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
      className="rounded-2xl px-6 py-6 text-white shadow-float"
      style={{
        background:
          "linear-gradient(135deg, #1c1e54 0%, #2e2b8c 55%, #533afd 100%)",
      }}
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-200 mb-1.5">
            총 평가금액
          </p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {formatKRW(totalValue)}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-1.5 transition-colors disabled:opacity-50"
        >
          {isRefreshing ? "갱신 중..." : "시세 새로고침"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
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
