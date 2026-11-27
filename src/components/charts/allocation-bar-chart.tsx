"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CHART_MUTED } from "@/lib/colors";
import { allocationSummary } from "./chart-summary";
import { usePrefersReducedMotion } from "./use-reduced-motion";

interface BarData {
  name: string;
  current: number;
  target: number;
}

interface AllocationBarChartProps {
  data: BarData[];
}

const TICK = { fontSize: 12, fill: "#5f6f88" };

export function AllocationBarChart({ data }: AllocationBarChartProps) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <div className="h-50" role="img" aria-label={allocationSummary(data)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" barGap={2} barSize={10} accessibilityLayer={false}>
          <XAxis type="number" domain={[0, "auto"]} unit="%" tick={TICK} />
          <YAxis type="category" dataKey="name" width={50} tick={TICK} />
          <Tooltip
            formatter={(v, name) => [`${Number(v).toFixed(1)}%`, name]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 0,
              border: "1px solid #e3e8ee",
              boxShadow: "0 8px 24px rgba(0,55,112,0.08)",
              color: "#0d253d",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span className="text-ink-mute">{value}</span>} />
          {/* 목표: 회색 테두리 막대(3:1 이상), 현재: 브랜드 채움 — 색과 모양 둘 다로 구분 */}
          <Bar dataKey="target" name="목표" fill="var(--hairline)" stroke={CHART_MUTED} strokeWidth={1.5} strokeDasharray="3 2" isAnimationActive={!reduceMotion} />
          <Bar dataKey="current" name="현재" fill="#533afd" isAnimationActive={!reduceMotion} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
