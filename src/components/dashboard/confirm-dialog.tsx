"use client";

// 브라우저 기본 confirm() 대신 쓰는 확인 대화상자.
// - 삭제 대상과 결과를 제목·본문에 적는다(문구의 뜻은 호출하는 쪽이 정한다)
// - 열리면 취소 버튼에 초점, Tab 은 대화상자 안에서만 돈다, Esc·취소·바깥 클릭으로 닫힌다
// - 닫히면 열기 전 초점 위치로 돌아간다
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type React from "react";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: 되돌릴 수 없는 삭제 */
  tone?: "danger" | "default";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

export function useConfirmDialog() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    []
  );

  const close = useCallback(
    (ok: boolean) => {
      setPending((current) => {
        current?.resolve(ok);
        return null;
      });
    },
    []
  );

  const dialog = pending ? <ConfirmDialog {...pending} onClose={close} /> : null;
  return { confirm, dialog };
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 모달 틀: 초점 가두기·Esc·바깥 클릭 닫기·닫힌 뒤 초점 복귀를 맡는다 */
export function DialogFrame({
  labelledBy,
  describedBy,
  role = "dialog",
  onDismiss,
  initialFocusRef,
  className,
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  role?: "dialog" | "alertdialog";
  onDismiss: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const target = initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-70 flex items-end justify-center bg-zinc-950/50 sm:items-center sm:px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onKeyDown={onKeyDown}
        className={cn("w-full max-w-md border bg-surface p-6 shadow-float", className)}
      >
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel = "삭제",
  cancelLabel = "취소",
  tone = "danger",
  onClose,
}: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogFrame
      labelledBy={titleId}
      describedBy={body ? bodyId : undefined}
      role={tone === "danger" ? "alertdialog" : "dialog"}
      onDismiss={() => onClose(false)}
      initialFocusRef={cancelRef}
      className={tone === "danger" ? "border-danger-line" : "border-hairline dark:border-zinc-800"}
    >
        <h2 id={titleId} className={cn("flex items-start gap-2 text-base font-bold", tone === "danger" ? "text-danger" : "text-ink")}>
          {tone === "danger" && (
            <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          )}
          {title}
        </h2>
        {body && (
          <div id={bodyId} className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
            {body}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(false)}
            className="h-11 border border-hairline bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-canvas-soft dark:border-zinc-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            className={cn(
              "h-11 px-5 text-sm font-semibold text-white transition-colors",
              tone === "danger" ? "bg-danger-fill hover:bg-danger-fill/90" : "bg-brand hover:bg-brand-deep"
            )}
          >
            {confirmLabel}
          </button>
        </div>
    </DialogFrame>
  );
}
