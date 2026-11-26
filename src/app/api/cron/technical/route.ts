// 매일 09:00, 13:00 KST 기술적 분석 (RSI/MACD) → 텔레그램 전송
import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sql } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";

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

function ema(data: number[], period: number): number {
  const k = 2 / (period + 1);
  let val = data[0];
  for (let i = 1; i < data.length; i++) {
    val = data[i] * k + val * (1 - k);
  }
  return val;
}

function calcRsi(closes: number[], period = 14): number {
  const slice = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

interface StockSignal {
  name: string;
  flag: string;
  price: string;
  priceChange: string;
  rsi: string;
  rsiSignal: string;
  rsiEmoji: string;
  macdSignal: string;
  macdEmoji: string;
  hasStrongSignal: boolean;
}

async function fetchAndAnalyze(symbol: string, name: string, market: string): Promise<StockSignal | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      chart?: { result?: { indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
    };
    const rawCloses = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses.filter((c): c is number => c !== null);
    if (closes.length < 40) return null;

    // RSI
    const rsi = calcRsi(closes);
    let rsiSignal: string, rsiEmoji: string;
    if (rsi <= 30) { rsiSignal = "RSI 30 이하"; rsiEmoji = "🟢"; }
    else if (rsi >= 70) { rsiSignal = "RSI 70 이상"; rsiEmoji = "🔴"; }
    else { rsiSignal = "중립"; rsiEmoji = "⚪"; }

    // MACD (12, 26)
    const macdLine = ema(closes.slice(-30), 12) - ema(closes.slice(-40), 26);
    const prevMacd = ema(closes.slice(-31, -1), 12) - ema(closes.slice(-41, -1), 26);
    let macdSignal: string, macdEmoji: string;
    if (prevMacd < 0 && macdLine > 0) { macdSignal = "MACD 0선 상향 교차"; macdEmoji = "🟢"; }
    else if (prevMacd > 0 && macdLine < 0) { macdSignal = "MACD 0선 하향 교차"; macdEmoji = "🔴"; }
    else { macdSignal = "횡보 중"; macdEmoji = "⚪"; }

    // 기준선 통과: RSI 30 이하·70 이상 OR MACD 0선 교차
    const hasStrongSignal =
      rsiEmoji !== "⚪" ||
      (prevMacd < 0 && macdLine > 0) ||
      (prevMacd > 0 && macdLine < 0);

    const currentPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2];
    const pct = prevPrice ? ((currentPrice - prevPrice) / prevPrice * 100).toFixed(2) : "0.00";
    const sign = parseFloat(pct) >= 0 ? "+" : "";

    const flag = market === "KR" ? "🇰🇷" : "🇺🇸";
    const price = market === "KR"
      ? `${Math.round(currentPrice).toLocaleString()}원`
      : `$${currentPrice.toFixed(2)}`;

    return {
      name, flag, price,
      priceChange: `${sign}${pct}%`,
      rsi: rsi.toFixed(1),
      rsiSignal, rsiEmoji,
      macdSignal, macdEmoji,
      hasStrongSignal,
    };
  } catch {
    return null;
  }
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
  const stocks = watchlist
    .filter((s) => s.code)
    .map((s) => ({
      name: s.name as string,
      market: s.market as string,
      symbol: s.market === "KR" ? `${s.code}.KS` : (s.code as string),
    }));

  if (!stocks.length) {
    return NextResponse.json({ success: true, skipped: true, reason: "no watchlist" });
  }

  const results = await Promise.all(
    stocks.map((s) => fetchAndAnalyze(s.symbol, s.name, s.market))
  );
  const signals = results.filter((r): r is StockSignal => r !== null);
  const strong = signals.filter((s) => s.hasStrongSignal);

  if (!strong.length) {
    return NextResponse.json({ success: true, skipped: true, reason: "no strong signals" });
  }

  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  let msg = `📉 기술적 분석 리포트\n📅 ${today}\n━━━━━━━━━━━━━━━━\n\n`;

  msg += "🔎 지표가 기준선을 넘은 종목\n\n";
  for (const s of strong) {
    msg += `${s.flag} ${s.name} (${s.price}, ${s.priceChange})\n`;
    msg += `   RSI: ${s.rsi} ${s.rsiEmoji} ${s.rsiSignal}\n`;
    msg += `   MACD: ${s.macdEmoji} ${s.macdSignal}\n\n`;
  }

  msg += "📊 전체 종목 현황\n\n";
  for (const s of signals) {
    msg += `${s.flag} ${s.name}: RSI ${s.rsi} ${s.rsiEmoji} | MACD ${s.macdEmoji} ${s.macdSignal}\n`;
  }

  msg += "\nℹ️ 공개 시세로 계산한 지표를 정리한 정보이며 투자 권유가 아닙니다.";

  await sendTelegramMessage(msg, { html: false });
  return NextResponse.json({ success: true, strongCount: strong.length });
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
