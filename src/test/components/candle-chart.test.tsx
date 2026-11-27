import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";
import type { CandlePoint } from "@/components/portfolio/rebalance-alert";
import type { HoldingWithPnL } from "@/types";

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let HoldingCandlePanel: typeof import("@/components/portfolio/rebalance-alert").HoldingCandlePanel;

const realFetch = globalThis.fetch;
let fetchUrls: string[] = [];
let candleResponse: { ok: boolean; body: unknown } = { ok: true, body: { candles: [] } };

before(async () => {
  setupDom();
  const rtl = await import("@testing-library/react");
  render = rtl.render;
  screen = rtl.screen;
  fireEvent = rtl.fireEvent;
  cleanup = rtl.cleanup;
  ({ HoldingCandlePanel } = await import("@/components/portfolio/rebalance-alert"));
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  cleanup();
  fetchUrls = [];
  candleResponse = { ok: true, body: { candles: [] } };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    fetchUrls.push(url);
    return new Response(JSON.stringify(candleResponse.body), {
      status: candleResponse.ok ? 200 : 502,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

function makeHolding(overrides: Partial<HoldingWithPnL> = {}): HoldingWithPnL {
  return {
    id: "h1",
    user_id: "user-1",
    account_id: "acc-1",
    code: "360750",
    name: "TIGER 미국S&P500",
    category: "주식",
    sub_category: "미국",
    current_price: 10_000,
    shares: 10,
    target_pct: 40,
    expense_ratio: 0.07,
    created_at: "",
    updated_at: "",
    total_cost: 90_000,
    avg_price: 9_000,
    current_value: 100_000,
    profit_loss: 10_000,
    profit_loss_pct: 11.1,
    actual_pct: 52,
    ...overrides,
  };
}

const remoteCandles: CandlePoint[] = [
  { date: "2026-11-10", open: 10_000, high: 10_300, low: 9_900, close: 10_000, volume: 1_000 },
  { date: "2026-11-11", open: 10_000, high: 10_600, low: 9_950, close: 10_500, volume: 2_000 },
];

test("HoldingCandlePanel: 종목번호가 없으면 요청 없이 대체 차트를 그린다", async () => {
  render(<HoldingCandlePanel holding={makeHolding({ code: "", name: "알 수 없는 종목" })} />);

  assert.equal(fetchUrls.length, 0);
  assert.ok(await screen.findByText(/종목번호 미등록/));
  assert.equal(screen.getByText("미등록 · 알 수 없는 종목") !== null, true);
  assert.ok(screen.getByText("매입"));
  assert.ok(screen.getByText("현재"));
});

test("HoldingCandlePanel: 이름으로 종목번호를 추정해 조회한다", async () => {
  render(<HoldingCandlePanel holding={makeHolding({ code: "" })} />);

  await screen.findByText("매입");
  assert.equal(fetchUrls.length, 1);
  assert.match(fetchUrls[0], /code=360750/);
  assert.match(fetchUrls[0], /period=day/);
});

test("HoldingCandlePanel: 원격 캔들을 쓰면 시가·종가·고가·저가와 등락률을 보여준다", async () => {
  candleResponse = { ok: true, body: { candles: remoteCandles } };
  render(<HoldingCandlePanel holding={makeHolding()} />);

  assert.ok(await screen.findByText("시가 10,000원"));
  assert.ok(screen.getByText("종가 10,500원"));
  assert.ok(screen.getByText("고가 10,600원"));
  assert.ok(screen.getByText("저가 9,900원"));
  assert.ok(screen.getByText("+5.0%"));
  assert.ok(screen.getByText(/외부 시세 기준 일봉 차트입니다/));
  assert.ok(screen.getByText("11/10"));
  assert.ok(screen.getByText("11/11"));
  assert.equal(screen.getByRole("img").getAttribute("aria-label"), "TIGER 미국S&P500 일봉 상세 캔들 그래프");
});

test("HoldingCandlePanel: 원격 조회가 실패하면 오류를 알리고 보유 데이터로 대체한다", async () => {
  candleResponse = { ok: false, body: { error: "차트 조회 실패" } };
  render(<HoldingCandlePanel holding={makeHolding()} />);

  assert.ok(await screen.findByText(/차트 조회 실패 · 보유 데이터 기준 대체 차트를 표시 중입니다/));
  assert.ok(screen.getByText("매입"));
  assert.ok(screen.getByText("현재"));
});

test("HoldingCandlePanel: 빈 캔들 응답은 오류 없이 대체 차트로 넘어간다", async () => {
  candleResponse = { ok: true, body: { candles: [] } };
  render(<HoldingCandlePanel holding={makeHolding()} />);

  assert.ok(await screen.findByText("매입"));
  assert.equal(screen.queryByText(/차트 조회 실패/), null);
  assert.ok(await screen.findByText(/시세 데이터가 없어 보유 데이터 기준 대체 차트를 표시 중입니다/));
});

test("HoldingCandlePanel: 기간을 바꾸면 해당 기간으로 다시 조회한다", async () => {
  render(<HoldingCandlePanel holding={makeHolding()} />);
  await screen.findByText("매입");

  fireEvent.click(screen.getByRole("button", { name: "주봉" }));

  assert.ok(await screen.findByText("주봉 캔들"));
  assert.equal(fetchUrls.length, 2);
  assert.match(fetchUrls[1], /period=week/);
  assert.equal(
    screen.getByRole("img").getAttribute("aria-label"),
    "TIGER 미국S&P500 주봉 상세 캔들 그래프"
  );
});

test("HoldingCandlePanel: 기간 버튼은 4개이고 현재 기간만 강조된다", async () => {
  render(<HoldingCandlePanel holding={makeHolding()} />);
  await screen.findByText("매입");

  for (const label of ["일봉", "주봉", "월봉", "년봉"]) {
    assert.ok(screen.getByRole("button", { name: label }), label);
  }
  const active = screen.getByRole("button", { name: "일봉" });
  assert.match(active.className, /(^| )bg-zinc-900 /);
  assert.doesNotMatch(screen.getByRole("button", { name: "월봉" }).className, /(^| )bg-zinc-900 /);
});
