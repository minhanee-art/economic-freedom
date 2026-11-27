import Link from "next/link";

// 공개 페이지(랜딩·정책·안내·404) 공통 머리·바닥.
// 대시보드 상단 바(남색 bg-dark-header, 반경 0)와 같은 모양을 써서 로그인 전후가 한 제품으로 보이게 한다.

export function SiteHeader({ showAuth = true }: { showAuth?: boolean }) {
  return (
    <header className="bg-dark-header text-white">
      <div className="mx-auto flex h-16 max-w-280 items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="inline-flex min-h-11 items-center text-lg font-bold tracking-tight">
          가족연금계획
        </Link>
        {showAuth && (
          <nav aria-label="계정" className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-11 items-center px-3 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-11 items-center bg-white px-4 text-sm font-bold text-dark-header transition-colors hover:bg-indigo-50"
            >
              회원가입
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-280 flex-col gap-4 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-start md:justify-between">
        <p className="max-w-prose leading-6 text-zinc-600 break-keep dark:text-zinc-400">
          가족연금계획은 사용자가 입력한 기록을 계산해 보여주는 도구이며 투자 자문이나 매매 권유를 하지 않습니다. 세금·수익 계산은 참고용입니다.
        </p>
        <nav aria-label="안내 문서" className="flex flex-wrap gap-x-5">
          <Link href="/privacy" className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline dark:text-zinc-200">
            개인정보처리방침
          </Link>
          <Link href="/account-deletion" className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline dark:text-zinc-200">
            계정 및 데이터 삭제
          </Link>
          <Link href="/guide/telegram" className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline dark:text-zinc-200">
            텔레그램 연결 방법
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/** 정책·안내 문서 틀. 카드 없이 한 단의 본문(65ch 폭, max-w-prose)으로 읽힌다. */
export function DocPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground dark:bg-zinc-950">
      <SiteHeader showAuth={false} />
      <main className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <article className="mx-auto max-w-prose">
          <h1 className="text-3xl font-bold tracking-tight text-dark-header text-balance break-keep dark:text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{updated}</p>
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

// 문서 본문용 클래스. 제목 위 여백 > 아래 여백, 16px 본문, 줄높이 1.75.
export const doc = {
  h2: "mt-12 text-xl font-bold text-dark-header text-balance break-keep dark:text-white",
  h3: "mt-8 text-base font-bold text-dark-header break-keep dark:text-white",
  p: "mt-4 text-base leading-7 text-ink break-keep dark:text-zinc-300",
  ul: "mt-4 list-disc space-y-2 pl-5 text-base leading-7 text-ink marker:text-zinc-500 break-keep dark:text-zinc-300",
  ol: "mt-4 list-decimal space-y-3 pl-5 text-base leading-7 text-ink marker:font-semibold marker:text-zinc-600 break-keep dark:text-zinc-300",
  strong: "font-semibold text-dark-header dark:text-white",
  link: "font-semibold text-indigo-600 underline underline-offset-4 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200",
};
