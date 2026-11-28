// 대시보드 클라이언트 — 시세 자동 갱신, 테마별 그룹·정렬, 차트
"use client";

import { LazyCategoryPieChart, LazyAllocationBarChart } from "@/components/charts/lazy";
import Link from "next/link";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Holding, CostBasis } from "@/types";
import { computeHoldingsWithPnL } from "@/lib/portfolio";
import { SummaryHeader } from "@/components/portfolio/summary-header";
import { HoldingsHeatmap } from "@/components/portfolio/holdings-heatmap";
import { computeDailyChange, computeDividendYields, type DividendRecordLite } from "@/lib/dashboard-insights";
import { RebalanceAlert } from "@/components/portfolio/rebalance-alert";
import { cn, formatSignedKRW } from "@/lib/utils";
import { toLocalDateKey, upcomingDividendSchedule } from "@/lib/dashboard-home";
import { HomeStatus } from "@/components/portfolio/home-status";
import type { DividendCalendarRow } from "@/lib/queries";
import { CATEGORIES } from "@/lib/constants";
import { EmojiLine, InfoTip } from "@/components/ui/info-tip";

interface Props {
  initialHoldings: Holding[];
  initialCostBases: CostBasis[];
  monthlyBudget: number;
  totalDividend: number;
  dividendRecords: DividendRecordLite[];
  lastPriceUpdate: string | null;
  dividendCalendar: DividendCalendarRow[];
  /** 홈 제목(h1) 바로 아래에 놓을 첫 사용 안내 */
  firstRun?: ReactNode;
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
  category?: string;
  sub_category?: string;
};

type ReturnPeriodKey = "day" | "week" | "month";

type PortfolioReturnPeriod = {
  key: ReturnPeriodKey;
  label: string;
  snapshotDate: string | null;
  returnAmount: number | null;
  returnPct: number | null;
};

type PortfolioReturnSummary = {
  accountName: string;
  telegramChatIdMasked: string | null;
  telegramNeedsRelink: boolean;
  asOfDate: string;
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPct: number;
  periods: Record<ReturnPeriodKey, PortfolioReturnPeriod>;
};

