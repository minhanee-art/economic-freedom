"use client";
// 리밸런싱 알림 — 테마별 비중 현황 및 개별 종목 조언

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CostBasis, Holding, HoldingWithPnL } from "@/types";
import { formatKRW } from "@/lib/utils";
import { HoldingCard } from "@/components/portfolio/holding-card";
import { CATEGORIES } from "@/lib/constants";

interface CategoryBalance {
  name: string;
  target: number;
  current: number;
}

type NewHoldingPayload = {
  code: string;
  name: string;
  category: (typeof CATEGORIES)[number];
  sub_category: string;
  current_price: number;
  target_pct: number;
  shares: number;
  avg_price: number;
};

type HoldingDetailsPatch = {
  code?: string;
  name?: string;
  shares?: number;
  avg_price?: number;
};

interface Props {
  holdings: HoldingWithPnL[];
  categoryData: CategoryBalance[];
  onTargetPctChange?: (holdingId: string, targetPct: number) => Promise<void>;
  onCategoryTargetPctChange?: (category: string, targetPct: number) => Promise<void>;
  onTradeComplete?: (result: { holding: Holding; costBasis: CostBasis | null }) => void;
  onAddHolding?: (payload: NewHoldingPayload) => Promise<void>;
  onDeleteHolding?: (holdingId: string) => Promise<void>;
  onHoldingDetailsChange?: (holdingId: string, patch: HoldingDetailsPatch) => Promise<void>;
  savingTargetPctId?: string | null;
  savingCategoryTarget?: string | null;
}

const CATEGORY_THRESHOLD = 3;
const HOLDING_THRESHOLD = 5;
const HIDDEN_HOLDING_IDS_STORAGE_KEY = "pension-manager:hidden-holding-ids";

type CategorySort = "diff" | "target-desc" | "target-asc" | "current-desc" | "current-asc" | "name-asc" | "name-desc";
type HoldingSort = "return-desc" | "code-asc" | "name-asc" | "name-desc" | "shares-desc" | "shares-asc";
type HoldingViewMode = "wide" | "grid" | "chart";
type CandlePeriod = "day" | "week" | "month" | "year";

interface CandlePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const CATEGORY_SORT_OPTIONS: { value: CategorySort; label: string }[] = [
  { value: "diff", label: "차이 큰순" },
  { value: "target-desc", label: "설정↓" },
  { value: "target-asc", label: "설정↑" },
  { value: "current-desc", label: "현재↓" },
  { value: "current-asc", label: "현재↑" },
  { value: "name-asc", label: "테마명↑" },
  { value: "name-desc", label: "테마명↓" },
];

const HOLDING_SORT_OPTIONS: { value: HoldingSort; label: string }[] = [
  { value: "return-desc", label: "수익률순" },
  { value: "code-asc", label: "티커순" },
  { value: "name-asc", label: "종목명↑" },
  { value: "name-desc", label: "종목명↓" },
  { value: "shares-desc", label: "보유수량↓" },
  { value: "shares-asc", label: "보유수량↑" },
];

const HOLDING_VIEW_OPTIONS: { value: HoldingViewMode; label: string }[] = [
  { value: "wide", label: "상세+차트" },
  { value: "grid", label: "상세" },
  { value: "chart", label: "간단" },
];

const CANDLE_PERIOD_OPTIONS: { value: CandlePeriod; label: string }[] = [
  { value: "day", label: "일봉" },
  { value: "week", label: "주봉" },
  { value: "month", label: "월봉" },
  { value: "year", label: "년봉" },
];

function normalizeSortText(value: string): string {
  return value.replace(/\s/g, "").toLocaleUpperCase("ko-KR");
}

function inferHoldingCode(name: string): string {
  const normalized = name.replace(/\s/g, "");
  if (
    normalized.includes("TIGER미국S&P500") ||
    normalized.includes("TIGER미국SP500") ||
    normalized.includes("TIGER미국에스앤피500")
  ) {
    return "360750";
  }
  return "";
}

function holdingCodeForSort(holding: HoldingWithPnL): string {
  return holding.code || inferHoldingCode(holding.name) || holding.name;
}

function readStoredHiddenHoldingIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(HIDDEN_HOLDING_IDS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function compareHoldingBySort(a: HoldingWithPnL, b: HoldingWithPnL, sort: HoldingSort): number {
  if (sort === "code-asc") {
    return normalizeSortText(holdingCodeForSort(a)).localeCompare(
      normalizeSortText(holdingCodeForSort(b)),
      "ko-KR",
      { numeric: true }
    );
  }
  if (sort === "name-asc") {
    return normalizeSortText(a.name).localeCompare(normalizeSortText(b.name), "ko-KR", {
      numeric: true,
    });
  }
  if (sort === "name-desc") {
    return normalizeSortText(b.name).localeCompare(normalizeSortText(a.name), "ko-KR", {
      numeric: true,
    });
  }
  if (sort === "shares-desc") {
    const shareDiff = b.shares - a.shares;
    if (shareDiff !== 0) return shareDiff;
    return normalizeSortText(a.name).localeCompare(normalizeSortText(b.name), "ko-KR", {
      numeric: true,
    });
  }
  if (sort === "shares-asc") {
    const shareDiff = a.shares - b.shares;
    if (shareDiff !== 0) return shareDiff;
    return normalizeSortText(a.name).localeCompare(normalizeSortText(b.name), "ko-KR", {
      numeric: true,
    });
  }
  const returnDiff = b.profit_loss_pct - a.profit_loss_pct;
  if (returnDiff !== 0) return returnDiff;
  return normalizeSortText(a.name).localeCompare(normalizeSortText(b.name), "ko-KR", {
    numeric: true,
  });
}

function getCategoryAdvice(name: string, diff: number): string {
  if (diff > 0) return `${name} 신규 매수 자제, 다른 자산군 우선 매수`;
  return `${name} ETF 추가 매수 고려`;
}

export function RebalanceAlert({
  holdings,
  categoryData,
  onTargetPctChange,
  onCategoryTargetPctChange,
  onTradeComplete,
  onAddHolding,
  onDeleteHolding,
  onHoldingDetailsChange,
  savingTargetPctId,
  savingCategoryTarget,
}: Props) {
  const [showAdvice, setShowAdvice] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showThemeWeights, setShowThemeWeights] = useState(true);
  const [showHoldingsOnly, setShowHoldingsOnly] = useState(false);
  const [expandedHiddenCategory, setExpandedHiddenCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [manualHiddenHoldingIds, setManualHiddenHoldingIds] = useState<string[]>(readStoredHiddenHoldingIds);
  const [showHiddenHoldings, setShowHiddenHoldings] = useState(false);
  const [categorySort, setCategorySort] = useState<CategorySort>("diff");
  const [holdingSort, setHoldingSort] = useState<HoldingSort>("return-desc");
  const [holdingSearch, setHoldingSearch] = useState("");
  const [holdingViewMode, setHoldingViewMode] = useState<HoldingViewMode>("wide");
  const totalValue = holdings.reduce((sum, h) => sum + h.current_value, 0);

  useEffect(() => {
    try {
      window.localStorage.setItem(HIDDEN_HOLDING_IDS_STORAGE_KEY, JSON.stringify(manualHiddenHoldingIds));
    } catch {
      // localStorage 저장 실패는 UI 표시만 유지합니다.
    }
  }, [manualHiddenHoldingIds]);

  const manualHiddenHoldingIdSet = useMemo(
    () => new Set(manualHiddenHoldingIds),
    [manualHiddenHoldingIds]
  );

  function setHoldingManuallyHidden(holdingId: string, hidden: boolean) {
    setManualHiddenHoldingIds((prev) => {
      if (hidden) {
        return prev.includes(holdingId) ? prev : [...prev, holdingId];
      }
      return prev.filter((id) => id !== holdingId);
    });
  }

  const categoryRows = useMemo(() => {
    const holdingCategoryNames = new Set(holdings.map((h) => h.category));
    return categoryData
      .filter((c) => c.target > 0 || c.current > 0 || holdingCategoryNames.has(c.name))
      .map((c) => ({ ...c, diff: +(c.current - c.target).toFixed(1) }))
      .sort((a, b) => {
        if (categorySort === "target-desc") return b.target - a.target;
        if (categorySort === "target-asc") return a.target - b.target;
        if (categorySort === "current-desc") return b.current - a.current;
        if (categorySort === "current-asc") return a.current - b.current;
        if (categorySort === "name-asc") return normalizeSortText(a.name).localeCompare(normalizeSortText(b.name), "ko-KR", { numeric: true });
        if (categorySort === "name-desc") return normalizeSortText(b.name).localeCompare(normalizeSortText(a.name), "ko-KR", { numeric: true });
        return Math.abs(b.diff) - Math.abs(a.diff);
      });
  }, [categoryData, categorySort, holdings]);

  const targetTotalPct = categoryRows.reduce((sum, c) => sum + c.target, 0);
  const currentTotalPct = categoryRows.reduce((sum, c) => sum + c.current, 0);
  const totalDiffPct = +(currentTotalPct - targetTotalPct).toFixed(1);

  const categoryAlerts = categoryRows.filter(
    (c) => c.target > 0 && Math.abs(c.diff) >= CATEGORY_THRESHOLD
  );

  const holdingAlerts = holdings
    .filter((h) => !manualHiddenHoldingIdSet.has(h.id) && h.target_pct > 0 && Math.abs(h.actual_pct - h.target_pct) >= HOLDING_THRESHOLD)
    .map((h) => ({ ...h, diff: +(h.actual_pct - h.target_pct).toFixed(1) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const normalizedHoldingSearch = normalizeSortText(holdingSearch.trim());
  const searchedHoldings = normalizedHoldingSearch
    ? holdings
        .filter((h) => !manualHiddenHoldingIdSet.has(h.id))
        .filter((h) => {
          const haystack = normalizeSortText(
            [h.code, inferHoldingCode(h.name), h.name, h.category, h.sub_category]
              .filter(Boolean)
              .join(" ")
          );
          return haystack.includes(normalizedHoldingSearch);
        })
        .sort((a, b) => compareHoldingBySort(a, b, holdingSort))
    : [];
  const holdingsOnlyRows = useMemo(
    () => [...holdings]
      .filter((h) => !manualHiddenHoldingIdSet.has(h.id))
      .sort((a, b) => compareHoldingBySort(a, b, holdingSort)),
    [holdings, holdingSort, manualHiddenHoldingIdSet]
  );
  const manualHiddenHoldings = useMemo(
    () => holdings
      .filter((h) => manualHiddenHoldingIdSet.has(h.id))
      .sort((a, b) => compareHoldingBySort(a, b, holdingSort)),
    [holdings, holdingSort, manualHiddenHoldingIdSet]
  );

  const hasAdvice = categoryAlerts.length > 0 || holdingAlerts.length > 0;
  const overCategories = categoryAlerts.filter((c) => c.diff > 0);
  const underCategories = categoryAlerts.filter((c) => c.diff < 0);
  const topOver = overCategories[0];
  const topUnder = underCategories[0];
  const totalDrift = categoryAlerts.reduce((sum, c) => sum + Math.abs(c.diff), 0);

  function renderHoldingVisibilityControl(holding: HoldingWithPnL, isHidden = false) {
    return (
      <label className="flex items-center justify-between gap-3 border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
        <span>{isHidden ? "숨김 목록에 있음" : "목록에서 숨기기"}</span>
        <span className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={manualHiddenHoldingIdSet.has(holding.id)}
            onChange={(e) => setHoldingManuallyHidden(holding.id, e.target.checked)}
            className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
          />
          <span>{isHidden ? "숨김" : "숨김"}</span>
        </span>
      </label>
    );
  }

  function renderHoldingCollection(items: HoldingWithPnL[], emptyText: string, keyPrefix = "holding") {
    if (items.length === 0) {
      return (
        <p className="border border-zinc-200 bg-white p-3 text-xs font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {emptyText}
        </p>
      );
    }

    if (holdingViewMode === "chart") {
      return (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {items.map((holding) => (
            <div key={`${keyPrefix}-chart-${holding.id}`} className="space-y-1.5">
              {renderHoldingVisibilityControl(holding)}
              <HoldingMiniChart holding={holding} />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={holdingViewMode === "grid" ? "grid grid-cols-1 gap-2 xl:grid-cols-2" : "space-y-2"}>
        {items.map((holding) => {
          const card = (
            <div key={`${keyPrefix}-${holding.id}`} className="space-y-1.5">
              {renderHoldingVisibilityControl(holding)}
              <HoldingCard
                holding={holding}
                portfolioTotalValue={totalValue}
                onTargetPctChange={onTargetPctChange}
                onTradeComplete={onTradeComplete}
                onHoldingDetailsChange={onHoldingDetailsChange}
                isSavingTargetPct={savingTargetPctId === holding.id}
              />
            </div>
          );

          if (holdingViewMode === "wide") {
            return (
              <HoldingWideChartCard key={`${keyPrefix}-${holding.id}`} holding={holding}>
                {card}
              </HoldingWideChartCard>
            );
          }

          return card;
        })}
      </div>
    );
  }

  if (categoryRows.length === 0) {
    return (
      <div className="border border-[var(--color-hairline)] bg-white px-5 py-4 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">새 계좌 시작하기</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            아직 이 계좌에 종목이 없습니다. 아래에서 종목을 추가하면서 대분류/소분류와 설정비중을 입력하면 테마별 비율이 바로 만들어집니다.
          </p>
        </div>
        {onAddHolding ? (
          <AddHoldingForm onAddHolding={onAddHolding} />
        ) : (
          <p className="border border-zinc-200 bg-zinc-50 p-3 text-xs font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            종목 추가 권한이 없습니다.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border border-[var(--color-hairline)] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 space-y-4 shadow-card">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">테마별 비중 현황</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            개별 종목 설정 비중의 합계가 테마 설정 비중입니다. 테마 비중을 바꾸면 해당 테마 종목들이 같은 비율로 자동 조정됩니다.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-4 xl:w-auto xl:min-w-[520px]">
          <button
            type="button"
            onClick={() => setShowThemeWeights((value) => !value)}
            aria-pressed={showThemeWeights}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 border px-3 py-2 text-xs font-black shadow-card transition-colors ${
              showThemeWeights
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            }`}
          >
            <span className="text-[10px]">{showThemeWeights ? "●" : "○"}</span>
            테마
          </button>
          <button
            type="button"
            onClick={() => setShowHoldingsOnly((value) => !value)}
            aria-pressed={showHoldingsOnly}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 border px-3 py-2 text-xs font-black shadow-card transition-colors ${
              showHoldingsOnly
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            }`}
          >
            <span className="text-[10px]">{showHoldingsOnly ? "●" : "○"}</span>
            종목
          </button>
          <button
            type="button"
            onClick={() => setShowAddHolding((value) => !value)}
            disabled={!onAddHolding}
            aria-pressed={showAddHolding}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 border px-3 py-2 text-xs font-black shadow-card transition-colors disabled:opacity-50 ${
              showAddHolding
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                : "border-zinc-200 bg-white text-zinc-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
            }`}
          >
            <span>{showAddHolding ? "−" : "+"}</span>
            종목추가
          </button>
          <button
            type="button"
            onClick={() => setShowAdvice((value) => !value)}
            aria-pressed={showAdvice}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 border px-3 py-2 text-xs font-black shadow-card transition-colors ${
              showAdvice
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                : hasAdvice
                ? "border-zinc-200 bg-white text-red-600 hover:border-red-200 hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-red-300 dark:hover:border-red-500/30 dark:hover:bg-red-500/10"
                : "border-zinc-200 bg-white text-zinc-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
            }`}
          >
            진단
            {hasAdvice && (
              <span className="border border-current px-1.5 py-0.5 text-[10px] tabular-nums">
                {categoryAlerts.length + holdingAlerts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {showAddHolding && onAddHolding && (
        <AddHoldingForm onAddHolding={onAddHolding} />
      )}

      {showHiddenHoldings && (
        <section className="space-y-3 border border-zinc-200 bg-white p-3 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">숨긴 종목</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                체크로 숨긴 종목 {manualHiddenHoldings.length}개입니다. 체크를 해제하면 원래 목록에 다시 표시됩니다.
              </p>
            </div>
            {manualHiddenHoldings.length > 0 && (
              <button
                type="button"
                onClick={() => setManualHiddenHoldingIds([])}
                className="self-start border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-black text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-white hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                전체 숨김 해제
              </button>
            )}
          </div>
          {manualHiddenHoldings.length === 0 ? (
            <p className="border border-zinc-200 bg-zinc-50 p-3 text-xs font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              체크해서 숨긴 종목이 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {manualHiddenHoldings.map((holding) => (
                <div key={`manual-hidden-${holding.id}`} className="space-y-1.5">
                  {renderHoldingVisibilityControl(holding, true)}
                  <HoldingCard
                    holding={holding}
                    portfolioTotalValue={totalValue}
                    onTargetPctChange={onTargetPctChange}
                    onTradeComplete={onTradeComplete}
                    onHoldingDetailsChange={onHoldingDetailsChange}
                    isSavingTargetPct={savingTargetPctId === holding.id}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="border border-zinc-100 bg-zinc-50 p-3 shadow-card dark:border-zinc-800 dark:bg-zinc-950/50">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black text-zinc-700 dark:text-zinc-200">보유종목 검색</p>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              종목명·종목번호·테마로 검색해서 바로 설정비중 조정, 매수, 매도할 수 있습니다.
            </p>
          </div>
          {holdingSearch && (
            <button
              type="button"
              onClick={() => setHoldingSearch("")}
              className="self-start border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
            >
              검색 초기화
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
          </svg>
          <input
            type="search"
            value={holdingSearch}
            onChange={(e) => setHoldingSearch(e.target.value)}
            placeholder="예: 나스닥, TIGER, 360750, 배당"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          />
        </div>
        {normalizedHoldingSearch && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-zinc-600 dark:text-zinc-300">
                검색 결과 {searchedHoldings.length}개
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {searchedHoldings.length > 0 && (
                  <span className="mr-1 text-zinc-400">숨김 종목 포함</span>
                )}
                {HOLDING_SORT_OPTIONS.map((option) => (
                  <button
                    key={`search-${option.value}`}
                    type="button"
                    onClick={() => setHoldingSort(option.value)}
                    className={`border px-2 py-1 font-bold transition-colors ${
                      holdingSort === option.value
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-zinc-200 bg-white text-zinc-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {renderHoldingCollection(searchedHoldings, "일치하는 보유종목이 없습니다.", "search")}
          </div>
        )}
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
        <span className="px-1.5 font-semibold text-zinc-500 dark:text-zinc-400">보기</span>
        {HOLDING_VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setHoldingViewMode(option.value)}
            className={`border px-2.5 py-1.5 font-bold transition-colors ${
              holdingViewMode === option.value
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-zinc-200 bg-white text-zinc-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {option.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
        <span className="px-1.5 font-semibold text-zinc-500 dark:text-zinc-400">종목 정렬</span>
        {HOLDING_SORT_OPTIONS.map((option) => (
          <button
            key={`holding-global-${option.value}`}
            type="button"
            onClick={() => setHoldingSort(option.value)}
            className={`border px-2.5 py-1.5 font-bold transition-colors ${
              holdingSort === option.value
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-zinc-200 bg-white text-zinc-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {option.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
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

      {showHoldingsOnly && (
        <section className="space-y-3 border border-zinc-200 bg-white p-3 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div>
              <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">전체 종목</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                테마 묶음 없이 전체 보유종목 {holdingsOnlyRows.length}개를 선택한 보기·정렬 기준으로 확인합니다.
              </p>
            </div>
          </div>
          {renderHoldingCollection(holdingsOnlyRows, "표시할 보유종목이 없습니다.", "all-holdings")}
        </section>
      )}

      {showThemeWeights ? (
        <div className="space-y-2">
        {categoryRows.map((c) => {
          const isOver = c.diff > 0;
          const isAlert = c.target > 0 && Math.abs(c.diff) >= CATEGORY_THRESHOLD;
          const allCategoryHoldings = holdings.filter((h) => h.category === c.name);
          const categoryHoldings = allCategoryHoldings
            .filter((h) => h.shares > 0 && h.target_pct > 0 && !manualHiddenHoldingIdSet.has(h.id))
            .sort((a, b) => compareHoldingBySort(a, b, holdingSort));
          const hiddenCategoryHoldings = allCategoryHoldings
            .filter((h) => h.shares <= 0 || h.target_pct <= 0 || manualHiddenHoldingIdSet.has(h.id))
            .sort((a, b) => compareHoldingBySort(a, b, holdingSort));
          const isExpanded = expandedCategory === c.name;
          const isHiddenExpanded = expandedHiddenCategory === c.name;

          return (
            <div
              key={c.name}
              className="cursor-pointer border border-zinc-100 bg-zinc-50 p-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10"
              onClick={() => {
                setExpandedCategory(isExpanded ? null : c.name);
                if (isExpanded) setExpandedHiddenCategory(null);
              }}
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
                  if (isExpanded) setExpandedHiddenCategory(null);
                }}
                className="mt-3 text-xs font-bold text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
              >
                {isExpanded
                  ? "종목 비중 닫기"
                  : `${categoryHoldings.length}개 표시${hiddenCategoryHoldings.length > 0 ? ` · 숨김 ${hiddenCategoryHoldings.length}개` : ""}`}
              </button>

              {isExpanded && (
                <div
                  className="mt-3 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {c.name} 테마 보유종목입니다. 설정 비중 수정, 바로 매수/매도까지 여기서 실행할 수 있습니다.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-semibold text-zinc-500 dark:text-zinc-400">보유종목 정렬</span>
                      {HOLDING_SORT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setHoldingSort(option.value)}
                          className={`border px-2.5 py-1.5 font-bold transition-colors ${
                            holdingSort === option.value
                              ? "border-indigo-500 bg-indigo-500 text-white"
                              : "border-zinc-200 bg-white text-zinc-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {renderHoldingCollection(
                    categoryHoldings,
                    "표시 중인 종목이 없습니다. 숨김 종목에서 설정비중을 올리거나 바로 매수로 보유수량을 만들면 표시됩니다.",
                    c.name
                  )}

                  {hiddenCategoryHoldings.length > 0 && (
                    <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedHiddenCategory(isHiddenExpanded ? null : c.name)
                        }
                        className="text-xs font-black text-zinc-600 transition-colors hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-300"
                      >
                        {isHiddenExpanded ? "숨김 종목 닫기" : `숨김 종목 ${hiddenCategoryHoldings.length}개 관리`}
                      </button>
                      {isHiddenExpanded && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                            보유수량 0주 또는 설정비중 0%인 종목입니다. 설정비중을 올리거나 매수하면 일반 목록에 표시되고, 보유수량 0주는 DB에서 삭제할 수 있습니다.
                          </p>
                          {hiddenCategoryHoldings.map((h) => (
                            <HiddenHoldingManager
                              key={h.id}
                              holding={h}
                              isManuallyHidden={manualHiddenHoldingIdSet.has(h.id)}
                              onManualHiddenChange={setHoldingManuallyHidden}
                              portfolioTotalValue={totalValue}
                              onTargetPctChange={onTargetPctChange}
                              onTradeComplete={onTradeComplete}
                              onDeleteHolding={onDeleteHolding}
                              onHoldingDetailsChange={onHoldingDetailsChange}
                              isSavingTargetPct={savingTargetPctId === h.id}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowThemeWeights(true)}
          className="w-full border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-white hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          테마 비중 숨김 · 클릭해서 다시 보기 ({categoryRows.length}개)
        </button>
      )}

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
      <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setShowHiddenHoldings((value) => !value)}
          className={`min-h-11 border px-4 py-2 text-sm font-black shadow-lg transition-colors ${
            showHiddenHoldings
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          }`}
        >
          숨긴 종목 {manualHiddenHoldings.length}
        </button>
        <button
          type="button"
          onClick={() => setShowAddHolding((value) => !value)}
          disabled={!onAddHolding}
          className={`min-h-11 border px-4 py-2 text-sm font-black shadow-lg transition-colors disabled:opacity-50 ${
            showAddHolding
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
              : "border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
          }`}
        >
          + 신규 추가
        </button>
      </div>
    </div>
  );
}

function HoldingMiniChart({ holding }: { holding: HoldingWithPnL }) {
  const code = holding.code || inferHoldingCode(holding.name) || "미등록";
  const targetWidth = Math.max(0, Math.min(100, holding.target_pct));
  const currentWidth = Math.max(0, Math.min(100, holding.actual_pct));
  const diff = holding.actual_pct - holding.target_pct;
  const isOver = diff > 0;
  const hasDiff = holding.target_pct > 0 && Math.abs(diff) >= 0.1;

  return (
    <div className="border border-zinc-200 bg-white p-3 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-black tabular-nums text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200">
            {code}
          </p>
          <p className="mt-1 truncate text-sm font-black text-zinc-950 dark:text-white">{holding.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black tabular-nums text-zinc-900 dark:text-zinc-100">{formatKRW(holding.current_value)}</p>
          <p className="text-[11px] font-semibold tabular-nums text-zinc-400">{holding.shares.toLocaleString()}주</p>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
            <span>설정</span>
            <span className="tabular-nums">{holding.target_pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-zinc-500" style={{ width: `${targetWidth}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
            <span>현재</span>
            <span className="tabular-nums">{holding.actual_pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-indigo-100 dark:bg-indigo-950">
            <div className={`h-full ${hasDiff && isOver ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${currentWidth}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[11px] font-bold tabular-nums">
        <span className="border border-zinc-100 bg-zinc-50 px-1.5 py-1 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          평단 ₩{Math.round(holding.avg_price || 0).toLocaleString()}
        </span>
        <span className={`border px-1.5 py-1 ${holding.profit_loss >= 0 ? "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-red-100 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"}`}>
          {holding.profit_loss >= 0 ? "+" : ""}{formatKRW(holding.profit_loss)}
        </span>
        <span className={`border px-1.5 py-1 ${hasDiff ? isOver ? "border-red-100 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" : "border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300" : "border-zinc-100 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"}`}>
          {diff > 0 ? "+" : ""}{diff.toFixed(1)}%p
        </span>
      </div>
    </div>
  );
}

function HoldingWideChartCard({
  holding,
  children,
}: {
  holding: HoldingWithPnL;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_340px]">
      <HoldingCandlePanel holding={holding} className="order-1 lg:order-2" />
      <div className="order-2 min-w-0 lg:order-1">{children}</div>
    </div>
  );
}

function HoldingCandlePanel({ holding, className = "" }: { holding: HoldingWithPnL; className?: string }) {
  const [period, setPeriod] = useState<CandlePeriod>("day");
  const [remoteCandles, setRemoteCandles] = useState<CandlePoint[]>([]);
  const [chartError, setChartError] = useState("");
  const code = holding.code || inferHoldingCode(holding.name);
  const startPrice = holding.avg_price > 0 ? holding.avg_price : holding.current_price;
  const endPrice = holding.current_price > 0 ? holding.current_price : startPrice;

  useEffect(() => {
    if (!code) {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/market/candles?code=${encodeURIComponent(code)}&period=${period}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "차트 조회 실패");
        setRemoteCandles(Array.isArray(data?.candles) ? data.candles : []);
        setChartError("");
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setRemoteCandles([]);
        setChartError((err as Error).message);
      })
      .finally(() => undefined);

    return () => controller.abort();
  }, [code, period]);

  const candles = remoteCandles.length > 0
    ? remoteCandles
    : buildFallbackCandles(startPrice, endPrice, holding.shares);
  const firstClose = candles[0]?.close ?? startPrice;
  const lastCandle = candles[candles.length - 1];
  const lastClose = lastCandle?.close ?? endPrice;
  const changePct = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;
  const isPositive = lastClose >= firstClose;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));
  const mid = (high + low) / 2;
  const range = Math.max(1, high - low);
  const chartBottom = 166;
  const chartHeight = chartBottom - 34;
  const y = (price: number) => chartBottom - ((price - low) / range) * chartHeight;
  const avgY = y(startPrice);
  const currentY = y(lastClose);
  const maxVolume = Math.max(...candles.map((c) => c.volume), 1);
  const periodLabel = CANDLE_PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "일봉";
  const visibleChartError = code ? chartError : "종목번호 미등록";

  return (
    <aside className={`overflow-hidden border border-zinc-200 bg-white shadow-card dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      <div className="border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white px-3 py-2.5 dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-zinc-500 dark:text-zinc-400">{periodLabel} 캔들</p>
            <p className="mt-1 truncate text-sm font-black text-zinc-950 dark:text-white">
              {code || "미등록"} · {holding.name}
            </p>
          </div>
          <span
            className={`shrink-0 border px-2 py-1 text-[11px] font-black tabular-nums ${
              isPositive
                ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            }`}
          >
            {isPositive ? "+" : ""}{changePct.toFixed(1)}%
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {CANDLE_PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setPeriod(option.value);
                setRemoteCandles([]);
                setChartError("");
              }}
              className={`border px-2 py-1 text-[11px] font-black transition-colors ${
                period === option.value
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                  : "border-zinc-200 bg-white text-zinc-500 hover:border-indigo-200 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        <svg
          viewBox="0 0 320 228"
          role="img"
          aria-label={`${holding.name} ${periodLabel} 상세 캔들 그래프`}
          className="h-56 w-full text-zinc-200 dark:text-zinc-800"
        >
          <defs>
            <linearGradient id={`candle-bg-${holding.id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#eef2ff" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="320" height="228" fill={`url(#candle-bg-${holding.id})`} />
          {[high, mid, low].map((price) => (
            <g key={price}>
              <line x1="48" x2="304" y1={y(price)} y2={y(price)} stroke="currentColor" strokeDasharray="4 5" />
              <text x="4" y={y(price) + 4} fill="#71717a" fontSize="10" fontWeight="700">
                {Math.round(price).toLocaleString()}
              </text>
            </g>
          ))}
          <line x1="48" x2="304" y1={avgY} y2={avgY} stroke="#64748b" strokeDasharray="3 4" strokeWidth="1.5" />
          <text x="244" y={avgY - 5} fill="#64748b" fontSize="10" fontWeight="800">평단</text>
          <line x1="48" x2="304" y1={currentY} y2={currentY} stroke={isPositive ? "#059669" : "#dc2626"} strokeDasharray="5 3" strokeWidth="1.5" />
          <text x="244" y={currentY + 12} fill={isPositive ? "#059669" : "#dc2626"} fontSize="10" fontWeight="800">종가</text>
          {candles.map((candle, index) => {
            const x = candles.length > 1 ? 60 + index * (232 / (candles.length - 1)) : 176;
            const bodyWidth = Math.max(5, Math.min(14, 180 / candles.length));
            const top = y(Math.max(candle.open, candle.close));
            const bottom = y(Math.min(candle.open, candle.close));
            const bodyHeight = Math.max(4, bottom - top);
            const up = candle.close >= candle.open;
            const color = up ? "#10b981" : "#ef4444";
            const volumeHeight = (candle.volume / maxVolume) * 30;
            return (
              <g key={`${candle.date}-${index}`}>
                <rect x={x - bodyWidth / 2} y={210 - volumeHeight} width={bodyWidth} height={volumeHeight} fill={color} opacity="0.22" />
                <line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="2" strokeLinecap="round" />
                <rect x={x - bodyWidth / 2} y={top} width={bodyWidth} height={bodyHeight} fill={color} rx="1.5" />
                <line x1={x - bodyWidth / 2} x2={x + bodyWidth / 2} y1={y(candle.open)} y2={y(candle.open)} stroke="#ffffff" strokeOpacity="0.45" />
              </g>
            );
          })}
          <line x1="48" x2="304" y1="212" y2="212" stroke="currentColor" />
          <text x="48" y="225" fill="#71717a" fontSize="10" fontWeight="700">{formatCandleDate(candles[0]?.date)}</text>
          <text x="258" y="225" fill="#71717a" fontSize="10" fontWeight="700">{formatCandleDate(lastCandle?.date)}</text>
        </svg>

        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] font-bold tabular-nums">
          <span className="border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            시가 ₩{Math.round(lastCandle.open).toLocaleString()}
          </span>
          <span className="border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            종가 ₩{Math.round(lastCandle.close).toLocaleString()}
          </span>
          <span className="border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            고가 ₩{Math.round(high).toLocaleString()}
          </span>
          <span className="border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            저가 ₩{Math.round(low).toLocaleString()}
          </span>
        </div>
        <p className="mt-2 text-[10px] font-semibold leading-4 text-zinc-400 dark:text-zinc-500">
          {visibleChartError
            ? `${visibleChartError} · 보유 데이터 기준 대체 차트를 표시 중입니다.`
            : `외부 시세 기준 ${periodLabel} 차트입니다. 평단선은 내 보유 평균단가입니다.`}
        </p>
      </div>
    </aside>
  );
}

function buildFallbackCandles(startPrice: number, endPrice: number, shares: number): CandlePoint[] {
  const safeStart = Math.max(1, startPrice || endPrice || 1);
  const safeEnd = Math.max(1, endPrice || safeStart);
  const changePct = safeStart > 0 ? ((safeEnd - safeStart) / safeStart) * 100 : 0;
  const volatility = Math.min(0.07, Math.max(0.018, Math.abs(changePct) / 180));
  const pattern = [0, 0.42, -0.25, 0.62, 0.16, -0.38, 0.54, -0.08, 0.72, 0.24, -0.18, 0];
  const closes = pattern.map((offset, index) => {
    const progress = index / (pattern.length - 1);
    const trendPrice = safeStart + (safeEnd - safeStart) * progress;
    return Math.max(1, trendPrice * (1 + offset * volatility));
  });
  closes[0] = safeStart;
  closes[closes.length - 1] = safeEnd;

  return closes.map((close, index) => {
    const open = index === 0 ? safeStart : closes[index - 1];
    const wick = Math.max(open, close) * (volatility * (0.32 + (index % 4) * 0.08));
    return {
      date: index === 0 ? "매입" : index === closes.length - 1 ? "현재" : `${index + 1}`,
      open,
      close,
      high: Math.max(open, close) + wick,
      low: Math.max(1, Math.min(open, close) - wick * 0.82),
      volume: shares * (0.72 + ((index * 7) % 9) / 10),
    };
  });
}

function formatCandleDate(date?: string): string {
  if (!date) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.slice(5).replace("-", "/");
  return date;
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

function HiddenHoldingManager({
  holding,
  isManuallyHidden,
  onManualHiddenChange,
  portfolioTotalValue,
  onTargetPctChange,
  onTradeComplete,
  onDeleteHolding,
  onHoldingDetailsChange,
  isSavingTargetPct,
}: {
  holding: HoldingWithPnL;
  isManuallyHidden?: boolean;
  onManualHiddenChange?: (holdingId: string, hidden: boolean) => void;
  portfolioTotalValue: number;
  onTargetPctChange?: (holdingId: string, targetPct: number) => Promise<void>;
  onTradeComplete?: (result: { holding: Holding; costBasis: CostBasis | null }) => void;
  onDeleteHolding?: (holdingId: string) => Promise<void>;
  onHoldingDetailsChange?: (holdingId: string, patch: HoldingDetailsPatch) => Promise<void>;
  isSavingTargetPct?: boolean;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState("");
  const hiddenReasons = [
    isManuallyHidden ? "직접 숨김" : null,
    holding.shares <= 0 ? "보유수량 0주" : null,
    holding.target_pct <= 0 ? "설정비중 0%" : null,
  ].filter(Boolean).join(" · ");

  async function deleteHolding() {
    if (!onDeleteHolding || holding.shares > 0) return;
    if (!confirm(`"${holding.name}"을(를) DB에서 삭제할까요?`)) return;
    setIsDeleting(true);
    setStatus("");
    try {
      await onDeleteHolding(holding.id);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-2 border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <span className="font-bold text-zinc-500 dark:text-zinc-400">
          숨김 사유: {hiddenReasons}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {isManuallyHidden && (
            <button
              type="button"
              onClick={() => onManualHiddenChange?.(holding.id, false)}
              className="border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-black text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-white hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              숨김 해제
            </button>
          )}
          <button
            type="button"
            onClick={deleteHolding}
            disabled={!onDeleteHolding || holding.shares > 0 || isDeleting}
            className="border border-red-200 bg-red-50 px-2.5 py-1.5 font-black text-red-600 transition-colors hover:bg-red-100 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            {isDeleting ? "삭제 중" : holding.shares > 0 ? "보유중 삭제불가" : "DB 삭제"}
          </button>
        </div>
      </div>
      <HoldingCard
        holding={holding}
        portfolioTotalValue={portfolioTotalValue}
        onTargetPctChange={onTargetPctChange}
        onTradeComplete={onTradeComplete}
        onHoldingDetailsChange={onHoldingDetailsChange}
        isSavingTargetPct={isSavingTargetPct}
      />
      {status && <p className="px-1 text-xs font-semibold text-red-500">{status}</p>}
    </div>
  );
}

function AddHoldingForm({
  onAddHolding,
}: {
  onAddHolding: (payload: NewHoldingPayload) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("주식");
  const [subCategory, setSubCategory] = useState("");
  const [price, setPrice] = useState("");
  const [targetPct, setTargetPct] = useState("0.0");
  const [shares, setShares] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [status, setStatus] = useState("");

  const parsedPrice = Number(price.replace(/[^0-9]/g, "")) || 0;
  const parsedTargetPct = Number(targetPct);
  const parsedShares = Number(shares.replace(/[^0-9]/g, "")) || 0;
  const parsedAvgPrice = Number(avgPrice.replace(/[^0-9]/g, "")) || 0;
  const totalCost = parsedShares * parsedAvgPrice;
  const canSubmit =
    code.trim().length > 0 &&
    name.trim().length > 0 &&
    subCategory.trim().length > 0 &&
    Number.isFinite(parsedTargetPct) &&
    parsedTargetPct >= 0 &&
    parsedTargetPct <= 100 &&
    Number.isInteger(parsedShares) &&
    parsedShares >= 0 &&
    (parsedShares === 0 || parsedAvgPrice > 0) &&
    !isAdding;

  async function submit() {
    if (!canSubmit) return;
    setIsAdding(true);
    setStatus("");
    try {
      await onAddHolding({
        code,
        name,
        category,
        sub_category: subCategory,
        current_price: parsedPrice,
        target_pct: parsedTargetPct,
        shares: parsedShares,
        avg_price: parsedAvgPrice,
      });
      setCode("");
      setName("");
      setSubCategory("");
      setPrice("");
      setTargetPct("0.0");
      setShares("");
      setAvgPrice("");
      setStatus("종목을 추가했습니다. 보유수량 0주 또는 설정비중 0%인 종목은 숨김 관리 영역에 표시됩니다.");
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="border border-indigo-100 bg-indigo-50/70 p-4 shadow-card dark:border-indigo-500/20 dark:bg-indigo-500/10">
      <div className="mb-3">
        <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">새 종목 추가</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          추가 후 보유수량과 설정비중이 모두 0보다 커야 테마별 종목 목록에 표시됩니다.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="종목코드">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="예: 069500"
            className="h-9 w-full border border-zinc-200 bg-white px-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </Field>
        <Field label="종목명">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: KODEX 200"
            className="h-9 w-full border border-zinc-200 bg-white px-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </Field>
        <Field label="대분류">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
            className="h-9 w-full border border-zinc-200 bg-white px-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="소분류">
          <input
            type="text"
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            placeholder="예: 배당"
            className="h-9 w-full border border-zinc-200 bg-white px-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </Field>
        <Field label="현재가">
          <input
            type="text"
            inputMode="numeric"
            value={price}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, "");
              setPrice(value ? Number(value).toLocaleString() : "");
            }}
            placeholder="0"
            className="h-9 w-full border border-zinc-200 bg-white px-2 text-right text-sm font-bold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </Field>
        <Field label="설정비중 (%)">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.5"
            value={targetPct}
            onChange={(e) => setTargetPct(e.target.value)}
            className="h-9 w-full border border-zinc-200 bg-white px-2 text-right text-sm font-bold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </Field>
        <Field label="보유수량">
          <input
            type="text"
            inputMode="numeric"
            value={shares}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, "");
              setShares(value ? Number(value).toLocaleString() : "");
            }}
            placeholder="0"
            className="h-9 w-full border border-zinc-200 bg-white px-2 text-right text-sm font-bold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </Field>
        <Field label="평단가">
          <input
            type="text"
            inputMode="numeric"
            value={avgPrice}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, "");
              setAvgPrice(value ? Number(value).toLocaleString() : "");
            }}
            placeholder="0"
            className="h-9 w-full border border-zinc-200 bg-white px-2 text-right text-sm font-bold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </Field>
      </div>
      <div className="mt-2 border border-indigo-100 bg-white/70 px-3 py-2 text-xs font-semibold text-zinc-600 shadow-sm dark:border-indigo-500/20 dark:bg-zinc-950/40 dark:text-zinc-300">
        초기 보유원가: <span className="font-black tabular-nums text-zinc-900 dark:text-zinc-100">{parsedShares.toLocaleString()}주 × ₩{parsedAvgPrice.toLocaleString()} = ₩{totalCost.toLocaleString()}</span>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-3 h-10 w-full border border-indigo-600 bg-indigo-600 px-4 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
      >
        {isAdding ? "추가 중" : "종목 추가"}
      </button>
      {status && (
        <p className={`mt-2 text-xs font-semibold ${status.includes("추가했습니다") ? "text-emerald-600 dark:text-emerald-300" : "text-red-500"}`}>
          {status}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
