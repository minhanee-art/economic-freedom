"use client";

// 설정 > 데이터 삭제 — 되돌릴 수 없는 기록 전체 삭제만 모은다. 누르면 확인 대화상자에서 무엇이 지워지는지 한 번 더 알린다.
// 계정 자체 삭제는 계정 탭 맨 아래에 있다.
import { useRouter } from "next/navigation";
import { failureMessage } from "@/components/dashboard/inline-error";
import type { SettingsTools } from "@/components/settings/settings-shared";

type DangerKind = "reset" | "purchases" | "dividends";

// 확인 문구는 무엇이 지워지는지 그대로 알린다
const DANGER_TEXT: Record<DangerKind, string> = {
  reset: "현재 계좌의 보유 종목을 모두 삭제합니다. 이 종목들의 매수·매도·배당 기록과 원가 데이터도 함께 지워집니다. 이 작업은 되돌릴 수 없습니다.",
  purchases: "모든 매수 기록, 보유수량, 원가 데이터가 초기화됩니다. 이 작업은 되돌릴 수 없습니다.",
  dividends: "모든 배당금 수령 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
};
const DANGER_TITLE: Record<DangerKind, { title: string; confirmLabel: string }> = {
  reset: { title: "현재 계좌의 보유 종목을 모두 삭제할까요?", confirmLabel: "보유 종목 모두 삭제" },
  purchases: { title: "매수 기록을 모두 삭제할까요?", confirmLabel: "매수 기록 모두 삭제" },
  dividends: { title: "배당 기록을 모두 삭제할까요?", confirmLabel: "배당 기록 모두 삭제" },
};

export function DataTab({ tools }: { tools: SettingsTools }) {
  const router = useRouter();
  const { flash, showError, confirm } = tools;

  const handleDangerAction = async (kind: DangerKind) => {
    const ok = await confirm({ ...DANGER_TITLE[kind], body: DANGER_TEXT[kind] });
    if (!ok) return;
    showError(null);
    try {
      if (kind === "purchases") {
        const res = await fetch("/api/danger/purchases", { method: "DELETE" });
        if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
        flash("매수 기록 전체 삭제됨");
        router.refresh();
      } else if (kind === "dividends") {
        const res = await fetch("/api/danger/dividends", { method: "DELETE" });
        if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
        flash("배당 기록 전체 삭제됨");
      } else {
        const res = await fetch("/api/settings", { method: "DELETE" });
        if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
        flash("보유 종목 전체 삭제됨");
        router.refresh();
      }
    } catch (err) {
      showError({ message: failureMessage("삭제", err), retry: () => handleDangerAction(kind) });
    }
  };

  return (
    <section aria-labelledby="settings-data-delete" className="border border-danger-line bg-surface p-5 space-y-3 shadow-card">
      <div>
        <h2 id="settings-data-delete" className="flex items-center gap-2 text-base font-bold tracking-tight text-danger">
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          데이터 삭제
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">아래 작업은 되돌릴 수 없습니다. 누르면 무엇이 지워지는지 한 번 더 확인합니다. 계정 자체 삭제는 계정 탭 맨 아래에 있습니다.</p>
      </div>
      <div className="space-y-2">
        <DangerButton label="보유 종목 전체 삭제" desc="현재 계좌의 종목을 모두 지워 빈 상태로 만듭니다" onClick={() => handleDangerAction("reset")} />
        <DangerButton label="매수 기록 전체 삭제" desc="모든 매수 기록과 보유수량이 초기화됩니다" onClick={() => handleDangerAction("purchases")} />
        <DangerButton label="배당 기록 전체 삭제" desc="모든 배당금 기록이 삭제됩니다" onClick={() => handleDangerAction("dividends")} />
      </div>
    </section>
  );
}

function DangerButton({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="w-full min-h-14 flex items-center justify-between border border-danger-line bg-surface px-4 py-3 text-left transition-colors hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
    >
      <div>
        <p className="text-sm font-medium text-danger">{label}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
      </div>
      <svg aria-hidden="true" className="w-4 h-4 text-danger shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}
