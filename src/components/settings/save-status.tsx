"use client";

// 설정 칸마다 따로 저장할 때 쓰는 저장 버튼 + 결과 한 줄.
// 버튼은 요청 중에만 비활성이고 스피너와 "저장 중…"을 보인다. 결과는 항상 있는 aria-live 자리에 적어 화면 낭독기가 읽는다.

export type SaveState = { kind: "idle" | "saving" } | { kind: "done"; message: string } | { kind: "error"; message: string };

export function Spinner() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SaveButton({ state, label, testId }: { state: SaveState; label: string; testId?: string }) {
  const saving = state.kind === "saving";
  return (
    <button
      type="submit"
      disabled={saving}
      data-testid={testId}
      className="inline-flex h-11 items-center justify-center gap-2 bg-brand px-4 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
    >
      {saving && <Spinner />}
      {saving ? "저장 중…" : label}
    </button>
  );
}

export function SaveMessage({ state }: { state: SaveState }) {
  return (
    // 알림 자리는 항상 두되(aria-live) 비어 있을 때는 자리를 차지하지 않는다
    <p aria-live="polite" className={state.kind === "done" || state.kind === "error" ? "text-xs" : "sr-only"}>
      {state.kind === "done" && <span role="status" className="text-success">{state.message}</span>}
      {state.kind === "error" && <span role="alert" className="text-danger">{state.message}</span>}
    </p>
  );
}
