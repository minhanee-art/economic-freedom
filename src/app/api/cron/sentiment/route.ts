// 매일 08:30 KST 구글 뉴스 수집 → GPT 감정분석 → 텔레그램 전송 cron
import { NextResponse, type NextRequest } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SHEET_BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyHVOzEVtov83161NOGwbIlzjoIWYtHjLjHAdOOZs08o7AJIhEkO14W0g6WOQBa3HQQ3tBzVTDw-8T/pub";

function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals: string[] = [];
    let cur = "";
    let inQ = false;
    for (const c of lines[i]) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { vals.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    vals.push(cur.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] ?? ""; });
    rows.push(obj);
  }
  return rows;
}

async function fetchNewsHeadlines(stockName: string): Promise<string[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(stockName + " stock")}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const xml = await res.text();
    const titles: string[] = [];
    for (const m of xml.matchAll(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g)) {
      const t = m[1].trim();
      if (t && t !== "Google News") titles.push(t);
    }
    return titles.slice(0, 7);
  } catch {
    return [];
  }
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const qs = request.nextUrl.searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 1. 구글 시트에서 종목 목록 가져오기
  const csvRes = await fetch(`${SHEET_BASE}?gid=1874827743&single=true&output=csv`);
  if (!csvRes.ok) throw new Error("구글 시트 요청 실패");
  const rows = parseCsv(await csvRes.text());
  const stocks = rows.filter((r) => r.market === "KR" || r.market === "US");
  if (!stocks.length) return NextResponse.json({ error: "종목 없음" }, { status: 400 });

  // 2. 종목별 뉴스 수집 (병렬)
  const newsResults = await Promise.all(stocks.map((s) => fetchNewsHeadlines(s.name)));
  let newsText = "";
  stocks.forEach((s, i) => {
    const headlines = newsResults[i];
    if (headlines.length) newsText += `[${s.name}] ${headlines.join(" / ")}\n`;
  });
  if (!newsText) throw new Error("수집된 뉴스 없음");

  // 3. GPT 감정분석
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY 환경변수 없음");

  const prompt =
    "너는 한국 배당투자 전문 애널리스트야. 아래 종목별 최신 뉴스 헤드라인을 분석해서 각 종목의 감정 점수(1~10)를 매기고, 상위 5개 오늘의 주목 종목을 추천해줘. 형식: 1. 종목명 - 감정점수/10 - 한줄 이유. 이모지 써서 보기 좋게.\n\n뉴스: " +
    newsText;

  const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
    }),
  });
  if (!gptRes.ok) throw new Error(`OpenAI 오류: ${await gptRes.text()}`);
  const gptData = (await gptRes.json()) as { choices: { message: { content: string } }[] };
  const analysisResult = gptData.choices[0]?.message?.content ?? "분석 결과 없음";

  // 4. 메시지 포맷팅 + 텔레그램 전송
  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const finalMessage = `🧠 AI 감정분석 종목 추천\n📅 ${today}\n━━━━━━━━━━━━━━━━\n\n${analysisResult}\n\n⚠️ 투자 참고용이며 매매 권유가 아닙니다.`;

  await sendTelegramMessage(finalMessage);
  return NextResponse.json({ success: true, stocks: stocks.length });
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
