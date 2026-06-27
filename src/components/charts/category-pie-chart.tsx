"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { getCategoryColor } from "@/lib/colors";
import { formatKRW } from "@/lib/utils";

interface PieData {
  name: string;
  value: number;
  pct: number;
}

interface CategoryPieChartProps {
  data: PieData[];
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex items-center gap-4">
      <div className="w-[160px] h-[160px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={72}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={getCategoryColor(entry.name)}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatKRW(Number(value))}
              contentStyle={{
                fontSize: 12,
                borderRadius: 12,
                border: "1px solid #e3e8ee",
                boxShadow: "0 8px 24px rgba(0,55,112,0.08)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: getCategoryColor(d.name) }}
            />
            <span className="text-zinc-600 dark:text-zinc-400 w-10">{d.name}</span>
            <span className="font-medium">{d.pct.toFixed(1)}%</span>
            <span className="text-zinc-400 text-xs">{formatKRW(d.value)}</span>
          </div>
        ))}
        {total > 0 && (
          <div className="pt-1 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
            합계 {formatKRW(total)}
          </div>
        )}
      </div>
    </div>
  );
}
