// alert() 대신 쓰는 인라인 오류 — 무엇이 실패했는지(원인)와 다시 시도할 방법을 그 자리에서 알린다.
import { cn } from "@/lib/utils";

export function InlineError({
  message,
  onRetry,
  retryLabel = "다시 시도",
  onDismiss,
  className,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-1 border border-danger-line bg-danger-soft px-3 py-2 text-sm leading-relaxed text-danger",
        className
      )}
    >
      <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      <p className="min-w-0 flex-1 whitespace-pre-line">{message}</p>
      {(onRetry || onDismiss) && (
        <span className="flex shrink-0 gap-1">
          {onRetry && (
            <button type="button" onClick={onRetry} className="min-h-10 px-2 font-semibold underline underline-offset-2">
              {retryLabel}
            </button>
          )}
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="min-h-10 px-2 font-semibold" aria-label="오류 안내 닫기">
              닫기
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/** 서버 오류 메시지를 사람이 읽을 원인 문장으로 */
export function failureMessage(action: string, err: unknown): string {
  const reason = err instanceof Error && err.message ? err.message : "";
  const generic = /^(failed to fetch|networkerror|load failed)/i.test(reason)
    ? "네트워크에 연결되지 않았습니다"
    : reason;
  return `${action}하지 못했습니다${generic ? `: ${generic}` : ""}. 잠시 뒤 다시 시도해 주세요.`;
}
