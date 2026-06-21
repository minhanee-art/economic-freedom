import { NextResponse } from "next/server";

export interface SearchETF {
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  tradingValue: number; // 거래대금
  category: string;
}

// 전체 ETF 리스트 캐시 (5분)
let cachedList: SearchETF[] = [];
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "volume"; // volume | value | name
  const theme = searchParams.get("theme") || ""; // 테마 필터

  try {
    const allETFs = await getETFList();

    // 5분 캐시 배열을 정렬로 in-place 변형하지 않도록 복사
    let filtered = [...allETFs];

    // 이름/코드 검색
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.code.includes(q)
      );
    }

    // 테마 필터
    if (theme) {
      const t = theme.toLowerCase();
      filtered = filtered.filter((e) =>
        e.name.toLowerCase().includes(t) ||
        e.category.toLowerCase().includes(t)
      );
    }

    // 정렬
    if (sort === "volume") {
      filtered.sort((a, b) => b.volume - a.volume);
    } else if (sort === "value") {
      filtered.sort((a, b) => b.tradingValue - a.tradingValue);
    } else if (sort === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({ etfs: filtered.slice(0, 30) });
  } catch (err) {
    return NextResponse.json(
      { etfs: [], error: (err as Error).message },
      { status: 500 }
    );
  }
}

async function getETFList(): Promise<SearchETF[]> {
  if (cachedList.length > 0 && Date.now() - cacheTime < CACHE_TTL) {
    return cachedList;
  }

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

  if (!res.ok) throw new Error("API 실패");

  const buffer = await res.arrayBuffer();
  const decoder = new TextDecoder("euc-kr");
  const text = decoder.decode(buffer);
  const data = JSON.parse(text);

  const items: Record<string, unknown>[] =
    data?.result?.etfItemList ?? [];

  cachedList = items.map((item) => {
    const name = String(item.itemname ?? "");
    return {
      code: String(item.itemcode ?? ""),
      name,
      price: Number(item.nowVal ?? 0),
      change: Number(item.changeVal ?? 0),
      changePct: Number(item.changeRate ?? 0),
      volume: Number(item.quant ?? 0),
      tradingValue: Number(item.amount ?? 0),
      category: guessCategory(name),
    };
  });

  cacheTime = Date.now();
  return cachedList;
}

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("채권") || n.includes("국채") || n.includes("bond")) return "채권";
  if (n.includes("금") && !n.includes("금융") || n.includes("골드") || n.includes("gold")) return "금";
  if (n.includes("은선물") || n.includes("silver")) return "은";
  if (n.includes("원유") || n.includes("wti") || n.includes("oil")) return "원유";
  if (n.includes("리츠") || n.includes("reit")) return "리츠";
  if (n.includes("배당") || n.includes("dividend")) return "배당";
  if (n.includes("반도체") || n.includes("semi")) return "반도체";
  if (n.includes("2차전지") || n.includes("배터리")) return "2차전지";
  if (n.includes("바이오") || n.includes("헬스")) return "바이오";
  if (n.includes("미국") || n.includes("나스닥") || n.includes("s&p")) return "미국";
  if (n.includes("중국") || n.includes("차이나")) return "중국";
  if (n.includes("일본") || n.includes("니케이")) return "일본";
  if (n.includes("인도") || n.includes("nifty")) return "인도";
  if (n.includes("코스피") || n.includes("kospi") || n.includes("200")) return "코스피";
  if (n.includes("코스닥") || n.includes("kosdaq")) return "코스닥";
  return "기타";
}
