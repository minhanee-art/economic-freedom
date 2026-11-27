// 작업 결과 한 줄: 성공은 success 글자(role=status), 실패는 danger 테두리 + 경고 아이콘 + 문구(role=alert).
// 손익 빨강 숫자 옆에 놓여도 위험 표시가 색 하나로만 전달되지 않게 한다(DESIGN.md '상태 — 손익과 섞지 않는다').
import { cn } from "@/lib/utils";

export function StatusLine({ ok, message, className }: { ok: boolean; message: string; className?: string }) {
  if (ok) {
    return (
      <p role="status" className={cn("text-xs font-semibold text-success", className)}>
        {message}
      </p>
    );
  }
  return (
    <p
      role="alert"
      className={cn("flex items-start gap-1.5 border border-danger-line bg-danger-soft px-2.5 py-1.5 text-xs font-semibold text-danger", className)}
    >
      <svg aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      <span>{message}</span>
    </p>
  );
}
