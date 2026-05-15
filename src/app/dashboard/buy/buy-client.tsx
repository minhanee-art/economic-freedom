"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Holding, CostBasis } from "@/types";
import { calculateBuyPlan, type BuyPlanItem } from "@/lib/buy-algorithm";
import { formatKRW, formatFullKRW, cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/colors";

interface Props {
  initialHoldings: Holding[];
  initialCostBases: CostBasis[];
  defaultBudget: number;
  userId: string;
}

const QUICK_AMOUNTS = [100000, 200000, 300000, 500000, 1000000];

export function BuyClient({
  initialHoldings,
  initialCostBases,
  defaultBudget,
  userId,
}: Props) {
  const [holdings, setHoldings] = useState(initialHoldings);
  const [budget, setBudget] = useState(defaultBudget);
  const [inputValue, setInputValue] = useState(defaultBudget.toLocaleString());
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [priceStatus, setPriceStatus] = useState("");
  const router = useRouter();

  // 페이지 진입 시 자동 시세 조회
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

      const { prices, errors } = (await res.json()) as {
        prices: Record<string, number>;
        errors: string[];
      };

      const updatedCodes = Object.keys(prices);
      if (updatedCodes.length === 0) {
        setPriceStatus("시세 조회 실패");
        return;
      }

      // DB 업데이트
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

      // 로컬 state 반영
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
    () => calculateBuyPlan(holdings, initialCostBases, budget),
    [holdings, initialCostBases, budget]
  );

  const buyItems = plan.items.filter((item) => item.quantity > 0);

  const handleInputChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    const num = parseInt(cleaned) || 0;
    setInputValue(num > 0 ? num.toLocaleString() : "");
    setBudget(num);
  };

  const handleQuickAmount = (amount: number) => {
    setBudget(amount);
    setInputValue(amount.toLocaleString());
  };

  const handleExecute = async () => {
    if (buyItems.length === 0) return;
    setIsExecuting(true);

    try {
      const date = new Date().toISOString().split("T")[0];
      const items = buyItems.map((item) => ({
        holdingId: item.holding.id,
        code: item.holding.code,
        name: item.holding.name,
        quantity: item.quantity,
        price: item.holding.current_price,
        cost: item.cost,
      }));

      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, items, totalSpent: plan.totalCost }),
      });
      if (!res.ok) throw new Error("매수 실행 실패");

      setSuccessMessage(
        `${buyItems.length}개 종목, 총 ${formatFullKRW(plan.totalCost)} 매수 완료!`
      );
      setShowConfirm(false);

      // 2초 후 새로고침
      setTimeout(() => {
        router.refresh();
        setSuccessMessage("");
        setBudget(defaultBudget);
        setInputValue(defaultBudget.toLocaleString());
      }, 2000);
    } catch (err) {
      alert(`매수 실행 중 오류가 발생했습니다:\n${(err as Error).message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 성공 알림 */}
      {successMessage && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 font-medium">
          {successMessage}
        </div>
      )}

      {/* 시세 상태 */}
      {priceStatus && (
        <div className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
          priceStatus.includes("실패")
            ? "bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
            : priceStatus.includes("중")
              ? "bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
              : "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
        }`}>
          {priceStatus}
        </div>
      )}

      {/* 금액 입력 */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <h2 className="text-lg font-bold">이번 달 투자금액</h2>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg">
            ₩
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            className="w-full h-14 rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-2xl font-bold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => handleQuickAmount(amount)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                budget === amount
                  ? "bg-indigo-500 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              )}
            >
              {formatKRW(amount)}
            </button>
          ))}
        </div>
      </div>

      {/* 매수 계획 카드 리스트 */}
      {budget > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">
            매수 계획 ({buyItems.length}종목)
          </h3>
          <div className="space-y-2">
            {plan.items.map((item) => (
              <BuyPlanCard key={item.holding.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* 하단 요약 + 확정 버튼 */}
      {buyItems.length > 0 && (
        <div
          className="rounded-xl px-5 py-4 text-white space-y-4"
          style={{
            background: "linear-gradient(135deg, #1a1f36 0%, #2d3250 100%)",
          }}
        >
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">총 매수금액</span>
            <span className="font-bold text-lg">
              {formatFullKRW(plan.totalCost)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">잔여금액</span>
            <span className="text-zinc-300">
              {formatFullKRW(plan.remaining)}
            </span>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full h-12 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
            }}
          >
            매수 확정 & 기록 저장
          </button>
        </div>
      )}

      {/* 확인 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 space-y-4">
            <h3 className="text-lg font-bold">매수를 확정하시겠습니까?</h3>
            <div className="space-y-2 text-sm">
              {buyItems.map((item) => (
                <div
                  key={item.holding.id}
                  className="flex justify-between text-zinc-600 dark:text-zinc-400"
                >
                  <span>{item.holding.name}</span>
                  <span>
                    {item.quantity}주 · {formatFullKRW(item.cost)}
                  </span>
                </div>
              ))}
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 flex justify-between font-semibold text-foreground">
                <span>합계</span>
                <span>{formatFullKRW(plan.totalCost)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isExecuting}
                className="flex-1 h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="flex-1 h-11 rounded-xl bg-indigo-500 text-white text-sm font-medium transition-colors hover:bg-indigo-600 disabled:opacity-50"
              >
                {isExecuting ? "처리 중..." : "확정"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BuyPlanCard({ item }: { item: BuyPlanItem }) {
  const h = item.holding;
  const isZero = item.quantity === 0;

  return (
    <div
      className={cn(
        "flex rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden",
        isZero
          ? "border-zinc-100 dark:border-zinc-800 opacity-50"
          : "border-zinc-200 dark:border-zinc-800"
      )}
    >
      <div
        className="w-1.5 shrink-0"
        style={{ background: getCategoryColor(h.category) }}
      />
      <div className="flex-1 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{h.name}</p>
            <p className="text-xs text-zinc-400">
              {h.code} · 현재가 ₩{h.current_price.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">
              {item.quantity}
              <span className="text-sm font-normal text-zinc-400 ml-0.5">
                주
              </span>
            </p>
            <p className="text-xs text-zinc-500">
              {formatFullKRW(item.cost)}
            </p>
          </div>
        </div>
        {item.isPriority && item.quantity > 0 && (
          <div className="mt-2">
            <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              비중 {item.gapPct.toFixed(1)}%p 부족 → 우선 매수
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
