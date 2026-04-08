"use client";

import type { HoldingWithPnL } from "@/types";

interface RebalanceAlertProps {
  holdings: HoldingWithPnL[];
}

export function RebalanceAlert({ holdings }: RebalanceAlertProps) {
  // 목표비중이 0보다 크고, 괴리가 5%p 이상인 종목
  const alerts = holdings.filter(
    (h) => h.target_pct > 0 && Math.abs(h.actual_pct - h.target_pct) >= 5
  );

  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3 space-y-2">
      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
        리밸런싱 알림
      </p>
      {alerts.map((h) => {
        const diff = h.actual_pct - h.target_pct;
        return (
          <p key={h.id} className="text-sm text-amber-800 dark:text-amber-300">
            {h.name}: 목표 {h.target_pct}% → 현재 {h.actual_pct.toFixed(1)}%{" "}
            <span className="font-medium">
              ({diff > 0 ? "▲" : "▼"}
              {Math.abs(diff).toFixed(1)}%p 괴리)
            </span>
          </p>
        );
      })}
    </div>
  );
}
