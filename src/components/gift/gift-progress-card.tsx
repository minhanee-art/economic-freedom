"use client";

import { formatKRW } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";
import type { CSSProperties } from "react";
import { getAge, isMinor, exemptionLimit, cumulativeGiftsWithin10Years } from "@/lib/gift-tax";

interface Props {
  /** 다른 카드 안에 놓을 때 — 테두리·안쪽 여백 없이(카드 안에 카드를 겹치지 않는다) */
  embedded?: boolean;
  birthDate: string;
  gifts: { date: string; amount: number; gift_type?: string }[];
}

export function GiftProgressCard({ birthDate, gifts, embedded = false }: Props) {
  const age = getAge(birthDate);
  const minor = isMinor(birthDate);
  const limit = exemptionLimit(birthDate);
  const used = cumulativeGiftsWithin10Years(gifts);
  const remaining = Math.max(0, limit - used);
  const pct = Math.min(100, (used / limit) * 100);
  const over = used > limit;

  return (
    <div className={embedded ? "space-y-2" : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2"}>
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {minor ? "미성년자" : "성년"} · 만 {age}세
        </span>
        <span className={over ? "text-caution font-semibold" : "text-zinc-500 dark:text-zinc-400"}>
          {over ? "한도 초과" : `잔여 ${formatKRW(remaining)}`}
        </span>
      </div>
      <div className="h-2 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`bar-w h-full transition-colors ${over ? "bg-caution" : "bg-indigo-500 dark:bg-indigo-400"}`}
          style={{ "--bar-w": `${pct}%` } as CSSProperties}
        />
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        최근 10년 누적 증여액 {formatKRW(used)} / 공제한도 {formatKRW(limit)}
        <InfoTip label="공제한도 계산 설명" align="start">
          직계존속 → 직계비속 10년 합산 한도입니다. 정부지원금·비증여 입금은 계산에서 제외합니다. 참고용 추정치입니다.
        </InfoTip>
      </p>
      {over && (
        <p role="note" className="text-xs leading-relaxed text-caution">
          <span aria-hidden="true">⚠️ </span>공제한도를 초과했습니다. 초과분은 증여세 신고·납부가 필요할 수 있으니 &quot;증여세 신고 가이드&quot;를 확인하세요.
        </p>
      )}
    </div>
  );
}
