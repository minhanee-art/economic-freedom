"use client";

import { useId, useLayoutEffect, useMemo, useState } from "react";
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
import { InfoTip } from "@/components/ui/info-tip";

const TONE_CLASS: Record<HeatmapTone, string> = {
  // 한국 관습: 상승 = 빨강 계열, 하락 = 파랑 계열. 칸 안 글자에는 부호(+/-)가 함께 붙는다.
  // 색·글자색은 테마 토큰(globals.css): 다크에서는 강한 칸일수록 밝고, 밝은 강한 칸에는 어두운 글자를 쓴다.
  "gain-strong": "bg-heat-gain-strong text-heat-on-strong",
  gain: "bg-heat-gain text-heat-on",
  flat: "bg-heat-flat text-heat-on",
  loss: "bg-heat-loss text-heat-on",
  "loss-strong": "bg-heat-loss-strong text-heat-on-strong",
};

const LEGEND: { tone: HeatmapTone; label: string }[] = [
  { tone: "loss-strong", label: "-10% 이하" },
  { tone: "loss", label: "-0.5% ~ -10%" },
  { tone: "flat", label: "±0.5%" },
  { tone: "gain", label: "+0.5% ~ +10%" },
  { tone: "gain-strong", label: "+10% 이상" },
];

// 칸 사이 간격(px). 칸 래퍼의 p-px(1px) 두 겹 = 2px 와 같아야 한다. 테두리 대신 칸마다 안쪽으로 이만큼 들여 구분한다
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

/**
 * 요소의 실제 px 크기를 재서 돌려준다. 측정 전에는 measured=false(칸을 그리지 않는다).
 * 요소가 없다가 생기거나(종목 2→3개) 사라졌다 다시 생겨도 붙고 떨어지도록 콜백 ref 로 요소를 state 에 담는다.
 */
function useElementSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState(FALLBACK_SIZE);
  const [measured, setMeasured] = useState(false);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // 레이아웃이 없는 환경(숨김·테스트)이면 기본 크기로 그린다
      if (w > 0 && h > 0) setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      setMeasured(true);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size, measured] as const;
}

