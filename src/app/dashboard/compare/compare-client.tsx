"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import type { Holding } from "@/types";
import { SERIES_COLORS } from "@/lib/colors";
import { cn, formatKRW, formatKRWFull } from "@/lib/utils";
import { CATEGORIES } from "@/lib/constants";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

interface SearchETF {
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  tradingValue: number;
  category: string;
}

interface ETFDetail {
  issuer: string;
  totalFee: number;
  dividendYield: number;
  nav: string;
  marketValue: string;
  returnRate1m: number;
  returnRate3m: number;
  returnRate1y: number;
  description: string;
  similarETFs: { code: string; name: string; price: string }[];
  components: { code: string; name: string; weight: number }[];
  componentTotalWeight: number;
}

interface CompareItem extends SearchETF {
  shares: number;
  targetPct: number;
  detail?: ETFDetail;
}

interface Props {
  holdings: Holding[];
}

const THEMES = [
  "전체", "코스피", "코스닥", "미국", "배당", "반도체",
  "2차전지", "바이오", "리츠", "채권", "금", "인도", "중국",
];

// 기본은 이름순(중립). 거래량·거래대금은 '얼마나 활발히 거래되는가'(유동성)를 비교하는 기준으로 둔다 — 순위 목록이 아니다.
const SORT_OPTIONS = [
  { value: "name", label: "이름순" },
  { value: "volume", label: "거래량 많은 순" },
  { value: "value", label: "거래대금 많은 순" },
];

const PERIOD_OPTIONS = [
  { value: "1m", label: "1개월" },
  { value: "3m", label: "3개월" },
  { value: "6m", label: "6개월" },
  { value: "1y", label: "1년" },
];

const COMPARISON_LABELS = {
  code: "종목코드",
  category: "분류/테마",
  price: "현재가(원)",
  dayChange: "당일 등락률(%)",
  returnRate: "선택 기간 수익률(%)",
  volume: "거래량(주, 당일)",
  tradingValue: "거래대금(원, 당일)",
  fee: "총보수(연 %)",
  dividendYield: "분배금 수익률(%)",
  issuer: "운용사",
  marketValue: "시가총액",
  nav: "기준가 NAV",
  shares: "내 보유수량",
};

const codeLabel = (item: CompareItem) => item.code || item.name;
const STORAGE_KEY = "pension-manager:compare-state:v1";

type StoredCompareState = {
  selected?: CompareItem[];
  period?: string;
  activeTheme?: string;
  sortBy?: string;
  searchQuery?: string;
  showSearch?: boolean;
};

