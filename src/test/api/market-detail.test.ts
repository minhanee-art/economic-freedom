import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { readJson } from "@/test/api-helpers";

// ── fetch 스텁 ────────────────────────────────
const realFetch = globalThis.fetch;
let stubs: { match: string; respond: () => Response }[] = [];
let fetchCalls: string[] = [];

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json" },
  });
}

before(() => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push(url);
    const matches = stubs.filter((item) => url.includes(item.match));
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
  stubs = [];
});

function stub(match: string, respond: () => Response) {
  stubs.push({ match, respond });
}

const integration = {
  stockName: "KODEX 200",
  description: "코스피 200 지수를 추종합니다.<br>국내 대표 ETF",
  etfKeyIndicator: {
    issuerName: "삼성자산운용",
    totalFee: 0.15,
    dividendYieldTtm: 1.2,
    nav: "57,480.12",
    marketValue: "5조 2,000억",
    returnRate1m: 2.5,
    returnRate3m: 8.1,
    returnRate1y: 14.3,
  },
  industryCompareInfo: [
    { itemCode: "069500", stockName: "KODEX 200", closePrice: "57,490" },
    { itemCode: "102110", stockName: "TIGER 200", closePrice: "57,500" },
    { itemCode: "a", stockName: "b", closePrice: "1" },
    { itemCode: "c", stockName: "d", closePrice: "2" },
    { itemCode: "e", stockName: "f", closePrice: "3" },
    { itemCode: "g", stockName: "h", closePrice: "4" },
  ],
};

const components = {
  result: {
    totalWeight: 92.5,
    items: [
      { itemCode: "005930", itemName: "삼성전자", weight: 22.1 },
      { itemCode: "000660", itemName: "SK하이닉스", weight: 18.4 },
    ],
  },
};

async function getDetail(query: string) {
  const { GET } = await import("@/app/api/market/detail/route");
  return GET(new Request(`https://pension.test/api/market/detail${query}`));
}

test("detail: codes가 없으면 빈 객체", async () => {
  const body = await readJson<{ details: Record<string, unknown> }>(await getDetail(""));
  assert.deepEqual(body.details, {});
  assert.equal(fetchCalls.length, 0);
});

test("detail: 통합 정보와 구성종목을 정리해 돌려준다", async () => {
  stub("m.stock.naver.com/api/stock/305050/integration", () => jsonResponse(integration));
  stub("m.stock.naver.com/front-api/stock/domestic/etf/component/list", () => jsonResponse(components));

  const body = await readJson<{
    details: Record<string, {
      name: string;
      description: string;
      issuer: string;
      totalFee: number;
      dividendYield: number;
      similarETFs: unknown[];
      components: { code: string; name: string; weight: number }[];
      componentTotalWeight: number;
    }>;
  }>(await getDetail("?codes=305050"));

  const detail = body.details["305050"];
  assert.equal(detail.name, "KODEX 200");
  assert.equal(detail.issuer, "삼성자산운용");
  assert.equal(detail.totalFee, 0.15);
  assert.equal(detail.dividendYield, 1.2);
  assert.match(detail.description, /\n/, "<br>을 줄바꿈으로 바꾼다");
  assert.equal(detail.similarETFs.length, 5, "유사종목은 5개로 자른다");
  assert.deepEqual(detail.components.map((item) => item.code), ["005930", "000660"]);
  assert.equal(detail.componentTotalWeight, 92.5);
});

test("detail: 코드가 5개를 넘으면 5개만 조회한다", async () => {
  stub("m.stock.naver.com/api/stock/", () => jsonResponse(integration));
  stub("component/list", () => jsonResponse(components));

  const response = await getDetail("?codes=1,2,3,4,5,6,7");
  const body = await readJson<{ details: Record<string, unknown> }>(response);
  assert.equal(Object.keys(body.details).length, 5);
  assert.equal(
    fetchCalls.filter((url) => url.includes("/integration")).length,
    5
  );
});

test("detail: 상류가 실패한 코드는 결과에서 빠진다", async () => {
  stub("m.stock.naver.com/api/stock/", () => jsonResponse({}, { status: 500 }));

  const body = await readJson<{ details: Record<string, unknown> }>(await getDetail("?codes=305050"));
  assert.deepEqual(body.details, {});
});

test("detail: 구성종목 API가 실패해도 상세는 빈 구성종목으로 돌려준다", async () => {
  stub("m.stock.naver.com/api/stock/", () => jsonResponse(integration));
  stub("component/list", () => jsonResponse({}, { status: 500 }));

  const body = await readJson<{ details: Record<string, { components: unknown[]; componentTotalWeight: number }> }>(
    await getDetail("?codes=305050")
  );
  assert.deepEqual(body.details["305050"].components, []);
  assert.equal(body.details["305050"].componentTotalWeight, 0);
});

test("detail: 설명은 200자로 자른다", async () => {
  stub("m.stock.naver.com/api/stock/", () =>
    jsonResponse({ ...integration, description: "가".repeat(500) })
  );
  stub("component/list", () => jsonResponse(components));

  const body = await readJson<{ details: Record<string, { description: string }> }>(
    await getDetail("?codes=305050")
  );
  assert.equal(body.details["305050"].description.length, 200);
});
