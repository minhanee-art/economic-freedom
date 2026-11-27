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
    <header className="space-y-2">
      <h1 className="text-xl font-bold tracking-tight text-ink">홈</h1>
      <div className="min-h-12 text-sm leading-relaxed text-ink" aria-live="polite">
        {state.kind === "loading" && (
          <p className="text-zinc-500 dark:text-zinc-400">올해 세액공제와 은퇴 현금흐름을 불러오는 중입니다.</p>
        )}
        {state.kind === "error" && (
          <p role="alert" className="text-danger">
            연금 요약을 불러오지 못했습니다. 네트워크를 확인한 뒤{" "}
            <button type="button" onClick={load} className="min-h-10 font-semibold underline underline-offset-2">
              다시 불러오기
            </button>
          </p>
        )}
        {state.kind === "ready" && <StatusLine summary={state.summary} />}
      </div>
    </header>
  );
}

function StatusLine({ summary }: { summary: PensionSummaryLite }) {
  const tax = homeTaxCreditStatus(summary);
  const cashflow = homeCashflowStatus(summary);

  return (
    <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-6">
      <li data-testid="home-tax-credit">
        {tax.kind === "ready" ? (
          <>
            {tax.year}년 세액공제 한도 <b className="font-semibold tabular-nums">{tax.progressPct}%</b> 채움
            <span className="text-zinc-500 dark:text-zinc-400"> · 남은 한도 </span>
            <b className="font-semibold tabular-nums">{formatKRW(tax.remaining)}</b>
          </>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">연금저축·IRP 계좌가 없어 세액공제를 계산하지 않았습니다.</span>
        )}
      </li>
      <li data-testid="home-cashflow">
        {cashflow.kind === "ready" ? (
          <>
            {cashflow.age}세 예상 월 <b className="font-semibold tabular-nums">{formatKRW(cashflow.monthly)}</b>
            <span className="text-zinc-500 dark:text-zinc-400">
              {" "}/ 목표 {formatKRW(cashflow.target)} ({cashflow.coveragePct}%)
            </span>
          </>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">은퇴 목표를 입력하면 은퇴 시점 월 현금흐름을 계산합니다.</span>
        )}
      </li>
      <li>
        <Link
          href="/dashboard/retirement"
          className="inline-flex min-h-10 items-center font-semibold text-brand underline-offset-2 hover:underline dark:text-indigo-300"
        >
          연금 설계 보기
        </Link>
      </li>
    </ul>
  );
}
