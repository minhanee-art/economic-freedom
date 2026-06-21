// 매일 15:40 KST (평일) 장 마감 리포트 → 텔레그램 전송
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { getKisToken, getKisPrice } from "@/lib/kis";
import { getYahooPrice } from "@/lib/yahoo";

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
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const qs = request.nextUrl.searchParams.get("secret");
  if (!secret || (auth !== `Bearer ${secret}` && qs !== secret)) {
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

  msg += "\n⚠️ 투자 참고용이며 매매 권유가 아닙니다.";

  // GPT 배당투자 관점 코멘트
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: `너는 배당투자 전문 애널리스트야. 아래 주식 데이터를 배당투자 관점에서 2-3문장으로 코멘트해줘. 데이터:\n${msg}` }],
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (gptRes.ok) {
        const gptData = await gptRes.json() as { choices: { message: { content: string } }[] };
        const comment = gptData.choices[0]?.message?.content?.trim();
        if (comment) msg += `\n\n💡 AI 코멘트\n${comment}`;
      }
    } catch { /* GPT 실패해도 리포트 발송 */ }
  }

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
