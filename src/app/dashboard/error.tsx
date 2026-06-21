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
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-3xl">⚠️</p>
      <div>
        <h2 className="text-base font-semibold">데이터를 불러오지 못했습니다</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          일시적인 오류일 수 있어요. 다시 시도해 주세요.
        </p>
      </div>
      <button
        onClick={reset}
        className="h-10 rounded-lg bg-indigo-500 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
      >
        다시 시도
      </button>
    </div>
  );
}
