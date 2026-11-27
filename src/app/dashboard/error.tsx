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
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div role="alert" className="w-full max-w-md border border-danger-line bg-surface px-6 py-8 shadow-card">
        <div className="flex items-start gap-3">
          <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          <div>
            <h1 className="text-base font-semibold text-ink">데이터를 불러오지 못했습니다</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">
              서버에서 기록을 읽는 중 오류가 났습니다. 입력한 기록은 지워지지 않았습니다. 잠시 뒤 다시 시도해 주세요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-11 w-full bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
