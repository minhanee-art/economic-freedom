"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HoldingWithPnL } from "@/types";
import { formatPercent } from "@/lib/utils";
import {
  HEATMAP_MIN_TILES,
  groupSmallHoldings,
  heatmapAspect,
  heatmapLabelLevel,
  heatmapTone,
  layoutHeatmap,
  toHeatmapItems,
  type HeatmapItem,
  type HeatmapTone,
} from "@/lib/dashboard-insights";

const TONE_CLASS: Record<HeatmapTone, string> = {
  // 한국 관습: 상승 = 빨강 계열, 하락 = 파랑 계열. 칸 안 글자에는 부호(+/-)가 함께 붙는다.
  "gain-strong":"bg-heat-gain-strong text-white",
  gain: "bg-heat-gain text-white",
  flat: "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50",
  loss: "bg-heat-loss text-white",
  "loss-strong":"bg-heat-loss-strong text-white",
};

const LEGEND: { tone: HeatmapTone; label: string }[] = [
  { tone: "loss-strong", label: "-10% 이하" },
  { tone: "loss", label: "-0.5% ~ -10%" },
  { tone: "flat", label: "±0.5%" },
  { tone: "gain", label: "+0.5% ~ +10%" },
  { tone: "gain-strong", label: "+10% 이상" },
];

// 칸 사이 간격(px). 테두리 대신 칸마다 안쪽으로 이만큼 들여 구분한다
const TILE_GAP = 2;
// 측정 전(서버 렌더·첫 그리기)에 쓰는 크기: 폰 기준. 높이는 고정이라 측정 후에도 레이아웃이 밀리지 않는다
const FALLBACK_SIZE = { w: 318, h: 192 };

function pctText(returnPct: number, hasCost: boolean) {
  return hasCost ? formatPercent(returnPct) : "원가 없음";
}

function tileSummary(r: { name: string; sharePct: number; returnPct: number; hasCost: boolean; groupedCount?: number }) {
  const share = `비중 ${r.sharePct.toFixed(1)}%`;
  // 기타 칸은 여러 종목이라 수익률이 없다(종목별 수익률은 아래 목록)
  return r.groupedCount ? `${r.name} · ${share}` : `${r.name} · ${share} · 수익률 ${pctText(r.returnPct, r.hasCost)}`;
}

// 읽어주는 이름 — 기존 형식 유지: "이름 비중 60.0%, 수익률 +20.00%"
function tileLabel(r: Parameters<typeof tileSummary>[0]) {
  const share = `비중 ${r.sharePct.toFixed(1)}%`;
  return r.groupedCount ? `${r.name} ${share}` : `${r.name} ${share}, 수익률 ${pctText(r.returnPct, r.hasCost)}`;
}

/** 요소의 실제 px 크기를 재서 돌려준다. 측정 전에는 폰 기준 기본값 */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(FALLBACK_SIZE);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function HoldingsHeatmap({ holdings }: { holdings: HoldingWithPnL[] }) {
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = useMemo(() => toHeatmapItems(holdings), [holdings]);
  const { tiles, grouped } = useMemo(() => groupSmallHoldings(items), [items]);
  const rects = useMemo(() => layoutHeatmap(tiles, heatmapAspect(size.w, size.h)), [tiles, size.w, size.h]);
  if (rects.length < HEATMAP_MIN_TILES) return null;

  const placed = rects.map((r) => {
    // 칸 안(간격을 뺀 색 면)의 실제 px 크기
    const wPx = (r.w / 100) * size.w - TILE_GAP;
    const hPx = (r.h / 100) * size.h - TILE_GAP;
    // 기타 칸은 수익률이 없으므로 두 줄(이름+비중)이 들어갈 때만 글자를 넣는다
    let level = heatmapLabelLevel(wPx, hPx);
    if (r.groupedCount && level === "one-line") level = "none";
    return { r, level, wPx, hPx };
  });
  // 글자가 안 들어간 종목 + "기타"로 묶인 종목은 아래 목록으로 보여준다
  const small: HeatmapItem[] = [
    ...placed.filter((p) => p.level === "none" && !p.r.groupedCount).map((p) => p.r),
    ...grouped,
  ].sort((a, b) => b.value - a.value);
  const total = items.reduce((s, i) => s + i.value, 0);
  const shareOf = (i: HeatmapItem) => (total > 0 ? (i.value / total) * 100 : 0);
  const selected = rects.find((r) => r.id === selectedId) ?? null;

  return (
    <section
      aria-label="종목 히트맵"
      className="border border-hairline bg-white p-5 shadow-card dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-sm font-semibold text-ink">종목 히트맵</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">면적 = 평가금액 비중 · 색 = 수익률(빨강 상승, 파랑 하락)</p>
      </div>

      <div
        ref={areaRef}
        className="relative h-48 w-full overflow-hidden bg-white dark:bg-zinc-900 sm:h-56"
        role="list"
      >
        {placed.map(({ r, level }) => {
          const text = pctText(r.returnPct, r.hasCost);
          const isSelected = r.id === selectedId;
          return (
            <div
              key={r.id}
              role="listitem"
              className="absolute"
              style={{
                left: `${r.x}%`,
                top: `${r.y}%`,
                width: `${r.w}%`,
                height: `${r.h}%`,
                padding: TILE_GAP / 2,
              }}
            >
              <button
                type="button"
                aria-label={tileLabel(r)}
                aria-pressed={isSelected}
                onClick={() => setSelectedId(isSelected ? null : r.id)}
                className={`flex h-full w-full flex-col justify-center overflow-hidden text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 ${
                  level === "none" ? "p-0" : "p-1"
                } ${isSelected ? "ring-2 ring-inset ring-zinc-900 dark:ring-white" : ""} ${TONE_CLASS[heatmapTone(r.returnPct, r.hasCost)]}`}
              >
                {level !== "none" && (
                  <>
                    {level === "two-line" && (
                      <span className="truncate text-xs font-semibold leading-[15px]">{r.name}</span>
                    )}
                    <span className="truncate text-xs tabular-nums leading-[15px]">
                      {r.groupedCount ? `${r.sharePct.toFixed(1)}%` : text}
                    </span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-2 min-h-8 text-xs text-zinc-600 dark:text-zinc-300">
        {selected ? tileSummary(selected) : "칸을 누르면 종목 이름·비중·수익률이 여기에 나와요."}
      </p>

      {small.length > 0 && (
        <ul aria-label="비중이 작은 종목" className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {small.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className={`inline-block h-2.5 w-2.5 shrink-0 ${TONE_CLASS[heatmapTone(r.returnPct, r.hasCost)]}`}
                />
                <span className="truncate" title={r.name}>{r.name}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {shareOf(r).toFixed(1)}% · {pctText(r.returnPct, r.hasCost)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {LEGEND.map((l) => (
          <span key={l.tone} className="flex items-center gap-1.5">
            <span aria-hidden className={`inline-block h-2.5 w-2.5 ${TONE_CLASS[l.tone]}`} />
            {l.label}
          </span>
        ))}
      </div>
    </section>
  );
}
