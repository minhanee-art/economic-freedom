import { NextResponse } from "next/server";

interface NewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
}

/** ETF 관련 뉴스 조회 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "ETF";

  try {
    const news = await fetchNews(query);
    return NextResponse.json({ news });
  } catch {
    return NextResponse.json({ news: [], error: "조회 실패" }, { status: 500 });
  }
}

async function fetchNews(query: string): Promise<NewsItem[]> {
  // 네이버 금융 뉴스 RSS 파싱
  const url = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query + " ETF")}&sort=1&sm=tab_smr`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error("뉴스 조회 실패");

  const html = await res.text();
  const news: NewsItem[] = [];

  // 뉴스 제목+링크 파싱
  const pattern =
    /class="news_tit"[^>]*href="([^"]*)"[^>]*title="([^"]*)"/g;
  let match;
  while ((match = pattern.exec(html)) !== null && news.length < 8) {
    news.push({
      title: decodeHTMLEntities(match[2]),
      link: match[1],
      source: "",
      date: "",
    });
  }

  // 소스/날짜 파싱
  const sourcePattern = /class="info_press"[^>]*>([^<]*)</g;
  let si = 0;
  while ((match = sourcePattern.exec(html)) !== null && si < news.length) {
    news[si].source = match[1].trim();
    si++;
  }

  const datePattern = /class="info"[^>]*>(\d+[^<]*)<\/span>/g;
  let di = 0;
  while ((match = datePattern.exec(html)) !== null && di < news.length) {
    news[di].date = match[1].trim();
    di++;
  }

  return news;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, "");
}
