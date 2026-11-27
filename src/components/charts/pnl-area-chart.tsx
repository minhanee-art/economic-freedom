"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatKRW, formatKRWAxis } from "@/lib/utils";
import { CHART_MUTED } from "@/lib/colors";
import { pnlTrendSummary } from "./chart-summary";
import { usePrefersReducedMotion } from "./use-reduced-motion";

interface ChartData {
  date: string;
  invested: number;
  value: number;
}

interface PnLAreaChartProps {
  data: ChartData[];
}

const TICK = { fontSize: 12, fill: "#5f6f88" };

export function PnLAreaChart({ data }: PnLAreaChartProps) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <div className="h-55" role="img" aria-label={pnlTrendSummary(data)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} accessibilityLayer={false}>
          <XAxis dataKey="date" tick={TICK} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={TICK} tickFormatter={(v) => formatKRWAxis(v)} width={55} />
          <Tooltip
            formatter={(value, name) => [formatKRW(Number(value)), name]}
            labelFormatter={(label) => `${label}`}
            contentStyle={{
              fontSize: 12,
              borderRadius: 0,
              border: "1px solid #e3e8ee",
              boxShadow: "0 8px 24px rgba(0, 55, 112, 0.08), 0 2px 6px rgba(0, 55, 112, 0.04)",
              color: "#0d253d",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#5f6f88" }} />
          {/* 누적 투입: 회색 점선(채움 없음), 평가금액: 브랜드 실선 + 옅은 단색 면 */}
          <Area
            type="monotone"
            dataKey="invested"
            name="누적 투입"
            stroke={CHART_MUTED}
            strokeWidth={2}
            strokeDasharray="5 3"
            fill="none"
            isAnimationActive={!reduceMotion}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="평가금액"
            stroke="#533afd"
            strokeWidth={2}
            fill="#533afd"
            fillOpacity={0.12}
            isAnimationActive={!reduceMotion}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
