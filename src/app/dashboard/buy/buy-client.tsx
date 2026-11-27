// 적립 배분 계산 클라이언트 (매수 계획 화면) — 알고리즘 자동 계산 + 종목별 수량 수동 조절 + 수수료 포함 계산
"use client";

import { InlineError, failureMessage } from "@/components/dashboard/inline-error";
import { DialogFrame } from "@/components/dashboard/confirm-dialog";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import type { Holding, CostBasis } from "@/types";
import {
  calculateBuyPlan,
  calculateAnnualPlan,
  type BuyPlanItem,
  type AnnualPlanItem,
} from "@/lib/buy-algorithm";
import { formatKRW, formatKRWFull, cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/colors";
import { CATEGORIES } from "@/lib/constants";

interface Props {
  initialHoldings: Holding[];
  initialCostBases: CostBasis[];
  defaultBudget: number;
  lastPurchaseDates: Record<string, string>;
  userId: string;
}

const QUICK_AMOUNTS = [100000, 200000, 300000, 500000, 1000000];

type SortMode = "recommended" | "quantity-desc" | "quantity-asc";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "recommended", label: "계산 기본순" },
  { value: "quantity-desc", label: "수량 많은순" },
  { value: "quantity-asc", label: "수량 적은순" },
];

// 적립 주기(2개월 이상) 상태 문구
function cycleStatusLabel(item: BuyPlanItem): string {
  if (item.isCycleBuy) return `${item.cycleMonths}개월 주기 · 이번 달 1주 편성`;
  if (item.isCycleDue) return `${item.cycleMonths}개월 주기 · 도래(예산 부족)`;
  const left = Math.max(1, item.cycleMonths - (item.monthsSinceLastBuy ?? 0));
  return `${item.cycleMonths}개월 주기 · ${left}개월 뒤`;
}

// 연간 계획의 주문 주기 문구
function annualCadenceLabel(item: AnnualPlanItem): string {
  if (item.quantity <= 0) return "배분 없음";
  if (item.quantity >= 12) {
    const perMonth = item.quantity / 12;
    return `매달 ${Number.isInteger(perMonth) ? perMonth : perMonth.toFixed(1)}주`;
  }
  const months = 12 / item.quantity;
  return Number.isInteger(months) ? `${months}개월에 1주` : `${months.toFixed(1)}개월에 1주`;
}

