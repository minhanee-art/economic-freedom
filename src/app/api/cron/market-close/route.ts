// 매일 15:40 KST (평일) KIS + Yahoo Finance 장 마감 리포트 → 텔레그램 전송
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KIS_BASE = "https://openapi.koreainvestment.com:9443";

async function resolveUserId(): Promise<string | null> {
  const directId = process.env.REPORT_USER_ID;
  if (directId) return directId;
  const email = process.env.REPORT_USER_EMAIL;
  if (!email) return null;
  const [row] = await sql`SELECT id FROM users WHERE email = ${email}`;
  return (row?.id as string) ?? null;
}

async function getKisToken(appkey: string, appsecret: string): Promise<string> {
  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", appkey, appsecret }),
  });
  if (!res.ok) throw new Error(`KIS 토큰 발급 실패: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function getKisPrice(
  code: string,
  token: string,
  appkey: string,
  appsecret: string
): Promise<{ price: number; changeRate: number; volume: number } | null> {
  const url = new URL(`${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`);
  url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
  url.searchParams.set("FID_INPUT_ISCD", code);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      appkey,
      appsecret,
      tr_id: "FHKST01010100",
      custtype: "P",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json() as { output?: Record<string, string> };
  const o = data.output;
  if (!o) return null;
  return {
    price: parseInt(o.stck_prpr ?? "0"),
    changeRate: parseFloat(o.prdy_ctrt ?? "0"),
    volume: parseInt(o.acml_vol ?? "0"),
  };
}

async function getYahooPrice(
  symbol: string
): Promise<{ price: number; changeRate: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; regularMarketChangePercent?: number } }[] };
    };
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      price: meta.regularMarketPrice ?? 0,
      changeRate: meta.regularMarketChangePercent ?? 0,
    };
  } catch {
    return null;
  }
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
      // 순차 호출 (KIS API rate limit 고려)
      const krLines: string[] = [];
      for (const s of krStocks) {
        const result = await getKisPrice(s.code as string, token, appkey, appsecret);
        if (!result) continue;
        const sign = result.changeRate >= 0 ? "+" : "";
        const emoji = result.changeRate >= 0 ? "📈" : "📉";
        krLines.push(
          `${emoji} ${s.name}: ${result.price.toLocaleString()}원 (${sign}${result.changeRate.toFixed(2)}%)  거래량: ${result.volume.toLocaleString()}`
        );
      }
      if (krLines.length) {
        msg += `🇰🇷 한국 장 마감\n━━━━━━━━━━━━━━━━\n${krLines.join("\n")}\n`;
      }
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
      usLines.push(
        `${emoji} ${s.name} (${s.code}): $${result.price.toFixed(2)} (${sign}${result.changeRate.toFixed(2)}%)`
      );
    });
    if (usLines.length) {
      msg += `\n🇺🇸 미국 주식 현황\n━━━━━━━━━━━━━━━━\n${usLines.join("\n")}\n`;
    }
  }

  msg += "\n⚠️ 투자 참고용이며 매매 권유가 아닙니다.";

  await sendTelegramMessage(msg);
  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
