import test, { after, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { createSessionState, jsonRequest, readJson } from "@/test/api-helpers";

const session = createSessionState("user-1");
mock.module("@/lib/session", { namedExports: session.namedExports });

// ── fetch 스텁 ────────────────────────────────
type Stub = { name: string; match: (url: string) => boolean; respond: () => Response | Promise<Response> };

let stubs: Stub[] = [];
let fetchCalls: string[] = [];
const realFetch = globalThis.fetch;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

function textResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { ...init, headers: { "content-type": "text/plain" } });
}

const naverEtfList = {
  result: {
    etfItemList: [
      { itemcode: "305050", itemname: "KODEX 200", nowVal: 57490, changeVal: 100, changeRate: 0.17, quant: 1_000_000, amount: 57_000_000_000 },
      { itemcode: "458730", itemname: "TIGER US BOND 10Y", nowVal: 14635, changeVal: -35, changeRate: -0.24, quant: 300_000, amount: 4_000_000_000 },
      { itemcode: "319640", itemname: "TIGER GOLD", nowVal: 27810, changeVal: 210, changeRate: 0.76, quant: 500_000, amount: 9_000_000_000 },
    ],
  },
};

const yahooCandles = {
  chart: {
    result: [
      {
        timestamp: [1_762_000_000, 1_762_086_400, 1_762_172_800],
        indicators: {
          quote: [
            {
              open: [57000.4, 57200.6, null],
              high: [57600.2, 57400.9, 58000.1],
              low: [56800.1, 56900.4, 57500.3],
              close: [57490.7, 57100.2, 57900.8],
              volume: [1000.4, 2000.6, 3000.9],
            },
          ],
        },
      },
    ],
    error: null,
  },
};

const googleNewsRss = `<?xml version="1.0"?><rss><channel>
<item><title>ETF 시장 &amp; 자금 유입</title><link>https://news.example.com/a</link><pubDate>Mon, 16 Nov 2026 09:00:00 GMT</pubDate><source>예시뉴스</source></item>
<item><title>두 번째 기사</title><link>https://news.example.com/b</link><pubDate>Sun, 15 Nov 2026 09:00:00 GMT</pubDate><source>예시뉴스</source></item>
</channel></rss>`;

before(() => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push(url);
    const matches = stubs.filter((item) => item.match(url));
    const stub = matches[matches.length - 1];
    if (!stub) throw new Error(`준비되지 않은 요청: ${url}`);
    return stub.respond();
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  fetchCalls = [];
});

function stub(name: string, match: string, respond: () => Response | Promise<Response>) {
  stubs = stubs.filter((item) => item.name !== name);
  stubs.push({ name, match: (url) => url.includes(match), respond });
}

// ── /api/market/search ───────────────────────
test("search: ETF 목록을 거래량 순으로 돌려주고 카테고리를 추론한다", async () => {
  const { GET } = await import("@/app/api/market/search/route");
  stub("naver", "etfItemList", () => jsonResponse(naverEtfList));

  const response = await GET(new Request("https://pension.test/api/market/search"));
  assert.equal(response.status, 200);

  const body = await readJson<{ etfs: { code: string; name: string; category: string }[] }>(response);
  assert.equal(body.etfs.length, 3);
  assert.equal(body.etfs[0].code, "305050");
  assert.equal(body.etfs[0].category, "코스피");
  assert.equal(body.etfs.find((e) => e.code === "458730")?.category, "채권");
  assert.equal(body.etfs.find((e) => e.code === "319640")?.category, "금");
});

test("search: 5분 캐시가 살아 있으면 다시 요청하지 않는다", async () => {
  const { GET } = await import("@/app/api/market/search/route");
  fetchCalls = [];

  await GET(new Request("https://pension.test/api/market/search?q=KODEX"));
  assert.equal(fetchCalls.filter((url) => url.includes("etfItemList")).length, 0, "캐시 사용 기대");
});

