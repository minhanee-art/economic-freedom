// 텔레그램 Bot API 전송 헬퍼
const TELEGRAM_API = "https://api.telegram.org";

interface SendMessageOptions {
  /** 대시보드로 바로 이동하는 인라인 버튼 URL (선택) */
  buttonUrl?: string;
  buttonText?: string;
}

/**
 * 텔레그램 봇으로 HTML 메시지 전송.
 * TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 환경변수 사용.
 */
export async function sendTelegramMessage(
  text: string,
  opts: SendMessageOptions = {}
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 환경변수가 없습니다");
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  if (opts.buttonUrl) {
    body.reply_markup = {
      inline_keyboard: [
        [{ text: opts.buttonText ?? "📊 대시보드 열기", url: opts.buttonUrl }],
      ],
    };
  }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`텔레그램 전송 실패 (${res.status}): ${detail}`);
  }
}
