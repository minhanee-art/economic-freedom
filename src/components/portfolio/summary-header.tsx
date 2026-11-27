"use client";

import { formatKRW, formatPercent, formatPnlKRW, pnlTextClass } from "@/lib/utils";
import type { DailyChange, DividendYields } from "@/lib/dashboard-insights";

interface SummaryHeaderProps {
  totalValue: number;
  totalCost: number;
  totalDividend: number;
  monthlyBudget: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  dividendYields?: DividendYields;
  /** undefined: 아직 불러오는 중, null: 전일 기준 데이터 없음 */
  dailyChange?: DailyChange | null;
}

export function SummaryHeader({
  totalValue,
  totalCost,
  totalDividend,
  monthlyBudget,
  onRefresh,
  isRefreshing,
  dividendYields,
  dailyChange,
}: SummaryHeaderProps) {
  const pnl = totalValue - totalCost;
  // 원가(매수 기록)가 없으면 손익을 계산할 수 없다 — "+0원 / +0.00%" 대신 "-"
  const hasCost = totalCost > 0;
  const pnlPct = hasCost ? (pnl / totalCost) * 100 : 0;

  return (
    <div className="border border-hairline bg-surface px-5 py-5 shadow-card dark:border-zinc-800 sm:px-6 sm:py-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-ink-mute mb-1.5">
            총 평가금액
          </p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
            {formatKRW(totalValue)}
          </p>
          {dailyChange !== undefined && (
            <p className="mt-1 text-xs tabular-nums" data-testid="daily-change">
              {dailyChange ? (
                <>
                  <span className="text-ink-mute">전일 대비 </span>
                  <span
                    className={`font-semibold ${pnlTextClass(dailyChange.amount)}`}
                  >
                    {formatPnlKRW(dailyChange.amount)}
                    {dailyChange.pct !== null && ` (${formatPercent(dailyChange.pct)})`}
                  </span>
                  {dailyChange.includesContribution && (
                    <span className="text-ink-mute"> · 매수·입출금 포함</span>
                  )}
                </>
              ) : (
                <span className="text-ink-mute">전일 대비 · 기준 기록 없음</span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex min-h-11 w-full items-center justify-center border border-hairline bg-surface px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas-soft disabled:opacity-50 dark:border-zinc-700 sm:w-auto"
        >
          {isRefreshing ? "갱신 중..." : "시세 새로고침"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div>
          <p className="text-xs text-ink-mute mb-0.5">총 손익</p>
          <p
            className={`text-sm font-semibold tabular-nums ${
              hasCost ? pnlTextClass(pnl) : "text-ink-mute"
            }`}
          >
            {hasCost ? formatPnlKRW(pnl) : "-"}
          </p>
          {hasCost && (
            <p className={`text-xs tabular-nums ${pnlTextClass(pnl)}`}>
              {formatPercent(pnlPct)}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-ink-mute mb-0.5">누적 배당</p>
          <p className="text-sm font-semibold tabular-nums text-ink">{formatKRW(totalDividend)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-mute mb-0.5">월 적립금</p>
          <p className={`text-sm font-semibold tabular-nums ${monthlyBudget > 0 ? "text-ink" : "text-ink-mute"}`}>
            {monthlyBudget > 0 ? formatKRW(monthlyBudget) : "미설정"}
          </p>
        </div>
      </div>

      {dividendYields && <DividendYieldRow yields={dividendYields} />}
    </div>
  );
}

function DividendYieldRow({ yields }: { yields: DividendYields }) {
  const items = [
    { label: "투자 배당률", hint: "최근 12개월 배당 ÷ 매입원가", value: yields.costYieldPct },
    { label: "시가 배당률", hint: "최근 12개월 배당 ÷ 평가금액", value: yields.marketYieldPct },
  ].filter((i) => i.value !== null);
  if (items.length === 0) return null;

  return (
    <div className="mt-4 border-t border-hairline pt-4" data-testid="dividend-yields">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {items.map((i) => (
          <div key={i.label}>
            <p className="text-xs text-ink-mute mb-0.5">{i.label}</p>
            <p className="text-sm font-semibold tabular-nums text-ink">{(i.value as number).toFixed(2)}%</p>
            <p className="text-xs text-ink-mute">{i.hint}</p>
          </div>
        ))}
      </div>
      {!yields.hasRecords ? (
        <p className="mt-2 text-xs text-ink-mute">배당 기록이 없어 0%로 계산됐습니다.</p>
      ) : yields.isPartialYear ? (
        <p className="mt-2 text-xs text-caution">
          배당 기록이 12개월 미만({yields.coveredMonths}개월)이라 연환산하지 않은 실제 수령액 기준입니다.
        </p>
      ) : null}
    </div>
  );
}
