import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-[860px] text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight text-dark-header dark:text-white sm:text-5xl">
          Pension Manager
        </h1>
        <p className="text-lg text-zinc-500">
          연금 ETF 포트폴리오를 한눈에 관리하세요.
          <br />
          매수 계획, 손익 추적, 배당금 관리까지.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-indigo-500 px-8 text-white font-medium transition-colors hover:bg-indigo-600"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-200 px-8 font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
