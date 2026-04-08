import { NextResponse } from "next/server";

interface PriceResult {
  prices: Record<string, number>;
  errors: string[];
}

/**
 * 네이버 금융 API를 통해 ETF/주식 현재가를 조회합니다.
 * POST { codes: ["305050", "354500", ...] }
 */
export async function POST(request: Request) {
  try {
    const { codes } = (await request.json()) as { codes: string[] };

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json(
        { error: "codes 배열이 필요합니다" },
        { status: 400 }
      );
    }

    // 최대 30개 제한
    const targetCodes = codes.slice(0, 30);
    const result = await fetchNaverPrices(targetCodes);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

async function fetchNaverPrices(codes: string[]): Promise<PriceResult> {
  const prices: Record<string, number> = {};
  const errors: string[] = [];

  // 네이버 시세 API (JSON) — 개별 종목 조회
  // polling API: 실시간 호가 데이터 JSON
  const promises = codes.map(async (code) => {
    try {
      const price = await fetchSinglePrice(code);
      if (price !== null) {
        prices[code] = price;
      } else {
        errors.push(`${code}: 가격 조회 실패`);
      }
    } catch {
      errors.push(`${code}: 네트워크 오류`);
    }
  });

  await Promise.all(promises);
  return { prices, errors };
}

async function fetchSinglePrice(code: string): Promise<number | null> {
  // 방법 1: 네이버 금융 polling API (JSON)
  try {
    const url = `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const raw = data?.datas?.[0]?.closePriceRaw ?? data?.datas?.[0]?.closePrice;
      if (raw) return Number(String(raw).replace(/,/g, ""));
    }
  } catch {
    // 방법 1 실패 → 방법 2로
  }

  // 방법 2: 네이버 금융 시세 조회 API
  try {
    const url = `https://m.stock.naver.com/api/stock/${code}/basic`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const price =
        data?.currentPrice ?? data?.stockEndPrice ?? data?.closePrice;
      if (price) return Number(price);
    }
  } catch {
    // 방법 2도 실패
  }

  // 방법 3: KRX 간접 조회 (ETF 전용)
  try {
    const url = `https://finance.naver.com/item/sise.naver?code=${code}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const html = await res.text();
      // 현재가 파싱: <strong>57,490</strong> 패턴
      const match = html.match(
        /현재가[^<]*<[^>]*>[^<]*<strong[^>]*>([\d,]+)<\/strong>/
      );
      if (match) {
        return Number(match[1].replace(/,/g, ""));
      }

      // 대체 패턴: id="_nowVal"
      const match2 = html.match(/id="_nowVal"[^>]*>([\d,]+)</);
      if (match2) {
        return Number(match2[1].replace(/,/g, ""));
      }

      // 대체 패턴: 종가 td_close
      const match3 = html.match(
        /class="no_today"[^>]*>[\s\S]*?<span[^>]*>([\d,]+)<\/span>/
      );
      if (match3) {
        return Number(match3[1].replace(/,/g, ""));
      }
    }
  } catch {
    // 모든 방법 실패
  }

  return null;
}
