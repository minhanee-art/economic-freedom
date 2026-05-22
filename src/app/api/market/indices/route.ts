// 주요 시장 지수(코스피, 코스닥, S&P500, 나스닥, 금) 조회 API
import { NextResponse } from "next/server";

export interface IndexData {
  id: string;
  name: string;
  value: string;
  change: number;
  changePct: number;
}

async function fetchNaverIndex(symbol: string): Promise<{ value: string; change: number; changePct: number } | null> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/index/${symbol}/basic`, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      value: String(data.nowVal ?? "--"),
      change: Number(data.fluctuations ?? 0),
      changePct: Number(data.fluctuationsRatio ?? 0),
    };
  } catch {
    return null;
  }
}

async function fetchNaverOverseasIndex(symbol: string): Promise<{ value: string; change: number; changePct: number } | null> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/basic`, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const close = data.closePrice ?? data.stockItemTotalInfos?.find((i: Record<string, string>) => i.key === "현재가")?.value;
    const fluctPct = data.fluctuationsRatio ?? data.stockItemTotalInfos?.find((i: Record<string, string>) => i.key === "등락률")?.value;
    if (!close) return null;
    const pct = parseFloat(String(fluctPct ?? "0").replace(/[^0-9.-]/g, ""));
    return {
      value: String(close),
      change: 0,
      changePct: isNaN(pct) ? 0 : pct,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const INDICES = [
    { id: "KOSPI", name: "코스피", fetch: () => fetchNaverIndex("KOSPI") },
    { id: "KOSDAQ", name: "코스닥", fetch: () => fetchNaverIndex("KOSDAQ") },
    { id: "SP500", name: "S&P500", fetch: () => fetchNaverOverseasIndex("SPY") },
    { id: "NASDAQ", name: "나스닥100", fetch: () => fetchNaverOverseasIndex("QQQ") },
    { id: "GOLD", name: "금(GLD)", fetch: () => fetchNaverOverseasIndex("GLD") },
  ];

  const results = await Promise.all(
    INDICES.map(async (idx) => {
      const data = await idx.fetch();
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