export function BuyClient({
  initialHoldings,
  initialCostBases,
  defaultBudget,
  lastPurchaseDates,
}: Props) {
  const [holdings, setHoldings] = useState(initialHoldings);
  const [budget, setBudget] = useState(defaultBudget);
  const [inputValue, setInputValue] = useState(defaultBudget.toLocaleString());
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingHoldingId, setExecutingHoldingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [saveError, setSaveError] = useState<{ message: string; retry?: () => void } | null>(null);
  const [priceStatus, setPriceStatus] = useState("");
  const [quantityOverrides, setQuantityOverrides] = useState<Record<string, number>>({});
  const [executionPriceOverrides, setExecutionPriceOverrides] = useState<Record<string, number>>({});
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  // 테마별 비중 조정 패널
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  // 연간 주문 계획 패널
  const [showAnnualPlan, setShowAnnualPlan] = useState(true);
  const [themeDrafts, setThemeDrafts] = useState<Record<string, string>>({});
  const [savingTheme, setSavingTheme] = useState<string | null>(null);
  const [themeStatus, setThemeStatus] = useState("");
  // 증권사 수수료율 (%) — localStorage 유지
  const [feeRatePct, setFeeRatePct] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pension_fee_rate_pct");
      return saved !== null ? Number(saved) : 0.014;
    }
    return 0.014;
  });
  const router = useRouter();

  useEffect(() => {
    setHoldings(initialHoldings);
    setQuantityOverrides({});
    setExecutionPriceOverrides({});
    setPriceStatus("");
  }, [initialHoldings]);

  useEffect(() => {
    setQuantityOverrides({});
    setExecutionPriceOverrides({});
  }, [budget]);

  const refreshPrices = useCallback(async () => {
    setPriceStatus("시세 조회 중...");
    try {
      const codes = holdings.map((h) => h.code);
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      if (!res.ok) throw new Error("API 호출 실패");

      const { prices } = (await res.json()) as {
        prices: Record<string, number>;
        errors: string[];
      };

      const updatedCodes = Object.keys(prices);
      if (updatedCodes.length === 0) {
        setPriceStatus("시세 조회 실패");
        return;
      }

      const updatePromises = holdings
        .filter((h) => prices[h.code] && prices[h.code] !== h.current_price)
        .map((h) =>
          fetch("/api/holdings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: h.id, current_price: prices[h.code] }),
          })
        );
      await Promise.all(updatePromises);

      const updated = holdings.map((h) =>
        prices[h.code] ? { ...h, current_price: prices[h.code] } : h
      );
      setHoldings(updated);
      setPriceStatus(`${updatedCodes.length}개 종목 시세 반영 완료`);
    } catch {
      setPriceStatus("시세 조회 실패");
    }
    setTimeout(() => setPriceStatus(""), 3000);
  }, [holdings]);

  useEffect(() => {
    refreshPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = useMemo(
    () => calculateBuyPlan(holdings, initialCostBases, budget, { lastPurchaseDates }),
    [holdings, initialCostBases, budget, lastPurchaseDates]
  );

  const effectiveItems = useMemo(() => {
    return plan.items.map((item) => {
      const qty = quantityOverrides[item.holding.id] ?? item.quantity;
      return { ...item, quantity: qty, cost: qty * item.holding.current_price };
    });
  }, [plan.items, quantityOverrides]);

  const algorithmQtyMap = useMemo(() => {
    const m: Record<string, number> = {};
    plan.items.forEach((i) => { m[i.holding.id] = i.quantity; });
    return m;
  }, [plan.items]);

  // 1주 가격이 월 배분보다 커서 매달 살 수 없는 종목(적립 주기 2개월 이상)
  const cycleItems = useMemo(
    () => plan.items.filter((i) => i.cycleMonths > 1),
    [plan.items]
  );
  const dueCycleCount = cycleItems.filter((i) => i.isCycleDue).length;

  // 월 투자금액 × 12 기준 종목별 연간 주문 수량(정수)
  const annualPlan = useMemo(
    () => calculateAnnualPlan(holdings, budget),
    [holdings, budget]
  );

  // 테마(자산군)별 목표 비중 합계
  const themeTotals = useMemo(() => {
    const map = new Map<string, number>();
    holdings.forEach((h) => {
      map.set(h.category, (map.get(h.category) ?? 0) + Number(h.target_pct));
    });
    return map;
  }, [holdings]);

  const themeCategories = useMemo(
    () => CATEGORIES.filter((c) => holdings.some((h) => h.category === c)),
    [holdings]
  );

  const totalTargetPctSum = useMemo(
    () => holdings.reduce((s, h) => s + Number(h.target_pct), 0),
    [holdings]
  );

  const themeInputValue = (category: string) =>
    themeDrafts[category] ?? (themeTotals.get(category) ?? 0).toFixed(1);

  const handleThemeDraftChange = (category: string, value: string) => {
    setThemeDrafts((prev) => ({ ...prev, [category]: value }));
  };

  const handleThemeSave = async (category: string) => {
    const parsed = Number(themeDrafts[category]);
    if (!Number.isFinite(parsed)) return;
    const nextCategoryTargetPct = Math.max(0, Math.min(100, parsed));
    const categoryHoldings = holdings.filter((h) => h.category === category);
    if (categoryHoldings.length === 0) return;

    const currentCategoryTargetPct = categoryHoldings.reduce(
      (sum, h) => sum + Number(h.target_pct),
      0
    );
    const nextTargets = new Map<string, number>();
    let assigned = 0;
    categoryHoldings.forEach((h, index) => {
      const isLast = index === categoryHoldings.length - 1;
      const nextTarget = isLast
        ? Math.max(0, +(nextCategoryTargetPct - assigned).toFixed(1))
        : currentCategoryTargetPct > 0
          ? +((Number(h.target_pct) / currentCategoryTargetPct) * nextCategoryTargetPct).toFixed(1)
          : +(nextCategoryTargetPct / categoryHoldings.length).toFixed(1);
      assigned += nextTarget;
      nextTargets.set(h.id, nextTarget);
    });

    setSavingTheme(category);
    setThemeStatus("");
    const previousHoldings = holdings;
    setHoldings((current) =>
      current.map((h) => (nextTargets.has(h.id) ? { ...h, target_pct: nextTargets.get(h.id)! } : h))
    );

    try {
      await Promise.all(
        categoryHoldings.map((h) =>
          fetch("/api/holdings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: h.id, target_pct: nextTargets.get(h.id) ?? h.target_pct }),
          }).then((res) => {
            if (!res.ok) throw new Error(`${h.name} 비중 저장 실패`);
          })
        )
      );
      setThemeStatus(`${category} 테마 비중 저장 완료`);
      setThemeDrafts((prev) => {
        const next = { ...prev };
        delete next[category];
        return next;
      });
      router.refresh();
    } catch (err) {
      setHoldings(previousHoldings);
      setThemeStatus(`${category} 테마 비중 저장 실패: ${(err as Error).message}`);
    } finally {
      setSavingTheme(null);
      setTimeout(() => setThemeStatus(""), 3000);
    }
  };

  // 수수료 계산
  const feeRate = feeRatePct / 100;
  const effectiveTotalCost = effectiveItems.reduce((s, i) => s + i.cost, 0);
  const feeAmount = Math.round(effectiveTotalCost * feeRate);
  const totalWithFee = effectiveTotalCost + feeAmount;
  const buyItems = effectiveItems.filter((item) => item.quantity > 0);

  const sortedEffectiveItems = useMemo(() => {
    if (sortMode === "recommended") return effectiveItems;

    return [...effectiveItems].sort((a, b) => {
      const quantityDiff =
        sortMode === "quantity-desc"
          ? b.quantity - a.quantity
          : a.quantity - b.quantity;

      if (quantityDiff !== 0) return quantityDiff;
      return b.gapPct - a.gapPct;
    });
  }, [effectiveItems, sortMode]);

  const sortedBuyItems = useMemo(
    () => sortedEffectiveItems.filter((item) => item.quantity > 0),
    [sortedEffectiveItems]
  );

  const actualBuyItems = useMemo(
    () =>
      sortedBuyItems.map((item) => {
        const executionPrice = executionPriceOverrides[item.holding.id] ?? item.holding.current_price;
        const netCost = item.quantity * executionPrice;
        return {
          item,
          executionPrice,
          netCost,
          actualCost: Math.round(netCost * (1 + feeRate)),
        };
      }),
    [sortedBuyItems, executionPriceOverrides, feeRate]
  );

  const actualNetTotal = actualBuyItems.reduce((s, row) => s + row.netCost, 0);
  const actualTotalSpent = actualBuyItems.reduce((s, row) => s + row.actualCost, 0);
  const actualFeeAmount = actualTotalSpent - actualNetTotal;
  const actualDifference = actualTotalSpent - totalWithFee;
  const actualRemaining = budget - actualTotalSpent;

  async function savePurchaseRows(rows: typeof actualBuyItems) {
    if (rows.length === 0) return false;
    setSaveError(null);
    if (rows.some(({ item, executionPrice }) => item.quantity <= 0 || executionPrice <= 0)) {
      setSaveError({ message: "기록할 수량과 단가는 0보다 커야 합니다. 종목 카드의 수량·기록 단가를 확인해 주세요." });
      return false;
    }

    const date = new Date().toISOString().split("T")[0];
    const items = rows.map(({ item, executionPrice, actualCost }) => ({
      holdingId: item.holding.id,
      code: item.holding.code,
      name: item.holding.name,
      quantity: item.quantity,
      price: executionPrice,
      cost: actualCost,
    }));

    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, items }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "매수 실행 실패");
    }
    return true;
  }

  function handleQuantityChange(holdingId: string, qty: number) {
    setQuantityOverrides((prev) => ({ ...prev, [holdingId]: Math.max(0, qty) }));
  }

  function handleExecutionPriceChange(holdingId: string, value: string) {
    const cleaned = value.replace(/[^0-9]/g, "");
    setExecutionPriceOverrides((prev) => ({
      ...prev,
      [holdingId]: parseInt(cleaned) || 0,
    }));
  }

  function resetExecutionPrice(holdingId: string) {
    setExecutionPriceOverrides((prev) => {
      const next = { ...prev };
      delete next[holdingId];
      return next;
    });
  }

  const handleInputChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    const num = parseInt(cleaned) || 0;
    setInputValue(num > 0 ? num.toLocaleString() : "");
    setBudget(num);
  };

  const handleFeeRateChange = (value: string) => {
    const num = Math.max(0, Math.min(5, Number(value) || 0));
    setFeeRatePct(num);
    localStorage.setItem("pension_fee_rate_pct", String(num));
  };

  const handleQuickAmount = (amount: number) => {
    setBudget(amount);
    setInputValue(amount.toLocaleString());
  };

  const handleExecute = async () => {
    if (buyItems.length === 0) return;
    setIsExecuting(true);

    try {
      const saved = await savePurchaseRows(actualBuyItems);
      if (!saved) return;

      setSuccessMessage(
        `${sortedBuyItems.length}개 종목, 총 ${formatKRWFull(actualTotalSpent)} 매수 기록 저장 완료 (수수료 ${formatKRWFull(actualFeeAmount)} 포함)`
      );
      setShowConfirm(false);

      setTimeout(() => {
        router.refresh();
        setSuccessMessage("");
        setBudget(defaultBudget);
        setInputValue(defaultBudget.toLocaleString());
        setExecutionPriceOverrides({});
      }, 2000);
    } catch (err) {
      setShowConfirm(false);
      setSaveError({ message: failureMessage("매수 기록을 저장", err), retry: handleExecute });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSingleExecute = async (holdingId: string) => {
    const row = actualBuyItems.find(({ item }) => item.holding.id === holdingId);
    if (!row) return;
    setExecutingHoldingId(holdingId);

    try {
      const saved = await savePurchaseRows([row]);
      if (!saved) return;

      setSuccessMessage(
        `${row.item.holding.name} ${row.item.quantity.toLocaleString()}주, ${formatKRWFull(row.actualCost)} 기록 저장 완료!`
      );
      setQuantityOverrides((prev) => ({ ...prev, [holdingId]: 0 }));
      resetExecutionPrice(holdingId);
      router.refresh();
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (err) {
      setSaveError({ message: failureMessage("매수 기록을 저장", err), retry: () => handleSingleExecute(holdingId) });
    } finally {
      setExecutingHoldingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="border border-hairline bg-canvas-soft px-4 py-3 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold tracking-tight text-ink">적립 배분 계산</h1>
        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          사용자가 설정한 목표 비중에 따른 계산 결과이며 투자 권유가 아닙니다.
        </p>
      </div>

      {saveError && <InlineError message={saveError.message} onRetry={saveError.retry} onDismiss={() => setSaveError(null)} />}
      {successMessage && (
        <div role="status" className="bg-surface border border-hairline px-4 py-3 text-sm text-success font-medium shadow-card dark:border-zinc-800">
          {successMessage}
        </div>
      )}

      {priceStatus && (
        <div className={`px-4 py-2.5 text-sm font-medium shadow-card ${
          priceStatus.includes("실패")
            ? "bg-danger-soft text-danger border border-danger-line"
            : priceStatus.includes("중")
              ? "bg-canvas-soft text-zinc-500 border border-hairline dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
              : "bg-canvas-soft text-success border border-hairline"
        }`}>
          {priceStatus}
        </div>
      )}

      {/* 투자금액 + 수수료 설정 */}
      <div className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-card transition-shadow hover:shadow-float">
        <h2 className="text-lg font-bold text-ink dark:text-zinc-100">이번 달 투자금액</h2>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            aria-label="이번 달 투자금액(원)"
            className="w-full h-14 border border-hairline bg-canvas-soft pl-4 pr-12 text-2xl font-bold text-right tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-zinc-500 dark:text-zinc-400">원</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => handleQuickAmount(amount)}
              className={cn(
                "px-4 py-2 text-sm font-medium tabular-nums transition-colors",
                budget === amount
                  ? "bg-indigo-500 text-white shadow-card"
                  : "bg-canvas-soft text-zinc-600 border border-hairline hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-700"
              )}
            >
              {formatKRW(amount)}
            </button>
          ))}
        </div>

        {/* 수수료율 설정 */}
        <div className="flex items-center gap-2 pt-3 border-t border-hairline dark:border-zinc-800">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">증권사 수수료</span>
          <input
            type="number"
            aria-label="증권사 수수료(%)"
            value={feeRatePct}
            onChange={(e) => handleFeeRateChange(e.target.value)}
            step="0.001"
            min="0"
            max="5"
            className="w-20 text-right text-sm tabular-nums px-2 py-1 border border-hairline dark:border-zinc-700 bg-canvas-soft dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">%</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-1 tabular-nums">
            (0.014% = IRP 일반 / 0% = 수수료 무료 증권사)
          </span>
        </div>
      </div>

      {/* 테마별 비중 조정 */}
      <div className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3 shadow-card transition-shadow hover:shadow-float">
        <button
          type="button"
          onClick={() => setShowThemeEditor((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <h2 className="text-lg font-bold text-ink dark:text-zinc-100">테마별 비중 조정</h2>
          <span className="text-xs font-medium text-indigo-500 dark:text-indigo-300">{showThemeEditor ? "닫기" : "열기"}</span>
        </button>

        {themeStatus && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{themeStatus}</p>
        )}

        {showThemeEditor && (
          <div className="space-y-3">
            <div
              className={cn(
                "px-3 py-2 text-xs font-medium tabular-nums",
                Math.abs(totalTargetPctSum - 100) < 0.01
                  ? "bg-canvas-soft text-success"
                  : "bg-caution-soft text-caution"
              )}
            >
              전체 목표 비중 합계: {totalTargetPctSum.toFixed(1)}%
              {Math.abs(totalTargetPctSum - 100) < 0.01 ? " (정상)" : " (100%가 아닙니다)"}
            </div>
            {themeCategories.map((category) => {
              const totalPct = themeTotals.get(category) ?? 0;
              const draftValue = themeInputValue(category);
              const hasChange = Number(draftValue) !== totalPct;
              return (
                <div
                  key={category}
                  className="flex items-center justify-between gap-3 border border-hairline dark:border-zinc-800 px-3 py-2"
                >
                  <span className="text-sm font-medium text-ink dark:text-zinc-100">{category}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.5"
                      value={draftValue}
                      onChange={(e) => handleThemeDraftChange(category, e.target.value)}
                      disabled={savingTheme !== null}
                      aria-label={`${category} 테마 목표 비중`}
                      className="h-8 w-20 border border-hairline bg-white px-2 text-right text-sm font-bold tabular-nums text-ink focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">%</span>
                    <button
                      type="button"
                      onClick={() => handleThemeSave(category)}
                      disabled={!hasChange || savingTheme !== null}
                      className="h-8 border border-indigo-100 bg-indigo-50 px-3 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400"
                    >
                      {savingTheme === category ? "저장중" : "저장"}
                    </button>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              테마 비중을 조정하면 그 테마 안의 종목별 비중이 기존 비율대로 나뉘어 저장됩니다. 종목별 세부 비중은 설정 페이지에서 조정하세요.
            </p>
          </div>
        )}
      </div>

      {/* 매수 계획 카드 리스트 */}
      {budget > 0 && (
        <div>
          {/* 연간 주문 계획 */}
          {annualPlan.items.length > 0 && (
            <div className="mb-4 border border-hairline bg-white p-4 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink dark:text-zinc-100">연간 배분 계획</p>
                  <p className="mt-0.5 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    월 {formatKRWFull(budget)} × 12개월 = {formatKRWFull(annualPlan.annualBudget)} 기준 · 1주 단위로 계산해 종목별 연간 수량을 정수로 맞춤
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnnualPlan((v) => !v)}
                  className="shrink-0 border border-hairline bg-canvas-soft px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                >
                  {showAnnualPlan ? "닫기" : "열기"}
                </button>
              </div>

              {showAnnualPlan && (
                <>
                  <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400 sm:hidden" aria-hidden="true">표가 넓으면 좌우로 밀어 보세요</p>
                  <div tabIndex={0} role="region" aria-label="연간 배분 계획 표" className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-130 border-collapse text-xs tabular-nums">
                    <caption className="sr-only">종목별 연간 배분 계획: 목표 비중, 1주 가격, 연 수량, 배분 주기, 연 금액</caption>
                      <thead>
                        <tr className="text-zinc-500 dark:text-zinc-400">
                          <th scope="col" className="pb-2 text-left font-medium">종목</th>
                          <th scope="col" className="pb-2 text-right font-medium">목표 비중</th>
                          <th scope="col" className="pb-2 text-right font-medium">1주 가격</th>
                          <th scope="col" className="pb-2 text-right font-medium">연 수량</th>
                          <th scope="col" className="pb-2 text-right font-medium">배분 주기</th>
                          <th scope="col" className="pb-2 text-right font-medium">연 금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {annualPlan.items.map((item) => (
                          <tr
                            key={item.holding.id}
                            className="border-t border-hairline dark:border-zinc-800"
                          >
                            <td className="max-w-60 py-1.5 pr-2 text-ink dark:text-zinc-200">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className="dot-bg inline-block h-1.5 w-1.5 shrink-0"
                                  style={{ "--dot-bg": getCategoryColor(item.holding.category) } as CSSProperties}
                                />
                                <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                                  {item.holding.code}
                                </span>
                                <span className="truncate">{item.holding.name}</span>
                              </div>
                            </td>
                            <td className="py-1.5 text-right text-zinc-500 dark:text-zinc-400">
                              {item.idealRatio * 100 < 10
                                ? (item.idealRatio * 100).toFixed(1)
                                : (item.idealRatio * 100).toFixed(0)}
                              %
                            </td>
                            <td className="py-1.5 text-right text-zinc-500 dark:text-zinc-400">
                              {item.price.toLocaleString()}
                            </td>
                            <td
                              className={cn(
                                "py-1.5 text-right font-semibold",
                                item.quantity === 0
                                  ? "text-caution"
                                  : "text-ink dark:text-zinc-100"
                              )}
                            >
                              {item.quantity.toLocaleString()}주
                            </td>
                            <td className="py-1.5 text-right text-zinc-500 dark:text-zinc-400">
                              {annualCadenceLabel(item)}
                            </td>
                            <td className="py-1.5 text-right text-zinc-600 dark:text-zinc-300">
                              {formatKRWFull(item.cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-hairline pt-2 text-xs tabular-nums dark:border-zinc-800">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      연 사용 <span className="font-semibold text-ink dark:text-zinc-100">{formatKRWFull(annualPlan.totalCost)}</span>
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      잔여 <span className="font-semibold text-ink dark:text-zinc-100">{formatKRWFull(annualPlan.leftover)}</span>
                    </span>
                  </div>
                  {annualPlan.items.some((i) => i.quantity === 0) && (
                    <p className="mt-2 text-xs leading-relaxed text-caution">
                      {annualPlan.items.filter((i) => i.quantity === 0).length}개 종목은 연간 배분액으로 1주도 살 수 없습니다. 비중을 올리거나
                      월 투자금액을 늘려야 합니다.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
              적립 배분 계산 (<span className="tabular-nums">{buyItems.length}</span>종목)
            </h3>
            <div className="flex flex-wrap gap-1.5" aria-label="적립 배분 계산 정렬">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSortMode(option.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    sortMode === option.value
                      ? "bg-indigo-500 text-white shadow-card"
                      : "border border-hairline bg-white text-zinc-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {cycleItems.length > 0 && (
            <div className="mb-3 border border-caution/30 bg-caution-soft p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-caution">
                  적립 종목 <span className="tabular-nums">{cycleItems.length}</span>개
                </p>
                <p className="text-xs font-semibold tabular-nums text-caution">
                  이번 달 도래 <span>{dueCycleCount}</span>개
                </p>
              </div>
              <ul className="mt-2 space-y-1">
                {cycleItems.map((item) => (
                  <li
                    key={item.holding.id}
                    className="flex items-center justify-between gap-2 text-xs tabular-nums text-zinc-600 dark:text-zinc-400"
                  >
                    <span className="truncate">
                      {item.holding.name}
                      <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                        1주 {formatKRWFull(item.holding.current_price)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-medium",
                        item.isCycleBuy || item.isCycleDue
                          ? "text-caution"
                          : "text-zinc-500 dark:text-zinc-400"
                      )}
                    >
                      {cycleStatusLabel(item)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-caution">
                월 투자금액 기준 1주 가격이 배분액보다 커서 매달은 살 수 없는 종목입니다. 주기가 도래한 달에만 1주를
                우선 편성하고, 나머지 달은 건너뜁니다.
              </p>
            </div>
          )}
          <div className="space-y-2">
            {sortedEffectiveItems.map((item) => (
              <BuyPlanCard
                key={item.holding.id}
                item={item}
                algorithmQty={algorithmQtyMap[item.holding.id] ?? 0}
                executionPrice={executionPriceOverrides[item.holding.id] ?? item.holding.current_price}
                isExecutionPriceOverridden={executionPriceOverrides[item.holding.id] !== undefined}
                onQuantityChange={(qty) => handleQuantityChange(item.holding.id, qty)}
                onExecutionPriceChange={(value) => handleExecutionPriceChange(item.holding.id, value)}
                onResetExecutionPrice={() => resetExecutionPrice(item.holding.id)}
                onSaveRecord={() => handleSingleExecute(item.holding.id)}
                isSavingRecord={executingHoldingId === item.holding.id}
                isSaveDisabled={isExecuting || executingHoldingId !== null}
              />
            ))}
          </div>
        </div>
      )}

      {/* 하단 요약 + 확정 버튼 */}
      {buyItems.length > 0 && (
        <div
          className="border border-hairline bg-surface px-6 py-5 space-y-2 shadow-card dark:border-zinc-800"
        >
          <div className="flex justify-between text-sm">
            <span className="text-ink-mute">순 배분금액</span>
            <span className="tabular-nums text-ink">{formatKRWFull(actualNetTotal)}</span>
          </div>
          {feeRatePct > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-ink-mute tabular-nums">수수료 ({feeRatePct}%)</span>
              <span className="text-ink tabular-nums">{formatKRWFull(actualFeeAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t border-hairline pt-3">
            <span className="text-ink font-medium">기록 금액 (수수료 포함)</span>
            <span className="font-bold text-lg tabular-nums text-ink">{formatKRWFull(actualTotalSpent)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-mute">잔여금액</span>
            <span className={cn("tabular-nums text-ink", actualRemaining < 0 && "text-caution")}>
              {formatKRWFull(actualRemaining)}{actualRemaining < 0 ? " (예산 초과)" : ""}
            </span>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full h-12 font-semibold text-white bg-brand hover:bg-brand-deep transition-colors mt-3"
          >
            기록 저장
          </button>
        </div>
      )}

      {/* 확인 모달 */}
      {showConfirm && (
        <DialogFrame labelledBy="buy-confirm-title" describedBy="buy-confirm-desc" onDismiss={() => !isExecuting && setShowConfirm(false)} className="max-w-lg space-y-4 border-hairline dark:border-zinc-800">
            <h2 id="buy-confirm-title" className="text-lg font-bold text-ink">이 매수 기록을 저장할까요?</h2>
            <p id="buy-confirm-desc" className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              종목 카드에서 입력한 기록 단가로 매수 기록과 평균단가를 저장합니다. 주문은 실행되지 않습니다. 일부 종목만 먼저 샀다면 목록을 닫고 해당 카드의 &apos;이 종목만 기록 저장&apos;을 사용하세요.
            </p>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1 text-sm">
              {actualBuyItems.map(({ item, executionPrice, actualCost }) => (
                <div
                  key={item.holding.id}
                  className="flex items-center justify-between gap-3 border border-hairline bg-canvas-soft p-3 dark:border-zinc-800 dark:bg-zinc-800/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink dark:text-zinc-100">{item.holding.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {item.quantity.toLocaleString()}주 × {formatKRWFull(executionPrice)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-ink dark:text-zinc-100">{formatKRWFull(actualCost)}</span>
                </div>
              ))}
              <div className="border-t border-hairline dark:border-zinc-700 pt-3 space-y-1">
                {feeRatePct > 0 && (
                  <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    <span>수수료 ({feeRatePct}%)</span>
                    <span>{formatKRWFull(actualFeeAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                  <span>계산 총 지출</span>
                  <span>{formatKRWFull(totalWithFee)}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                  <span>정정 차액</span>
                  <span className="text-ink">
                    {actualDifference === 0 ? "0원" : `${actualDifference > 0 ? "+" : ""}${formatKRWFull(actualDifference)}`}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-ink dark:text-zinc-100">
                  <span>정정 후 총 지출</span>
                  <span className="tabular-nums">{formatKRWFull(actualTotalSpent)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isExecuting}
                className="flex-1 h-11 border border-hairline dark:border-zinc-700 text-sm font-medium transition-colors hover:bg-canvas-soft dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button
                onClick={handleExecute}
                disabled={isExecuting || actualTotalSpent <= 0}
                className="flex-1 h-11 bg-brand text-white text-sm font-semibold transition-colors hover:bg-brand-deep disabled:opacity-50"
              >
                {isExecuting ? "저장 중..." : "기록 저장"}
              </button>
            </div>
        </DialogFrame>
      )}
    </div>
  );
}

function BuyPlanCard({
  item,
  algorithmQty,
  executionPrice,
  isExecutionPriceOverridden,
  onQuantityChange,
  onExecutionPriceChange,
  onResetExecutionPrice,
  onSaveRecord,
  isSavingRecord,
  isSaveDisabled,
}: {
  item: BuyPlanItem;
  algorithmQty: number;
  executionPrice: number;
  isExecutionPriceOverridden: boolean;
  onQuantityChange: (qty: number) => void;
  onExecutionPriceChange: (value: string) => void;
  onResetExecutionPrice: () => void;
  onSaveRecord: () => void;
  isSavingRecord: boolean;
  isSaveDisabled: boolean;
}) {
  const h = item.holding;
  const isZero = item.quantity === 0;
  const isOverridden = item.quantity !== algorithmQty;
  const orderCost = item.quantity * executionPrice;

  return (
    <div
      className={cn(
        "flex border bg-white dark:bg-zinc-900 overflow-hidden transition-shadow",
        isZero
          ? "border-hairline dark:border-zinc-800 opacity-50"
          : "border-hairline dark:border-zinc-800 shadow-card hover:shadow-float"
      )}
    >
      <div className="flex-1 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-ink dark:text-zinc-100"><span aria-hidden="true" className="dot-bg mr-1.5 inline-block h-2 w-2 shrink-0 align-middle" style={{"--dot-bg": getCategoryColor(h.category) } as CSSProperties} />{h.name}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {h.code} · 현재가 {formatKRWFull(h.current_price)}
            </p>
          </div>

          {/* 수량 조절 */}
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 justify-end">
              <button
                type="button"
                onClick={() => onQuantityChange(item.quantity - 1)}
                aria-label={`${h.name} 수량 1주 줄이기`}
                className="h-11 w-11 bg-canvas-soft border border-hairline dark:bg-zinc-800 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 dark:hover:bg-zinc-700 flex items-center justify-center text-lg font-bold leading-none transition-colors select-none"
              >
                −
              </button>
              <span className="w-10 text-center text-xl font-bold tabular-nums text-ink dark:text-zinc-100">
                {item.quantity}
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-0.5">주</span>
              </span>
              <button
                type="button"
                onClick={() => onQuantityChange(item.quantity + 1)}
                aria-label={`${h.name} 수량 1주 늘리기`}
                className="h-11 w-11 bg-canvas-soft border border-hairline dark:bg-zinc-800 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 dark:hover:bg-zinc-700 flex items-center justify-center text-lg font-bold leading-none transition-colors select-none"
              >
                +
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">{formatKRWFull(orderCost)}</p>
            {isOverridden && (
              <button
                onClick={() => onQuantityChange(algorithmQty)}
                className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-300 transition-colors tabular-nums"
              >
                계산 {algorithmQty.toLocaleString()}주로 복원
              </button>
            )}
          </div>
        </div>

        {item.quantity > 0 && (
          <div className="mt-3 border border-hairline bg-canvas-soft p-3 dark:border-zinc-800 dark:bg-zinc-800/60">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">기록 단가</span>
              {isExecutionPriceOverridden && (
                <button
                  type="button"
                  onClick={onResetExecutionPrice}
                  className="text-xs font-medium text-indigo-500 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-300"
                >
                  현재가로 복원
                </button>
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`${h.name} 기록 단가(원)`}
                  value={executionPrice > 0 ? executionPrice.toLocaleString("ko-KR") : ""}
                  onChange={(e) => onExecutionPriceChange(e.target.value)}
                  className="h-10 w-full border border-hairline bg-white pl-3 pr-9 text-right font-semibold tabular-nums text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400">원</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">기록 금액</p>
                <p className="text-sm font-semibold tabular-nums text-ink dark:text-zinc-100">{formatKRWFull(orderCost)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSaveRecord}
              disabled={isSaveDisabled}
              className="mt-3 w-full h-9 bg-indigo-600 text-white text-xs font-semibold transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-card"
            >
              {isSavingRecord ? "저장 중..." : "이 종목만 기록 저장"}
            </button>
          </div>
        )}

        {item.isPriority && item.quantity > 0 && (
          <div className="mt-2">
            <span className="inline-flex items-center bg-caution-soft px-2 py-0.5 text-xs font-medium text-caution tabular-nums">
              목표 비중 대비 {item.gapPct.toFixed(1)}%p 부족 (계산상 우선 배분)
            </span>
          </div>
        )}

        {item.cycleMonths > 1 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 text-xs font-medium tabular-nums",
                item.isCycleDue || item.isCycleBuy
                  ? "bg-caution-soft text-caution"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              )}
            >
              {item.isCycleBuy
                ? `${item.cycleMonths}개월 주기 적립 도래 → 이번 달 1주 편성`
                : item.isCycleDue
                  ? `${item.cycleMonths}개월 주기 적립 도래 · 1주 ${formatKRWFull(h.current_price)} 필요`
                  : `${item.cycleMonths}개월에 1주 적립 · ${Math.max(
                      1,
                      item.cycleMonths - (item.monthsSinceLastBuy ?? 0)
                    )}개월 뒤`}
            </span>
            <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              이 비중({(item.idealRatio * 100).toFixed(1)}%)으로 매달 사려면 월{" "}
              {formatKRWFull(Math.ceil(item.minBudget))} 필요
            </span>
          </div>
        ) : (
          isZero &&
          item.idealRatio > 0 && (
            <div className="mt-2">
              <span className="inline-flex items-center bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
                이 비중({(item.idealRatio * 100).toFixed(1)}%)으로 1주를 배분하려면 최소 {formatKRWFull(Math.ceil(h.current_price / item.idealRatio))} 필요
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
