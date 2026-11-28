// 홈 첫 사용 안내 — 연금 계좌 등록 → 종목 추가와 첫 매수 기록 → 은퇴 목표 입력.
// 단계 완료 여부는 서버가 기존 데이터에서 유도해 넘긴다(src/lib/onboarding.ts). 숨기기는 쿠키에만 남긴다.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { EmojiLine, InfoTip } from "@/components/ui/info-tip";
import {
  ONBOARDING_DONE_SEEN_COOKIE,
  ONBOARDING_HIDDEN_COOKIE,
  ONBOARDING_STARTED_COOKIE,
  type OnboardingStep,
} from "@/lib/onboarding-steps";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

// 단계 설명을 한눈에 보이는 이모지 한 줄로 줄인다. 원래 설명(step.description)은 제목 옆 말풍선에 그대로 둔다.
const STEP_LINE: Record<OnboardingStep["key"], { emoji: string; text: string }> = {
  "pension-account": { emoji: "🏦", text: "연금저축·IRP·DC 계좌 지정" },
  "first-purchase": { emoji: "💰", text: "가진 종목과 산 수량·단가 기록" },
  "retirement-goal": { emoji: "🌴", text: "목표 월 생활비와 은퇴 나이" },
};

function setCookie(name: string) {
  document.cookie = `${name}=1; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export function FirstRunGuide({ steps }: { steps: OnboardingStep[] }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    // 진행 중인 안내를 봤다는 표시 — 세 단계를 마친 뒤 홈에 완료 한 줄을 한 번 보여 줄 때 쓴다
    setCookie(ONBOARDING_STARTED_COOKIE);
  }, []);
  if (hidden) return null;

  const doneCount = steps.filter((step) => step.done).length;
  const nextKey = steps.find((step) => !step.done)?.key;

  const hide = () => {
    setCookie(ONBOARDING_HIDDEN_COOKIE);
    setHidden(true);
  };

  return (
    <section
      aria-labelledby="first-run-guide-title"
      className="border border-hairline bg-surface p-5 shadow-card dark:border-zinc-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="first-run-guide-title" className="text-base font-bold tracking-tight text-ink">
            처음 시작하기
          </h2>
          <p className="mt-1 text-sm text-ink-mute">
            <span className="font-semibold tabular-nums text-ink">
              {steps.length}단계 중 {doneCount}단계 완료
            </span>
            <InfoTip label="처음 시작하기 설명" align="start">
              세 단계를 마치면 홈과 연금 설계에 내 기록으로 계산한 숫자가 채워집니다.
            </InfoTip>
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          className="min-h-11 shrink-0 px-2 text-xs font-semibold text-zinc-600 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-zinc-400 dark:hover:text-white"
        >
          안내 숨기기
        </button>
      </div>

      <ol className="mt-4 divide-y divide-hairline border-t border-hairline dark:divide-zinc-800 dark:border-zinc-800">
        {steps.map((step, index) => (
          <li key={step.key} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center border text-xs font-bold tabular-nums",
                  step.done
                    ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                )}
              >
                {step.done ? (
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-bold", step.done ? "text-zinc-500 dark:text-zinc-400" : "text-ink")}>
                  {step.title}
                  {step.done && <span className="sr-only"> (완료)</span>}
                  <InfoTip label={`${step.title} 설명`} align="start">{step.description}</InfoTip>
                </p>
                <EmojiLine as="p" emoji={STEP_LINE[step.key].emoji} size="xs" tone="mute" className="mt-1">
                  {STEP_LINE[step.key].text}
                </EmojiLine>
              </div>
            </div>
            {step.done ? (
              <span className="pl-10 text-xs font-semibold text-zinc-500 sm:pl-0 sm:pr-1 dark:text-zinc-400">완료</span>
            ) : (
              <Link
                href={step.href}
                className={cn(
                  "ml-10 inline-flex h-11 shrink-0 items-center justify-center self-start border px-4 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:ml-0 sm:self-auto",
                  step.key === nextKey
                    ? "border-brand bg-brand text-white hover:bg-brand-deep"
                    : "border-hairline bg-surface text-zinc-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
                )}
              >
                {step.actionLabel}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 세 단계를 마친 뒤 홈에 한 번만 보이는 완료 한 줄. 보여 준 즉시 다시 나오지 않게 표시한다. */
export function FirstRunComplete() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setCookie(ONBOARDING_DONE_SEEN_COOKIE);
  }, []);
  if (hidden) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border border-hairline bg-surface px-4 py-2 text-sm text-ink shadow-card dark:border-zinc-800"
    >
      <p>
        <span className="font-semibold text-success">첫 사용 세 단계를 마쳤습니다.</span>{" "}
        <span className="text-ink-mute">위 숫자는 지금까지 적은 기록으로 계산했습니다.</span>
      </p>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="min-h-11 px-2 text-xs font-semibold text-zinc-600 underline-offset-4 hover:text-ink hover:underline dark:text-zinc-400 dark:hover:text-white"
      >
        닫기
      </button>
    </div>
  );
}
