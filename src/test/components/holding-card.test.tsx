import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";
import type { HoldingWithPnL } from "@/types";

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let within: typeof import("@testing-library/react").within;
let HoldingCard: typeof import("@/components/portfolio/holding-card").HoldingCard;

const realFetch = globalThis.fetch;
let fetchCalls: { url: string; body: unknown }[] = [];

before(async () => {
  setupDom();
  const rtl = await import("@testing-library/react");
  render = rtl.render;
  screen = rtl.screen;
  fireEvent = rtl.fireEvent;
  cleanup = rtl.cleanup;
  within = rtl.within;
  ({ HoldingCard } = await import("@/components/portfolio/holding-card"));
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  cleanup();
  fetchCalls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    fetchCalls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify({ ok: true, holding: { id: "h1" }, costBasis: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

function makeHolding(overrides: Partial<HoldingWithPnL> = {}): HoldingWithPnL {
  return {
    id: "h1",
    user_id: "user-1",
    account_id: "acc-1",
    code: "305050",
    name: "KODEX 200",
    category: "주식",
    sub_category: "국장",
    current_price: 10_000,
    shares: 10,
    target_pct: 50,
    expense_ratio: 0.15,
    created_at: "",
    updated_at: "",
    total_cost: 90_000,
    avg_price: 9_000,
    current_value: 100_000,
    profit_loss: 10_000,
    profit_loss_pct: 11.1,
    actual_pct: 40,
    ...overrides,
  };
}

test("HoldingCard: 종목·금액·비중 뱃지를 렌더한다", async () => {
  render(<HoldingCard holding={makeHolding()} />);

  assert.ok(screen.getByText("KODEX 200"));
  assert.ok(screen.getByText("티커 305050"));
  assert.ok(screen.getByText("10만"), "평가금액");
  assert.ok(screen.getByText("10주 × ₩10,000"));
  assert.ok(screen.getByText("₩9,000"), "평단가");
  assert.ok(screen.getByText("+11.1%"), "수익률");
  assert.ok(screen.getByText("설정 50.0%"));
  assert.ok(screen.getByText("현재 보유 40.0%"));
  assert.ok(screen.getByText("총보수 0.15%"));
  assert.ok(screen.getByText("▼10.0%p"), "3%p 이상 벌어지면 차이 뱃지");
});

test("HoldingCard: 운용사 접두어를 떼고 원문도 함께 보여준다", async () => {
  render(
    <HoldingCard
      holding={makeHolding({ name: "미래에셋 TIGER 미국S&P500증권상장지수투자신탁(주식)", code: "" })}
    />
  );

  assert.ok(screen.getByText("TIGER 미국S&P500"));
  assert.ok(screen.getByText(/원문: 미래에셋 TIGER/));
  assert.ok(screen.getByText("티커 360750"), "이름으로 코드 추정");
  assert.ok(screen.getByText("이름 기준 추정"));
});

test("HoldingCard: 원가가 없으면 수익률·손익을 -로 둔다", async () => {
  render(
    <HoldingCard
      holding={makeHolding({ total_cost: 0, avg_price: 0, profit_loss: 0, profit_loss_pct: 0 })}
    />
  );

  assert.equal(screen.queryByText("+0.0%"), null);
  assert.ok(screen.getAllByText("-").length >= 2);
});

test("HoldingCard: 보유 수량이 0이면 매도 버튼이 비활성", async () => {
  render(<HoldingCard holding={makeHolding({ shares: 0, current_value: 0, actual_pct: 0 })} />);

  const sell = screen.getByRole("button", { name: "바로 매도" }) as HTMLButtonElement;
  assert.equal(sell.disabled, true);
  assert.equal((screen.getByRole("button", { name: "바로 매수" }) as HTMLButtonElement).disabled, false);
});

test("HoldingCard: 설정 비중을 바꾸면 저장 콜백을 부른다", async () => {
  const calls: [string, number][] = [];
  render(
    <HoldingCard
      holding={makeHolding()}
      onTargetPctChange={async (id, pct) => {
        calls.push([id, pct]);
      }}
    />
  );

  const input = screen.getByLabelText("KODEX 200 설정 비중");
  fireEvent.change(input, { target: { value: "60" } });
  fireEvent.blur(input);

  assert.deepEqual(calls, [["h1", 60]]);
});

test("HoldingCard: 설정 비중은 0~100으로 잘라서 저장한다", async () => {
  const calls: [string, number][] = [];
  render(
    <HoldingCard
      holding={makeHolding()}
      onTargetPctChange={async (id, pct) => {
        calls.push([id, pct]);
      }}
    />
  );

  const input = screen.getByLabelText("KODEX 200 설정 비중");
  fireEvent.change(input, { target: { value: "150" } });
  fireEvent.blur(input);

  assert.deepEqual(calls, [["h1", 100]]);
});

test("HoldingCard: 종목 정정에서 소수 수량은 거부한다", async () => {
  const calls: unknown[] = [];
  render(
    <HoldingCard
      holding={makeHolding()}
      onHoldingDetailsChange={async (...args) => {
        calls.push(args);
      }}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "종목 정보 정정" }));
  const editor = screen.getByText("품번 / 상품명 / 수량 / 평단가 정정").parentElement as HTMLElement;

  const numberInputs = within(editor).getAllByRole("spinbutton") as HTMLInputElement[];
  fireEvent.change(numberInputs[0], { target: { value: "1.5" } });
  fireEvent.click(within(editor).getByRole("button", { name: "정정 저장" }));

  assert.ok(await screen.findByText("보유수량은 0 이상 정수로 입력해주세요."));
  assert.equal(calls.length, 0, "저장 콜백이 불리지 않는다");
});

test("HoldingCard: 수량이 있는데 평단가가 0이면 저장을 막는다", async () => {
  render(<HoldingCard holding={makeHolding()} onHoldingDetailsChange={async () => {}} />);

  fireEvent.click(screen.getByRole("button", { name: "종목 정보 정정" }));
  const editor = screen.getByText("품번 / 상품명 / 수량 / 평단가 정정").parentElement as HTMLElement;
  const inputs = within(editor).getAllByRole("spinbutton") as HTMLInputElement[];

  fireEvent.change(inputs[1], { target: { value: "0" } });
  fireEvent.click(within(editor).getByRole("button", { name: "정정 저장" }));

  assert.ok(await screen.findByText("보유수량이 있으면 평단가는 0보다 커야 합니다."));
});

test("HoldingCard: 종목 정보를 정정하면 콜백에 값이 전달된다", async () => {
  const calls: unknown[][] = [];
  render(
    <HoldingCard
      holding={makeHolding()}
      onHoldingDetailsChange={async (...args) => {
        calls.push(args);
      }}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "종목 정보 정정" }));
  const editor = screen.getByText("품번 / 상품명 / 수량 / 평단가 정정").parentElement as HTMLElement;
  const textInputs = within(editor).getAllByRole("textbox");
  const numberInputs = within(editor).getAllByRole("spinbutton") as HTMLInputElement[];

  fireEvent.change(textInputs[0], { target: { value: "069500" } });
  fireEvent.change(textInputs[1], { target: { value: "KODEX 200 TR" } });
  fireEvent.change(numberInputs[0], { target: { value: "12" } });
  fireEvent.change(numberInputs[1], { target: { value: "9500" } });
  fireEvent.click(within(editor).getByRole("button", { name: "정정 저장" }));

  assert.deepEqual(calls[0], [
    "h1",
    { code: "069500", name: "KODEX 200 TR", shares: 12, avg_price: 9500 },
  ]);
  // 저장에 성공하면 편집 패널이 닫힌다
  await screen.findByRole("button", { name: "종목 정보 정정" });
  assert.equal(screen.queryByText("품번 / 상품명 / 수량 / 평단가 정정"), null);
});

