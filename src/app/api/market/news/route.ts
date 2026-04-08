import { NextResponse } from "next/server";

interface NewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
}

/** ETF 관련 뉴스 조회 (Google News RSS) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "ETF";

  try {
    const news = await fetchGoogleNews(query);
    return NextResponse.json({ news });
  } catch {
    return NextResponse.json({ news: [], error: "조회 실패" }, { status: 500 });
  }
}

async function fetchGoogleNews(query: string): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query + " ETF"
  )}&hl=ko&gl=KR&ceid=KR:ko`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PensionManager/1.0)",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error("Google News RSS 실패");

  const xml = await res.text();
  const news: NewsItem[] = [];

  // RSS XML 파싱 (간단한 정규식)
  const itemPattern = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;

  while (
    (itemMatch = itemPattern.exec(xml)) !== null &&
    news.length < 8
  ) {
    const block = itemMatch[1];

    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    const source = extractTag(block, "source");

    if (title && link) {
      news.push({
        title: cleanHTML(title),
        link,
        source: source || "",
        date: pubDate ? formatDate(pubDate) : "",
      });
    }
  }

  return news;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`)
  );
  if (match) return match[1].trim();

  const match2 = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  );
  return match2 ? match2[1].trim() : "";
}

function cleanHTML(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatDate(pubDate: string): string {
  try {
    const d = new Date(pubDate);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${month}/${day} ${hours}:${mins}`;
  } catch {
    return pubDate;
  }
}
