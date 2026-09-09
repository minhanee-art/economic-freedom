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
  onTargetPctChange?: (holdingId: string, targetPct: number) => Promise<void>;
  onCategoryTargetPctChange?: (category: string, targetPct: number) => Promise<void>;
  savingTargetPctId?: string | null;
  savingCategoryTarget?: string | null;
}

const CATEGORY_THRESHOLD = 3;
const HOLDING_THRESHOLD = 5;

type CategorySort = "diff" | "target-desc" | "target-asc" | "current-desc" | "current-asc";

const CATEGORY_SORT_OPTIONS: { value: CategorySort; label: string }[] = [
  { value: "diff", label: "차이 큰순" },
  { value: "target-desc", label: "설정↓" },
  { value: "target-asc", label: "설정↑" },
  { value: "current-desc", label: "현재↓" },
  { value: "current-asc", label: "현재↑" },
];

function getCategoryAdvice(name: string, diff: number): string {
  if (diff > 0) return `${name} 신규 매수 자제, 다른 자산군 우선 매수`;
  return `${name} ETF 추가 매수 고려`;
}

export function RebalanceAlert({
  holdings,
  categoryData,
  onTargetPctChange,
  onCategoryTargetPctChange,
  savingTargetPctId,
  savingCategoryTarget,
}: Props) {
  const [showAdvice, setShowAdvice] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [categorySort, setCategorySort] = useState<CategorySort>("diff");
  const totalValue = holdings.reduce((sum, h) => sum + h.current_value, 0);

  const categoryRows = useMemo(
    () =>
      categoryData
        .filter((c) => c.target > 0 || c.current > 0)
        .map((c) => ({ ...c, diff: +(c.current - c.target).toFixed(1) }))
        .sort((a, b) => {
          if (categorySort === "target-desc") return b.target - a.target;
          if (categorySort === "target-asc") return a.target - b.target;
          if (categorySort === "current-desc") return b.current - a.current;
          if (categorySort === "current-asc") return a.current - b.current;
          return Math.abs(b.diff) - Math.abs(a.diff);
        }),
    [categoryData, categorySort]
  );

  const targetTotalPct = categoryRows.reduce((sum, c) => sum + c.target, 0);
  const currentTotalPct = categoryRows.reduce((sum, c) => sum + c.current, 0);
  const totalDiffPct = +(currentTotalPct - targetTotalPct).toFixed(1);

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
            개별 종목 설정 비중의 합계가 테마 설정 비중입니다. 테마 비중을 바꾸면 해당 테마 종목들이 같은 비율로 자동 조정됩니다.
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

      <div className="grid grid-cols-1 gap-2 border border-indigo-100 bg-indigo-50/70 p-3 shadow-card dark:border-indigo-500/20 dark:bg-indigo-500/10 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-500 dark:text-indigo-300">현재 총 합계 비율</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-indigo-700 dark:text-indigo-200">
            {currentTotalPct.toFixed(1)}%
          </p>
        </div>
        <div className="border-t border-indigo-100 pt-2 dark:border-indigo-500/20 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">설정 합계</p>
          <p className="mt-1 text-base font-black tabular-nums text-zinc-800 dark:text-zinc-100">
            {targetTotalPct.toFixed(1)}%
          </p>
        </div>
        <div className="border-t border-indigo-100 pt-2 dark:border-indigo-500/20 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">합계 차이</p>
          <p className={`mt-1 text-base font-black tabular-nums ${
            Math.abs(totalDiffPct) >= 0.1
              ? totalDiffPct > 0
                ? "text-red-500"
                : "text-blue-500"
              : "text-zinc-500 dark:text-zinc-400"
          }`}>
            {totalDiffPct > 0 ? "+" : ""}{totalDiffPct.toFixed(1)}%p
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border border-zinc-100 bg-zinc-50 p-2 text-xs shadow-card dark:border-zinc-800 dark:bg-zinc-950/50">
        <span className="px-1.5 font-semibold text-zinc-500 dark:text-zinc-400">테마 정렬</span>
        {CATEGORY_SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setCategorySort(option.value)}
            className={`border px-2.5 py-1.5 font-bold transition-colors ${
              categorySort === option.value
                ? "border-indigo-500 bg-indigo-500 text-white"
                : "border-zinc-200 bg-white text-zinc-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {categoryRows.map((c) => {
          const isOver = c.diff > 0;
          const isAlert = c.target > 0 && Math.abs(c.diff) >= CATEGORY_THRESHOLD;
          const categoryHoldings = holdings
            .filter((h) => h.category === c.name)
            .sort((a, b) => b.target_pct - a.target_pct);
          const isExpanded = expandedCategory === c.name;

          return (
            <div
              key={c.name}
              className="cursor-pointer border border-zinc-100 bg-zinc-50 p-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10"
              onClick={() => setExpandedCategory(isExpanded ? null : c.name)}
            >
              <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="w-14 shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{c.name}</span>
                <div className="flex-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                  <CategoryTargetEditor
                    key={`${c.name}-${c.target}`}
                    category={c.name}
                    target={c.target}
                    onCategoryTargetPctChange={onCategoryTargetPctChange}
                    isSaving={savingCategoryTarget === c.name}
                  />
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedCategory(isExpanded ? null : c.name);
                }}
                className="mt-3 text-xs font-bold text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
              >
                {isExpanded ? "종목 비중 닫기" : `${categoryHoldings.length}개 종목 보기/수정`}
              </button>

              {isExpanded && (
                <div
                  className="mt-3 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {c.name} 테마 안에서 종목별 설정 비중을 직접 수정할 수 있습니다. 저장하면 위 테마 설정 비중 합계도 바로 바뀝니다.
                  </p>
                  {categoryHoldings.map((h) => (
                    <ThemeHoldingTargetRow
                      key={`${h.id}-${h.target_pct}`}
                      holding={h}
                      onTargetPctChange={onTargetPctChange}
                      isSaving={savingTargetPctId === h.id}
                    />
                  ))}
                </div>
              )}
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

function CategoryTargetEditor({
  category,
  target,
  onCategoryTargetPctChange,
  isSaving = false,
}: {
  category: string;
  target: number;
  onCategoryTargetPctChange?: (category: string, targetPct: number) => Promise<void>;
  isSaving?: boolean;
}) {
  const [input, setInput] = useState(target.toFixed(1));
  const parsedInput = Number(input);
  const hasChange = Number.isFinite(parsedInput) && parsedInput !== target;

  async function save() {
    if (!onCategoryTargetPctChange) return;
    const nextTarget = Number(input);
    if (!Number.isFinite(nextTarget)) return;
    const clampedTarget = Math.max(0, Math.min(100, nextTarget));
    setInput(clampedTarget.toFixed(1));
    if (clampedTarget === target) return;
    await onCategoryTargetPctChange(category, clampedTarget);
  }

  return (
    <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <span>설정</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        max="100"
        step="0.5"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        disabled={!onCategoryTargetPctChange || isSaving}
        aria-label={`${category} 테마 설정 비중`}
        className="h-8 w-20 border border-zinc-200 bg-white px-2 text-right text-xs font-bold tabular-nums text-zinc-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <span>%</span>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={save}
        disabled={!onCategoryTargetPctChange || !hasChange || isSaving}
        className="h-8 border border-indigo-100 bg-indigo-50 px-2 text-[11px] font-bold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
      >
        {isSaving ? "저장중" : "저장"}
      </button>
    </span>
  );
}

function ThemeHoldingTargetRow({
  holding,
  onTargetPctChange,
  isSaving = false,
}: {
  holding: HoldingWithPnL;
  onTargetPctChange?: (holdingId: string, targetPct: number) => Promise<void>;
  isSaving?: boolean;
}) {
  const diff = holding.actual_pct - holding.target_pct;
  const isAlert = holding.target_pct > 0 && Math.abs(diff) >= HOLDING_THRESHOLD;
  const [input, setInput] = useState(holding.target_pct.toFixed(1));
  const parsedInput = Number(input);
  const hasChange = Number.isFinite(parsedInput) && parsedInput !== holding.target_pct;

  async function save() {
    if (!onTargetPctChange) return;
    const nextTarget = Number(input);
    if (!Number.isFinite(nextTarget)) return;
    const clampedTarget = Math.max(0, Math.min(100, nextTarget));
    setInput(clampedTarget.toFixed(1));
    if (clampedTarget === holding.target_pct) return;
    await onTargetPctChange(holding.id, clampedTarget);
  }

  return (
    <div className="grid gap-2 border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{holding.name}</p>
        <p className="text-xs text-zinc-400 tabular-nums">
          현재 보유 {holding.actual_pct.toFixed(1)}% · 차이{" "}
          <span className={isAlert ? (diff > 0 ? "text-red-500" : "text-blue-500") : "text-zinc-400"}>
            {diff > 0 ? "+" : ""}{diff.toFixed(1)}%p
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="100"
          step="0.5"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          disabled={!onTargetPctChange || isSaving}
          aria-label={`${holding.name} 설정 비중`}
          className="h-8 w-20 border border-zinc-200 bg-zinc-50 px-2 text-right text-sm font-bold tabular-nums text-zinc-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <span className="text-xs font-semibold text-zinc-500">%</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={save}
          disabled={!onTargetPctChange || !hasChange || isSaving}
          className="h-8 border border-indigo-100 bg-indigo-50 px-2.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          {isSaving ? "저장중" : "저장"}
        </button>
      </div>
    </div>
  );
}
