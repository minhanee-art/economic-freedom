// 매일 16:10 KST (평일) 포트폴리오 수익률 트래킹 → 텔레그램 전송
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

// 종목코드가 숫자(6자리)면 KR, 아니면 US
function detectMarket(code: string): "KR" | "US" {
  return /^\d+$/.test(code.trim()) ? "KR" : "US";
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const qs = request.nextUrl.searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: "REPORT_USER_ID 또는 REPORT_USER_EMAIL 필요" }, { status: 400 });
  }

  // 보유 종목 (shares > 0) + 원가 데이터
  const holdings = await sql`
    SELECT h.id, h.code, h.name, h.shares,
           COALESCE(cb.total_cost, 0) AS total_cost,
           COALESCE(cb.total_shares, 0) AS total_shares
    FROM holdings h
    LEFT JOIN cost_basis cb ON cb.holding_id = h.id AND cb.user_id = h.user_id
    WHERE h.user_id = ${userId} AND h.shares > 0
    ORDER BY h.target_pct DESC
  `;

  if (!holdings.length) {
    return NextResponse.json({ error: "보유 종목 없음" }, { status: 400 });
  }

  const krHoldings = holdings.filter((h) => detectMarket(h.code as string) === "KR");
  const usHoldings = holdings.filter((h) => detectMarket(h.code as string) === "US");

  const appkey = process.env.KIS_APP_KEY ?? "";
  const appsecret = process.env.KIS_APP_SECRET ?? "";

  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  let totalInvest = 0;
  let totalValue = 0;
  let bestStock = { name: "", pct: -9999 };
  let worstStock = { name: "", pct: 9999 };

  let msg = `📊 포트폴리오 수익률 트래킹\n📅 ${today}\n\n`;

  // 한국 포트폴리오
  if (krHoldings.length > 0 && appkey) {
    try {
      const token = await getKisToken(appkey, appsecret);
      const krLines: string[] = [];
      for (const h of krHoldings) {
        const result = await getKisPrice(h.code as string, token, appkey, appsecret);
        if (!result) continue;
        const qty = Number(h.shares);
        const avgPrice = Number(h.total_shares) > 0
          ? Number(h.total_cost) / Number(h.total_shares)
          : 0;
        const invest = avgPrice * qty;
        const value = result.price * qty;
        const pnl = value - invest;
        const pct = invest > 0 ? ((pnl / invest) * 100) : 0;
        const sign = pct >= 0 ? "+" : "";
        const emoji = pct >= 0 ? "📈" : "📉";
        totalInvest += invest;
        totalValue += value;
        if (pct > bestStock.pct) bestStock = { name: h.name as string, pct };
        if (pct < worstStock.pct) worstStock = { name: h.name as string, pct };
        krLines.push(
          `${emoji} ${h.name}: ${result.price.toLocaleString()}원 ×${qty} = ${value.toLocaleString()}원 (${sign}${pct.toFixed(1)}%)`
        );
      }
      if (krLines.length) msg += `🇰🇷 한국 포트폴리오\n━━━━━━━━━━━━━━━━\n${krLines.join("\n")}\n`;
    } catch (err) {
      msg += `🇰🇷 한국 데이터 오류: ${(err as Error).message}\n`;
    }
  }

  // 미국 포트폴리오
  if (usHoldings.length > 0) {
    const usResults = await Promise.all(usHoldings.map((h) => getYahooPrice(h.code as string)));
    const usLines: string[] = [];
    usHoldings.forEach((h, i) => {
      const result = usResults[i];
      if (!result) return;
      const qty = Number(h.shares);
      const avgPrice = Number(h.total_shares) > 0
        ? Number(h.total_cost) / Number(h.total_shares)
        : 0;
      const invest = avgPrice * qty;
      const value = result.price * qty;
      const pnl = value - invest;
      const pct = invest > 0 ? ((pnl / invest) * 100) : 0;
      const sign = pct >= 0 ? "+" : "";
      const emoji = pct >= 0 ? "📈" : "📉";
      totalInvest += invest;
      totalValue += value;
      if (pct > bestStock.pct) bestStock = { name: h.name as string, pct };
      if (pct < worstStock.pct) worstStock = { name: h.name as string, pct };
      usLines.push(
        `${emoji} ${h.name} (${h.code}): $${result.price.toFixed(2)} ×${qty} = $${value.toFixed(2)} (${sign}${pct.toFixed(1)}%)`
      );
    });
    if (usLines.length) msg += `\n🇺🇸 미국 포트폴리오\n━━━━━━━━━━━━━━━━\n${usLines.join("\n")}\n`;
  }

  // 총 요약
  if (totalInvest > 0) {
    const totalPnl = totalValue - totalInvest;
    const totalPct = (totalPnl / totalInvest) * 100;
    const totalEmoji = totalPnl >= 0 ? "📈" : "📉";
    msg += `\n━━━━━━━━━━━━━━━━\n`;
    msg += `💼 총 투자: ${totalInvest.toLocaleString()}원\n`;
    msg += `💰 총 평가: ${totalValue.toLocaleString()}원\n`;
    msg += `${totalEmoji} 수익: ${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()}원 (${totalPct >= 0 ? "+" : ""}${totalPct.toFixed(1)}%)\n`;
    if (bestStock.name) msg += `🏆 최고: ${bestStock.name} (${bestStock.pct >= 0 ? "+" : ""}${bestStock.pct.toFixed(1)}%)\n`;
    if (worstStock.name && worstStock.name !== bestStock.name) {
      msg += `💀 최저: ${worstStock.name} (${worstStock.pct >= 0 ? "+" : ""}${worstStock.pct.toFixed(1)}%)\n`;
    }
  }

  msg += "\n⚠️ 투자 참고용이며 매매 권유가 아닙니다.";

  await sendTelegramMessage(msg);
  return NextResponse.json({ success: true, holdings: holdings.length });
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
