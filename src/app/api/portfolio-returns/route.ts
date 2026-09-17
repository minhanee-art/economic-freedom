// 계좌별 기간 수익률 조회/텔레그램 전송 API
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";
import {
  formatReturnReport,
  getPortfolioReturnSummary,
  updatePortfolioTelegramChatId,
} from "@/lib/portfolio-returns";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  try {
    const accountId = await getActivePortfolioAccountId(session.userId);
    const summary = await getPortfolioReturnSummary(session.userId, accountId);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const chatId = typeof body.telegramChatId === "string" ? body.telegramChatId : "";

  try {
    const accountId = await getActivePortfolioAccountId(session.userId);
    await updatePortfolioTelegramChatId(session.userId, accountId, chatId || null);
    const summary = await getPortfolioReturnSummary(session.userId, accountId);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const chatId = typeof body.telegramChatId === "string" ? body.telegramChatId.trim() : "";

  try {
    const accountId = await getActivePortfolioAccountId(session.userId);
    if (chatId) {
      await updatePortfolioTelegramChatId(session.userId, accountId, chatId);
    }
    const summary = await getPortfolioReturnSummary(session.userId, accountId);
    const targetChatId = chatId || summary.telegramChatId;
    if (!targetChatId) {
      return NextResponse.json({ error: "이 계좌의 텔레그램 chat_id를 먼저 입력해주세요." }, { status: 400 });
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
