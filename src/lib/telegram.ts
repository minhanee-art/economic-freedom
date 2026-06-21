// 텔레그램 Bot API 전송 헬퍼
const TELEGRAM_API = "https://api.telegram.org";

interface SendMessageOptions {
  /** 대시보드로 바로 이동하는 인라인 버튼 URL (선택) */
  buttonUrl?: string;
  buttonText?: string;
  /** HTML 파싱 사용 여부 (기본 true). 평문 메시지는 false로 설정해 &,<,> 이스케이프 이슈 방지 */
  html?: boolean;
}

/**
 * 텔레그램 봇으로 HTML 메시지 전송.
 * TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 환경변수 사용.
 */
export async function sendTelegramMessage(
  text: string,
  opts: SendMessageOptions = {}
): Promise<void> {
  // 복붙 시 딸려오는 앞뒤 공백/줄바꿈 제거 (URL 404 방지)
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 환경변수가 없습니다");
  }

  // 텔레그램 메시지 길이 제한(4096자) 대응 — 줄 경계로 분할 전송
  const chunks = splitMessage(text);
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: chunks[i],
      disable_web_page_preview: true,
    };
    // 평문 메시지(html:false)는 parse_mode를 생략 — &,<,> 등으로 인한 Telegram 400 방지
    if (opts.html !== false) body.parse_mode = "HTML";
    // 인라인 버튼은 마지막 청크에만 부착
    if (isLast && opts.buttonUrl) {
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
}

/** 텔레그램 4096자 제한에 맞춰 줄 경계 기준으로 분할(여유분 4000). */
function splitMessage(text: string, limit = 4000): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (line.length > limit) {
      // 한 줄이 limit보다 길면 강제 분할
      if (current) { chunks.push(current); current = ""; }
      for (let i = 0; i < line.length; i += limit) chunks.push(line.slice(i, i + limit));
      continue;
    }
    if (current.length + line.length + 1 > limit) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