test("HoldingCard: 매수 확정 시 수량·단가·날짜를 담아 API를 부른다", async () => {
  const completed: unknown[] = [];
  render(<HoldingCard holding={makeHolding()} onTradeComplete={(result) => completed.push(result)} />);

  fireEvent.click(screen.getByRole("button", { name: "바로 매수" }));
  fireEvent.change(screen.getByLabelText("KODEX 200 거래 수량"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("KODEX 200 거래 단가"), { target: { value: "10500" } });
  fireEvent.click(screen.getByRole("button", { name: "매수 확정" }));

  assert.ok(await screen.findByText("매수 반영 완료"));
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "/api/trades");
  assert.deepEqual(fetchCalls[0].body, {
    holdingId: "h1",
    action: "buy",
    quantity: 3,
    price: 10_500,
    date: new Date().toISOString().split("T")[0],
  });
  assert.equal(completed.length, 1);
});

test("HoldingCard: 보유 수량보다 많이 매도하면 요청을 보내지 않는다", async () => {
  render(<HoldingCard holding={makeHolding({ shares: 2 })} />);

  fireEvent.click(screen.getByRole("button", { name: "바로 매도" }));
  fireEvent.change(screen.getByLabelText("KODEX 200 거래 수량"), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "매도 확정" }));

  assert.ok(await screen.findByText("보유 수량보다 많이 매도할 수 없습니다."));
  assert.equal(fetchCalls.length, 0);
});

test("HoldingCard: API가 실패하면 서버 메시지를 보여준다", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "보유 수량이 부족합니다." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  render(<HoldingCard holding={makeHolding()} />);

  fireEvent.click(screen.getByRole("button", { name: "바로 매수" }));
  fireEvent.click(screen.getByRole("button", { name: "매수 확정" }));

  assert.ok(await screen.findByText("보유 수량이 부족합니다."));
});

test("HoldingCard: 리밸런싱 계산 수량을 계산해 보여준다", async () => {
  render(<HoldingCard holding={makeHolding({ target_pct: 60, actual_pct: 40 })} portfolioTotalValue={250_000} />);

  fireEvent.click(screen.getByRole("button", { name: "바로 매수" }));

  // (0.6 × 250,000 - 100,000) / (10,000 × 0.4) = 12.5 → 13주
  const advice = await screen.findByText(/가 필요합니다\(계산값\)/);
  assert.match(advice.textContent ?? "", /13주/);
  assert.ok(screen.getByRole("button", { name: "계산 13주 적용" }));

  fireEvent.click(screen.getByRole("button", { name: "계산 13주 적용" }));
  assert.equal((screen.getByLabelText("KODEX 200 거래 수량") as HTMLInputElement).value, "13");
});
