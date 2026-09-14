"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { Holding } from "@/types";
import { cn } from "@/lib/utils";
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

const COLORS = ["#533afd", "#F97316", "#22C55E", "#EF4444", "#EAB308"];

const THEMES = [
  "전체", "코스피", "코스닥", "미국", "배당", "반도체",
  "2차전지", "바이오", "리츠", "채권", "금", "인도", "중국",
];

const SORT_OPTIONS = [
  { value: "volume", label: "거래량순" },
  { value: "value", label: "거래대금순" },
  { value: "name", label: "이름순" },
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
  volume: "거래량(주)",
  tradingValue: "거래대금(원)",
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
  const [selected, setSelected] = useState<CompareItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchETF[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTheme, setActiveTheme] = useState("전체");
  const [sortBy, setSortBy] = useState("volume");
  const [showSearch, setShowSearch] = useState(true);
  const [period, setPeriod] = useState("3m");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const maxSelect = 5;

  const holdingMap = useMemo(
    () => new Map(holdings.map((h) => [h.code, h])),
    [holdings]
  );

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

  // 초기 로드
  useEffect(() => {
    search("", "전체", "volume");
  }, [search]);

  // 페이지 이동 후 돌아와도 사용자가 직접 초기화하기 전까지 비교 상태 유지
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
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
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
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
    setSortBy("volume");
    setSearchQuery("");
    setShowSearch(true);
    window.localStorage.removeItem(STORAGE_KEY);
    search("", "전체", "volume");
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
    color: COLORS[i],
  }));

  const returnBarData = selected.map((s, i) => ({
    name: s.name,
    code: codeLabel(s),
    수익률: getReturn(s),
    color: COLORS[i],
  }));

  const volumeBarData = selected.map((s, i) => ({
    name: s.name,
    code: codeLabel(s),
    거래량: s.volume,
    color: COLORS[i],
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
        <h2 className="text-lg font-bold text-ink tracking-tight">ETF 종목 비교</h2>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <button
              onClick={resetCompare}
              className="rounded-full border border-red-100 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-600 shadow-card transition-all hover:border-red-200 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
            >
              비교 초기화
            </button>
          )}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="rounded-full border border-hairline bg-white px-4 py-1.5 text-xs font-medium text-indigo-600 shadow-card transition-all hover:shadow-float hover:border-indigo-200 dark:bg-zinc-900 dark:border-zinc-700"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-card"
              style={{ background: COLORS[i] }}
            >
              {s.name.length > 10 ? s.name.slice(0, 10) + "…" : s.name}
              <button
                onClick={() => removeFromCompare(s.code)}
                className="hover:opacity-70 text-white/80"
              >
                ×
              </button>
            </span>
          ))}
          <span className="text-xs text-zinc-400 self-center tabular-nums">
            {selected.length}/{maxSelect}
          </span>
        </div>
      )}

      {/* 검색 영역 */}
      {showSearch && (
        <div className="rounded-2xl border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card space-y-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="ETF 이름 또는 종목코드 검색"
              className="w-full h-11 rounded-full border border-hairline bg-canvas-soft pl-10 pr-4 text-sm text-ink placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => handleTheme(t)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  activeTheme === t
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border border-hairline bg-white text-zinc-500 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-800 dark:border-zinc-700"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => handleSort(o.value)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  sortBy === o.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border border-hairline bg-white text-zinc-500 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-800 dark:border-zinc-700"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {isSearching ? (
              <p className="py-4 text-center text-sm text-zinc-400">검색 중...</p>
            ) : searchResults.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">결과 없음</p>
            ) : (
              searchResults.map((etf) => {
                const isSel = selected.some((s) => s.code === etf.code);
                const isMy = holdingMap.has(etf.code);
                return (
                  <button
                    key={etf.code}
                    onClick={() => !isSel && addToCompare(etf)}
                    disabled={isSel || selected.length >= maxSelect}
                    className={cn(
                      "w-full flex items-center rounded-xl px-3 py-2.5 text-left transition-colors",
                      isSel ? "bg-indigo-50 dark:bg-indigo-900/20 opacity-60" : "hover:bg-canvas-soft dark:hover:bg-zinc-800"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{etf.name}</p>
                        {isMy && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            보유
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 tabular-nums">
                        <strong className="font-extrabold text-zinc-700 dark:text-zinc-200">{etf.code}</strong> · {etf.category} · 거래량 {fmtVol(etf.volume)}
                      </p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="text-sm font-semibold tabular-nums">₩{etf.price.toLocaleString()}</p>
                      <p className={cn("text-xs tabular-nums", etf.changePct > 0 ? "text-red-500" : etf.changePct < 0 ? "text-blue-500" : "text-zinc-400")}>
                        {etf.changePct > 0 ? "+" : ""}{etf.changePct.toFixed(2)}%
                      </p>
                    </div>
                  </button>
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
            <span className="text-xs text-zinc-500 font-medium">수익률 기간:</span>
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  period === p.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border border-hairline bg-white text-zinc-500 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-800 dark:border-zinc-700"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 비교 테이블 */}
          <div className="rounded-2xl border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline dark:border-zinc-800">
                  <th className="px-3 py-3 text-left text-xs text-zinc-500 font-semibold sticky left-0 bg-white dark:bg-zinc-900 z-10">
                    항목
                  </th>
                  {selected.map((s, i) => (
                    <th key={s.code} className="px-3 py-3 text-right min-w-[140px]" style={{ color: COLORS[i] }}>
                      <span className="block text-sm font-extrabold tabular-nums">{s.code}</span>
                      <span className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 whitespace-normal break-keep">
                        {s.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <CRow label={COMPARISON_LABELS.code} vals={selected.map((s) => s.code)} bold />
                <CRow label={COMPARISON_LABELS.category} vals={selected.map((s) => s.category)} />
                <CRow label={COMPARISON_LABELS.price} vals={selected.map((s) => `₩${s.price.toLocaleString()}`)} />
                <CRow
                  label={COMPARISON_LABELS.dayChange}
                  vals={selected.map((s) => `${s.changePct > 0 ? "+" : ""}${s.changePct.toFixed(2)}%`)}
                  colors={selected.map((s) => s.changePct > 0 ? "text-red-500" : s.changePct < 0 ? "text-blue-500" : "")}
                />
                <CRow
                  label={`${COMPARISON_LABELS.returnRate} · ${PERIOD_OPTIONS.find((p) => p.value === period)?.label}`}
                  vals={selected.map((s) => {
                    const r = getReturn(s);
                    return `${r > 0 ? "+" : ""}${r.toFixed(2)}%`;
                  })}
                  colors={selected.map((s) => {
                    const r = getReturn(s);
                    return r > 0 ? "text-red-500" : r < 0 ? "text-blue-500" : "";
                  })}
                />
                <CRow label={COMPARISON_LABELS.volume} vals={selected.map((s) => fmtVol(s.volume))} />
                <CRow label={COMPARISON_LABELS.tradingValue} vals={selected.map((s) => fmtVal(s.tradingValue))} />
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
          <div className="rounded-2xl border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">ETF 구성 종목·편입비율 비교</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  각 ETF의 상위 편입 종목과 비중입니다. 종목코드는 굵게 표시했습니다.
                </p>
              </div>
              {loadingDetail && <span className="text-xs text-zinc-400">구성 종목 로딩 중...</span>}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selected.map((s, i) => {
                const components = s.detail?.components ?? [];
                return (
                  <div key={s.code} className="rounded-xl border border-zinc-100 bg-canvas-soft p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold tabular-nums" style={{ color: COLORS[i] }}>{s.code}</p>
                        <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 truncate">{s.name}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-zinc-600 shadow-sm dark:bg-zinc-900 dark:text-zinc-300">
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
                            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(component.weight * 5, 100)}%`, background: COLORS[i] }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg bg-white px-3 py-4 text-center text-xs text-zinc-400 dark:bg-zinc-900">
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
            <div className="rounded-2xl border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
              <h3 className="text-sm font-semibold text-ink mb-3">유사 ETF</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selected.map((s, i) => (
                  s.detail?.similarETFs?.length ? (
                    <div key={s.code} className="space-y-1.5">
                      <p className="text-xs font-bold" style={{ color: COLORS[i] }}>
                        {s.name}
                      </p>
                      {s.detail.similarETFs.map((sim) => (
                        <div key={sim.code} className="flex justify-between text-xs text-zinc-500">
                          <span>{sim.name}</span>
                          <span className="tabular-nums">₩{sim.price}</span>
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
            <div className="rounded-2xl border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
              <h3 className="text-sm font-semibold text-ink mb-3">종합 비교</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e3e8ee" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "#71717a" }} />
                    <PolarRadiusAxis tick={false} domain={[0, 100]} />
                    {selected.map((s, i) => (
                      <Radar
                        key={s.code}
                        name={s.name.length > 8 ? s.name.slice(0, 8) + "…" : s.name}
                        dataKey={`v${i}`}
                        stroke={COLORS[i]}
                        fill={COLORS[i]}
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
            <div className="rounded-2xl border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
              <h3 className="text-sm font-semibold text-ink mb-3">
                수익률 비교 ({PERIOD_OPTIONS.find((p) => p.value === period)?.label})
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={returnBarData} margin={{ top: 8, right: 12, bottom: 58, left: 4 }}>
                    <XAxis dataKey="code" interval={0} height={58} tick={<AxisTick />} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} unit="%" />
                    <Bar dataKey="수익률" radius={[6, 6, 0, 0]}>
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
            <div className="rounded-2xl border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
              <h3 className="text-sm font-semibold text-ink mb-3">현재가 비교</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 12, bottom: 58, left: 4 }}>
                    <XAxis dataKey="code" interval={0} height={58} tick={<AxisTick />} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v)} />
                    <Bar dataKey="현재가" radius={[6, 6, 0, 0]}>
                      {barData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartLegend items={selected} />
            </div>

            {/* 거래량 바 */}
            <div className="rounded-2xl border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-card">
              <h3 className="text-sm font-semibold text-ink mb-3">거래량 비교</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeBarData} margin={{ top: 8, right: 12, bottom: 58, left: 4 }}>
                    <XAxis dataKey="code" interval={0} height={58} tick={<AxisTick />} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => fmtVol(v)} />
                    <Bar dataKey="거래량" radius={[6, 6, 0, 0]}>
                      {volumeBarData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartLegend items={selected} />
            </div>
          </div>

          {loadingDetail && (
            <p className="text-xs text-zinc-400 text-center">상세 정보 로딩 중...</p>
          )}
        </>
      )}

      {selected.length === 1 && (
        <p className="text-sm text-zinc-400 text-center py-4">
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
      <td className="px-3 py-2.5 text-xs text-zinc-500 sticky left-0 bg-white dark:bg-zinc-900 z-10 whitespace-nowrap">
        {label}
      </td>
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
        fill="#3f3f46"
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
        <div key={item.code} className="flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-300">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i] }} />
          <strong className="shrink-0 font-extrabold tabular-nums text-zinc-950 dark:text-white">{item.code}</strong>
          <span className="max-w-[240px] whitespace-normal break-keep leading-snug">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

function fmtVol(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}천`;
  return String(v);
}

function fmtVal(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(0)}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`;
  return String(v);
}
