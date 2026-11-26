// 매일 15:40 KST (평일) 장 마감 리포트 → 텔레그램 전송
import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sql } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { getKisToken, getKisPrice } from "@/lib/kis";
import { getYahooPrice } from "@/lib/yahoo";
import { MARKET_CLOSE_SYSTEM_PROMPT, asDataBlock, callOpenAIChat, withAiDisclaimer } from "@/lib/ai-text";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function resolveUserId(): Promise<string | null> {
  const directId = process.env.REPORT_USER_ID;
  if (directId) return directId;
  const email = process.env.REPORT_USER_EMAIL;
  if (!email) return null;
  const [row] = await sql`SELECT id FROM users WHERE email = ${email}`;
  return (row?.id as string) ?? null;
}

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: "REPORT_USER_ID 또는 REPORT_USER_EMAIL 필요" }, { status: 400 });
  }

  const watchlist = await sql`SELECT name, code, market FROM watchlist WHERE user_id = ${userId}`;
  const krStocks = watchlist.filter((s) => s.market === "KR" && s.code);
  const usStocks = watchlist.filter((s) => s.market === "US" && s.code);

  const appkey = process.env.KIS_APP_KEY ?? "";
  const appsecret = process.env.KIS_APP_SECRET ?? "";

  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  let msg = `📊 일일 장 마감 리포트\n📅 ${today}\n\n`;

  // 한국 장
  if (krStocks.length > 0 && appkey) {
    try {
      const token = await getKisToken(appkey, appsecret);
      const krResults = await Promise.all(
        krStocks.map((s) => getKisPrice(s.code as string, token, appkey, appsecret))
      );
      const krLines: string[] = [];
      krStocks.forEach((s, idx) => {
        const result = krResults[idx];
        if (!result) return;
        const sign = result.changeRate >= 0 ? "+" : "";
        const emoji = result.changeRate >= 0 ? "📈" : "📉";
        krLines.push(
          `${emoji} ${s.name}: ${result.price.toLocaleString()}원 (${sign}${result.changeRate.toFixed(2)}%)  거래량: ${result.volume.toLocaleString()}`
        );
      });
      if (krLines.length) msg += `🇰🇷 한국 장 마감\n━━━━━━━━━━━━━━━━\n${krLines.join("\n")}\n`;
    } catch (err) {
      msg += `🇰🇷 한국 장 데이터 오류: ${(err as Error).message}\n`;
    }
  }

  // 미국 장
  if (usStocks.length > 0) {
    const usResults = await Promise.all(usStocks.map((s) => getYahooPrice(s.code as string)));
    const usLines: string[] = [];
    usStocks.forEach((s, i) => {
      const result = usResults[i];
      if (!result) return;
      const sign = result.changeRate >= 0 ? "+" : "";
      const emoji = result.changeRate >= 0 ? "📈" : "📉";
      usLines.push(`${emoji} ${s.name} (${s.code}): $${result.price.toFixed(2)} (${sign}${result.changeRate.toFixed(2)}%)`);
    });
    if (usLines.length) msg += `\n🇺🇸 미국 주식 현황\n━━━━━━━━━━━━━━━━\n${usLines.join("\n")}\n`;
  }

  // AI 시세 요약 코멘트 (정보 정리용 — 매매 권유·전망 없음)
  const openaiKey = process.env.OPENAI_API_KEY;
  let hasAiText = false;
  if (openaiKey) {
    try {
      const comment = await callOpenAIChat({
        apiKey: openaiKey,
        system: MARKET_CLOSE_SYSTEM_PROMPT,
        user: `아래 관심종목 시세를 요약해줘.\n${asDataBlock("market-data", msg)}`,
        model: "gpt-4o",
        maxTokens: 300,
        timeoutMs: 20000,
      });
      if (comment) {
        msg += `\n\n💡 AI 시세 요약\n${comment}`;
        hasAiText = true;
      }
    } catch { /* GPT 실패해도 리포트 발송 */ }
  }

  msg = hasAiText ? withAiDisclaimer(msg) : `${msg}\n\nℹ️ 공개 시세를 정리한 정보이며 투자 권유가 아닙니다.`;

  await sendTelegramMessage(msg, { html: false });
  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
