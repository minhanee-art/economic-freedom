// Telegram Webhook 핸들러 - 허용된 채팅의 질문에 일반 정보 정리 답변을 보낸다.
// GET /api/telegram-bot?setup=1 (Authorization: Bearer CRON_SECRET) → 웹훅 등록
// POST /api/telegram-bot → Telegram이 호출하는 웹훅 엔드포인트
//
// 접근 통제(기본 거부):
// 1. TELEGRAM_WEBHOOK_SECRET이 없거나 헤더가 다르면 처리하지 않는다.
// 2. chat_id가 TELEGRAM_ALLOWED_CHAT_IDS / TELEGRAM_CHAT_ID 목록에 없으면 응답하지 않는다.
//    목록이 비어 있으면 모든 채팅을 거부한다.
// 봇은 DB를 조회하지 않는다 — 어떤 이용자의 포트폴리오도 답변 자료로 쓰지 않는다.
import { NextResponse, type NextRequest } from "next/server";
import {
  BOT_SYSTEM_PROMPT,
  buildBotUserMessage,
  callOpenAIChat,
  withAiDisclaimer,
} from "@/lib/ai-text";
import { sendTelegramMessage } from "@/lib/telegram";
import { isChatAllowed, safeEqual, verifyWebhookSecret } from "@/lib/telegram-bot-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
  };
}

const ERROR_REPLY = "⚠️ 지금은 답변을 만들 수 없습니다. 잠시 후 다시 시도해주세요.";

// POST: Telegram webhook
export async function POST(request: NextRequest) {
  const auth = verifyWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"));
  if (!auth.ok) {
    // 시크릿 미설정은 운영 설정 오류 — 처리하지 않고 503으로 알린다(Telegram getWebhookInfo에 남음)
    if (auth.reason === "secret-not-configured") {
      return NextResponse.json({ error: "TELEGRAM_WEBHOOK_SECRET 미설정" }, { status: 503 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!botToken || !openaiKey) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN, OPENAI_API_KEY 필요" }, { status: 500 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  if (!text || chatId === undefined || chatId === null) return NextResponse.json({ ok: true });

  // 허용되지 않은 채팅은 조용히 무시(응답·OpenAI 호출 없음). Telegram 재전송을 막으려고 200을 준다.
  if (!isChatAllowed(chatId)) {
    return NextResponse.json({ ok: true });
  }

  let reply: string;
  try {
    const answer = await callOpenAIChat({
      apiKey: openaiKey,
      system: BOT_SYSTEM_PROMPT,
      user: buildBotUserMessage(text),
      maxTokens: 800,
    });
    reply = answer ? withAiDisclaimer(answer) : ERROR_REPLY;
  } catch {
    reply = ERROR_REPLY;
  }

  try {
    await sendTelegramMessage(reply, { chatId: String(chatId), html: false });
  } catch {
    /* 전송 실패 무시 */
  }

  return NextResponse.json({ ok: true });
}

// GET: 웹훅 등록 (운영자 전용 — CRON_SECRET Bearer 필요)
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";
  const authHeader = request.headers.get("authorization") ?? "";
  if (!cronSecret || !safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const setup = request.nextUrl.searchParams.get("setup");
  if (setup !== "1") {
    return NextResponse.json({ message: "웹훅 등록: ?setup=1 파라미터 추가" });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  if (!botToken || !webhookSecret) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET 필요" }, { status: 500 });
  }

  const host = request.headers.get("host") ?? "";
  const webhookUrl = `https://${host}/api/telegram-bot`;
  const setupUrl =
    `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}` +
    `&secret_token=${encodeURIComponent(webhookSecret)}`;
  const res = await fetch(setupUrl, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  return NextResponse.json({ webhookUrl, secretTokenSet: true, telegram: data });
}
