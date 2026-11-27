"use client";

import { useMemo } from "react";
import type { HoldingWithPnL } from "@/types";
import { formatPercent } from "@/lib/utils";
import {
  heatmapTone,
  layoutHeatmap,
  toHeatmapItems,
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

// 이 비중 미만이면 타일 안에는 글자를 넣지 않고 아래 목록으로 보여준다
const LABEL_MIN_SHARE = 6;

function pctText(returnPct: number, hasCost: boolean) {
  return hasCost ? formatPercent(returnPct) : "원가 없음";
}

export function HoldingsHeatmap({ holdings }: { holdings: HoldingWithPnL[] }) {
  const rects = useMemo(() => layoutHeatmap(toHeatmapItems(holdings)), [holdings]);
  if (rects.length === 0) return null;

  const small = rects.filter((r) => r.sharePct < LABEL_MIN_SHARE);

  return (
    <section
      aria-label="종목 히트맵"
      className="border border-hairline bg-white p-5 shadow-card dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-sm font-semibold text-ink">종목 히트맵</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">면적 = 평가금액 비중 · 색 = 수익률(빨강 상승, 파랑 하락)</p>
      </div>

      <div className="relative h-80 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 sm:h-96" role="list">
        {rects.map((r) => {
          const showLabel = r.sharePct >= LABEL_MIN_SHARE;
          const text = pctText(r.returnPct, r.hasCost);
          return (
            <div
              key={r.id}
              role="listitem"
              aria-label={`${r.name} 비중 ${r.sharePct.toFixed(1)}%, 수익률 ${text}`}
              title={`${r.name} · 비중 ${r.sharePct.toFixed(1)}% · ${text}`}
              className={`absolute flex flex-col justify-center overflow-hidden border border-white p-1.5 dark:border-zinc-900 ${TONE_CLASS[heatmapTone(r.returnPct, r.hasCost)]}`}
              style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
            >
              {showLabel && (
                <>
                  <span className="truncate text-xs font-semibold leading-tight sm:text-sm">{r.name}</span>
                  <span className="truncate text-xs tabular-nums leading-tight">{text}</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {small.length > 0 && (
        <ul aria-label="비중이 작은 종목" className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {small.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className={`inline-block h-2.5 w-2.5 shrink-0 ${TONE_CLASS[heatmapTone(r.returnPct, r.hasCost)]}`}
                />
                <span className="truncate">{r.name}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {r.sharePct.toFixed(1)}% · {pctText(r.returnPct, r.hasCost)}
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
