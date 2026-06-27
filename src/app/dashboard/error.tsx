"use client";

import { useEffect } from "react";

// 대시보드 하위 서버 컴포넌트(DB 쿼리 등) 렌더 실패 시 전체 붕괴 대신 재시도 UI 노출
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-hairline bg-white px-8 py-10 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-3xl dark:bg-red-900/20">
          ⚠️
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink dark:text-zinc-100">
            데이터를 불러오지 못했습니다
          </h2>
          <p className="mt-1.5 text-sm text-ink-mute dark:text-zinc-400">
            일시적인 오류일 수 있어요. 다시 시도해 주세요.
          </p>
        </div>
        <button
          onClick={reset}
          className="h-10 rounded-full bg-indigo-600 px-6 text-sm font-semibold text-white shadow-card transition-all hover:bg-indigo-700 hover:shadow-float"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
