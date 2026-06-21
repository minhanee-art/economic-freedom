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
  Tooltip,
  Legend,
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
}

interface CompareItem extends SearchETF {
  shares: number;
  targetPct: number;
  detail?: ETFDetail;
}

interface Props {
  holdings: Holding[];
}

const COLORS = ["#6366F1", "#F97316", "#22C55E", "#EF4444", "#EAB308"];

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
    name: s.name.length > 7 ? s.name.slice(0, 7) + "…" : s.name,
    현재가: s.price,
    color: COLORS[i],
  }));

  const returnBarData = selected.map((s, i) => ({
    name: s.name.length > 7 ? s.name.slice(0, 7) + "…" : s.name,
    수익률: getReturn(s),
    color: COLORS[i],
  }));

  const volumeBarData = selected.map((s, i) => ({
    name: s.name.length > 7 ? s.name.slice(0, 7) + "…" : s.name,
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">ETF 종목 비교</h2>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="text-xs text-indigo-500 font-medium"
        >
          {showSearch ? "검색 닫기" : "종목 검색"}
        </button>
      </div>

      {/* 선택 칩 */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((s, i) => (
            <span
              key={s.code}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-sm"
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
          <span className="text-xs text-zinc-400 self-center">
            {selected.length}/{maxSelect}
          </span>
        </div>
      )}

      {/* 검색 영역 */}
      {showSearch && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
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
              className="w-full h-10 rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => handleTheme(t)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                  activeTheme === t
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
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
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  sortBy === o.value
                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
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
                      "w-full flex items-center rounded-lg px-3 py-2.5 text-left transition-colors",
                      isSel ? "bg-indigo-50 dark:bg-indigo-900/20 opacity-60" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{etf.name}</p>
                        {isMy && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            보유
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {etf.code} · {etf.category} · 거래량 {fmtVol(etf.volume)}
                      </p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="text-sm font-semibold">₩{etf.price.toLocaleString()}</p>
                      <p className={cn("text-xs", etf.changePct > 0 ? "text-red-500" : etf.changePct < 0 ? "text-blue-500" : "text-zinc-400")}>
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
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  period === p.value
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 비교 테이블 */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-3 py-3 text-left text-xs text-zinc-500 font-medium sticky left-0 bg-white dark:bg-zinc-900 z-10">
                    항목
                  </th>
                  {selected.map((s, i) => (
                    <th key={s.code} className="px-3 py-3 text-right text-xs font-bold min-w-[100px]" style={{ color: COLORS[i] }}>
                      {s.name.length > 8 ? s.name.slice(0, 8) + "…" : s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <CRow label="종목코드" vals={selected.map((s) => s.code)} />
                <CRow label="카테고리" vals={selected.map((s) => s.category)} />
                <CRow label="현재가" vals={selected.map((s) => `₩${s.price.toLocaleString()}`)} />
                <CRow
                  label="등락률(당일)"
                  vals={selected.map((s) => `${s.changePct > 0 ? "+" : ""}${s.changePct.toFixed(2)}%`)}
                  colors={selected.map((s) => s.changePct > 0 ? "text-red-500" : s.changePct < 0 ? "text-blue-500" : "")}
                />
                <CRow
                  label={`수익률(${PERIOD_OPTIONS.find((p) => p.value === period)?.label})`}
                  vals={selected.map((s) => {
                    const r = getReturn(s);
                    return `${r > 0 ? "+" : ""}${r.toFixed(2)}%`;
                  })}
                  colors={selected.map((s) => {
                    const r = getReturn(s);
                    return r > 0 ? "text-red-500" : r < 0 ? "text-blue-500" : "";
                  })}
                />
                <CRow label="거래량" vals={selected.map((s) => fmtVol(s.volume))} />
                <CRow label="거래대금" vals={selected.map((s) => fmtVal(s.tradingValue))} />
                <CRow
                  label="총보수(%)"
                  vals={selected.map((s) => s.detail ? `${s.detail.totalFee}%` : "-")}
                  bold
                />
                <CRow
                  label="배당수익률"
                  vals={selected.map((s) => s.detail ? `${s.detail.dividendYield}%` : "-")}
                />
                <CRow
                  label="운용사"
                  vals={selected.map((s) => s.detail?.issuer ?? "-")}
                />
                <CRow
                  label="시가총액"
                  vals={selected.map((s) => s.detail?.marketValue ?? "-")}
                />
                <CRow
                  label="NAV"
                  vals={selected.map((s) => s.detail?.nav ?? "-")}
                />
                <CRow
                  label="보유수량"
                  vals={selected.map((s) => s.shares > 0 ? `${s.shares}주` : "-")}
                />
              </tbody>
            </table>
          </div>

          {/* 유사/구성 종목 */}
          {selected.some((s) => s.detail?.similarETFs?.length) && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold mb-3">유사 ETF</h3>
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
                          <span>₩{sim.price}</span>
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
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold mb-3">종합 비교</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e4e4e7" />
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
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(value) => <span style={{ color: "#374151", fontWeight: 500 }}>{value}</span>}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 수익률 바 */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold mb-3">
                수익률 비교 ({PERIOD_OPTIONS.find((p) => p.value === period)?.label})
              </h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={returnBarData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} unit="%" />
                    <Tooltip
                      formatter={(v) => `${Number(v).toFixed(2)}%`}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
                    />
                    <Bar dataKey="수익률" radius={[6, 6, 0, 0]}>
                      {returnBarData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 현재가 바 */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold mb-3">현재가 비교</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v)} />
                    <Tooltip formatter={(v) => `₩${Number(v).toLocaleString()}`} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }} />
                    <Bar dataKey="현재가" radius={[6, 6, 0, 0]}>
                      {barData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 거래량 바 */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold mb-3">거래량 비교</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeBarData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => fmtVol(v)} />
                    <Tooltip formatter={(v) => `${Number(v).toLocaleString()}주`} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }} />
                    <Bar dataKey="거래량" radius={[6, 6, 0, 0]}>
                      {volumeBarData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
        <td key={i} className={cn("px-3 py-2.5 text-right text-xs", bold ? "font-bold" : "font-medium", colors?.[i])}>
          {v}
        </td>
      ))}
    </tr>
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
