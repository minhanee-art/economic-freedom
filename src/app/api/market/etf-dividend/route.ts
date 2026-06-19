// Naver 모바일 API를 통해 ETF 분배금 이력을 조회하는 프록시 라우트
import { NextResponse } from "next/server";

export interface Distribution {
  date: string;        // YYYY-MM-DD
  perShareAmount: number;  // 원 단위
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) return NextResponse.json({ distributions: [] });

  try {
    // 엔드포인트: https://m.stock.naver.com/front-api/stock/domestic/etf/dividendHistory/list
    // 확인된 응답 형식:
    //   { result: { totalCount: 26, result: [{ dividendAmount: 446, exDividendAt: "2026.04.29", dividendYield: 0.3 }, ...] } }
    const res = await fetch(
      `https://m.stock.naver.com/front-api/stock/domestic/etf/dividendHistory/list?code=${code}&page=1&pageSize=100&firstPageSize=3`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return NextResponse.json({ distributions: [] });

    const data = await res.json();

    if (!data?.isSuccess) return NextResponse.json({ distributions: [] });

    const rawList: Array<{ dividendAmount: number; exDividendAt: string }> =
      data?.result?.result ?? [];

    const distributions: Distribution[] = rawList
      .map((item) => {
        // 날짜 형식: "2026.04.29" → "2026-04-29"
        const date = item.exDividendAt?.replace(/\./g, "-") ?? "";
        const perShareAmount = item.dividendAmount ?? 0;
        return { date, perShareAmount };
      })
      .filter((d) => d.date && d.perShareAmount > 0);

    return NextResponse.json({ distributions });
  } catch {
    return NextResponse.json({ distributions: [] });
  }
}
