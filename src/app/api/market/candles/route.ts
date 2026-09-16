import { NextResponse } from "next/server";

type CandlePeriod = "day" | "week" | "month" | "year";

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface YahooChartResponse {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: {
        quote?: {
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }[];
      };
    }[];
    error?: { description?: string } | null;
  };
}

const PERIOD_CONFIG: Record<CandlePeriod, { range: string; interval: string; limit: number }> = {
  day: { range: "3mo", interval: "1d", limit: 36 },
  week: { range: "1y", interval: "1wk", limit: 36 },
  month: { range: "5y", interval: "1mo", limit: 48 },
  year: { range: "10y", interval: "1mo", limit: 10 },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCode = searchParams.get("code") ?? "";
  const period = parsePeriod(searchParams.get("period"));
  const code = rawCode.trim().replace(/[^0-9A-Za-z.]/g, "");

  if (!code) {
    return NextResponse.json({ error: "종목번호가 필요합니다." }, { status: 400 });
  }

  const config = PERIOD_CONFIG[period];
  const symbols = buildYahooSymbols(code);

  for (const symbol of symbols) {
    try {
      const candles = await fetchYahooCandles(symbol, config.range, config.interval);
      const normalized = period === "year" ? aggregateYearlyCandles(candles) : candles;
      const sliced = normalized.slice(-config.limit);
      if (sliced.length > 0) {
        return NextResponse.json({ code, symbol, period, candles: sliced });
      }
    } catch {
      // 다음 심볼 후보로 재시도
    }
  }

  return NextResponse.json(
    { error: "차트 데이터를 가져오지 못했습니다.", code, period, candles: [] },
    { status: 502 }
  );
}

function parsePeriod(value: string | null): CandlePeriod {
  if (value === "week" || value === "month" || value === "year") return value;
  return "day";
}

function buildYahooSymbols(code: string): string[] {
  if (code.includes(".")) return [code];
  return [`${code}.KS`, `${code}.KQ`, code];
}

async function fetchYahooCandles(symbol: string, range: string, interval: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    next: { revalidate: 60 * 15 },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error("Yahoo chart API failed");

  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) return [];

  return timestamps
    .map((timestamp, index) => {
      const open = quote.open?.[index];
      const high = quote.high?.[index];
      const low = quote.low?.[index];
      const close = quote.close?.[index];
      if (open == null || high == null || low == null || close == null) return null;
      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        open: Math.round(open),
        high: Math.round(high),
        low: Math.round(low),
        close: Math.round(close),
        volume: Math.max(0, Math.round(quote.volume?.[index] ?? 0)),
      };
    })
    .filter((candle): candle is Candle => candle !== null);
}

function aggregateYearlyCandles(candles: Candle[]): Candle[] {
  const yearly = new Map<string, Candle>();

  for (const candle of candles) {
    const year = candle.date.slice(0, 4);
    const existing = yearly.get(year);
    if (!existing) {
      yearly.set(year, { ...candle, date: year });
      continue;
    }

    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
  }

  return [...yearly.values()].sort((a, b) => a.date.localeCompare(b.date));
}
