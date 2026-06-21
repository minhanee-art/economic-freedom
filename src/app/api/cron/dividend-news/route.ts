// 매일 09:00, 18:00 KST 배당 관련 뉴스 수집 후 GPT 분석 → 텔레그램 전송
import { NextResponse, type NextRequest } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEYWORDS = [
  "KEPCO 배당",
  "한국전력 배당",
  "삼성전자 배당",
  "SK하이닉스 배당",
  "Realty Income dividend",
  "MAIN dividend",
  "배당금 인상",
  "중간배당",
  "결산배당",
  "배당수익률",
  "dividend increase 2026",
];

interface NewsItem {
  title: string;
  date: string;
  keyword: string;
}

function parseRss(xml: string, keyword: string, cutoff: Date): NewsItem[] {
  const items: NewsItem[] = [];
  const parts = xml.split("<item>");
  for (let i = 1; i < Math.min(parts.length, 4); i++) {
    const block = parts[i];
    const titleMatch =
      block.match(/<title><!\[CDATA\[(.+?)\]\]><\/title>/) ||
      block.match(/<title>(.+?)<\/title>/);
    const dateMatch = block.match(/<pubDate>(.+?)<\/pubDate>/);
    if (!titleMatch) continue;
    const title = titleMatch[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    const pubDate = dateMatch ? new Date(dateMatch[1]) : new Date();
    if (pubDate >= cutoff) {
      items.push({
        title,
        date: pubDate.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }),
        keyword,
      });
    }
  }
  return items;
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const qs = request.nextUrl.searchParams.get("secret");
  if (!secret || (auth !== `Bearer ${secret}` && qs !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 키워드별 RSS 병렬 조회
  const rssResults = await Promise.allSettled(
    KEYWORDS.map((kw) =>
      fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(kw)}&hl=ko&gl=KR&ceid=KR:ko`,
        { signal: AbortSignal.timeout(8000) }
      )
        .then((r) => r.text())
        .then((xml) => parseRss(xml, kw, cutoff))
    )
  );

  // 중복 제거 + 최대 10개
  const seen = new Set<string>();
  const allNews: NewsItem[] = [];
  for (const result of rssResults) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      if (!seen.has(item.title)) {
        seen.add(item.title);
        allNews.push(item);
        if (allNews.length >= 10) break;
      }
    }
    if (allNews.length >= 10) break;
  }

  // 뉴스 없으면 조용히 종료
  if (allNews.length === 0) {
    return NextResponse.json({ success: true, skipped: true, reason: "no news" });
  }

  const newsList = allNews.map((n) => `- ${n.title} (${n.date})`).join("\n");

  // GPT-4o-mini 분석
  const openaiKey = process.env.OPENAI_API_KEY;
  let analysis = "(AI 분석 불가)";
  if (openaiKey) {
    try {
      const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content:
                "너는 한국 배당투자 전문 애널리스트야. 아래 최신 뉴스 헤드라인들을 분석해서 배당 투자 관점에서 상위 5개 오늘의 주목 종목을 추천해줘. 형식: 1. 종목명 - 감정점수/10 - 한줄 이유. 이모지 써서 보기 좋게.\n\n[오늘의 뉴스]\n" +
                newsList,
            },
          ],
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (gptRes.ok) {
        const gptData = await gptRes.json() as { choices: { message: { content: string } }[] };
        analysis = gptData.choices[0]?.message?.content?.trim() ?? analysis;
      }
    } catch { /* GPT 실패해도 계속 */ }
  }

  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const msg =
    `🍀 배당 뉴스 알림\n📅 ${today}\n━━━━━━━━━━━━━━━━\n\n` +
    `📰 오늘의 배당 뉴스 (${allNews.length}건)\n${newsList}\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `💡 AI 배당 종목 추천\n${analysis}\n\n` +
    `⚠️ 투자 참고용이며 매매 권유가 아닙니다.`;

  await sendTelegramMessage(msg, { html: false });
  return NextResponse.json({ success: true, newsCount: allNews.length });
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
