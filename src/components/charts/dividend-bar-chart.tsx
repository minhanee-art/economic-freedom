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
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => formatKRW(v)}
            width={50}
          />
          <Tooltip
            formatter={(value) => formatKRW(Number(value))}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e4e4e7",
            }}
          />
          <Bar dataKey="amount" fill="#EAB308" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
