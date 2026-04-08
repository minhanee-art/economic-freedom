"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatKRW } from "@/lib/utils";

interface ChartData {
  date: string;
  invested: number;
  value: number;
}

interface PnLAreaChartProps {
  data: ChartData[];
}

export function PnLAreaChart({ data }: PnLAreaChartProps) {
  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => v.slice(5)} // MM-DD
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => formatKRW(v)}
            width={55}
          />
          <Tooltip
            formatter={(value) => formatKRW(Number(value))}
            labelFormatter={(label) => `${label}`}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e4e4e7",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) =>
              value === "invested" ? "누적 투입" : "평가금액"
            }
          />
          <Area
            type="monotone"
            dataKey="invested"
            stroke="#94A3B8"
            fillOpacity={1}
            fill="url(#colorInvested)"
            name="invested"
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#6366F1"
            fillOpacity={1}
            fill="url(#colorValue)"
            name="value"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