test("search: 코드·이름으로 검색하고 정렬한다", async () => {
  const { GET } = await import("@/app/api/market/search/route");

  const byName = await GET(new Request("https://pension.test/api/market/search?q=gold"));
  const byNameBody = await readJson<{ etfs: { code: string }[] }>(byName);
  assert.deepEqual(byNameBody.etfs.map((e) => e.code), ["319640"]);

  const byCode = await GET(new Request("https://pension.test/api/market/search?q=458730"));
  const byCodeBody = await readJson<{ etfs: { code: string }[] }>(byCode);
  assert.deepEqual(byCodeBody.etfs.map((e) => e.code), ["458730"]);

  const sorted = await GET(new Request("https://pension.test/api/market/search?sort=name"));
  const sortedBody = await readJson<{ etfs: { name: string }[] }>(sorted);
  const names = sortedBody.etfs.map((e) => e.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

// ── /api/market/volume ───────────────────────
test("volume: 거래량 상위 10개를 순위와 함께 돌려준다", async () => {
  const { GET } = await import("@/app/api/market/volume/route");
  stub("naver-volume", "etfItemList", () => jsonResponse(naverEtfList));

  const response = await GET();
  assert.equal(response.status, 200);

  const body = await readJson<{ etfs: { rank: number; code: string; volume: number }[] }>(response);
  assert.equal(body.etfs.length, 3);
  assert.deepEqual(body.etfs.map((e) => e.rank), [1, 2, 3]);
  assert.deepEqual(body.etfs.map((e) => e.code), ["305050", "319640", "458730"]);
});

test("volume: 상류 응답이 실패하면 500과 빈 목록", async () => {
  const { GET } = await import("@/app/api/market/volume/route");
  stub("naver-volume", "etfItemList", () => textResponse("nope", { status: 503 }));

  const response = await GET();
  assert.equal(response.status, 500);
  const body = await readJson<{ etfs: unknown[]; error: string }>(response);
  assert.deepEqual(body.etfs, []);
  assert.match(body.error, /실패/);
});

test("volume: 목록이 비면 500", async () => {
  const { GET } = await import("@/app/api/market/volume/route");
  stub("naver-volume", "etfItemList", () => jsonResponse({ result: { etfItemList: [] } }));

  const response = await GET();
  assert.equal(response.status, 500);
  assert.match((await readJson<{ error: string }>(response)).error, /데이터 없음/);
});

// ── /api/market/indices ──────────────────────
test("indices: 야후 응답을 지수 5개로 정리한다", async () => {
  const { GET } = await import("@/app/api/market/indices/route");
  stub("yahoo-index", "finance.yahoo.com/v8/finance/chart", () =>
    jsonResponse({
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 2650.12,
              chartPreviousClose: 2640,
              regularMarketChange: 10.12,
              regularMarketChangePercent: 0.38,
            },
          },
        ],
      },
    })
  );

  const response = await GET();
  assert.equal(response.status, 200);

  const body = await readJson<{ indices: { id: string; value: string; change: number; changePct: number }[] }>(response);
  assert.equal(body.indices.length, 5);
  assert.deepEqual(body.indices.map((i) => i.id), ["KOSPI", "KOSDAQ", "SP500", "NASDAQ", "GOLD"]);
  assert.equal(body.indices[0].value, "2,650.12");
  assert.equal(body.indices[0].change, 10.12);
  assert.equal(body.indices[0].changePct, 0.38);
});

test("indices: 야후가 실패하면 값은 --, 변동은 0", async () => {
  const { GET } = await import("@/app/api/market/indices/route");
  stub("yahoo-index", "finance.yahoo.com/v8/finance/chart", () => textResponse("down", { status: 500 }));

  const body = await readJson<{ indices: { value: string; change: number; changePct: number }[] }>(await GET());
  for (const index of body.indices) {
    assert.equal(index.value, "--");
    assert.equal(index.change, 0);
    assert.equal(index.changePct, 0);
  }
});

// ── /api/market/candles ──────────────────────
test("candles: 종목번호가 없으면 400", async () => {
  const { GET } = await import("@/app/api/market/candles/route");
  const response = await GET(new Request("https://pension.test/api/market/candles"));
  assert.equal(response.status, 400);
});

test("candles: 야후 차트를 캔들로 변환하고 null 봉은 버린다", async () => {
  const { GET } = await import("@/app/api/market/candles/route");
  stub("yahoo-chart", "finance.yahoo.com/v8/finance/chart", () => jsonResponse(yahooCandles));

  const response = await GET(new Request("https://pension.test/api/market/candles?code=305050"));
  assert.equal(response.status, 200);

  const body = await readJson<{
    code: string;
    symbol: string;
    period: string;
    candles: { date: string; open: number; close: number; volume: number }[];
  }>(response);

  assert.equal(body.code, "305050");
  assert.equal(body.symbol, "305050.KS");
  assert.equal(body.period, "day");
  assert.equal(body.candles.length, 2, "null 봉 제외");
  assert.equal(body.candles[0].open, 57000);
  assert.equal(body.candles[0].close, 57491);
  assert.equal(body.candles[0].volume, 1000);
  assert.match(body.candles[0].date, /^\d{4}-\d{2}-\d{2}$/);
});

test("candles: 점이 있는 종목번호는 심볼을 그대로 쓴다", async () => {
  const { GET } = await import("@/app/api/market/candles/route");
  stub("yahoo-chart", "finance.yahoo.com/v8/finance/chart", () => jsonResponse(yahooCandles));

  const body = await readJson<{ symbol: string }>(
    await GET(new Request("https://pension.test/api/market/candles?code=005930.KS"))
  );
  assert.equal(body.symbol, "005930.KS");
});

