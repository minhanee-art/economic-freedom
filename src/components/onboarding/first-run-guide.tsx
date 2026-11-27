// 홈 첫 사용 안내 — 연금 계좌 등록 → 종목 추가와 첫 매수 기록 → 은퇴 목표 입력.
// 단계 완료 여부는 서버가 기존 데이터에서 유도해 넘긴다(src/lib/onboarding.ts). 숨기기는 쿠키에만 남긴다.
"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ONBOARDING_HIDDEN_COOKIE, type OnboardingStep } from "@/lib/onboarding-steps";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function FirstRunGuide({ steps }: { steps: OnboardingStep[] }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const doneCount = steps.filter((step) => step.done).length;
  const nextKey = steps.find((step) => !step.done)?.key;

  const hide = () => {
    document.cookie = `${ONBOARDING_HIDDEN_COOKIE}=1; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    setHidden(true);
  };

  return (
    <section
      aria-labelledby="first-run-guide-title"
      className="border border-hairline bg-white p-4 shadow-card dark:border-zinc-800 dark:bg-zinc-900 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="first-run-guide-title" className="text-base font-bold tracking-tight text-ink dark:text-white">
            처음 시작하기
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            세 단계를 마치면 홈과 연금 설계에 내 기록으로 계산한 숫자가 채워집니다.{" "}
            <span className="font-semibold tabular-nums text-ink dark:text-zinc-100">
              {steps.length}단계 중 {doneCount}단계 완료
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          className="min-h-10 shrink-0 px-2 text-xs font-semibold text-zinc-600 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-zinc-400 dark:hover:text-white"
        >
          안내 숨기기
        </button>
      </div>

      <ol className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
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
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-bold", step.done ? "text-zinc-500 dark:text-zinc-400" : "text-ink dark:text-zinc-100")}>
                  {step.title}
                  {step.done && <span className="sr-only"> (완료)</span>}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{step.description}</p>
              </div>
            </div>
            {step.done ? (
              <span className="pl-10 text-xs font-semibold text-zinc-500 sm:pl-0 sm:pr-1 dark:text-zinc-400">완료</span>
            ) : (
              <Link
                href={step.href}
                className={cn(
                  "ml-10 inline-flex h-10 shrink-0 items-center justify-center self-start border px-4 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:ml-0 sm:self-auto",
                  step.key === nextKey
                    ? "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
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
