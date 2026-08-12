"use client";

import type { HoldingWithPnL } from "@/types";
import { formatKRW, cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/colors";

interface HoldingCardProps {
  holding: HoldingWithPnL;
}

export function HoldingCard({ holding: h }: HoldingCardProps) {
  const diff = h.actual_pct - h.target_pct;
  const showDiff = h.target_pct > 0 && Math.abs(diff) >= 3;
  const hasPnL = h.total_cost > 0;

  return (
    <div className="flex overflow-hidden border border-[var(--color-hairline)] bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float dark:border-zinc-800 dark:bg-zinc-900">
      {/* 카테고리 색상 바 */}
      <div
        className="w-1.5 shrink-0"
        style={{ background: getCategoryColor(h.category) }}
      />

      <div className="flex-1 space-y-3 px-4 py-3">
        {/* 상단: 종목명 + 코드 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{h.name}</p>
            <p className="text-xs text-zinc-400 tabular-nums">{h.code}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-semibold tabular-nums">{formatKRW(h.current_value)}</p>
            <p className="text-xs text-zinc-400 tabular-nums">
              {h.shares}주 × ₩{h.current_price.toLocaleString()}
            </p>
          </div>
        </div>

        {/* 뱃지 행 */}
        <div className="flex flex-wrap gap-1.5">
          <Badge label={`목표 ${h.target_pct}%`} variant="default" />
          <Badge
            label={`현재 ${h.actual_pct.toFixed(1)}%`}
            variant="indigo"
          />
          {hasPnL && (
            <Badge
              label={`${h.profit_loss >= 0 ? "+" : ""}${formatKRW(h.profit_loss)}`}
              variant={h.profit_loss >= 0 ? "green" : "red"}
            />
          )}
          {showDiff && (
            <Badge
              label={`${diff > 0 ? "▲" : "▼"}${Math.abs(diff).toFixed(1)}%p`}
              variant="amber"
            />
          )}
          {h.expense_ratio > 0 && (
            <Badge label={`총보수 ${h.expense_ratio}%`} variant="default" />
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({
  label,
  variant,
}: {
  label: string;
  variant: "default" | "indigo" | "green" | "red" | "amber";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 text-xs font-medium tabular-nums",
        variant === "default" && "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
        variant === "indigo" && "border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-900/30 dark:text-indigo-400",
        variant === "green" && "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-900/30 dark:text-emerald-400",
        variant === "red" && "border-red-100 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-900/30 dark:text-red-400",
        variant === "amber" && "border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-900/30 dark:text-amber-400"
      )}
    >
      {label}
    </span>
  );
}
