"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface BarData {
  name: string;
  current: number;
  target: number;
}

interface AllocationBarChartProps {
  data: BarData[];
}

export function AllocationBarChart({ data }: AllocationBarChartProps) {
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" barGap={2} barSize={10}>
          <XAxis type="number" domain={[0, "auto"]} unit="%" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={50}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(v) => `${Number(v).toFixed(1)}%`}
            contentStyle={{
              fontSize: 12,
              borderRadius: 12,
              border: "1px solid #e3e8ee",
              boxShadow: "0 8px 24px rgba(0,55,112,0.08)",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => (value === "current" ? "현재" : "목표")}
          />
          <Bar dataKey="target" fill="#dbe1ea" radius={[0, 4, 4, 0]} name="target" />
          <Bar dataKey="current" fill="#533afd" radius={[0, 4, 4, 0]} name="current" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
