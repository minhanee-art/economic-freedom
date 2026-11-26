import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";
import type { HoldingWithPnL } from "@/types";

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let within: typeof import("@testing-library/react").within;
let RebalanceAlert: typeof import("@/components/portfolio/rebalance-alert").RebalanceAlert;

const realFetch = globalThis.fetch;
const realConfirm = globalThis.confirm;
let fetchUrls: string[] = [];
let deleteCalls: string[] = [];

before(async () => {
  setupDom();
  const rtl = await import("@testing-library/react");
  render = rtl.render;
  screen = rtl.screen;
  fireEvent = rtl.fireEvent;
  cleanup = rtl.cleanup;
  within = rtl.within;
  ({ RebalanceAlert } = await import("@/components/portfolio/rebalance-alert"));
});

after(() => {
  globalThis.fetch = realFetch;
  globalThis.confirm = realConfirm;
});

beforeEach(() => {
  cleanup();
  localStorage.clear();
  fetchUrls = [];
  deleteCalls = [];
  globalThis.confirm = () => true;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    fetchUrls.push(url);
    if (url.includes("/api/market/search")) {
      return new Response(
        JSON.stringify({
          etfs: [{ code: "360750", name: "TIGER 미국S&P500", price: 20_000, category: "미국" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ candles: [] }), {
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
    target_pct: 40,
    expense_ratio: 0.15,
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

const categoryData = [
  { name: "주식", target: 40, current: 52 },
  { name: "채권", target: 60, current: 48 },
];

const twoHoldings = [
  makeHolding(),
  makeHolding({
    id: "h2",
    code: "458730",
    name: "TIGER 미국배당",
    category: "채권",
    sub_category: "미국",
    current_price: 12_500,
    shares: 8,
    current_value: 100_000,
    actual_pct: 48,
    target_pct: 60,
    total_cost: 96_000,
    avg_price: 12_000,
    profit_loss: 4_000,
    profit_loss_pct: 4.2,
  }),
];

test("RebalanceAlert: 종목이 없으면 새 계좌 시작 안내를 보여준다", async () => {
  render(<RebalanceAlert holdings={[]} categoryData={[]} />);

  assert.ok(screen.getByText("새 계좌 시작하기"));
  assert.ok(screen.getByText("종목 추가 권한이 없습니다."));
});

test("RebalanceAlert: 추가 권한이 있으면 빈 계좌에서도 추가 폼을 연다", async () => {
  render(<RebalanceAlert holdings={[]} categoryData={[]} onAddHolding={async () => {}} />);

  assert.ok(screen.getByText("종목 검색 후 추가"));
});

test("RebalanceAlert: 테마별 설정·현재 비중과 초과/부족을 표시한다", async () => {
  render(<RebalanceAlert holdings={twoHoldings} categoryData={categoryData} />);

  assert.ok(screen.getByText("테마별 비중 현황"));
  assert.ok(screen.getByText("주식"));
  assert.ok(screen.getByText("채권"));
  assert.ok(screen.getByText("+12%p 초과"));
  assert.ok(screen.getByText("-12%p 부족"));
  assert.equal((screen.getByLabelText("주식 테마 설정 비중") as HTMLInputElement).value, "40.0");
  assert.ok(screen.getByText("52.0%"));
});

test("RebalanceAlert: 진단 뱃지 수와 조정안 문구를 계산한다", async () => {
  render(<RebalanceAlert holdings={twoHoldings} categoryData={categoryData} />);

  const diagnose = screen.getByRole("button", { name: /진단/ });
  assert.match(diagnose.textContent ?? "", /4/, "테마 2건 + 종목 2건");

  fireEvent.click(diagnose);

  assert.ok(await screen.findByText("목표 비중 기준 조정안"));
  const summary = screen.getByText(/총 이탈폭/).parentElement?.textContent ?? "";
  assert.match(summary, /주식/);
  assert.match(summary, /채권/);
  assert.match(summary, /12\.0%p 초과/);
  assert.match(summary, /총 이탈폭 24\.0%p/);
});

test("RebalanceAlert: 차이가 기준 이내면 급하지 않다고 알린다", async () => {
  render(
    <RebalanceAlert
      holdings={[makeHolding({ target_pct: 50, actual_pct: 51 })]}
      categoryData={[{ name: "주식", target: 50, current: 51 }]}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: /진단/ }));

  assert.ok(await screen.findByText(/지금은 리밸런싱이 급하지 않습니다/));
  assert.equal(screen.queryByText("목표 비중 기준 조정안"), null);
});

test("RebalanceAlert: 테마 설정 비중을 저장하고 0~100으로 자른다", async () => {
  const calls: [string, number][] = [];
  render(
    <RebalanceAlert
      holdings={twoHoldings}
      categoryData={categoryData}
      onCategoryTargetPctChange={async (category, pct) => {
        calls.push([category, pct]);
      }}
    />
  );

  const input = screen.getByLabelText("주식 테마 설정 비중");
  fireEvent.change(input, { target: { value: "55" } });
  fireEvent.blur(input);
  assert.deepEqual(calls, [["주식", 55]]);

  fireEvent.change(input, { target: { value: "150" } });
  fireEvent.blur(input);
  assert.deepEqual(calls[1], ["주식", 100]);
});

test("RebalanceAlert: 테마 토글로 비중 목록을 접고 펼친다", async () => {
  render(<RebalanceAlert holdings={twoHoldings} categoryData={categoryData} />);

  const toggle = screen.getByRole("button", { name: /테마$/ });
  assert.equal(toggle.getAttribute("aria-pressed"), "true");

  fireEvent.click(toggle);
  assert.equal(screen.getByRole("button", { name: /테마$/ }).getAttribute("aria-pressed"), "false");
  assert.ok(await screen.findByText("테마 비중 숨김 · 클릭해서 다시 보기 (2개)"));

  fireEvent.click(screen.getByText("테마 비중 숨김 · 클릭해서 다시 보기 (2개)"));
  assert.ok(screen.getByText("테마별 비중 현황"));
});

test("RebalanceAlert: 종목 토글은 테마 묶음 없이 전체 종목을 보여준다", async () => {
  render(<RebalanceAlert holdings={twoHoldings} categoryData={categoryData} />);

  fireEvent.click(screen.getByRole("button", { name: /종목$/ }));

  assert.ok(await screen.findByText("전체 종목"));
  assert.ok(screen.getByText(/전체 보유종목 2개/));
  assert.ok(screen.getAllByText("KODEX 200").length >= 1);
  assert.ok(screen.getAllByText("TIGER 미국배당").length >= 1);
});

test("RebalanceAlert: 검색어로 종목을 걸러낸다", async () => {
  render(<RebalanceAlert holdings={twoHoldings} categoryData={categoryData} />);

  const search = screen.getByPlaceholderText("예: 나스닥, TIGER, 360750, 배당");
  fireEvent.change(search, { target: { value: "TIGER" } });

  assert.ok(await screen.findByText("검색 결과 1개"));
  assert.ok(screen.getByText("검색 초기화"));

  fireEvent.click(screen.getByText("검색 초기화"));
  assert.equal(screen.queryByText("검색 결과 1개"), null);
});

test("RebalanceAlert: 종목을 숨기면 목록에서 빠지고 개수가 표시된다", async () => {
  render(<RebalanceAlert holdings={twoHoldings} categoryData={categoryData} />);

  // 테마를 펼쳐야 종목 목록과 숨기기 체크박스가 나온다
  fireEvent.click(screen.getAllByRole("button", { name: /개 표시/ })[0]);
  const hideControls = await screen.findAllByText("목록에서 숨기기");
  assert.equal(hideControls.length, 1);

  fireEvent.click(within(hideControls[0].closest("label") as HTMLElement).getByRole("checkbox"));

  assert.ok(await screen.findByRole("button", { name: "숨긴 종목 1" }));
  const stored = JSON.parse(localStorage.getItem("pension-manager:hidden-holding-ids") ?? "[]");
  assert.deepEqual(stored, ["h1"]);

  fireEvent.click(screen.getByRole("button", { name: "숨긴 종목 1" }));
  assert.ok(await screen.findByText("숨긴 종목"));
  fireEvent.click(screen.getByRole("button", { name: "전체 숨김 해제" }));
  assert.ok(await screen.findByRole("button", { name: "숨긴 종목 0" }));
});

test("RebalanceAlert: 보유 0주 종목은 DB 삭제가 가능하다", async () => {
  render(
    <RebalanceAlert
      holdings={[
        makeHolding(),
        makeHolding({
          id: "h0",
          code: "069500",
          name: "KODEX 200 TR",
          shares: 0,
          target_pct: 0,
          current_value: 0,
          actual_pct: 0,
          total_cost: 0,
          avg_price: 0,
          profit_loss: 0,
          profit_loss_pct: 0,
        }),
      ]}
      categoryData={categoryData}
      onDeleteHolding={async (id) => {
        deleteCalls.push(id);
      }}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: /1개 표시 · 숨김 1개/ }));
  fireEvent.click(await screen.findByRole("button", { name: /숨김 종목 1개 관리/ }));

  const removeButtons = await screen.findAllByRole("button", { name: "DB 삭제" });
  fireEvent.click(removeButtons[0]);

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(deleteCalls, ["h0"]);
});

test("RebalanceAlert: 보유 중인 종목은 삭제 버튼이 잠긴다", async () => {
  render(
    <RebalanceAlert
      holdings={[makeHolding({ target_pct: 0 })]}
      categoryData={categoryData}
      onDeleteHolding={async () => {}}
    />
  );

  const expandButtons = screen.getAllByRole("button", { name: /개 표시/ });
  fireEvent.click(expandButtons[0]);
  fireEvent.click(await screen.findByRole("button", { name: /숨김 종목 \d+개 관리/ }));

  const locked = await screen.findAllByRole("button", { name: "보유중 삭제불가" });
  assert.ok(locked.length >= 1);
  assert.equal((locked[0] as HTMLButtonElement).disabled, true);
});

test("RebalanceAlert: 검색으로 종목을 찾아 추가한다", async () => {
  const added: unknown[] = [];
  render(
    <RebalanceAlert
      holdings={twoHoldings}
      categoryData={categoryData}
      onAddHolding={async (payload) => {
        added.push(payload);
      }}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "+ 신규 추가" }));
  assert.ok(await screen.findByText("종목 검색 후 추가"));

  fireEvent.change(screen.getByPlaceholderText("예: TIGER 미국S&P500, 360750, 나스닥"), {
    target: { value: "TIGER" },
  });

  const result = await screen.findByText("TIGER 미국S&P500", undefined, { timeout: 2000 });
  fireEvent.click(result);

  assert.ok(await screen.findByText("자동 테마 분류"));
  fireEvent.change(screen.getByLabelText("보유수량"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("평단가"), { target: { value: "19000" } });
  fireEvent.change(screen.getByLabelText("설정비중 (%)"), { target: { value: "20" } });

  fireEvent.click(screen.getByRole("button", { name: "종목 추가" }));

  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(added.length, 1);
  assert.deepEqual(added[0], {
    code: "360750",
    name: "TIGER 미국S&P500",
    category: (added[0] as { category: string }).category,
    sub_category: (added[0] as { sub_category: string }).sub_category,
    current_price: 20_000,
    target_pct: 20,
    shares: 10,
    avg_price: 19_000,
  });
  assert.ok(fetchUrls.some((url) => url.includes("/api/market/search")));
});
