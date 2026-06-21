"use client";
// 리밸런싱 알림 — 테마별 비중 현황 및 개별 종목 조언

import type { HoldingWithPnL } from "@/types";

interface CategoryBalance {
  name: string;
  target: number;
  current: number;
}

interface Props {
  holdings: HoldingWithPnL[];
  categoryData: CategoryBalance[];
}

const CATEGORY_THRESHOLD = 3;
const HOLDING_THRESHOLD = 5;

function getCategoryAdvice(name: string, diff: number): string {
  if (diff > 0) return `${name} 신규 매수 자제, 다른 자산군 우선 매수`;
  return `${name} ETF 추가 매수 고려`;
}

export function RebalanceAlert({ holdings, categoryData }: Props) {
  const categoryRows = categoryData
    .filter((c) => c.target > 0 || c.current > 0)
    .map((c) => ({ ...c, diff: +(c.current - c.target).toFixed(1) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const categoryAlerts = categoryRows.filter(
    (c) => c.target > 0 && Math.abs(c.diff) >= CATEGORY_THRESHOLD
  );

  const holdingAlerts = holdings
    .filter((h) => h.target_pct > 0 && Math.abs(h.actual_pct - h.target_pct) >= HOLDING_THRESHOLD)
    .map((h) => ({ ...h, diff: +(h.actual_pct - h.target_pct).toFixed(1) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  if (categoryRows.length === 0) return null;

  const hasAdvice = categoryAlerts.length > 0 || holdingAlerts.length > 0;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 space-y-3">
      <p className="text-sm font-semibold">테마별 비중 현황</p>

      <div className="space-y-2">
        {categoryRows.map((c) => {
          const isOver = c.diff > 0;
          const isAlert = c.target > 0 && Math.abs(c.diff) >= CATEGORY_THRESHOLD;
          return (
            <div key={c.name} className="flex items-center gap-3">
              <span className="text-sm text-zinc-700 dark:text-zinc-300 w-14 shrink-0">{c.name}</span>
              <div className="flex-1 flex items-center gap-1.5 text-xs text-zinc-500">
                <span>목표 <b className="text-zinc-700 dark:text-zinc-300">{c.target.toFixed(1)}%</b></span>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span>현재 <b className="text-zinc-700 dark:text-zinc-300">{c.current.toFixed(1)}%</b></span>
              </div>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  !isAlert
                    ? "text-zinc-400"
                    : isOver
                    ? "text-red-500"
                    : "text-blue-500"
                }`}
              >
                {isOver ? "+" : ""}{c.diff}%p
                {isAlert && (isOver ? " 초과" : " 부족")}
              </span>
            </div>
          );
        })}
      </div>

      {hasAdvice && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-2">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            리밸런싱 조언
          </p>

          {categoryAlerts.map((c) => (
            <div key={c.name} className="flex gap-2 text-sm">
              <span
                className={`font-semibold shrink-0 ${
                  c.diff > 0 ? "text-red-500" : "text-blue-500"
                }`}
              >
                {c.name}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {getCategoryAdvice(c.name, c.diff)}
              </span>
            </div>
          ))}

          {holdingAlerts.length > 0 && (
            <div className="mt-1 space-y-1.5">
              <p className="text-xs text-zinc-400">종목별</p>
              {holdingAlerts.map((h) => (
                <div
                  key={h.id}
                  className="pl-2 border-l-2 border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400"
                >
                  {h.name}: 목표 {h.target_pct}% → 현재 {h.actual_pct.toFixed(1)}%{" "}
                  <span
                    className={`font-medium ${
                      h.diff > 0 ? "text-red-400" : "text-blue-400"
                    }`}
                  >
                    ({h.diff > 0 ? "+" : ""}{h.diff}%p)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
