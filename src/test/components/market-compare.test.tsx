import test, { after, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";

mock.module("next/navigation", {
  namedExports: {
    useRouter: () => ({ push: () => {}, refresh: () => {}, prefetch: () => {} }),
  },
});

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let CompareClient: typeof import("@/app/dashboard/compare/compare-client").CompareClient;
let MarketClient: typeof import("@/app/dashboard/market/market-client").MarketClient;

const realFetch = globalThis.fetch;
let calls: { url: string; method: string; body: unknown }[] = [];

const ETFS = [
  { code: "360750", name: "TIGER 미국S&P500", price: 24265, change: 255, changePct: 1.06, volume: 23_664_017, tradingValue: 572_731_000_000, category: "미국" },
  { code: "069500", name: "KODEX 200", price: 57490, change: 100, changePct: 0.17, volume: 1_000_000, tradingValue: 57_490_000_000, category: "코스피" },
];

before(async () => {
  setupDom();
  ({ render, screen, fireEvent, cleanup } = await import("@testing-library/react"));
  ({ CompareClient } = await import("@/app/dashboard/compare/compare-client"));
  ({ MarketClient } = await import("@/app/dashboard/market/market-client"));
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  cleanup();
  calls = [];
  window.localStorage.clear();
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method: init?.method ?? "GET", body });
    if (url.startsWith("/api/market/search")) return new Response(JSON.stringify({ etfs: ETFS }));
    if (url === "/api/holdings" && init?.method === "POST") return new Response(JSON.stringify({ holding: { id: "n1" } }), { status: 201 });
    if (url.startsWith("/api/market/indices")) return new Response(JSON.stringify({ indices: [] }));
    if (url.startsWith("/api/market/news")) return new Response(JSON.stringify({ news: [] }));
    if (url === "/api/prices") return new Response(JSON.stringify({ prices: { "360750": 24500 }, errors: [] }));
    return new Response("{}");
  }) as typeof fetch;
});

test("ETF 비교: 상단에 참고 정보·추천 아님 고지, 기본 정렬은 이름순이며 거래량·거래대금은 정렬 기준으로 고를 수 있다", async () => {
  render(<CompareClient holdings={[]} />);
  assert.ok(screen.getByText(/참고 정보이며 종목 추천이 아닙니다/));

  const sort = screen.getByLabelText("정렬") as HTMLSelectElement;
  assert.equal(sort.value, "name");
  assert.deepEqual([...sort.options].map((o) => o.textContent), ["이름순", "거래량 많은 순", "거래대금 많은 순"]);
  await screen.findByText("TIGER 미국S&P500");
  assert.match(calls.find((c) => c.url.startsWith("/api/market/search"))!.url, /sort=name/);

  fireEvent.change(sort, { target: { value: "value" } });
  assert.match(calls.filter((c) => c.url.startsWith("/api/market/search")).at(-1)!.url, /sort=value/);

  // 목록에 거래량·거래대금을 함께 보인다(순위 번호 없음)
  assert.ok(await screen.findByText(/거래대금 5,727억 3,100만원/));
  assert.equal(screen.queryByText(/TOP|순위|인기/), null);
});

test("ETF 비교: '내 종목에 추가'는 현재 계좌에 0주로 추가하고 주문이 아니라고 알린다", async () => {
  render(<CompareClient holdings={[]} />);
  await screen.findByText("TIGER 미국S&P500");
  const add = screen.getByRole("button", { name: "TIGER 미국S&P500을(를) 내 종목 목록에 0주로 추가(주문 아님)" });
  assert.equal(add.textContent, "내 종목에 추가");
  fireEvent.click(add);

  const status = await screen.findByRole("status");
  assert.match(status.textContent ?? "", /종목 목록에 0주로 추가했습니다\. 주문은 실행되지 않습니다\./);
  const post = calls.find((c) => c.url === "/api/holdings" && c.method === "POST")!;
  assert.deepEqual(
    { shares: (post.body as { shares: number }).shares, target: (post.body as { target_pct: number }).target_pct },
    { shares: 0, target: 0 }
  );
});

test("시장 현황: 거래량 순위 목록 없이 주요 지수와 내 보유 종목 시세만, 뉴스는 외부 기사라고 밝힌다", async () => {
  render(
    <MarketClient
      holdings={[
        { id: "h1", code: "360750", name: "TIGER 미국S&P500", shares: 300, currentPrice: 21430 },
        { id: "h2", code: "", name: "코드 없는 종목", shares: 1, currentPrice: 0 },
      ]}
    />
  );
  assert.ok(screen.getByRole("heading", { name: "주요 지수" }));
  assert.ok(screen.getByRole("heading", { name: "내 보유 종목 시세" }));
  assert.equal(screen.queryByText(/거래량 TOP|TOP 10/), null);
  assert.ok(screen.getByText(/종목 추천이 아닙니다/));
  assert.ok(screen.getByText("21,430원"));
  assert.equal(screen.queryByText("코드 없는 종목"), null);
  assert.equal(calls.some((c) => c.url.includes("/api/market/volume")), false);

  fireEvent.click(screen.getByRole("button", { name: "지금 시세 조회" }));
  assert.ok(await screen.findByText("24,500원"));
  assert.ok(screen.getByText("방금 조회"));
  assert.deepEqual(calls.find((c) => c.url === "/api/prices")!.body, { codes: ["360750"] });
});
