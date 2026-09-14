import { NextResponse } from "next/server";

export interface ETFDetail {
  code: string;
  name: string;
  description: string;
  issuer: string;
  totalFee: number;
  dividendYield: number;
  nav: string;
  marketValue: string;
  returnRate1m: number;
  returnRate3m: number;
  returnRate1y: number;
  similarETFs: { code: string; name: string; price: string }[];
  components: { code: string; name: string; weight: number }[];
  componentTotalWeight: number;
}

interface NaverEtfComponentItem {
  itemCode?: string;
  itemName?: string;
  weight?: number;
}

async function fetchEtfComponents(code: string) {
  try {
    const res = await fetch(
      `https://m.stock.naver.com/front-api/stock/domestic/etf/component/list?code=${code}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)",
          Referer: `https://m.stock.naver.com/domestic/stock/${code}/total`,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return { components: [], componentTotalWeight: 0 };

    const data = await res.json();
    const result = data.result ?? {};
    const components = ((result.items ?? []) as NaverEtfComponentItem[])
      .slice(0, 15)
      .map((item) => ({
        code: String(item.itemCode ?? ""),
        name: String(item.itemName ?? ""),
        weight: Number(item.weight ?? 0),
      }))
      .filter((item) => item.code || item.name);

    return {
      components,
      componentTotalWeight: Number(result.totalWeight ?? 0),
    };
  } catch {
    return { components: [], componentTotalWeight: 0 };
  }
}

/** ETF 상세 정보 (보수, 수익률, 유사종목) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codes = searchParams.get("codes")?.split(",") ?? [];

  if (codes.length === 0) {
    return NextResponse.json({ details: {} });
  }

  const details: Record<string, ETFDetail> = {};

  await Promise.all(
    codes.slice(0, 5).map(async (code) => {
      try {
        const res = await fetch(
          `https://m.stock.naver.com/api/stock/${code}/integration`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)",
            },
            signal: AbortSignal.timeout(5000),
          }
        );

        if (!res.ok) return;
        const data = await res.json();

        const etf = data.etfKeyIndicator ?? {};
        const similar = (data.industryCompareInfo ?? [])
          .slice(0, 5)
          .map((s: Record<string, unknown>) => ({
            code: String(s.itemCode ?? ""),
            name: String(s.stockName ?? ""),
            price: String(s.closePrice ?? ""),
          }));
        const { components, componentTotalWeight } = await fetchEtfComponents(code);

        details[code] = {
          code,
          name: String(data.stockName ?? ""),
          description: String(data.description ?? "").replace(/<br>/g, "\n").slice(0, 200),
          issuer: String(etf.issuerName ?? "-"),
          totalFee: Number(etf.totalFee ?? 0),
          dividendYield: Number(etf.dividendYieldTtm ?? 0),
          nav: String(etf.nav ?? "-"),
          marketValue: String(etf.marketValue ?? "-"),
          returnRate1m: Number(etf.returnRate1m ?? 0),
          returnRate3m: Number(etf.returnRate3m ?? 0),
          returnRate1y: Number(etf.returnRate1y ?? 0),
          similarETFs: similar,
          components,
          componentTotalWeight,
        };
      } catch {
        // skip
      }
    })
  );

  return NextResponse.json({ details });
}
