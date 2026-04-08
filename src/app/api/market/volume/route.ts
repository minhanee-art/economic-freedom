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

  // EUC-KR 인코딩 처리
  const buffer = await res.arrayBuffer();
  const decoder = new TextDecoder("euc-kr");
  const text = decoder.decode(buffer);
  const data = JSON.parse(text);

  const items: Record<string, unknown>[] =
    data?.result?.etfItemList ?? [];

  if (items.length === 0) throw new Error("ETF 데이터 없음");

  const sorted = items
    .sort((a, b) => Number(b.quant ?? 0) - Number(a.quant ?? 0))
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