export function DashboardClient({
  initialHoldings,
  initialCostBases,
  monthlyBudget,
  totalDividend,
  dividendRecords,
  lastPriceUpdate,
  dividendCalendar,
  firstRun,
}: Props) {
  const [holdings, setLocalHoldings] = useState(initialHoldings);
  const [costBases, setCostBases] = useState(initialCostBases);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState("");
  const [savingTargetPctId, setSavingTargetPctId] = useState<string | null>(null);
  const [savingCategoryTarget, setSavingCategoryTarget] = useState<string | null>(null);
  // 서버·클라이언트 날짜가 다를 수 있어 마운트 뒤에 정한다
  const [todayKey, setTodayKey] = useState<string | null>(null);
  const [returnSummary, setReturnSummary] = useState<PortfolioReturnSummary | null>(null);
  const [returnStatus, setReturnStatus] = useState("");
  const [isSendingReturnReport, setIsSendingReturnReport] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const id = globalThis.setTimeout(() => setTodayKey(toLocalDateKey(new Date())), 0);
    return () => globalThis.clearTimeout(id);
  }, []);

  useEffect(() => {
    setLocalHoldings(initialHoldings);
    setCostBases(initialCostBases);
    setRefreshResult("");
  }, [initialHoldings, initialCostBases]);

  const loadReturnSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio-returns", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "수익률 조회 실패");
      const summary = data.summary as PortfolioReturnSummary;
      setReturnSummary(summary);
    } catch (err) {
      setReturnStatus(`수익률 조회 실패: ${(err as Error).message}`);
    }
  }, []);

  useEffect(() => {
    loadReturnSummary();
  }, [loadReturnSummary, holdings, costBases]);

  const handleSendReturnReport = useCallback(async () => {
    setIsSendingReturnReport(true);
    setReturnStatus("");
    try {
      // 받는 채팅은 서버가 정한다(설정에서 연결 코드로 확인한 채팅만)
      const res = await fetch("/api/portfolio-returns", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "텔레그램 전송 실패");
      setReturnSummary(data.summary as PortfolioReturnSummary);
      setReturnStatus("텔레그램 전송 완료");
      setTimeout(() => setReturnStatus(""), 3000);
    } catch (err) {
      setReturnStatus(`텔레그램 전송 실패: ${(err as Error).message}`);
    } finally {
      setIsSendingReturnReport(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshResult("");

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
        setRefreshResult("시세 조회 실패 — 잠시 후 다시 시도해주세요");
        setIsRefreshing(false);
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

      await fetch("/api/settings/price-update", { method: "POST" });

      const updatedHoldings = holdings.map((h) =>
        prices[h.code] ? { ...h, current_price: prices[h.code] } : h
      );
      setLocalHoldings(updatedHoldings);

      const failCount = errors.length;
      setRefreshResult(
        `${updatedCodes.length}개 종목 시세 업데이트 완료${
          failCount > 0 ? ` (${failCount}개 실패)` : ""
        }`
      );

      router.refresh();
    } catch (err) {
      setRefreshResult(`시세 조회 실패: ${(err as Error).message}`);
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshResult(""), 4000);
    }
  }, [holdings, router]);

  // 마지막 업데이트가 1일 이상 지났으면 자동 새로고침
  useEffect(() => {
    if (!lastPriceUpdate) return;
    const lastUpdate = new Date(lastPriceUpdate).getTime();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (lastUpdate < oneDayAgo) {
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTargetPctChange = useCallback(
    async (holdingId: string, targetPct: number) => {
      const previousHoldings = holdings;
      const nextTargetPct = Math.max(0, Math.min(100, targetPct));
      setSavingTargetPctId(holdingId);
      setRefreshResult("");
      setLocalHoldings((current) =>
        current.map((h) =>
          h.id === holdingId ? { ...h, target_pct: nextTargetPct } : h
        )
      );

      try {
        const res = await fetch("/api/holdings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: holdingId, target_pct: nextTargetPct }),
        });
        if (!res.ok) throw new Error("목표 비중 저장 실패");
        setRefreshResult("목표 비중 저장 완료");
        router.refresh();
      } catch (err) {
        setLocalHoldings(previousHoldings);
        setRefreshResult(`목표 비중 저장 실패: ${(err as Error).message}`);
      } finally {
        setSavingTargetPctId(null);
        setTimeout(() => setRefreshResult(""), 3000);
      }
    },
    [holdings, router]
  );

  const handleCategoryTargetPctChange = useCallback(
    async (category: string, targetPct: number) => {
      const previousHoldings = holdings;
      const categoryHoldings = holdings.filter((h) => h.category === category);
      if (categoryHoldings.length === 0) return;

      const nextCategoryTargetPct = Math.max(0, Math.min(100, targetPct));
      const currentCategoryTargetPct = categoryHoldings.reduce(
        (sum, h) => sum + h.target_pct,
        0
      );
      const nextTargets = new Map<string, number>();

      if (currentCategoryTargetPct > 0) {
        let assigned = 0;
        categoryHoldings.forEach((h, index) => {
          const isLast = index === categoryHoldings.length - 1;
          const nextTarget = isLast
            ? Math.max(0, +(nextCategoryTargetPct - assigned).toFixed(1))
            : +((h.target_pct / currentCategoryTargetPct) * nextCategoryTargetPct).toFixed(1);
          assigned += nextTarget;
          nextTargets.set(h.id, nextTarget);
        });
      } else {
        let assigned = 0;
        categoryHoldings.forEach((h, index) => {
          const isLast = index === categoryHoldings.length - 1;
          const nextTarget = isLast
            ? Math.max(0, +(nextCategoryTargetPct - assigned).toFixed(1))
            : +(nextCategoryTargetPct / categoryHoldings.length).toFixed(1);
          assigned += nextTarget;
          nextTargets.set(h.id, nextTarget);
        });
      }

      setSavingCategoryTarget(category);
      setRefreshResult("");
      setLocalHoldings((current) =>
        current.map((h) =>
          nextTargets.has(h.id) ? { ...h, target_pct: nextTargets.get(h.id)! } : h
        )
      );

      try {
        await Promise.all(
          categoryHoldings.map((h) =>
            fetch("/api/holdings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: h.id, target_pct: nextTargets.get(h.id) ?? h.target_pct }),
            }).then((res) => {
              if (!res.ok) throw new Error(`${h.name} 목표 비중 저장 실패`);
            })
          )
        );
        setRefreshResult(`${category} 테마 목표 비중 저장 완료`);
        router.refresh();
      } catch (err) {
        setLocalHoldings(previousHoldings);
        setRefreshResult(`테마 목표 비중 저장 실패: ${(err as Error).message}`);
      } finally {
        setSavingCategoryTarget(null);
        setTimeout(() => setRefreshResult(""), 3000);
      }
    },
    [holdings, router]
  );

  const handleTradeComplete = useCallback(
    (result: { holding: Holding; costBasis: CostBasis | null }) => {
      setLocalHoldings((current) =>
        current.map((h) => (h.id === result.holding.id ? result.holding : h))
      );
      setCostBases((current) => {
        if (!result.costBasis) return current;
        const exists = current.some((cb) => cb.holding_id === result.costBasis?.holding_id);
        if (exists) {
          return current.map((cb) =>
            cb.holding_id === result.costBasis?.holding_id ? result.costBasis : cb
          );
        }
        return [...current, result.costBasis];
      });
      setRefreshResult("매수·매도 기록을 저장했습니다.");
      router.refresh();
      setTimeout(() => setRefreshResult(""), 3000);
    },
    [router]
  );

  const handleAddHolding = useCallback(
    async (payload: NewHoldingPayload) => {
      const body = {
        code: payload.code.trim(),
        name: payload.name.trim(),
        category: payload.category,
        sub_category: payload.sub_category.trim(),
        current_price: Math.max(0, Math.round(payload.current_price)),
        target_pct: Math.max(0, Math.min(100, payload.target_pct)),
        shares: Math.max(0, Math.round(payload.shares)),
        avg_price: Math.max(0, Math.round(payload.avg_price)),
      };

      const res = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "종목 추가 실패");
      }

      const row = data?.holding ?? data;
      const createdHolding: Holding = {
        ...row,
        target_pct: Number(row.target_pct ?? body.target_pct),
        current_price: Number(row.current_price ?? body.current_price),
        shares: Number(row.shares ?? body.shares),
        expense_ratio: Number(row.expense_ratio ?? 0),
      };
      setLocalHoldings((current) => [...current, createdHolding]);
      if (data?.costBasis) {
        setCostBases((current) => [...current, data.costBasis as CostBasis]);
      }
      setRefreshResult(`${body.name} 종목을 추가했습니다.`);
      router.refresh();
      setTimeout(() => setRefreshResult(""), 6000);
    },
    [router]
  );

  const handleDeleteHolding = useCallback(
    async (holdingId: string) => {
      const targetHolding = holdings.find((h) => h.id === holdingId);
      if (!targetHolding) return;
      if (targetHolding.shares > 0) {
        throw new Error("보유수량이 있는 종목은 삭제할 수 없습니다.");
      }

      const res = await fetch("/api/holdings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: holdingId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "종목 삭제 실패");
      }

      setLocalHoldings((current) => current.filter((h) => h.id !== holdingId));
      setCostBases((current) => current.filter((cb) => cb.holding_id !== holdingId));
      setRefreshResult("종목 삭제 완료");
      router.refresh();
      setTimeout(() => setRefreshResult(""), 3000);
    },
    [holdings, router]
  );

  const handleHoldingDetailsChange = useCallback(
    async (holdingId: string, patch: HoldingDetailsPatch) => {
      const res = await fetch("/api/holdings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: holdingId, ...patch }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "종목 정보 정정 실패");
      }

      if (data?.holding) {
        const updatedHolding: Holding = {
          ...data.holding,
          target_pct: Number(data.holding.target_pct ?? 0),
          current_price: Number(data.holding.current_price ?? 0),
          shares: Number(data.holding.shares ?? 0),
          expense_ratio: Number(data.holding.expense_ratio ?? 0),
        };
        setLocalHoldings((current) =>
          current.map((h) => (h.id === holdingId ? updatedHolding : h))
        );
        if (patch.shares !== undefined || patch.avg_price !== undefined) {
          if (data?.costBasis) {
            setCostBases((current) => {
              const updatedCostBasis = data.costBasis as CostBasis;
              const exists = current.some((cb) => cb.holding_id === holdingId);
              return exists
                ? current.map((cb) => cb.holding_id === holdingId ? updatedCostBasis : cb)
                : [...current, updatedCostBasis];
            });
          } else {
            setCostBases((current) => current.filter((cb) => cb.holding_id !== holdingId));
          }
        }
      }

      setRefreshResult("종목 정보 정정 완료");
      router.refresh();
      setTimeout(() => setRefreshResult(""), 3000);
    },
    [router]
  );

  const holdingsWithPnL = computeHoldingsWithPnL(holdings, costBases);

  const totalValue = holdingsWithPnL.reduce((s, h) => s + h.current_value, 0);
  const totalCost = holdingsWithPnL.reduce((s, h) => s + h.total_cost, 0);

  const dividendYields = computeDividendYields(dividendRecords, totalCost, totalValue);
  // undefined = 스냅샷 응답을 아직 못 받음(표시 안 함), null = 전일 기준 없음
  const dailyChange = returnSummary
    ? computeDailyChange(returnSummary.periods.day, returnSummary.totalValue)
    : undefined;


  // 파이차트 데이터
  const categoryMap = new Map<string, number>();
  holdingsWithPnL.forEach((h) => {
    if (h.current_value > 0) {
      categoryMap.set(h.category, (categoryMap.get(h.category) ?? 0) + h.current_value);
    }
  });
  const pieData = Array.from(categoryMap.entries()).map(([name, value]) => ({
    name,
    value,
    pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
  }));

  // 바차트 데이터
  const categoryTargetMap = new Map<string, number>();
  const categoryCurrentMap = new Map<string, number>();
  holdingsWithPnL.forEach((h) => {
    categoryTargetMap.set(h.category, (categoryTargetMap.get(h.category) ?? 0) + h.target_pct);
    categoryCurrentMap.set(h.category, (categoryCurrentMap.get(h.category) ?? 0) + h.actual_pct);
  });
  const barData = Array.from(
    new Set([...categoryTargetMap.keys(), ...categoryCurrentMap.keys()])
  ).map((name) => ({
    name,
    target: categoryTargetMap.get(name) ?? 0,
    current: Number((categoryCurrentMap.get(name) ?? 0).toFixed(1)),
  }));

  const upcomingDividends = upcomingDividendSchedule(dividendCalendar, todayKey ?? "9999-12-31");

  return (
    <div className="space-y-5 md:space-y-6">
      {refreshResult && (
        <div
          role={refreshResult.includes("실패") ? "alert" : "status"}
          className={`border px-4 py-2.5 text-sm font-medium ${
            refreshResult.includes("실패")
              ? "bg-danger-soft text-danger border-danger-line"
              : "bg-surface text-success border-hairline dark:border-zinc-800"
          }`}
        >
          {refreshResult}
        </div>
      )}

      <HomeStatus />

      {firstRun}

      <SummaryHeader
        totalValue={totalValue}
        totalCost={totalCost}
        totalDividend={totalDividend}
        monthlyBudget={monthlyBudget}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        dividendYields={dividendYields}
        dailyChange={dailyChange}
      />

      <ReturnSummaryCard
        summary={returnSummary}
        onSend={handleSendReturnReport}
        isSending={isSendingReturnReport}
        status={returnStatus}
      />

      <UpcomingDividends items={upcomingDividends} />

      <HoldingsHeatmap holdings={holdingsWithPnL} />

      {totalValue > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <section aria-labelledby="home-pie-title" className="border border-hairline bg-surface p-5 shadow-card dark:border-zinc-800">
            <h2 id="home-pie-title" className="mb-3 text-base font-bold tracking-tight text-ink">자산군별 비중</h2>
            <LazyCategoryPieChart data={pieData} />
          </section>
          <section aria-labelledby="home-bar-title" className="border border-hairline bg-surface p-5 shadow-card dark:border-zinc-800">
            <h2 id="home-bar-title" className="mb-3 text-base font-bold tracking-tight text-ink">
              현재 vs 목표 비중
              <InfoTip label="현재 vs 목표 비중 설명">자산군별 목표는 그 자산군 종목들의 목표 비중을 더한 값입니다.</InfoTip>
            </h2>
            <LazyAllocationBarChart data={barData} />
          </section>
        </div>
      )}

      <RebalanceAlert
        title="보유 종목과 목표 비중"
        collapsible
        defaultCollapsed
        holdings={holdingsWithPnL}
        categoryData={barData}
        onTargetPctChange={handleTargetPctChange}
        onCategoryTargetPctChange={handleCategoryTargetPctChange}
        onTradeComplete={handleTradeComplete}
        onAddHolding={handleAddHolding}
        onDeleteHolding={handleDeleteHolding}
        onHoldingDetailsChange={handleHoldingDetailsChange}
        savingTargetPctId={savingTargetPctId}
        savingCategoryTarget={savingCategoryTarget}
      />
    </div>
  );
}

