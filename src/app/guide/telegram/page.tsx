import type { Metadata } from "next";
import Link from "next/link";
import { TelegramGuide } from "@/components/guide/telegram-guide";
import { getBotUsername } from "@/lib/telegram-bot-username";

export const metadata: Metadata = {
  title: "텔레그램 연결 방법 - 가족연금계획",
  description: "가족연금계획 웹에서 텔레그램 채팅을 연결하고 해제하는 방법입니다.",
};

// 봇 사용자명은 배포 환경변수라 빌드 때 굳히지 않고 요청마다 읽는다.
export const dynamic = "force-dynamic";

export default function TelegramGuidePage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-12 text-foreground dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
          가족연금계획
        </Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-dark-header dark:text-white">텔레그램 연결 방법</h1>
        <TelegramGuide botUsername={getBotUsername()} />
      </div>
    </main>
  );
}
