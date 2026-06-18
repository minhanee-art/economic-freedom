// Telegram Webhook 핸들러 - 메시지 수신 시 Gemini로 즉시 답변
// GET /api/telegram-bot?setup=1 → 웹훅 등록 (최초 1회)
// POST /api/telegram-bot → Telegram이 호출하는 웹훅 엔드포인트
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
  };
}

async function callGemini(question: string, apiKey: string): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const prompt = `너는 한국 배당투자 전문가 AI야. 간결하고 유용하게 답해줘. 이모지 써서 보기 좋게. 질문: ${question}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(25000),
    }
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini 오류 ${res.status}: ${detail.substring(0, 200)}`);
  }
  const data = await res.json() as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return data.candidates[0]?.content?.parts?.[0]?.text?.trim() ?? "(응답 없음)";
}

async function telegramSend(chatId: number, text: string, botToken: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(10000),
  });
}

// POST: Telegram webhook
export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const geminiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  const allowedChatId = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";

  if (!botToken || !geminiKey) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN, GEMINI_API_KEY 필요" }, { status: 500 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  if (!text || !chatId) return NextResponse.json({ ok: true });

  // 허용된 채팅만 응답 (설정된 경우)
  if (allowedChatId && String(chatId) !== allowedChatId) {
    return NextResponse.json({ ok: true });
  }

  try {
    const answer = await callGemini(text, geminiKey);
    await telegramSend(chatId, answer, botToken);
  } catch (err) {
    try {
      await telegramSend(chatId, `⚠️ 오류: ${(err as Error).message.substring(0, 200)}`, botToken);
    } catch { /* 전송 실패 무시 */ }
  }

  return NextResponse.json({ ok: true });
}

// GET: 웹훅 등록 (최초 1회 실행)
export async function GET(request: NextRequest) {
  const setup = request.nextUrl.searchParams.get("setup");
  if (setup !== "1") {
    return NextResponse.json({ message: "웹훅 등록: ?setup=1 파라미터 추가" });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN 필요" }, { status: 500 });
  }

  const host = request.headers.get("host") ?? "";
  const webhookUrl = `https://${host}/api/telegram-bot`;

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  const data = await res.json();
  return NextResponse.json({ webhookUrl, telegram: data });
}
