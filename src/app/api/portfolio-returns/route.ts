// 계좌별 기간 수익률 조회/텔레그램 전송 API
// 텔레그램 전송은 연결 코드로 소유 확인을 마친 chat_id(설정 > 텔레그램 연결)로만 보낸다.
// 요청 본문의 telegramChatId는 받지 않는다(예전 화면이 보내더라도 무시). chat_id 직접 저장(PATCH)은 없앴다.
import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";
import { selectRequestAccount } from "@/lib/account-selection";
import { formatReturnReport, getPortfolioReturnSummary } from "@/lib/portfolio-returns";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  try {
    const selected = await selectRequestAccount(request, session.userId);
    if (!selected.ok) return selected.response;
    const accountId = selected.accountId;
    const summary = await getPortfolioReturnSummary(session.userId, accountId);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  try {
    const selected = await selectRequestAccount(request, session.userId);
    if (!selected.ok) return selected.response;
    const accountId = selected.accountId;
    const summary = await getPortfolioReturnSummary(session.userId, accountId);
    const targetChatId = summary.telegramChatId; // 확인된 chat_id만 들어 있다
    if (!targetChatId) {
      return NextResponse.json(
        {
          error: summary.telegramNeedsRelink
            ? "텔레그램 채팅 확인이 필요합니다. 설정 > 텔레그램 연결에서 연결 코드로 다시 연결해 주세요."
            : "이 계좌에 연결된 텔레그램 채팅이 없습니다. 설정 > 텔레그램 연결에서 먼저 연결해 주세요.",
          code: summary.telegramNeedsRelink ? "telegram_needs_relink" : "telegram_not_linked",
        },
        { status: 409 }
      );
    }

    await sendTelegramMessage(formatReturnReport(summary), {
      html: false,
      chatId: targetChatId,
      buttonUrl: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/dashboard`
        : undefined,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
