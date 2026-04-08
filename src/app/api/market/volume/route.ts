import { NextResponse } from "next/server";

interface VolumeETF {
  rank: number;
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
}

/** ETF 거래량 상위 종목 조회 */
export async function GET() {
  try {
    const etfs = await fetchTopVolumeETFs();
    return NextResponse.json({ etfs });
  } catch (err) {
    return NextResponse.json(
      { etfs: [], error: (err as Error).message },
      { status: 500 }
    );
  }
}

async function fetchTopVolumeETFs(): Promise<VolumeETF[]> {
  // 네이버 금융 ETF 전체 목록 (파라미터 없이 호출해야 동작)
  const res = await fetch(
    "https://finance.naver.com/api/sise/etfItemList.nhn",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!res.ok) throw new Error("네이버 API 응답 실패");

  const data = await res.json();
  const items: Record<string, unknown>[] =
    data?.result?.etfItemList ?? [];

  if (items.length === 0) throw new Error("ETF 데이터 없음");

  // 거래량순 정렬 후 상위 10개
  const sorted = items
    .sort(
      (a, b) => Number(b.quant ?? 0) - Number(a.quant ?? 0)
    )
    .slice(0, 10);

  return sorted.map((item, i) => ({
    rank: i + 1,
    code: String(item.itemcode ?? ""),
    name: String(item.itemname ?? ""),
    price: Number(item.nowVal ?? 0),
    change: Number(item.changeVal ?? 0),
    changePct: Number(item.changeRate ?? 0),
    volume: Number(item.quant ?? 0),
  }));
}
