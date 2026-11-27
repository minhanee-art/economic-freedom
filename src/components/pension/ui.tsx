// 연금 설계 화면 공용 조각 — 기존 대시보드 카드·입력 스타일을 그대로 따른다.
import type { CSSProperties, ReactNode } from "react";

export const inputClass =
  "w-full h-10 border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800";

export const primaryButtonClass =
  "h-10 bg-indigo-500 px-4 text-white text-sm font-medium transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed";

export const secondaryButtonClass =
  "h-9 border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

export function SectionCard({
  id,
  title,
  description,
  children,
}: {
  /** 다른 화면(홈 첫 사용 안내)에서 #id 로 바로 이동할 때 쓰는 앵커 */
  id?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</div>}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

/** 세금 관련 화면 공통 안내 */
export function TaxDisclaimer({ extra }: { extra?: ReactNode }) {
  return (
    <p className="bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
      참고용이며 실제 세액과 다를 수 있습니다.
      {extra && <span className="block mt-0.5">{extra}</span>}
    </p>
  );
}

export function ProgressBar({ pct, tone = "normal" }: { pct: number; tone?: "normal" | "over" }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
      <div
        className={`bar-w h-full transition-all ${tone === "over" ? "bg-caution" : "bg-indigo-500"}`}
        style={{ "--bar-w": `${width}%` } as CSSProperties}
      />
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="border border-zinc-100 p-3 dark:border-zinc-800">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

/** 빈 문자열은 null, 숫자로 못 바꾸면 NaN */
export function parseNumberInput(value: string): number | null {
  const cleaned = value.replace(/[,\s원]/g, "");
  if (!cleaned) return null;
  return Number(cleaned);
}

export async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "저장하지 못했습니다.");
  return data as T;
}
