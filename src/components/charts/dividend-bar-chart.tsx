"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatKRW, formatKRWAxis } from "@/lib/utils";
import { dividendSummary } from "./chart-summary";
import { usePrefersReducedMotion } from "./use-reduced-motion";

interface ChartData {
  month: string;
  amount: number;
}

interface DividendBarChartProps {
  data: ChartData[];
}

const TICK = { fontSize: 12, fill: "#5f6f88" };

export function DividendBarChart({ data }: DividendBarChartProps) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <div className="h-50" role="img" aria-label={dividendSummary(data)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} accessibilityLayer={false}>
          <XAxis dataKey="month" tick={TICK} axisLine={{ stroke: "#e3e8ee" }} tickLine={false} />
          <YAxis tick={TICK} tickFormatter={(v) => formatKRWAxis(v)} width={50} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(83, 58, 253, 0.06)" }}
            formatter={(value) => [formatKRW(Number(value)), "배당금"]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 0,
              border: "1px solid #e3e8ee",
              boxShadow: "0 8px 24px rgba(0, 55, 112, 0.08)",
              color: "#0d253d",
            }}
          />
          <Bar dataKey="amount" name="배당금" fill="#533afd" isAnimationActive={!reduceMotion} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
