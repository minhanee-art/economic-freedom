"use client";
// 리밸런싱 알림 — 테마별 비중 현황 및 개별 종목 조언

import { useMemo, useState } from "react";
import type { HoldingWithPnL } from "@/types";
import { formatKRW } from "@/lib/utils";

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
  const [showAdvice, setShowAdvice] = useState(false);
  const totalValue = holdings.reduce((sum, h) => sum + h.current_value, 0);

  const categoryRows = useMemo(
    () =>
      categoryData
        .filter((c) => c.target > 0 || c.current > 0)
        .map((c) => ({ ...c, diff: +(c.current - c.target).toFixed(1) }))
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)),
    [categoryData]
  );

  const categoryAlerts = categoryRows.filter(
    (c) => c.target > 0 && Math.abs(c.diff) >= CATEGORY_THRESHOLD
  );

  const holdingAlerts = holdings
    .filter((h) => h.target_pct > 0 && Math.abs(h.actual_pct - h.target_pct) >= HOLDING_THRESHOLD)
    .map((h) => ({ ...h, diff: +(h.actual_pct - h.target_pct).toFixed(1) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  if (categoryRows.length === 0) return null;

  const hasAdvice = categoryAlerts.length > 0 || holdingAlerts.length > 0;
  const overCategories = categoryAlerts.filter((c) => c.diff > 0);
  const underCategories = categoryAlerts.filter((c) => c.diff < 0);
  const topOver = overCategories[0];
  const topUnder = underCategories[0];
  const totalDrift = categoryAlerts.reduce((sum, c) => sum + Math.abs(c.diff), 0);

  return (
    <div className="border border-[var(--color-hairline)] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 space-y-4 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">테마별 비중 현황</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            내가 설정한 비중과 현재 보유 비중을 비교합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvice((value) => !value)}
          className={`inline-flex min-h-11 items-center justify-center border px-4 py-2 text-sm font-bold shadow-card transition-colors ${
            hasAdvice
              ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
          }`}
        >
          {showAdvice ? "진단 접기" : "리밸런싱 진단 보기"}
          {hasAdvice && (
            <span className="ml-2 border border-current px-1.5 py-0.5 text-[11px] tabular-nums">
              {categoryAlerts.length + holdingAlerts.length}
            </span>
          )}
        </button>
      </div>

      <div className="space-y-2">
        {categoryRows.map((c) => {
          const isOver = c.diff > 0;
          const isAlert = c.target > 0 && Math.abs(c.diff) >= CATEGORY_THRESHOLD;
          return (
            <div key={c.name} className="border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="mb-2 flex items-center gap-3">
                <span className="w-14 shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{c.name}</span>
                <div className="flex-1 flex items-center gap-1.5 text-xs text-zinc-500">
                  <span>설정 <b className="text-zinc-700 dark:text-zinc-300 tabular-nums">{c.target.toFixed(1)}%</b></span>
                  <span className="text-zinc-300 dark:text-zinc-600">·</span>
                  <span>현재 보유 <b className="text-zinc-700 dark:text-zinc-300 tabular-nums">{c.current.toFixed(1)}%</b></span>
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
              <div className="grid gap-1.5">
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full bg-zinc-400 dark:bg-zinc-500" style={{ width: `${Math.max(0, Math.min(100, c.target))}%` }} />
                </div>
                <div className="h-2 bg-indigo-100 dark:bg-indigo-950">
                  <div
                    className={`h-full ${isAlert && isOver ? "bg-red-500" : isAlert ? "bg-blue-500" : "bg-indigo-500"}`}
                    style={{ width: `${Math.max(0, Math.min(100, c.current))}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAdvice && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-3">
          {hasAdvice ? (
            <div className="border-2 border-red-200 bg-red-50 p-4 shadow-card dark:border-red-500/30 dark:bg-red-500/10">
              <p className="text-sm font-black text-red-700 dark:text-red-300">리밸런싱 추천 행동</p>
              <p className="mt-2 text-sm leading-6 text-red-700 dark:text-red-200">
                {topOver && topUnder ? (
                  <>
                    <b>{topOver.name}</b>이 설정 {topOver.target.toFixed(1)}%보다 현재 {topOver.current.toFixed(1)}%로 <b>{topOver.diff.toFixed(1)}%p 초과</b>입니다. 약 {formatKRW(totalValue * (topOver.diff / 100))} 또는 {topOver.diff.toFixed(1)}%p만큼 줄이고, <b>{topUnder.name}</b>처럼 부족한 자산군을 우선 매수하세요.
                  </>
                ) : topOver ? (
                  <>
                    <b>{topOver.name}</b>이 설정 {topOver.target.toFixed(1)}%보다 현재 {topOver.current.toFixed(1)}%로 <b>{topOver.diff.toFixed(1)}%p 초과</b>입니다. 초과분 매도를 검토하고 신규 매수는 잠시 줄이세요.
                  </>
                ) : topUnder ? (
                  <>
                    <b>{topUnder.name}</b>이 설정 {topUnder.target.toFixed(1)}%보다 현재 {topUnder.current.toFixed(1)}%로 <b>{Math.abs(topUnder.diff).toFixed(1)}%p 부족</b>입니다. 다음 매수 계획에서 이 자산군을 우선 매수하세요.
                  </>
                ) : (
                  <>종목별 비중 변동이 큽니다. 아래 종목별 조언을 확인하세요.</>
                )}
              </p>
              <p className="mt-2 text-xs font-semibold text-red-500 dark:text-red-300">
                총 이탈폭 {totalDrift.toFixed(1)}%p · 빨간색은 초과, 파란색은 부족입니다.
              </p>
            </div>
          ) : (
            <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              현재 설정 비중과 보유 비중 차이가 기준 이내입니다. 지금은 리밸런싱이 급하지 않습니다.
            </div>
          )}

          {categoryAlerts.map((c) => (
            <div key={c.name} className="flex gap-2 border-l-4 border-zinc-200 pl-3 text-sm dark:border-zinc-700">
              <span
                className={`font-semibold shrink-0 ${
                  c.diff > 0 ? "text-red-500" : "text-blue-500"
                }`}
              >
                {c.name}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                설정 {c.target.toFixed(1)}% → 현재 보유 {c.current.toFixed(1)}%: {Math.abs(c.diff).toFixed(1)}%p {c.diff > 0 ? "초과" : "부족"}. {getCategoryAdvice(c.name, c.diff)}
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
                  {h.name}: 설정 {h.target_pct.toFixed(1)}% → 현재 보유 {h.actual_pct.toFixed(1)}%{" "}
                  <span
                    className={`font-medium ${
                      h.diff > 0 ? "text-red-400" : "text-blue-400"
                    }`}
                  >
                    ({h.diff > 0 ? "+" : ""}{h.diff}%p)
                  </span>
                  <span className="ml-1">
                    {h.diff > 0
                      ? `${Math.abs(h.diff).toFixed(1)}%p 줄이고 부족한 종목 매수 검토`
                      : `${Math.abs(h.diff).toFixed(1)}%p 추가 매수 우선 검토`}
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