export function HoldingsHeatmap({ holdings }: { holdings: HoldingWithPnL[] }) {
  const [areaRef, size, measured] = useElementSize<HTMLDivElement>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 아래 목록은 기본으로 접어 둔다(폰에서는 종목 수만큼 줄이 생겨 너무 길다). 접힌 상태가 기본이라 첫 화면에서 밀림이 없다
  const [listOpen, setListOpen] = useState(false);
  const listId = useId();
  const items = useMemo(() => toHeatmapItems(holdings), [holdings]);
  const { tiles, grouped } = useMemo(() => groupSmallHoldings(items), [items]);
  const rects = useMemo(() => layoutHeatmap(tiles, heatmapAspect(size.w, size.h)), [tiles, size.w, size.h]);
  // 고른 종목이 사라지거나 기타로 묶이면 선택을 지운다(렌더 중 state 보정)
  if (selectedId !== null && (rects.length < HEATMAP_MIN_TILES || !rects.some((r) => r.id === selectedId))) {
    setSelectedId(null);
  }
  if (rects.length < HEATMAP_MIN_TILES) return null;

  const placed = rects.map((r) => {
    // 칸 안(간격을 뺀 색 면)의 실제 px 크기
    const wPx = (r.w / 100) * size.w - TILE_GAP;
    const hPx = (r.h / 100) * size.h - TILE_GAP;
    return { r, level: heatmapLabelLevel(wPx, hPx), wPx, hPx };
  });
  // 아래 목록은 펼치면 측정과 무관하게 모든 종목을 보여준다. 어느 칸에 이름이 들어가는지는 화면 크기를 재야 알 수 있는데,
  // 목록이 그것에 따라 달라지면 측정 전(서버 렌더)과 후에 목록 줄 수가 바뀌어 아래 내용이 밀린다.
  const groupedIds = new Set(grouped.map((g) => g.id));
  const total = items.reduce((s, i) => s + i.value, 0);
  const shareOf = (i: HeatmapItem) => (total > 0 ? (i.value / total) * 100 : 0);
  const selected = rects.find((r) => r.id === selectedId) ?? null;

  return (
    <section
      aria-label="종목 히트맵"
      className="border border-hairline bg-white p-5 shadow-card dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="mb-3 text-base font-bold tracking-tight text-ink">
        종목 히트맵
        <InfoTip label="종목 히트맵 보는 법" align="start">
          칸 면적은 평가금액 비중, 색은 수익률입니다(빨강 상승, 파랑 하락). 칸을 누르면 아래에 이름·비중·수익률이 나옵니다.
        </InfoTip>
      </h2>

      <div
        ref={areaRef}
        className="relative h-48 w-full overflow-hidden bg-white dark:bg-zinc-900 sm:h-56"
        role="list"
      >
        {measured && placed.map(({ r, level }) => {
          const text = pctText(r.returnPct, r.hasCost);
          const isSelected = r.id === selectedId;
          const isOther = !!r.groupedCount;
          return (
            <div
              key={r.id}
              role="listitem"
              className="absolute p-px"
              style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
            >
              <button
                type="button"
                data-heat-tile
                // 글자가 있으면 이름("기타 N종목")이 보합 칸과 구별해 주므로 빗금은 글자 없는 칸에만 둔다(글자가 깔끔하게 읽히도록)
                data-heat-hatch={isOther && level === "none" ? "" : undefined}
                aria-label={tileLabel(r)}
                aria-pressed={isSelected}
                title={isOther ? undefined : tileSummary(r)}
                onClick={() => setSelectedId(isSelected ? null : r.id)}
                className={`flex h-full w-full flex-col justify-center overflow-hidden text-left ${
                  level === "none" ? "p-0" : "p-1"
                } ${TONE_CLASS[heatmapTone(r.returnPct, r.hasCost)]} `}
              >
                {level === "two-line" && (
                  <>
                    <span className="truncate text-xs font-semibold leading-3.75">{r.name}</span>
                    <span className="truncate text-xs tabular-nums leading-3.75">
                      {isOther ? `${r.sharePct.toFixed(1)}%` : text}
                    </span>
                  </>
                )}
                {level === "one-line" && (
                  <span className="truncate text-xs tabular-nums leading-3.75">{isOther ? r.name : text}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-2 min-h-8 text-xs text-zinc-600 dark:text-zinc-300">
        {selected ? tileSummary(selected) : "칸을 누르면 종목 이름·비중·수익률이 여기에 나와요."}
        {selected?.groupedCount ? (
          <span className="block">
            {listOpen
              ? "묶인 종목은 아래 목록에서 '· 기타' 표시로 볼 수 있어요."
              : "묶인 종목은 아래 '종목별 목록 펼치기'를 눌러 볼 수 있어요."}
          </span>
        ) : null}
      </p>

      {items.length > 0 && (
        <button
          type="button"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listId : undefined}
          onClick={() => setListOpen((o) => !o)}
          className="mt-1 flex min-h-11 w-full items-center justify-between gap-2 border border-hairline px-3 text-left text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:border-zinc-800"
        >
          <span>{listOpen ? "종목별 목록 접기" : `종목별 목록 펼치기 · ${items.length}종목`}</span>
          <svg
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400 ${listOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {items.length > 0 && listOpen && (
        <ul id={listId} aria-label="종목별 비중·수익률" className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {items.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className={`inline-block h-2.5 w-2.5 shrink-0 ${TONE_CLASS[heatmapTone(r.returnPct, r.hasCost)]}`}
                />
                <span className="truncate" title={r.name}>{r.name}</span>
                {groupedIds.has(r.id) && <span className="shrink-0 text-zinc-500 dark:text-zinc-400">· 기타</span>}
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
        {grouped.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden data-heat-hatch className={`inline-block h-2.5 w-2.5 ${TONE_CLASS.flat}`} />
            기타(2% 미만 묶음, 색 없음)
          </span>
        )}
      </div>
    </section>
  );
}
