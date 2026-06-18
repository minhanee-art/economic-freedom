// Yahoo Finance 주가 조회 헬퍼
export async function getYahooPrice(
  symbol: string
): Promise<{ price: number; changeRate: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }[] };
    };
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? 0;
    const prev = meta.chartPreviousClose ?? 0;
    const changeRate = prev ? ((price - prev) / prev * 100) : 0;
    return { price, changeRate };
  } catch {
    return null;
  }
}
