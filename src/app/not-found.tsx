import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/guide/public-site";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다 - 가족연금계획",
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground dark:bg-zinc-950">
      <SiteHeader />
      <main className="flex-1 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-prose">
          <h1 className="text-3xl font-bold tracking-tight text-dark-header text-balance break-keep dark:text-white sm:text-4xl">
            페이지를 찾을 수 없습니다
          </h1>
          <p className="mt-4 text-base leading-7 text-ink break-keep dark:text-zinc-300">
            주소가 바뀌었거나 잘못 입력됐을 수 있습니다. 주소를 다시 확인하거나 아래에서 이동해 주세요.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center bg-indigo-500 px-6 text-base font-bold text-white transition-colors hover:bg-indigo-600"
            >
              대시보드로 가기
            </Link>
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center border border-zinc-300 bg-white px-6 text-base font-bold text-ink transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              처음 화면
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
