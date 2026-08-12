// 대시보드 클라이언트 — 시세 자동 갱신, 테마별 그룹·정렬, 차트
"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Holding, CostBasis, HoldingWithPnL } from "@/types";
import { computeHoldingsWithPnL } from "@/lib/portfolio";
import { SummaryHeader } from "@/components/portfolio/summary-header";
import { RebalanceAlert } from "@/components/portfolio/rebalance-alert";
import { HoldingCard } from "@/components/portfolio/holding-card";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { AllocationBarChart } from "@/components/charts/allocation-bar-chart";
import { getCategoryColor } from "@/lib/colors";
import { cn, formatKRW } from "@/lib/utils";
import { extraNavItems } from "@/lib/dashboard-navigation";
import type { DividendCalendarRow } from "@/lib/queries";

interface Props {
  initialHoldings: Holding[];
  initialCostBases: CostBasis[];
  monthlyBudget: number;
  totalDividend: number;
  lastPriceUpdate: string | null;
  dividendCalendar: DividendCalendarRow[];
}

type GroupBy = "none" | "category" | "sub_category";
type SortBy = "default" | "weight_desc" | "pnl_desc" | "pnl_asc";

const PENSION_QUOTES = [
  "연금은 시장을 맞히는 일이 아니라, 시간을 내 편으로 쌓는 일입니다.",
  "오늘의 적립은 작아 보여도 복리의 시간표에서는 가장 앞자리에 놓입니다.",
  "노후 현금흐름은 한 번의 수익률보다 오래 지속되는 습관에서 만들어집니다.",
  "분산된 연금 포트폴리오는 불확실한 시장을 견디는 생활 방어선입니다.",
  "경제적 자유는 큰 매수 한 번보다 정해진 날의 꾸준한 실행에 더 가깝습니다.",
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type TodayInfo = {
  date: Date;
  dateKey: string;
  fullDate: string;
  weekOfYear: number;
};

type EconomicEvent = {
  id: string;
  date: string;
  title: string;
  type: string;
  note: string;
  source: string;
};

export function DashboardClient({
  initialHoldings,
  initialCostBases,
  monthlyBudget,
  totalDividend,
  lastPriceUpdate,
  dividendCalendar,
}: Props) {
  const [holdings, setLocalHoldings] = useState(initialHoldings);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [todayInfo, setTodayInfo] = useState<TodayInfo | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    setTodayInfo(getTodayInfo(new Date()));
    setQuoteIndex(Math.floor(Math.random() * PENSION_QUOTES.length));
  }, []);

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

  const holdingsWithPnL = computeHoldingsWithPnL(holdings, initialCostBases);

  const totalValue = holdingsWithPnL.reduce((s, h) => s + h.current_value, 0);
  const totalCost = holdingsWithPnL.reduce((s, h) => s + h.total_cost, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const activeHoldings = holdingsWithPnL.filter(
    (h) => h.shares > 0 || h.target_pct > 0
  );

  // 정렬
  const sortedHoldings = useMemo(() => {
    return [...activeHoldings].sort((a, b) => {
      if (sortBy === "pnl_desc") return b.profit_loss_pct - a.profit_loss_pct;
      if (sortBy === "pnl_asc") return a.profit_loss_pct - b.profit_loss_pct;
      if (sortBy === "weight_desc") return b.actual_pct - a.actual_pct;
      return b.target_pct - a.target_pct;
    });
  }, [activeHoldings, sortBy]);

  // 그룹핑
  const holdingGroups = useMemo(() => {
    if (groupBy === "none") return [{ label: "", items: sortedHoldings }];
    const key = groupBy === "category" ? "category" : "sub_category";
    const map = new Map<string, HoldingWithPnL[]>();
    for (const h of sortedHoldings) {
      const k = String(h[key] || "기타");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(h);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [sortedHoldings, groupBy]);

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

  const economicEvents = useMemo(() => {
    const baseDate = todayInfo?.date ?? new Date();
    return buildEconomicEvents(dividendCalendar, baseDate);
  }, [dividendCalendar, todayInfo]);

  return (
    <div className="space-y-5 md:space-y-6">
      {refreshResult && (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
            refreshResult.includes("실패")
              ? "bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
              : "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
          }`}
        >
          {refreshResult}
        </div>
      )}

      <section className="overflow-hidden rounded-[1.75rem] border border-indigo-100 bg-white shadow-float dark:border-indigo-500/15 dark:bg-zinc-900">
        <div className="relative px-5 py-6 sm:px-6">
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_20%_0%,rgba(83,58,253,0.22),transparent_36%),linear-gradient(135deg,rgba(28,30,84,0.10),transparent_45%)] dark:bg-[radial-gradient(circle_at_20%_0%,rgba(83,58,253,0.25),transparent_38%)]" />
          <div className="relative space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-indigo-500">HOME</p>
                <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white sm:text-3xl">
                  {PENSION_QUOTES[quoteIndex]}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-mute dark:text-zinc-400">
                  <span className="rounded-full bg-white/80 px-3 py-1 font-semibold text-ink shadow-card dark:bg-zinc-950/70 dark:text-zinc-100">
                    {todayInfo?.fullDate ?? "오늘"}
                  </span>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                    {todayInfo ? `${todayInfo.weekOfYear}주차` : "주차 계산 중"}
                  </span>
                  <span>장기 연금 관리는 날짜를 기록하는 것부터 시작합니다.</span>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-indigo-500 px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(83,58,253,0.24)] transition-all hover:bg-indigo-600 active:scale-[0.98] disabled:opacity-60"
              >
                {isRefreshing ? "갱신 중..." : "시세 새로고침"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HomeStat label="평가금액" value={formatKRW(totalValue)} />
              <HomeStat
                label="총 손익"
                value={formatKRW(totalPnL)}
                tone={totalPnL >= 0 ? "up" : "down"}
                sub={`${totalPnLPct >= 0 ? "+" : ""}${totalPnLPct.toFixed(2)}%`}
              />
              <HomeStat label="보유 종목" value={`${activeHoldings.length}개`} />
              <HomeStat label="월 적립금" value={formatKRW(monthlyBudget)} />
            </div>

            <div className="rounded-[1.35rem] border border-white/70 bg-white/80 p-4 shadow-card backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/60">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-ink dark:text-white">경제 캘린더</h2>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    등록된 배당락일과 월간 경제 체크 이벤트를 함께 봅니다.
                  </p>
                </div>
                <Link
                  href="/dashboard/dividend"
                  className="shrink-0 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300"
                >
                  배당 관리
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {economicEvents.map((event) => (
                  <EconomicEventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--color-hairline)] bg-white p-4 shadow-card dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight">추가 메뉴</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              하단 메뉴에서 뺀 기능은 홈에서 버튼으로 실행합니다.
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
            {extraNavItems.length}개
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {extraNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-20 items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/60 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-500 shadow-card transition-colors group-hover:bg-indigo-500 group-hover:text-white dark:bg-zinc-900">
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <SummaryHeader
        totalValue={totalValue}
        totalCost={totalCost}
        totalDividend={totalDividend}
        monthlyBudget={monthlyBudget}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <RebalanceAlert holdings={holdingsWithPnL} categoryData={barData} />

      {totalValue > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-[var(--color-hairline)] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card">
            <h3 className="text-sm font-semibold mb-3">자산군별 비중</h3>
            <CategoryPieChart data={pieData} />
          </div>
          <div className="rounded-2xl border border-[var(--color-hairline)] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card">
            <h3 className="text-sm font-semibold mb-3">현재 vs 목표 비중</h3>
            <AllocationBarChart data={barData} />
          </div>
        </div>
      )}

      {/* 종목 리스트 */}
      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold">
            보유 종목 ({activeHoldings.length})
          </h3>

          {activeHoldings.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
              {/* 그룹 컨트롤 */}
              <div className="flex items-center overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-white text-xs shadow-card dark:border-zinc-700 dark:bg-zinc-900">
                <span className="px-2.5 py-1 text-zinc-400 shrink-0 border-r border-[var(--color-hairline)] dark:border-zinc-700">그룹</span>
                {(
                  [
                    { value: "none", label: "전체" },
                    { value: "category", label: "자산군" },
                    { value: "sub_category", label: "세부테마" },
                  ] as { value: GroupBy; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGroupBy(opt.value)}
                    className={cn(
                      "flex-1 px-2.5 py-2 transition-colors sm:flex-none sm:py-1.5",
                      groupBy === opt.value
                        ? "bg-indigo-500 text-white"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* 정렬 컨트롤 */}
              <div className="flex items-center overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-white text-xs shadow-card dark:border-zinc-700 dark:bg-zinc-900">
                <span className="px-2.5 py-1 text-zinc-400 shrink-0 border-r border-[var(--color-hairline)] dark:border-zinc-700">정렬</span>
                {(
                  [
                    { value: "default", label: "목표비중" },
                    { value: "weight_desc", label: "현재비중" },
                    { value: "pnl_desc", label: "수익↓" },
                    { value: "pnl_asc", label: "수익↑" },
                  ] as { value: SortBy; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={cn(
                      "flex-1 px-2.5 py-2 transition-colors sm:flex-none sm:py-1.5",
                      sortBy === opt.value
                        ? "bg-indigo-500 text-white"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeHoldings.length === 0 ? (
          <p className="text-sm text-zinc-400 py-8 text-center">
            아직 보유 종목이 없습니다. 매수 계획에서 첫 매수를 시작해보세요.
          </p>
        ) : (
          <div className="space-y-4">
            {holdingGroups.map((group) => (
              <div key={group.label || "_all"}>
                {group.label && (
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: getCategoryColor(group.label) }}
                    />
                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                    <span className="text-xs text-zinc-400">{group.items.length}종목</span>
                  </div>
                )}
                <div className="space-y-2">
                  {group.items.map((h) => (
                    <HoldingCard key={h.id} holding={h} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeStat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "up" | "down";
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-card backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums tracking-tight",
          tone === "up" && "text-emerald-600 dark:text-emerald-400",
          tone === "down" && "text-red-600 dark:text-red-400",
          tone === "neutral" && "text-zinc-950 dark:text-white"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-400">{sub}</p>}
    </div>
  );
}

function EconomicEventCard({ event }: { event: EconomicEvent }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white/90 p-3 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-card dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-indigo-500/30">
      <div className="mb-2 flex items-start justify-between gap-3">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {formatEventDate(event.date)}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-bold",
            event.type.includes("배당") && "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
            event.type.includes("실적") && "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
            !event.type.includes("배당") && !event.type.includes("실적") && "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
          )}
        >
          {event.type}
        </span>
      </div>
      <p className="text-sm font-bold text-zinc-950 dark:text-white">{event.title}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{event.note}</p>
      <p className="mt-2 text-[11px] font-semibold text-zinc-400">{event.source}</p>
    </div>
  );
}

function getTodayInfo(date: Date): TodayInfo {
  return {
    date,
    dateKey: toDateKey(date),
    fullDate: `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}요일`,
    weekOfYear: getISOWeek(date),
  };
}

function buildEconomicEvents(
  dividendCalendar: DividendCalendarRow[],
  baseDate: Date
): EconomicEvent[] {
  const todayKey = toDateKey(baseDate);
  const dividendEvents = dividendCalendar
    .filter((item) => item.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      date: item.date,
      title: item.stock,
      type: item.type || "배당 일정",
      note: item.note || "배당 캘린더에 등록된 일정입니다.",
      source: "등록된 배당 캘린더",
    }));

  const nextMonday = addDays(baseDate, ((8 - baseDate.getDay()) % 7) || 7);
  const nextMonthStart = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  const earningsSeasonMonths = [0, 3, 6, 9];
  const isEarningsSeason = earningsSeasonMonths.includes(baseDate.getMonth());

  const checklistEvents: EconomicEvent[] = [
    {
      id: "earnings-check",
      date: toDateKey(nextMonday),
      title: isEarningsSeason ? "미국 기업 실적 발표 시즌 점검" : "관심 기업 실적 발표 일정 확인",
      type: "실적 체크",
      note: "ETF 편입 비중이 큰 기업의 실적 발표가 지수 변동성을 키울 수 있습니다.",
      source: "월간 경제 체크",
    },
    {
      id: "macro-check",
      date: toDateKey(addDays(baseDate, 5)),
      title: "물가·금리 일정 확인",
      type: "경제 일정",
      note: "금리와 물가 지표는 채권·배당 ETF의 가격 흐름을 흔들 수 있습니다.",
      source: "월간 경제 체크",
    },
    {
      id: "monthly-pension-check",
      date: toDateKey(nextMonthStart),
      title: "월 적립·리밸런싱 점검",
      type: "연금 관리",
      note: "정해진 예산과 목표 비중을 다시 확인하고 다음 매수 계획을 준비합니다.",
      source: "개인 연금 루틴",
    },
  ];

  return [...dividendEvents, ...checklistEvents]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getISOWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatEventDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getMonth() + 1}/${parsed.getDate()}(${WEEKDAYS[parsed.getDay()]})`;
}