const RETURNS_TIP =
  "하루 한 번 저장되는 계좌 평가액 기록으로 일별·주간·월간 수익률을 계산합니다. 그 사이 추가 매수·매도로 바뀐 원가는 보정합니다.";

function ReturnSummaryCard({
  summary,
  onSend,
  isSending,
  status,
}: {
  summary: PortfolioReturnSummary | null;
  onSend: () => void;
  isSending: boolean;
  status: string;
}) {
  const periods: ReturnPeriodKey[] = ["day", "week", "month"];
  // 비교할 기준 기록이 하나도 없으면 빈 칸 세 개 대신 한 줄 안내로 접는다
  const noData = summary !== null && periods.every((key) => summary.periods[key]?.returnPct == null);
  if (noData) {
    return (
      <section aria-labelledby="home-returns-title" className="border border-hairline bg-surface p-5 shadow-card dark:border-zinc-800">
        <h2 id="home-returns-title" className="text-base font-bold tracking-tight text-ink">
          기간별 수익률
          <InfoTip label="기간별 수익률 설명">{RETURNS_TIP}</InfoTip>
        </h2>
        <EmojiLine as="p" emoji="📅" size="sm" tone="mute" className="mt-2">
          아직 비교할 기준 기록이 없습니다.
        </EmojiLine>
      </section>
    );
  }
  return (
    <section aria-labelledby="home-returns-title" className="border border-hairline bg-surface p-5 shadow-card dark:border-zinc-800">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="home-returns-title" className="text-base font-bold tracking-tight text-ink">
          기간별 수익률
          <InfoTip label="기간별 수익률 설명" align="start">{RETURNS_TIP}</InfoTip>
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {summary?.telegramChatIdMasked ? (
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              텔레그램 {summary.telegramChatIdMasked}
            </span>
          ) : (
            <Link
              href="/dashboard/settings"
              className="inline-flex min-h-10 items-center text-xs font-semibold text-brand hover:underline dark:text-indigo-300"
            >
              {summary?.telegramNeedsRelink ? "텔레그램 다시 연결 필요 · 설정" : "텔레그램 연결 · 설정"}
            </Link>
          )}
          <button
            type="button"
            onClick={onSend}
            disabled={isSending || !summary?.telegramChatIdMasked}
            className="h-10 border border-hairline bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-canvas-soft dark:border-zinc-700 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400"
          >
            {isSending ? "전송 중" : "텔레그램 전송"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-hairline border-y border-hairline dark:divide-zinc-800 dark:border-zinc-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {periods.map((key) => (
          <ReturnPeriodBox key={key} period={summary?.periods[key] ?? null} />
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {summary
            ? `${summary.accountName} · 기준일 ${summary.asOfDate}`
            : "수익률 기준 기록을 불러오는 중입니다."}
        </span>
        {status && (
          <span role={status.includes("실패") ? "alert" : "status"} className={status.includes("실패") ? "text-danger" : "text-success"}>
            {status}
          </span>
        )}
      </div>
    </section>
  );
}

function ReturnPeriodBox({ period }: { period: PortfolioReturnPeriod | null }) {
  const pct = period?.returnPct;
  const amount = period?.returnAmount;
  const tone = pct === null || pct === undefined || pct === 0 ? "neutral" : pct > 0 ? "up" : "down";
  return (
    <div className="py-3 sm:px-4 sm:first:pl-0">
      <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{period?.label ??"수익률"}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums tracking-tight",
          tone === "up" && "text-gain",
          tone === "down" && "text-loss",
          tone === "neutral" && "text-zinc-500 dark:text-zinc-400"
        )}
      >
        {pct === null || pct === undefined ? "-" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
      </p>
      <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
        {amount === null || amount === undefined
          ? "기준 기록 없음"
          : formatSignedKRW(amount)}
      </p>
      {period?.snapshotDate && (
        <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          비교 기준 {period.snapshotDate}
        </p>
      )}
    </div>
  );
}

function UpcomingDividends({ items }: { items: DividendCalendarRow[] }) {
  return (
    <section aria-labelledby="home-dividend-schedule" className="border border-hairline bg-surface p-5 shadow-card dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="home-dividend-schedule" className="text-base font-bold tracking-tight text-ink">
          다가오는 배당 일정
          <InfoTip label="배당 일정 설명" align="start">설정의 배당 일정에 등록한 지급 예정일 가운데 가까운 3건입니다.</InfoTip>
        </h2>
        <Link href="/dashboard/dividend" className="inline-flex min-h-10 items-center text-sm font-semibold text-brand hover:underline dark:text-indigo-300">
          배당 기록
        </Link>
      </div>
      {items.length === 0 ? (
        <EmojiLine as="p" emoji="💸" size="sm" tone="mute">
          <span>
            등록한 배당 일정이 없습니다.{" "}
            <Link href="/dashboard/settings" className="font-semibold text-brand underline-offset-2 hover:underline dark:text-indigo-300">
              설정에서 등록
            </Link>
          </span>
        </EmojiLine>
      ) : (
        <ul className="divide-y divide-hairline dark:divide-zinc-800">
          {items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-semibold text-ink">{item.stock}</span>
                <span className="text-zinc-500 dark:text-zinc-400"> · {item.type}{item.note ? ` · ${item.note}` : ""}</span>
              </span>
              <time dateTime={item.date} className="shrink-0 tabular-nums text-ink">{formatScheduleDate(item.date)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatScheduleDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일(${WEEKDAYS[parsed.getDay()]})`;
}
