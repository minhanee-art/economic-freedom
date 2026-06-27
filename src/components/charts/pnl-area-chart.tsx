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
              <stop offset="5%" stopColor="#b9b9f9" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#b9b9f9" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#533afd" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#533afd" stopOpacity={0} />
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
              borderRadius: 12,
              border: "1px solid #e3e8ee",
              boxShadow:
                "0 8px 24px rgba(0, 55, 112, 0.08), 0 2px 6px rgba(0, 55, 112, 0.04)",
              color: "#0d253d",
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
            stroke="#b9b9f9"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorInvested)"
            name="invested"
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#533afd"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorValue)"
            name="value"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
