import type { Metadata } from "next";
import { TelegramGuide } from "@/components/guide/telegram-guide";
import { DocPage } from "@/components/guide/public-site";
import { getBotUsername } from "@/lib/telegram-bot-username";

export const metadata: Metadata = {
  title: "텔레그램 연결 방법 - 가족연금계획",
  description: "가족연금계획 웹에서 텔레그램 채팅을 연결하고 해제하는 방법입니다.",
};

// 봇 사용자명은 배포 환경변수라 빌드 때 굳히지 않고 요청마다 읽는다.
export const dynamic = "force-dynamic";

export default function TelegramGuidePage() {
  return (
    <DocPage title="텔레그램 연결 방법" updated="최종 업데이트: 2026년 11월 27일">
      <TelegramGuide botUsername={getBotUsername()} />
    </DocPage>
  );
}
