import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[860px] text-center space-y-8">
        <span className="inline-flex items-center rounded-full border border-hairline bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-600 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
          연금 ETF 포트폴리오
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-dark-header dark:text-white sm:text-5xl">
          Pension Manager
        </h1>
        <p className="text-lg text-ink-mute dark:text-zinc-400">
          연금 ETF 포트폴리오를 한눈에 관리하세요.
          <br />
          매수 계획, 손익 추적, 배당금 관리까지.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-indigo-900 via-indigo-700 to-indigo-500 px-8 text-white font-semibold shadow-card transition-shadow hover:shadow-float"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-full border border-hairline bg-white px-8 font-semibold text-ink shadow-card transition-shadow hover:shadow-float dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          >
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
