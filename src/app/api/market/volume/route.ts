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
  } catch {
    return NextResponse.json({ etfs: [], error: "조회 실패" }, { status: 500 });
  }
}

async function fetchTopVolumeETFs(): Promise<VolumeETF[]> {
  // 네이버 금융 ETF 거래량 순
  const url =
    "https://finance.naver.com/api/sise/etfItemList.nhn?etfType=0&targetColumn=quant&sortOrder=desc";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error("네이버 API 실패");

  const data = await res.json();
  const items = data?.result?.etfItemList ?? [];

  return items.slice(0, 10).map((item: Record<string, unknown>, i: number) => ({
    rank: i + 1,
    code: String(item.itemcode ?? ""),
    name: String(item.itemname ?? ""),
    price: Number(item.nowVal ?? 0),
    change: Number(item.changeVal ?? 0),
    changePct: Number(item.changeRate ?? 0),
    volume: Number(item.quant ?? 0),
  }));
}