export function CompareClient({ holdings }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<CompareItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchETF[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTheme, setActiveTheme] = useState("전체");
  const [sortBy, setSortBy] = useState("name");
  const [showSearch, setShowSearch] = useState(true);
  const [period, setPeriod] = useState("3m");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const [addedCodes, setAddedCodes] = useState<Set<string>>(new Set());
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const [addStatus, setAddStatus] = useState<{ kind: "done" | "error"; text: string } | null>(null);
  const maxSelect = 5;

  const holdingMap = useMemo(
    () => new Map(holdings.map((h) => [h.code, h])),
    [holdings]
  );

  useEffect(() => {
    setAddedCodes(new Set());
  }, [holdings]);

  const search = useCallback(
    async (query: string, theme: string, sort: string) => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (theme && theme !== "전체") params.set("theme", theme);
        params.set("sort", sort);
        const res = await fetch(`/api/market/search?${params}`);
        const data = await res.json();
        setSearchResults(data.etfs ?? []);
      } catch {
        setSearchResults([]);
      }
      setIsSearching(false);
    },
    []
  );

  // 페이지 이동 후 돌아와도 사용자가 직접 초기화하기 전까지 비교 상태 유지
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        search("", "전체", "name");
        return;
      }
      const saved = JSON.parse(raw) as StoredCompareState;
      const savedSelected = Array.isArray(saved.selected)
        ? saved.selected.filter((item) => item?.code && item?.name).slice(0, maxSelect)
        : [];

      if (savedSelected.length > 0) setSelected(savedSelected);
      if (saved.period && PERIOD_OPTIONS.some((p) => p.value === saved.period)) setPeriod(saved.period);
      if (saved.activeTheme && THEMES.includes(saved.activeTheme)) setActiveTheme(saved.activeTheme);
      if (saved.sortBy && SORT_OPTIONS.some((o) => o.value === saved.sortBy)) setSortBy(saved.sortBy);
      if (typeof saved.searchQuery === "string") setSearchQuery(saved.searchQuery);
      if (typeof saved.showSearch === "boolean") setShowSearch(saved.showSearch);
      // 마지막으로 고른 정렬·테마·검색어로 목록을 불러온다
      search(
        typeof saved.searchQuery === "string" ? saved.searchQuery : "",
        saved.activeTheme && THEMES.includes(saved.activeTheme) ? saved.activeTheme : "전체",
        saved.sortBy && SORT_OPTIONS.some((o) => o.value === saved.sortBy) ? saved.sortBy : "name"
      );
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      search("", "전체", "name");
    } finally {
      setHasRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!hasRestored) return;
    const snapshot: StoredCompareState = {
      selected,
      period,
      activeTheme,
      sortBy,
      searchQuery,
      showSearch,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [activeTheme, hasRestored, period, searchQuery, selected, showSearch, sortBy]);

  // 선택 변경 시 상세 정보 로드
  useEffect(() => {
    if (selected.length < 2) return;
    const needDetail = selected.filter((s) => !s.detail);
    if (needDetail.length === 0) return;

    setLoadingDetail(true);
    const codes = needDetail.map((s) => s.code).join(",");
    fetch(`/api/market/detail?codes=${codes}`)
      .then((r) => r.json())
      .then((data) => {
        const details: Record<string, ETFDetail> = data.details ?? {};
        setSelected((prev) =>
          prev.map((s) =>
            details[s.code] ? { ...s, detail: details[s.code] } : s
          )
        );
      })
      .finally(() => setLoadingDetail(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selected 전체를 deps에 넣으면 무한 루프
  }, [selected.length]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    search(q, activeTheme, sortBy);
  };

  const handleTheme = (theme: string) => {
    setActiveTheme(theme);
    search(searchQuery, theme, sortBy);
  };

  const handleSort = (sort: string) => {
    setSortBy(sort);
    search(searchQuery, activeTheme, sort);
  };

  const addToCompare = (etf: SearchETF) => {
    if (selected.length >= maxSelect) return;
    if (selected.some((s) => s.code === etf.code)) return;
    const h = holdingMap.get(etf.code);
    setSelected([
      ...selected,
      { ...etf, shares: h?.shares ?? 0, targetPct: h?.target_pct ?? 0 },
    ]);
  };

  const removeFromCompare = (code: string) => {
    setSelected(selected.filter((s) => s.code !== code));
  };

  const resetCompare = () => {
    setSelected([]);
    setPeriod("3m");
    setActiveTheme("전체");
    setSortBy("name");
    setSearchQuery("");
    setShowSearch(true);
    window.localStorage.removeItem(STORAGE_KEY);
    search("", "전체", "name");
  };

  const addToPortfolio = async (etf: SearchETF) => {
    if (holdingMap.has(etf.code) || addedCodes.has(etf.code) || addingCode) return;
    setAddingCode(etf.code);
    setAddStatus(null);
    try {
      const res = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: etf.code,
          name: etf.name,
          category: inferPortfolioCategory(etf.category),
          sub_category: etf.category || "기타",
          current_price: Math.max(0, Math.round(etf.price)),
          target_pct: 0,
          shares: 0,
          avg_price: 0,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "종목 추가 실패");

      setAddedCodes((current) => new Set(current).add(etf.code));
      setAddStatus({
        kind: "done",
        text: `${etf.name}(${etf.code})을(를) 지금 선택한 계좌의 종목 목록에 0주로 추가했습니다. 주문은 실행되지 않습니다. 실제로 매수한 뒤 매수 기록에 남기면 보유 수량이 반영됩니다.`,
      });
      router.refresh();
    } catch (err) {
      setAddStatus({ kind: "error", text: `${etf.name}을(를) 내 종목에 추가하지 못했습니다: ${(err as Error).message}. 잠시 뒤 다시 시도해 주세요.` });
    } finally {
      setAddingCode(null);
    }
  };

  // 기간별 수익률 가져오기
  const getReturn = (item: CompareItem) => {
    if (!item.detail) return item.changePct;
    if (period === "1m") return item.detail.returnRate1m;
    if (period === "3m") return item.detail.returnRate3m;
    if (period === "6m") return item.detail.returnRate3m; // 6m 실데이터 미제공 → 3m로 근사(조작 수치 제거)
    if (period === "1y") return item.detail.returnRate1y;
    return item.changePct;
  };

  // 차트 데이터
  const barData = selected.map((s, i) => ({
    name: s.name,
    code: codeLabel(s),
    현재가: s.price,
    color: SERIES_COLORS[i],
  }));

  const returnBarData = selected.map((s, i) => ({
    name: s.name,
    code: codeLabel(s),
    수익률: getReturn(s),
    color: SERIES_COLORS[i],
  }));

  const volumeBarData = selected.map((s, i) => ({
    name: s.name,
    code: codeLabel(s),
    거래량: s.volume,
    color: SERIES_COLORS[i],
  }));

  // 레이더
  const safe = (v: number, max: number) =>
    max > 0 ? (v / max) * 100 : 0;
  const maxPrice = Math.max(...selected.map((s) => s.price), 1);
  const maxVol = Math.max(...selected.map((s) => s.volume), 1);
  const maxReturn = Math.max(...selected.map((s) => Math.abs(getReturn(s))), 1);

  const radarData = [
    {
      metric: "현재가",
      ...Object.fromEntries(selected.map((s, i) => [`v${i}`, safe(s.price, maxPrice)])),
    },
    {
      metric: "거래량",
      ...Object.fromEntries(selected.map((s, i) => [`v${i}`, safe(s.volume, maxVol)])),
    },
    {
      metric: "수익률",
      ...Object.fromEntries(selected.map((s, i) => [`v${i}`, safe(Math.abs(getReturn(s)), maxReturn)])),
    },
    {
      metric: "배당률",
      ...Object.fromEntries(selected.map((s, i) => [`v${i}`, (s.detail?.dividendYield ?? 0) * 20])),
    },
    {
      metric: "저보수",
      ...Object.fromEntries(selected.map((s, i) => [`v${i}`, Math.max(0, 100 - (s.detail?.totalFee ?? 0) * 200)])),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink">ETF 종목 비교</h1>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            공개 시세를 나란히 놓고 보는 참고 정보이며 투자 권유가 아닙니다. 주문은 실행되지 않습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <button
              onClick={resetCompare}
              className="border border-hairline bg-surface px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-canvas-soft dark:border-zinc-700"
            >
              비교 초기화
            </button>
          )}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="border border-hairline bg-white px-4 py-1.5 text-xs font-medium text-indigo-600 shadow-card transition-colors hover:shadow-float hover:border-indigo-200 dark:bg-zinc-900 dark:border-zinc-700"
          >
            {showSearch ? "검색 닫기" : "종목 검색"}
          </button>
        </div>
      </div>

      {/* 선택 칩 */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((s, i) => (
            <span
              key={s.code}
              className="dot-bg inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white shadow-card"
              style={{ "--dot-bg": SERIES_COLORS[i] } as CSSProperties}
            >
              <span title={s.name}>{s.name.length > 10 ? s.name.slice(0, 10) + "…" : s.name}</span>
              <button
                type="button"
                onClick={() => removeFromCompare(s.code)}
                aria-label={`${s.name} 비교에서 빼기`}
                className="-my-2 -mr-2 inline-flex h-11 w-11 items-center justify-center text-white hover:opacity-80"
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </span>
          ))}
          <span className="text-xs text-zinc-500 dark:text-zinc-400 self-center tabular-nums">
            {selected.length}/{maxSelect}
          </span>
        </div>
      )}

      {/* 검색 영역 */}
      {showSearch && (
        <div className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card space-y-3">
          {addStatus && (
            <p
              role={addStatus.kind === "error" ? "alert" : "status"}
              className={`border px-3 py-2 text-xs leading-relaxed ${
                addStatus.kind === "done"
                  ? "border-hairline bg-surface text-ink dark:border-zinc-800"
                  : "border-danger-line bg-danger-soft text-danger"
              }`}
            >
              {addStatus.text}
            </p>
          )}
          <div className="relative">
            <svg aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 dark:text-zinc-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input aria-label="ETF 이름 또는 종목코드 검색"
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="ETF 이름 또는 종목코드 검색"
              className="w-full h-11 border border-hairline bg-canvas-soft pl-10 pr-4 text-sm text-ink placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => handleTheme(t)}
                className={cn(
                  "inline-flex min-h-10 items-center px-3 text-xs font-medium whitespace-nowrap transition-colors",
                  activeTheme === t
                    ? "border border-brand bg-brand text-white"
                    : "border border-hairline bg-white text-zinc-500 dark:text-zinc-400 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-800 dark:border-zinc-700"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              정렬
              <select
                value={sortBy}
                onChange={(e) => handleSort(e.target.value)}
                className="h-10 border border-hairline bg-surface px-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-zinc-700"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <p className="min-w-0 flex-1 basis-56 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              거래량·거래대금이 적은 ETF 는 원하는 가격에 사고팔기 어려울 수 있습니다(유동성). 비교할 때 함께 보세요.
            </p>
          </div>

          <div tabIndex={0} role="region" aria-label="ETF 검색 결과" className="max-h-112 overflow-y-auto space-y-1">
            {isSearching ? (
              <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">검색 중...</p>
            ) : searchResults.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">결과 없음</p>
            ) : (
              searchResults.map((etf) => {
                const isSel = selected.some((s) => s.code === etf.code);
                const isMy = holdingMap.has(etf.code) || addedCodes.has(etf.code);
                return (
                  <div
                    key={etf.code}
                    className={cn(
                      "w-full flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5 text-left transition-colors sm:flex-nowrap",
                      isSel ? "bg-indigo-50 dark:bg-indigo-900/20 opacity-60" : "hover:bg-canvas-soft dark:hover:bg-zinc-800"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => !isSel && addToCompare(etf)}
                      disabled={isSel || selected.length >= maxSelect}
                      className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate" title={etf.name}>{etf.name}</p>
                        {isMy && (
                          <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            내 종목
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                        <strong className="font-semibold text-zinc-700 dark:text-zinc-200">{etf.code}</strong> · {etf.category} · 거래량 {fmtVol(etf.volume)}주 · 거래대금 {etf.tradingValue > 0 ? formatKRW(etf.tradingValue) : "-"}
                      </p>
                    </button>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{formatKRWFull(etf.price)}</p>
                      <p className={cn("text-xs tabular-nums", etf.changePct > 0 ? "text-gain" : etf.changePct < 0 ? "text-loss" : "text-zinc-500 dark:text-zinc-400")}>
                        {etf.changePct > 0 ? "+" : ""}{etf.changePct.toFixed(2)}%
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToPortfolio(etf)}
                      disabled={isMy || addingCode === etf.code || Boolean(addingCode)}
                      aria-label={isMy ? `${etf.name} 이미 내 종목 목록에 있음` : `${etf.name}을(를) 내 종목 목록에 0주로 추가(주문 아님)`}
                      title="지금 선택한 계좌의 종목 목록에 0주로 추가합니다. 주문은 실행되지 않습니다."
                      className="inline-flex min-h-11 basis-full shrink-0 items-center justify-center border border-indigo-100 sm:basis-auto bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400"
                    >
                      {isMy ? "내 종목에 있음" : addingCode === etf.code ? "추가 중" : "내 종목에 추가"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========== 비교 결과 ========== */}
      {selected.length >= 2 && (
        <>
          {/* 기간 선택 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">수익률 기간:</span>
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  period === p.value
                    ? "border border-brand bg-brand text-white"
                    : "border border-hairline bg-white text-zinc-500 dark:text-zinc-400 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-800 dark:border-zinc-700"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 비교 테이블 */}
          <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400 sm:hidden" aria-hidden="true">표가 넓으면 좌우로 밀어 보세요</p>
          <div tabIndex={0} role="region" aria-label="ETF 비교 표" className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto shadow-card">
            <table className="w-full text-sm">
            <caption className="sr-only">선택한 ETF 항목별 비교</caption>
              <thead>
                <tr className="border-b border-hairline dark:border-zinc-800">
                  <th scope="col" className="px-3 py-3 text-left text-xs text-zinc-500 dark:text-zinc-400 font-semibold sticky left-0 bg-white dark:bg-zinc-900 z-10">
                    항목
                  </th>
                  {selected.map((s, i) => (
                    <th scope="col" key={s.code} className="series-fg px-3 py-3 text-right min-w-35" style={{"--series-fg": SERIES_COLORS[i] } as CSSProperties}>
                      <span className="block text-sm font-extrabold tabular-nums">{s.code}</span>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 whitespace-normal break-keep">
                        {s.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <CRow label={COMPARISON_LABELS.code} vals={selected.map((s) => s.code)} bold />
                <CRow label={COMPARISON_LABELS.category} vals={selected.map((s) => s.category)} />
                <CRow label={COMPARISON_LABELS.price} vals={selected.map((s) => formatKRWFull(s.price))} />
                <CRow label={COMPARISON_LABELS.volume} vals={selected.map((s) => s.volume.toLocaleString("ko-KR"))} />
                <CRow label={COMPARISON_LABELS.tradingValue} vals={selected.map((s) => (s.tradingValue > 0 ? formatKRWFull(s.tradingValue) : "-"))} />
                <CRow
                  label={COMPARISON_LABELS.dayChange}
                  vals={selected.map((s) => `${s.changePct > 0 ? "+" : ""}${s.changePct.toFixed(2)}%`)}
                />
                <CRow
                  label={`${COMPARISON_LABELS.returnRate} · ${PERIOD_OPTIONS.find((p) => p.value === period)?.label}`}
                  vals={selected.map((s) => {
                    const r = getReturn(s);
                    return `${r > 0 ? "+" : ""}${r.toFixed(2)}%`;
                  })}
                />
                <CRow
                  label={COMPARISON_LABELS.fee}
                  vals={selected.map((s) => s.detail ? `${s.detail.totalFee}%` : "-")}
                  bold
                />
                <CRow
                  label={COMPARISON_LABELS.dividendYield}
                  vals={selected.map((s) => s.detail ? `${s.detail.dividendYield}%` : "-")}
                />
                <CRow
                  label={COMPARISON_LABELS.issuer}
                  vals={selected.map((s) => s.detail?.issuer ?? "-")}
                />
                <CRow
                  label={COMPARISON_LABELS.marketValue}
                  vals={selected.map((s) => s.detail?.marketValue ?? "-")}
                />
                <CRow
                  label={COMPARISON_LABELS.nav}
                  vals={selected.map((s) => s.detail?.nav ?? "-")}
                />
                <CRow
                  label={COMPARISON_LABELS.shares}
                  vals={selected.map((s) => s.shares > 0 ? `${s.shares}주` : "-")}
                />
              </tbody>
            </table>
          </div>

          {/* ETF 구성 종목 */}
          <div className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">ETF 구성 종목·편입비율 비교</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  각 ETF의 상위 편입 종목과 비중입니다. 종목코드는 굵게 표시했습니다.
                </p>
              </div>
              {loadingDetail && <span className="text-xs text-zinc-500 dark:text-zinc-400">구성 종목 로딩 중...</span>}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selected.map((s, i) => {
                const components = s.detail?.components ?? [];
                return (
                  <div key={s.code} className="border border-zinc-100 bg-canvas-soft p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="series-fg text-sm font-extrabold tabular-nums" style={{"--series-fg": SERIES_COLORS[i] } as CSSProperties}>{s.code}</p>
                        <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 truncate">{s.name}</p>
                      </div>
                      <span className="shrink-0 bg-white px-2 py-1 text-xs font-bold text-zinc-600 shadow-sm dark:bg-zinc-900 dark:text-zinc-300">
                        표시합계 {(s.detail?.componentTotalWeight ?? 0).toFixed(2)}%
                      </span>
                    </div>
                    {components.length > 0 ? (
                      <div className="space-y-2">
                        {components.slice(0, 10).map((component) => (
                          <div key={`${s.code}-${component.code || component.name}`} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">
                                <strong className="font-extrabold text-zinc-950 dark:text-white">{component.code || "코드없음"}</strong>
                                <span className="ml-1">{component.name}</span>
                              </span>
                              <span className="shrink-0 font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                                {component.weight.toFixed(2)}%
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                              <div
                                className="bar-w dot-bg h-full"
                                style={{ "--bar-w": `${Math.min(component.weight * 5, 100)}%`, "--dot-bg": SERIES_COLORS[i] } as CSSProperties}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="bg-white px-3 py-4 text-center text-xs text-zinc-500 dark:text-zinc-400 dark:bg-zinc-900">
                        구성 종목 데이터 없음
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 유사 ETF */}
          {selected.some((s) => s.detail?.similarETFs?.length) && (
            <div className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
              <h2 className="text-sm font-semibold text-ink mb-3">유사 ETF</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selected.map((s, i) => (
                  s.detail?.similarETFs?.length ? (
                    <div key={s.code} className="space-y-1.5">
                      <p className="series-fg text-xs font-bold" style={{"--series-fg": SERIES_COLORS[i] } as CSSProperties}>
                        {s.name}
                      </p>
                      {s.detail.similarETFs.map((sim) => (
                        <div key={sim.code} className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{sim.name}</span>
                          <span className="tabular-nums">{sim.price}원</span>
                        </div>
                      ))}
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          )}

          {/* 차트 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 레이더 */}
            <div className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
              <h2 className="text-sm font-semibold text-ink mb-3">종합 비교</h2>
              <div className="h-65">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e3e8ee" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: "#5f6f88" }} />
                    <PolarRadiusAxis tick={false} domain={[0, 100]} />
                    {selected.map((s, i) => (
                      <Radar
                        key={s.code}
                        name={s.name.length > 8 ? s.name.slice(0, 8) + "…" : s.name}
                        dataKey={`v${i}`}
                        stroke={SERIES_COLORS[i]}
                        fill={SERIES_COLORS[i]}
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <ChartLegend items={selected} />
            </div>

            {/* 수익률 바 */}
            <div className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
              <h2 className="text-sm font-semibold text-ink mb-3">
                수익률 비교 ({PERIOD_OPTIONS.find((p) => p.value === period)?.label})
              </h2>
              <div className="h-75">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={returnBarData} margin={{ top: 8, right: 12, bottom: 58, left: 4 }}>
                    <XAxis dataKey="code" interval={0} height={58} tick={<AxisTick />} />
                    <YAxis tick={{ fontSize: 12, fill: "#5f6f88" }} unit="%" />
                    <Bar dataKey="수익률">
                      {returnBarData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartLegend items={selected} />
            </div>

            {/* 현재가 바 */}
            <div className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
              <h2 className="text-sm font-semibold text-ink mb-3">현재가 비교</h2>
              <div className="h-65">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 12, bottom: 58, left: 4 }}>
                    <XAxis dataKey="code" interval={0} height={58} tick={<AxisTick />} />
                    <YAxis tick={{ fontSize: 12, fill: "#5f6f88" }} tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v)} />
                    <Bar dataKey="현재가">
                      {barData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartLegend items={selected} />
            </div>

            {/* 거래량 바 */}
            <div className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
              <h2 className="text-sm font-semibold text-ink mb-3">거래량 비교</h2>
              <div className="h-65">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeBarData} margin={{ top: 8, right: 12, bottom: 58, left: 4 }}>
                    <XAxis dataKey="code" interval={0} height={58} tick={<AxisTick />} />
                    <YAxis tick={{ fontSize: 12, fill: "#5f6f88" }} tickFormatter={(v) => fmtVol(v)} />
                    <Bar dataKey="거래량">
                      {volumeBarData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartLegend items={selected} />
            </div>
          </div>

          {loadingDetail && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">상세 정보 로딩 중...</p>
          )}
        </>
      )}

      {selected.length === 1 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
          1개 더 선택하면 비교가 시작됩니다.
        </p>
      )}
    </div>
  );
}

function CRow({
  label,
  vals,
  colors,
  bold,
}: {
  label: string;
  vals: string[];
  colors?: string[];
  bold?: boolean;
}) {
  return (
    <tr>
      <th scope="row" className="px-3 py-2.5 text-left text-xs font-normal text-zinc-500 dark:text-zinc-400 sticky left-0 bg-white dark:bg-zinc-900 z-10 whitespace-nowrap">
        {label}
      </th>
      {vals.map((v, i) => (
        <td key={i} className={cn("px-3 py-2.5 text-right text-xs tabular-nums", bold ? "font-bold" : "font-medium", colors?.[i])}>
          {v}
        </td>
      ))}
    </tr>
  );
}

function AxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const value = String(payload?.value ?? "");
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="middle"
        fill="var(--color-zinc-700)"
        fontSize={11}
        fontWeight={800}
      >
        {value}
      </text>
    </g>
  );
}

function ChartLegend({ items }: { items: CompareItem[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      {items.map((item, i) => (
        <div key={item.code} className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          <span className="dot-bg h-2.5 w-2.5 shrink-0" style={{ "--dot-bg": SERIES_COLORS[i] } as CSSProperties} />
          <strong className="shrink-0 font-extrabold tabular-nums text-zinc-950 dark:text-white">{item.code}</strong>
          <span className="max-w-60 whitespace-normal break-keep leading-snug">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

function inferPortfolioCategory(theme: string): (typeof CATEGORIES)[number] {
  if ((CATEGORIES as readonly string[]).includes(theme)) return theme as (typeof CATEGORIES)[number];
  if (["리츠"].includes(theme)) return "리츠";
  if (["금", "원유", "은"].includes(theme)) return "원자재";
  if (["채권"].includes(theme)) return "채권";
  return "주식";
}

function fmtVol(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}천`;
  return String(v);
}

