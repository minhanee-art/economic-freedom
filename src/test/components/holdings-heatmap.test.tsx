import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import type { HoldingWithPnL } from "@/types";
import { setupDom } from "@/test/dom";

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let cleanup: typeof import("@testing-library/react").cleanup;
let HoldingsHeatmap: typeof import("@/components/portfolio/holdings-heatmap").HoldingsHeatmap;

before(async () => {
  setupDom();
  const rtl = await import("@testing-library/react");
  render = rtl.render;
  screen = rtl.screen;
  cleanup = rtl.cleanup;
  ({ HoldingsHeatmap } = await import("@/components/portfolio/holdings-heatmap"));
});

after(() => cleanup());
beforeEach(() => cleanup());

function make(overrides: Partial<HoldingWithPnL>): HoldingWithPnL {
  return {
    id: "h1",
    user_id: "u",
    account_id: "a",
    code: "000000",
    name: "종목",
    category: "주식",
    sub_category: "",
    current_price: 1,
    shares: 1,
    target_pct: 0,
    expense_ratio: 0,
    created_at: "",
    updated_at: "",
    total_cost: 100,
    avg_price: 100,
    current_value: 100,
    profit_loss: 0,
    profit_loss_pct: 0,
    actual_pct: 0,
    ...overrides,
  };
}

const holdings = [
  make({ id: "a", name: "KODEX 200", current_value: 600_000, total_cost: 500_000, profit_loss_pct: 20 }),
  make({ id: "b", name: "TIGER 미국", current_value: 380_000, total_cost: 400_000, profit_loss_pct: -5 }),
  make({ id: "c", name: "작은종목", current_value: 20_000, total_cost: 20_000, profit_loss_pct: 0.1 }),
];

test("히트맵: 큰 종목은 타일에 이름과 수익률 수치를 함께 보여준다", () => {
  render(<HoldingsHeatmap holdings={holdings} />);
  assert.ok(screen.getByText("KODEX 200"));
  assert.ok(screen.getByText("+20.00%"));
  assert.ok(screen.getByText("TIGER 미국"));
  assert.ok(screen.getByText("-5.00%"));
});

test("히트맵: 접근성 라벨에 비중과 수익률이 들어간다", () => {
  render(<HoldingsHeatmap holdings={holdings} />);
  const tile = screen.getByLabelText("KODEX 200 비중 60.0%, 수익률 +20.00%");
  // 한국 관습: 상승은 빨강 계열 토큰, 하락은 파랑 계열 토큰
  assert.match(tile.className, /bg-heat-gain-strong/);
  const loss = screen.getByLabelText("TIGER 미국 비중 38.0%, 수익률 -5.00%");
  assert.match(loss.className, /bg-heat-loss\b/);
});

test("히트맵: 비중이 작은 종목은 아래 목록에 이름·비중·수익률을 표시한다", () => {
  render(<HoldingsHeatmap holdings={holdings} />);
  const list = screen.getByRole("list", { name: "비중이 작은 종목" });
  assert.match(list.textContent ?? "", /작은종목/);
  assert.match(list.textContent ?? "", /2\.0%/);
  assert.match(list.textContent ?? "", /\+0\.10%/);
});

test("히트맵: 평가금액이 있는 종목이 없으면 렌더하지 않는다", () => {
  const { container } = render(
    <HoldingsHeatmap holdings={[make({ id: "z", current_value: 0, shares: 0 })]} />
  );
  assert.equal(container.innerHTML, "");
});

test("히트맵: 원가가 없으면 수익률 대신 '원가 없음'", () => {
  render(
    <HoldingsHeatmap
      holdings={[make({ id: "n", name: "원가없음", current_value: 100, total_cost: 0, profit_loss_pct: 0 })]}
    />
  );
  assert.ok(screen.getByText("원가 없음"));
});
