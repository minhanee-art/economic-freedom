"use client";

import { useState, useMemo, useCallback } from "react";
import type { Holding } from "@/types";
import { formatFullKRW, cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/colors";
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

interface CompareItem {
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  tradingValue: number;
  category: string;
  // 내 보유 정보 (있으면)
  shares: number;
  targetPct: number;
  expenseRatio: number;
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

export function CompareClient({ holdings }: Props) {
  const [selected, setSelected] = useState<CompareItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchETF[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTheme, setActiveTheme] = useState("전체");
  const [sortBy, setSortBy] = useState("volume");
  const [showSearch, setShowSearch] = useState(true);
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
  useState(() => {
    search("", "전체", "volume");
  });

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

    const holding = holdingMap.get(etf.code);
    setSelected([
      ...selected,
      {
        ...etf,
        shares: holding?.shares ?? 0,
        targetPct: holding?.target_pct ?? 0,
        expenseRatio: holding?.expense_ratio ?? 0,
      },
    ]);
  };

  const removeFromCompare = (code: string) => {
    setSelected(selected.filter((s) => s.code !== code));
  };

  // 차트 데이터
  const barData = selected.map((s, i) => ({
    name: s.name.length > 6 ? s.name.slice(0, 6) + "…" : s.name,
    현재가: s.price,
    color: COLORS[i],
  }));

  const volumeBarData = selected.map((s, i) => ({
    name: s.name.length > 6 ? s.name.slice(0, 6) + "…" : s.name,
    거래량: s.volume,
    color: COLORS[i],
  }));

  // 레이더 차트
  const maxPrice = Math.max(...selected.map((s) => s.price), 1);
  const maxVol = Math.max(...selected.map((s) => s.volume), 1);
  const maxVal = Math.max(...selected.map((s) => s.tradingValue), 1);
  const maxChange = Math.max(...selected.map((s) => Math.abs(s.changePct)), 1);

  const radarData = [
    {
      metric: "현재가",
      ...Object.fromEntries(selected.map((s, i) => [`v${i}`, (s.price / maxPrice) * 100])),
    },
    {
      metric: "거래량",
      ...Object.fromEntries(selected.map((s, i) => [`v${i}`, (s.volume / maxVol) * 100])),
    },
    {
      metric: "거래대금",
      ...Object.fromEntries(selected.map((s, i) => [`v${i}`, (s.tradingValue / maxVal) * 100])),
    },
    {
      metric: "등락률",
      ...Object.fromEntries(selected.map((s, i) => [`v${i}`, (Math.abs(s.changePct) / maxChange) * 100])),
    },
    {
      metric: "보유수량",
      ...Object.fromEntries(selected.map((s, i) => [`v${i}`, s.shares > 0 ? 80 : 10])),
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

      {/* 선택된 종목 칩 */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((s, i) => (
            <span
              key={s.code}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-white"
              style={{ background: COLORS[i] }}
            >
              {s.name.length > 8 ? s.name.slice(0, 8) + "…" : s.name}
              <button
                onClick={() => removeFromCompare(s.code)}
                className="ml-0.5 hover:opacity-70"
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
          {/* 검색 입력 */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="ETF 이름 또는 종목코드 검색 (예: KODEX, 069500)"
              className="w-full h-10 rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          {/* 테마 필터 */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {THEMES.map((theme) => (
              <button
                key={theme}
                onClick={() => handleTheme(theme)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                  activeTheme === theme
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                )}
              >
                {theme}
              </button>
            ))}
          </div>

          {/* 정렬 */}
          <div className="flex gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSort(opt.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  sortBy === opt.value
                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 검색 결과 */}
          {isSearching ? (
            <div className="py-4 text-center text-sm text-zinc-400">
              검색 중...
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {searchResults.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-400">
                  결과 없음
                </p>
              ) : (
                searchResults.map((etf) => {
                  const isSelected = selected.some(
                    (s) => s.code === etf.code
                  );
                  const isMyHolding = holdingMap.has(etf.code);
                  return (
                    <button
                      key={etf.code}
                      onClick={() => !isSelected && addToCompare(etf)}
                      disabled={isSelected || selected.length >= maxSelect}
                      className={cn(
                        "w-full flex items-center rounded-lg px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-900/20 opacity-60"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">
                            {etf.name}
                          </p>
                          {isMyHolding && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                              보유
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">
                          {etf.code} · {etf.category} ·{" "}
                          거래량 {formatVolume(etf.volume)}
                        </p>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <p className="text-sm font-semibold">
                          ₩{etf.price.toLocaleString()}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            etf.changePct > 0
                              ? "text-red-500"
                              : etf.changePct < 0
                                ? "text-blue-500"
                                : "text-zinc-400"
                          )}
                        >
                          {etf.changePct > 0 ? "+" : ""}
                          {etf.changePct.toFixed(2)}%
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* 비교 차트 & 테이블 */}
      {selected.length >= 2 && (
        <>
          {/* 비교 테이블 */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-3 py-3 text-left text-xs text-zinc-500 font-medium sticky left-0 bg-white dark:bg-zinc-900">
                    항목
                  </th>
                  {selected.map((s, i) => (
                    <th
                      key={s.code}
                      className="px-3 py-3 text-right text-xs font-medium min-w-[90px]"
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1"
                        style={{ background: COLORS[i] }}
                      />
                      {s.name.length > 6 ? s.name.slice(0, 6) + "…" : s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <CompareRow
                  label="종목코드"
                  values={selected.map((s) => s.code)}
                />
                <CompareRow
                  label="카테고리"
                  values={selected.map((s) => s.category)}
                />
                <CompareRow
                  label="현재가"
                  values={selected.map(
                    (s) => `₩${s.price.toLocaleString()}`
                  )}
                />
                <CompareRow
                  label="등락률"
                  values={selected.map(
                    (s) =>
                      `${s.changePct > 0 ? "+" : ""}${s.changePct.toFixed(2)}%`
                  )}
                  highlights={selected.map((s) =>
                    s.changePct > 0
                      ? "text-red-500"
                      : s.changePct < 0
                        ? "text-blue-500"
                        : ""
                  )}
                />
                <CompareRow
                  label="거래량"
                  values={selected.map((s) => formatVolume(s.volume))}
                />
                <CompareRow
                  label="거래대금"
                  values={selected.map((s) => formatValue(s.tradingValue))}
                />
                <CompareRow
                  label="보유수량"
                  values={selected.map((s) =>
                    s.shares > 0 ? `${s.shares}주` : "-"
                  )}
                />
                <CompareRow
                  label="목표비중"
                  values={selected.map((s) =>
                    s.targetPct > 0 ? `${s.targetPct}%` : "-"
                  )}
                />
              </tbody>
            </table>
          </div>

          {/* 레이더 차트 */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h3 className="text-sm font-semibold mb-3">종합 비교</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e4e4e7" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis tick={false} domain={[0, 100]} />
                  {selected.map((s, i) => (
                    <Radar
                      key={s.code}
                      name={
                        s.name.length > 8
                          ? s.name.slice(0, 8) + "…"
                          : s.name
                      }
                      dataKey={`v${i}`}
                      stroke={COLORS[i]}
                      fill={COLORS[i]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 현재가 바 차트 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold mb-3">현재가 비교</h3>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) =>
                        v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v)
                      }
                    />
                    <Tooltip
                      formatter={(v) => `₩${Number(v).toLocaleString()}`}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e4e4e7",
                      }}
                    />
                    <Bar dataKey="현재가" radius={[6, 6, 0, 0]}>
                      {barData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold mb-3">거래량 비교</h3>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeBarData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => formatVolume(v)}
                    />
                    <Tooltip
                      formatter={(v) => `${Number(v).toLocaleString()}주`}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e4e4e7",
                      }}
                    />
                    <Bar dataKey="거래량" radius={[6, 6, 0, 0]}>
                      {volumeBarData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {selected.length === 1 && (
        <p className="text-sm text-zinc-400 text-center py-4">
          1개 더 선택하면 비교가 시작됩니다.
        </p>
      )}

      {selected.length === 0 && !showSearch && (
        <p className="text-sm text-zinc-400 text-center py-8">
          &quot;종목 검색&quot;을 눌러 비교할 종목을 추가하세요.
        </p>
      )}
    </div>
  );
}

function CompareRow({
  label,
  values,
  highlights,
}: {
  label: string;
  values: string[];
  highlights?: string[];
}) {
  return (
    <tr>
      <td className="px-3 py-2.5 text-xs text-zinc-500 sticky left-0 bg-white dark:bg-zinc-900">
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={cn(
            "px-3 py-2.5 text-right text-xs font-medium",
            highlights?.[i]
          )}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}

function formatVolume(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}천`;
  return String(v);
}

function formatValue(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(0)}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`;
  return String(v);
}
