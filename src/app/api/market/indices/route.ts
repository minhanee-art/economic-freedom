// 주요 시장 지수(코스피, 코스닥, S&P500, 나스닥100, 금) 조회 API — Yahoo Finance
import { NextResponse } from "next/server";

export interface IndexData {
  id: string;
  name: string;
  value: string;
  change: number;
  changePct: number;
}

async function fetchYahooIndex(symbol: string): Promise<{ value: string; change: number; changePct: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number; regularMarketChange?: number; regularMarketChangePercent?: number } }[] };
    };
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? 0;
    const prev = meta.chartPreviousClose ?? 0;
    const changePct = meta.regularMarketChangePercent ?? (prev ? (price - prev) / prev * 100 : 0);
    const change = meta.regularMarketChange ?? (price - prev);
    return {
      value: price.toLocaleString("en-US", { maximumFractionDigits: 2 }),
      change,
      changePct,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const INDICES = [
    { id: "KOSPI",  name: "코스피",   symbol: "^KS11"  },
    { id: "KOSDAQ", name: "코스닥",   symbol: "^KQ11"  },
    { id: "SP500",  name: "S&P500",   symbol: "^GSPC"  },
    { id: "NASDAQ", name: "나스닥100", symbol: "^NDX"   },
    { id: "GOLD",   name: "금(GLD)",  symbol: "GC=F"   },
  ];

  const results = await Promise.all(
    INDICES.map(async (idx) => {
      const data = await fetchYahooIndex(idx.symbol);
      return {
        id: idx.id,
        name: idx.name,
        value: data?.value ?? "--",
        change: data?.change ?? 0,
        changePct: data?.changePct ?? 0,
      } satisfies IndexData;
    })
  );

  return NextResponse.json({ indices: results });
}
