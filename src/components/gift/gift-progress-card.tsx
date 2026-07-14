"use client";

import { formatKRW } from "@/lib/utils";
import { getAge, isMinor, exemptionLimit, cumulativeGiftsWithin10Years } from "@/lib/gift-tax";

interface Props {
  birthDate: string;
  gifts: { date: string; amount: number }[];
}

export function GiftProgressCard({ birthDate, gifts }: Props) {
  const age = getAge(birthDate);
  const minor = isMinor(birthDate);
  const limit = exemptionLimit(birthDate);
  const used = cumulativeGiftsWithin10Years(gifts);
  const remaining = Math.max(0, limit - used);
  const pct = Math.min(100, (used / limit) * 100);
  const over = used > limit;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          {minor ? "미성년자" : "성년"} · 만 {age}세 · 10년 공제한도 {formatKRW(limit)}
        </span>
        <span className={over ? "text-red-500 font-semibold" : "text-zinc-400"}>
          {over ? "한도 초과" : `잔여 ${formatKRW(remaining)}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-zinc-400">
        최근 10년 누적 증여액 {formatKRW(used)} / {formatKRW(limit)}
      </p>
      {over && (
        <p className="text-xs text-red-500">
          공제한도를 초과했습니다. 초과분에 대해 증여세 신고·납부가 필요할 수 있어요. 아래 &quot;증여세 신고 가이드&quot;를 확인하세요.
        </p>
      )}
    </div>
  );
}
