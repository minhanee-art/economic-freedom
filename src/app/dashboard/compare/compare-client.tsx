"use client";

import { useState, useMemo } from "react";
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

interface Props {
  holdings: Holding[];
}

const COLORS = ["#6366F1", "#F97316", "#22C55E", "#EF4444", "#EAB308"];

export function CompareClient({ holdings }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const maxSelect = 5;

  const selected = useMemo(
    () => holdings.filter((h) => selectedIds.includes(h.id)),
    [holdings, selectedIds]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < maxSelect
          ? [...prev, id]
          : prev
    );
  };

  // 비교 차트 데이터
  const barData = selected.map((h, i) => ({
    name: h.name.length > 6 ? h.name.slice(0, 6) + "…" : h.name,
    현재가: h.current_price,
    목표비중: h.target_pct,
    보유수량: h.shares,
    color: COLORS[i],
  }));

  // 레이더 차트 데이터 (정규화)
  const maxPrice = Math.max(...selected.map((h) => h.current_price), 1);
  const maxShares = Math.max(...selected.map((h) => h.shares), 1);
  const maxTarget = Math.max(...selected.map((h) => h.target_pct), 1);

  const radarData = [
    { metric: "현재가", ...Object.fromEntries(selected.map((h, i) => [`v${i}`, (h.current_price / maxPrice) * 100])) },
    { metric: "목표비중", ...Object.fromEntries(selected.map((h, i) => [`v${i}`, (h.target_pct / maxTarget) * 100])) },
    { metric: "보유수량", ...Object.fromEntries(selected.map((h, i) => [`v${i}`, (h.shares / maxShares) * 100])) },
    { metric: "평가금액", ...Object.fromEntries(selected.map((h, i) => [`v${i}`, ((h.current_price * h.shares) / (maxPrice * maxShares)) * 100])) },
    { metric: "운용보수", ...Object.fromEntries(selected.map((h, i) => [`v${i}`, h.expense_ratio * 100])) },
  ];

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold">ETF 종목 비교</h2>

      {/* 종목 선택 */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <p className="text-sm text-zinc-500 mb-3">
          비교할 종목을 선택하세요 (최대 {maxSelect}개)
        </p>
        <div className="flex flex-wrap gap-2">
          {holdings.map((h) => {
            const isSelected = selectedIds.includes(h.id);
            const colorIdx = selectedIds.indexOf(h.id);
            return (
              <button
                key={h.id}
                onClick={() => toggleSelect(h.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  isSelected
                    ? "text-white border-transparent"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                )}
                style={
                  isSelected
                    ? { background: COLORS[colorIdx] }
                    : undefined
                }
              >
                {h.name}
              </button>
            );
          })}
        </div>
      </div>

      {selected.length >= 2 && (
        <>
          {/* 비교 테이블 */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">
                    항목
                  </th>
                  {selected.map((h, i) => (
                    <th key={h.id} className="px-3 py-3 text-right text-xs font-medium">
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1"
                        style={{ background: COLORS[i] }}
                      />
                      {h.name.length > 6 ? h.name.slice(0, 6) + "…" : h.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <CompareRow label="종목코드" values={selected.map((h) => h.code)} />
                <CompareRow label="카테고리" values={selected.map((h) => `${h.category}/${h.sub_category}`)} />
                <CompareRow label="현재가" values={selected.map((h) => `₩${h.current_price.toLocaleString()}`)} />
                <CompareRow label="보유수량" values={selected.map((h) => `${h.shares}주`)} />
                <CompareRow label="평가금액" values={selected.map((h) => formatFullKRW(h.current_price * h.shares))} />
                <CompareRow label="목표비중" values={selected.map((h) => `${h.target_pct}%`)} />
                <CompareRow label="운용보수" values={selected.map((h) => `${h.expense_ratio}%`)} />
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
                  {selected.map((h, i) => (
                    <Radar
                      key={h.id}
                      name={h.name}
                      dataKey={`v${i}`}
                      stroke={COLORS[i]}
                      fill={COLORS[i]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(_, entry) => {
                      const idx = selected.findIndex(
                        (h) => h.name === entry.value
                      );
                      const name = entry.value as string;
                      return name.length > 8 ? name.slice(0, 8) + "…" : name;
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 현재가 바 차트 */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h3 className="text-sm font-semibold mb-3">현재가 비교</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) =>
                      v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v
                    }
                  />
                  <Tooltip
                    formatter={(v) => `₩${Number(v).toLocaleString()}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
                  />
                  <Bar dataKey="현재가" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {selected.length < 2 && selected.length > 0 && (
        <p className="text-sm text-zinc-400 text-center py-4">
          비교하려면 2개 이상 선택해주세요.
        </p>
      )}

      {selected.length === 0 && (
        <p className="text-sm text-zinc-400 text-center py-8">
          위에서 비교할 종목을 선택해주세요.
        </p>
      )}
    </div>
  );
}

function CompareRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-xs text-zinc-500">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-2.5 text-right text-xs font-medium">
          {v}
        </td>
      ))}
    </tr>
  );
}