test("candles: 국내 접미사가 빈 응답이면 원본 심볼로 재시도한다", async () => {
  const { GET } = await import("@/app/api/market/candles/route");
  stub("yahoo-chart", "finance.yahoo.com/v8/finance/chart", () => jsonResponse({ chart: { result: [{ timestamp: [] }] } }));

  const empty = await readJson<{ candles: unknown[] }>(
    await GET(new Request("https://pension.test/api/market/candles?code=TSLA"))
  );
  // 모든 후보가 비면 502 응답이지만, 호출 순서는 .KS → .KQ → TSLA
  assert.deepEqual(empty.candles, []);
  const tried = fetchCalls.map((url) => decodeURIComponent(url.split("/chart/")[1]?.split("?")[0] ?? ""));
  assert.deepEqual(tried, ["TSLA.KS", "TSLA.KQ", "TSLA"]);
});

test("candles: 모든 후보 심볼이 실패하면 502", async () => {
  const { GET } = await import("@/app/api/market/candles/route");
  stub("yahoo-chart", "finance.yahoo.com/v8/finance/chart", () => textResponse("down", { status: 500 }));

  const response = await GET(new Request("https://pension.test/api/market/candles?code=305050"));
  assert.equal(response.status, 502);
  const body = await readJson<{ error: string; candles: unknown[] }>(response);
  assert.deepEqual(body.candles, []);
  assert.match(body.error, /차트 데이터/);
});

// ── /api/market/news ─────────────────────────
test("news: RSS에서 제목·링크·출처·날짜를 뽑는다", async () => {
  const { GET } = await import("@/app/api/market/news/route");
  stub("google-news", "news.google.com/rss/search", () => textResponse(googleNewsRss));

  const response = await GET(new Request("https://pension.test/api/market/news?q=%EC%A0%80%EB%B6%84%EB%B0%B0%EB%8B%B9"));
  assert.equal(response.status, 200);

  const body = await readJson<{ news: { title: string; link: string; source: string; date: string }[] }>(response);
  assert.equal(body.news.length, 2);
  assert.equal(body.news[0].title, "ETF 시장 & 자금 유입");
  assert.equal(body.news[0].link, "https://news.example.com/a");
  assert.equal(body.news[0].source, "예시뉴스");
  // 시각은 로컬 시간대에 따라 달라지고, 라우트는 시(hour)를 0으로 채우지 않는다
  assert.match(body.news[0].date, /^11\/16 \d{1,2}:\d{2}$/);
});

test("news: RSS가 실패하면 500과 빈 목록", async () => {
  const { GET } = await import("@/app/api/market/news/route");
  stub("google-news", "news.google.com/rss/search", () => textResponse("no", { status: 500 }));

  const response = await GET(new Request("https://pension.test/api/market/news"));
  assert.equal(response.status, 500);
  assert.deepEqual(await readJson(response), { news: [], error: "조회 실패" });
});

// ── /api/market/etf-dividend ─────────────────
test("etf-dividend: 코드가 없으면 빈 목록", async () => {
  const { GET } = await import("@/app/api/market/etf-dividend/route");
  const body = await readJson<{ distributions: unknown[] }>(await GET(jsonRequest("GET")));
  assert.deepEqual(body.distributions, []);
  assert.equal(fetchCalls.length, 0);
});

test("etf-dividend: 분배금 이력을 날짜·금액으로 정리한다", async () => {
  const { GET } = await import("@/app/api/market/etf-dividend/route");
  stub("naver-dividend", "dividendHistory/list", () =>
    jsonResponse({
      result: {
        totalCount: 3,
        result: [
          { dividendAmount: 446, exDividendAt: "2026.04.29", dividendYield: 0.3 },
          { dividendAmount: 0, exDividendAt: "2026.01.02" },
          { dividendAmount: 120, exDividendAt: "" },
        ],
      },
    })
  );

  const body = await readJson<{ distributions: { date: string; perShareAmount: number }[] }>(
    await GET(new Request("https://pension.test/api/market/etf-dividend?code=305050"))
  );
  assert.deepEqual(body.distributions, [{ date: "2026-04-29", perShareAmount: 446 }]);
});

test("etf-dividend: 상류가 실패하면 빈 목록", async () => {
  const { GET } = await import("@/app/api/market/etf-dividend/route");
  stub("naver-dividend", "dividendHistory/list", () => textResponse("no", { status: 500 }));

  const body = await readJson<{ distributions: unknown[] }>(await GET(jsonRequest("GET")));
  assert.deepEqual(body.distributions, []);
});
