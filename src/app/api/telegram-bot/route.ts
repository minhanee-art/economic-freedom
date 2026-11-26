// Telegram Webhook 핸들러 - 허용된 채팅의 질문에 일반 정보 정리 답변을 보낸다.
// GET /api/telegram-bot?setup=1 (Authorization: Bearer CRON_SECRET) → 웹훅 등록
// POST /api/telegram-bot → Telegram이 호출하는 웹훅 엔드포인트
//
// 접근 통제(기본 거부):
// 1. TELEGRAM_WEBHOOK_SECRET이 없거나 헤더가 다르면 처리하지 않는다(연결 코드 포함 모든 메시지).
// 2. 연결 코드 메시지(`/start <코드>`, `/link <코드>`, 코드만)는 허용 목록과 무관하게 받는다.
//    이 경로는 chat_id별 레이트리밋 → 코드 확인(DB) → 고정 문구 답장만 한다. OpenAI는 호출하지 않는다.
//    틀린 코드·만료·재사용은 모두 같은 문구로 답하고, 한도를 넘으면 답하지 않는다.
// 3. 그 밖의 메시지는 chat_id가 TELEGRAM_ALLOWED_CHAT_IDS / TELEGRAM_CHAT_ID 목록에 있을 때만 답한다.
//    목록이 비어 있으면 모든 채팅을 거부한다.
// 질문 답변 경로는 DB를 조회하지 않는다 — 어떤 이용자의 포트폴리오도 답변 자료로 쓰지 않는다.
import { NextResponse, type NextRequest } from "next/server";
import {
  BOT_SYSTEM_PROMPT,
  buildBotUserMessage,
  callOpenAIChat,
  withAiDisclaimer,
} from "@/lib/ai-text";
import { sendTelegramMessage } from "@/lib/telegram";
import { isChatAllowed, safeEqual, verifyWebhookSecret } from "@/lib/telegram-bot-auth";
import {
  LINK_FAILURE_REPLY,
  LINK_SUCCESS_REPLY,
  parseLinkAttempt,
  redeemTelegramLinkCode,
} from "@/lib/telegram-link";
import { authRateLimit } from "@/lib/rate-limit";

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
/** 연결 코드 처리 — 허용 목록 밖 채팅도 오는 경로라 레이트리밋·코드 확인·고정 문구 답장 외에는 아무것도 하지 않는다. */
async function handleLinkAttempt(chatId: string, code: string | null): Promise<void> {
  // 무차별 대입 제한: chat_id별 10분 10회. 넘으면 답하지 않는다(봇을 답장 증폭기로 쓰지 못하게).
  if (!(await authRateLimit(`telegram-link:chat:${chatId}`))) return;
  let linked = false;
  if (code) {
    try {
      linked = await redeemTelegramLinkCode(code, chatId);
    } catch {
      linked = false;
    }
  }
  try {
    await sendTelegramMessage(linked ? LINK_SUCCESS_REPLY : LINK_FAILURE_REPLY, { chatId, html: false });
  } catch {
    /* 전송 실패 무시 */
  }
}

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
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN 필요" }, { status: 500 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  if (!text || typeof chatId !== "number" || !Number.isSafeInteger(chatId)) return NextResponse.json({ ok: true });

  // 연결 코드는 허용 목록 검사보다 먼저 — 여기서 끝나며 아래 OpenAI 경로로 내려가지 않는다.
  const linkAttempt = parseLinkAttempt(text);
  if (linkAttempt) {
    await handleLinkAttempt(String(chatId), linkAttempt.code);
    return NextResponse.json({ ok: true });
  }

  // 허용되지 않은 채팅은 조용히 무시(응답·OpenAI·DB 호출 없음). Telegram 재전송을 막으려고 200을 준다.
  if (!isChatAllowed(chatId)) {
    return NextResponse.json({ ok: true });
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!openaiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY 필요" }, { status: 500 });
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
