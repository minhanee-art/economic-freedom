"use client";

// 대시보드 홈 머리: 화면 제목과 이 제품만의 한 줄 상태
// (올해 세액공제 한도 진행률·남은 금액, 은퇴 시점 예상 월 현금흐름 대 목표).
// 계산은 연금 설계 화면과 같은 /api/pension/summary 결과를 그대로 쓴다.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  homeCashflowStatus,
  homeTaxCreditStatus,
  type PensionSummaryLite,
} from "@/lib/dashboard-home";
import { formatKRW } from "@/lib/utils";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; summary: PensionSummaryLite };

export function HomeStatus() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/pension/summary", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setState({ kind: "ready", summary: (await res.json()) as PensionSummaryLite });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    // 마운트 시 한 번 불러온다(setState 는 비동기 응답 뒤에 일어난다)
    const id = globalThis.setTimeout(load, 0);
    return () => globalThis.clearTimeout(id);
  }, [load]);

  return (
    <header className="space-y-3">
      <h1 className="text-xl font-bold tracking-tight text-ink">홈</h1>
      {/* 숫자가 들어올 자리를 미리 잡아 둬 아래 패널이 밀리지 않게 한다 */}
      <div className="min-h-54 text-sm leading-relaxed text-ink sm:min-h-22" aria-live="polite">
        {state.kind === "loading" && (
          <p className="text-zinc-500 dark:text-zinc-400">올해 세액공제와 은퇴 현금흐름을 불러오는 중입니다.</p>
        )}
        {state.kind === "error" && (
          <p role="alert" className="text-danger">
            연금 요약을 불러오지 못했습니다. 네트워크를 확인한 뒤{" "}
            <button type="button" onClick={load} className="min-h-11 font-semibold underline underline-offset-2">
              다시 불러오기
            </button>
          </p>
        )}
        {state.kind === "ready" && <StatusLine summary={state.summary} />}
      </div>
    </header>
  );
}

const NUMBER_CLASS = "mt-1 text-number-lg font-semibold leading-tight tracking-tight tabular-nums text-ink";

function StatusLine({ summary }: { summary: PensionSummaryLite }) {
  const tax = homeTaxCreditStatus(summary);
  const cashflow = homeCashflowStatus(summary);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-10">
        <div data-testid="home-tax-credit">
          <dt className="text-xs font-medium text-ink-mute">{tax.year}년 세액공제 남은 한도</dt>
          {tax.kind === "ready" ? (
            <>
              <dd className={NUMBER_CLASS}>{formatKRW(tax.remaining)}</dd>
              <dd className="mt-0.5 text-xs tabular-nums text-ink-mute">한도의 {tax.progressPct}% 채움</dd>
            </>
          ) : (
            <dd className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">연금저축·IRP 계좌가 없어 계산하지 않았습니다.</dd>
          )}
        </div>
        <div data-testid="home-cashflow">
          <dt className="text-xs font-medium text-ink-mute">
            {cashflow.kind === "ready" ? `${cashflow.age}세 예상 월 현금흐름` : "은퇴 시점 예상 월 현금흐름"}
          </dt>
          {cashflow.kind === "ready" ? (
            <>
              <dd className={NUMBER_CLASS}>월 {formatKRW(cashflow.monthly)}</dd>
              <dd className="mt-0.5 text-xs tabular-nums text-ink-mute">
                목표 월 {formatKRW(cashflow.target)}의 {cashflow.coveragePct}%
              </dd>
            </>
          ) : (
            <dd className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">은퇴 목표를 입력하면 계산합니다.</dd>
          )}
        </div>
      </dl>
      <Link
        href="/dashboard/retirement"
        className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-brand underline-offset-2 hover:underline sm:self-auto dark:text-indigo-300"
      >
        연금 설계 보기
      </Link>
    </div>
  );
}
