"use client";

import { useState } from "react";
import type { CostBasis, Holding, HoldingWithPnL } from "@/types";
import { formatKRW, cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/colors";

interface HoldingCardProps {
  holding: HoldingWithPnL;
  onTargetPctChange?: (holdingId: string, targetPct: number) => Promise<void>;
  onTradeComplete?: (result: { holding: Holding; costBasis: CostBasis | null }) => void;
  isSavingTargetPct?: boolean;
}

type TradeAction = "buy" | "sell";

export function HoldingCard({
  holding: h,
  onTargetPctChange,
  onTradeComplete,
  isSavingTargetPct = false,
}: HoldingCardProps) {
  const diff = h.actual_pct - h.target_pct;
  const showDiff = h.target_pct > 0 && Math.abs(diff) >= 3;
  const hasPnL = h.total_cost > 0;
  const targetPct = Math.max(0, Math.min(100, h.target_pct));
  const actualPct = Math.max(0, Math.min(100, h.actual_pct));
  const [targetDraft, setTargetDraft] = useState<{
    holdingId: string;
    targetPct: number;
    value: string;
  } | null>(null);
  const targetInput =
    targetDraft?.holdingId === h.id && targetDraft.targetPct === h.target_pct
      ? targetDraft.value
      : h.target_pct.toFixed(1);
  const parsedTargetInput = Number(targetInput);
  const hasTargetChange =
    Number.isFinite(parsedTargetInput) && parsedTargetInput !== h.target_pct;
  const [tradeAction, setTradeAction] = useState<TradeAction | null>(null);
  const [tradeQuantity, setTradeQuantity] = useState("1");
  const [tradePrice, setTradePrice] = useState(String(Math.round(h.current_price)));
  const [isTrading, setIsTrading] = useState(false);
  const [tradeStatus, setTradeStatus] = useState("");

  async function saveTargetPct() {
    if (!onTargetPctChange) return;
    const nextTargetPct = Number(targetInput);
    if (!Number.isFinite(nextTargetPct)) return;
    const clampedTargetPct = Math.max(0, Math.min(100, nextTargetPct));
    setTargetDraft({
      holdingId: h.id,
      targetPct: h.target_pct,
      value: clampedTargetPct.toFixed(1),
    });
    if (clampedTargetPct === h.target_pct) return;
    await onTargetPctChange(h.id, clampedTargetPct);
  }

  async function executeTrade() {
    if (!tradeAction) return;
    const quantity = Number(tradeQuantity);
    const price = Number(tradePrice);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setTradeStatus("수량은 1주 이상 정수로 입력해주세요.");
      return;
    }
    if (tradeAction === "sell" && quantity > h.shares) {
      setTradeStatus("보유 수량보다 많이 매도할 수 없습니다.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setTradeStatus("가격을 올바르게 입력해주세요.");
      return;
    }

    setIsTrading(true);
    setTradeStatus("");
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdingId: h.id,
          action: tradeAction,
          quantity,
          price,
          date: new Date().toISOString().split("T")[0],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "거래 저장 실패");
      onTradeComplete?.(data);
      setTradeStatus(`${tradeAction === "buy" ? "매수" : "매도"} 반영 완료`);
      setTradeAction(null);
      setTradeQuantity("1");
    } catch (err) {
      setTradeStatus((err as Error).message);
    } finally {
      setIsTrading(false);
    }
  }

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

        {/* 설정 비중 vs 현재 보유 비중 */}
        <div className="border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">내 설정 비중</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.5"
                value={targetInput}
                onChange={(e) =>
                  setTargetDraft({
                    holdingId: h.id,
                    targetPct: h.target_pct,
                    value: e.target.value,
                  })
                }
                onBlur={saveTargetPct}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                disabled={!onTargetPctChange || isSavingTargetPct}
                aria-label={`${h.name} 설정 비중`}
                className="h-8 w-20 border border-zinc-200 bg-white px-2 text-right text-sm font-bold tabular-nums text-ink focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <span className="text-xs font-semibold text-zinc-500">%</span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={saveTargetPct}
                disabled={!onTargetPctChange || !hasTargetChange || isSavingTargetPct}
                className="h-8 border border-indigo-100 bg-indigo-50 px-2.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                {isSavingTargetPct ? "저장중" : "저장"}
              </button>
            </div>
          </div>
          <div className="h-2 overflow-hidden bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-zinc-400 dark:bg-zinc-500" style={{ width: `${targetPct}%` }} />
          </div>

          <div className="mb-2 mt-3 flex items-center justify-between gap-3 text-xs font-semibold">
            <span className="text-indigo-600 dark:text-indigo-300">현재 보유 비중</span>
            <span className="tabular-nums text-indigo-600 dark:text-indigo-300">{h.actual_pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden bg-indigo-100 dark:bg-indigo-950">
            <div className="h-full bg-indigo-500" style={{ width: `${actualPct}%` }} />
          </div>
        </div>

        {/* 뱃지 행 */}
        <div className="flex flex-wrap gap-1.5">
          <Badge label={`설정 ${h.target_pct.toFixed(1)}%`} variant="default" />
          <Badge
            label={`현재 보유 ${h.actual_pct.toFixed(1)}%`}
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

        <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTradeAction(tradeAction === "buy" ? null : "buy")}
              className="h-9 border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
            >
              바로 매수
            </button>
            <button
              type="button"
              onClick={() => setTradeAction(tradeAction === "sell" ? null : "sell")}
              disabled={h.shares <= 0}
              className="h-9 border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              바로 매도
            </button>
          </div>

          {tradeAction && (
            <div className="mt-3 border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="mb-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                {tradeAction === "buy" ? "매수" : "매도"} 수량과 단가 입력
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[80px_1fr_auto] sm:items-center">
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={tradeAction === "sell" ? h.shares : undefined}
                  step="1"
                  value={tradeQuantity}
                  onChange={(e) => setTradeQuantity(e.target.value)}
                  disabled={isTrading}
                  aria-label={`${h.name} 거래 수량`}
                  className="h-9 border border-zinc-200 bg-white px-2 text-right text-sm font-bold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={tradePrice}
                  onChange={(e) => setTradePrice(e.target.value)}
                  disabled={isTrading}
                  aria-label={`${h.name} 거래 단가`}
                  className="h-9 border border-zinc-200 bg-white px-2 text-right text-sm font-bold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={executeTrade}
                  disabled={isTrading}
                  className={`col-span-2 h-9 border px-3 text-xs font-bold text-white transition-colors disabled:opacity-60 sm:col-span-1 ${
                    tradeAction === "buy"
                      ? "border-emerald-600 bg-emerald-600 hover:bg-emerald-700"
                      : "border-red-600 bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isTrading ? "처리중" : `${tradeAction === "buy" ? "매수" : "매도"} 확정`}
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-400 tabular-nums">
                예상금액 {formatKRW((Number(tradeQuantity) || 0) * (Number(tradePrice) || 0))}
              </p>
            </div>
          )}
          {tradeStatus && (
            <p className={`mt-2 text-xs font-semibold ${tradeStatus.includes("완료") ? "text-emerald-600 dark:text-emerald-300" : "text-red-500"}`}>
              {tradeStatus}
            </p>
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
