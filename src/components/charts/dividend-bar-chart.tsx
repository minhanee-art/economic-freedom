"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatKRW } from "@/lib/utils";

interface ChartData {
  month: string;
  amount: number;
}

interface DividendBarChartProps {
  data: ChartData[];
}

export function DividendBarChart({ data }: DividendBarChartProps) {
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#64748d" }}
            axisLine={{ stroke: "#e3e8ee" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748d" }}
            tickFormatter={(v) => formatKRW(v)}
            width={50}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(83, 58, 253, 0.06)" }}
            formatter={(value) => formatKRW(Number(value))}
            contentStyle={{
              fontSize: 12,
              borderRadius: 12,
              border: "1px solid #e3e8ee",
              boxShadow: "0 8px 24px rgba(0, 55, 112, 0.08)",
            }}
          />
          <Bar dataKey="amount" fill="#533afd" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
