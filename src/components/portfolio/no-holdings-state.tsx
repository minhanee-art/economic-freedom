// 종목이 하나도 없는 계좌의 빈 상태 — 0원·0% 같은 계산 결과 대신 무엇을 먼저 하면 되는지 보여 준다.
// 적립 배분 계산·손익·배당·기록 화면이 같이 쓴다. 종목 추가 폼은 홈 하단(#holdings)에 있다.
import Link from "next/link";
import type { ReactNode } from "react";

export const ADD_HOLDING_HREF = "/dashboard#holdings";

export function NoHoldingsState({
  title = "아직 종목이 없습니다",
  actionLabel = "종목 추가",
  description,
  children,
}: {
  title?: string;
  /** 홈 종목 영역(#holdings)으로 가는 주 동작의 이름 */
  actionLabel?: string;
  /** 이 화면이 종목으로 무엇을 계산·기록하는지 한두 문장 */
  description: ReactNode;
  /** 종목 추가 옆에 둘 보조 동작(선택) */
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="no-holdings-title"
      className="border border-hairline bg-surface px-5 py-8 shadow-card dark:border-zinc-800 sm:px-8 sm:py-10"
    >
      <h1 id="no-holdings-title" className="text-lg font-bold tracking-tight text-ink">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={ADD_HOLDING_HREF}
          className="inline-flex h-10 items-center justify-center border border-brand bg-brand px-4 text-xs font-bold text-white transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          {actionLabel}
        </Link>
        {children}
      </div>
    </section>
  );
}

/** 빈 상태 옆에 두는 보조 동작 — 테두리 버튼 모양 */
export const noHoldingsSecondaryClass =
  "inline-flex h-10 items-center justify-center border border-hairline bg-surface px-4 text-xs font-bold text-zinc-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300";
