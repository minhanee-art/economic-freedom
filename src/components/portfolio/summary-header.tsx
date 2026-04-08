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
      className="rounded-xl px-5 py-5 text-white"
      style={{
        background: "linear-gradient(135deg, #1a1f36 0%, #2d3250 100%)",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-zinc-400 mb-1">총 평가금액</p>
          <p className="text-2xl font-bold">{formatKRW(totalValue)}</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="text-xs text-zinc-400 hover:text-white border border-zinc-600 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          {isRefreshing ? "갱신 중..." : "시세 새로고침"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-zinc-400 mb-0.5">총 손익</p>
          <p
            className={`text-sm font-semibold ${
              pnl >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatKRW(pnl)}
          </p>
          <p
            className={`text-xs ${
              pnl >= 0 ? "text-emerald-400/70" : "text-red-400/70"
            }`}
          >
            {formatPercent(pnlPct)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400 mb-0.5">누적 배당</p>
          <p className="text-sm font-semibold">{formatKRW(totalDividend)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400 mb-0.5">월 적립금</p>
          <p className="text-sm font-semibold">{formatKRW(monthlyBudget)}</p>
        </div>
      </div>
    </div>
  );
}
