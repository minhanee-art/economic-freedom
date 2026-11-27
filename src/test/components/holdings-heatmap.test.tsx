import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import type { HoldingWithPnL } from "@/types";
import { setupDom } from "@/test/dom";

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let cleanup: typeof import("@testing-library/react").cleanup;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let HoldingsHeatmap: typeof import("@/components/portfolio/holdings-heatmap").HoldingsHeatmap;

before(async () => {
  setupDom();
  const rtl = await import("@testing-library/react");
  render = rtl.render;
  screen = rtl.screen;
  cleanup = rtl.cleanup;
  fireEvent = rtl.fireEvent;
  ({ HoldingsHeatmap } = await import("@/components/portfolio/holdings-heatmap"));
});

after(() => cleanup());
beforeEach(() => cleanup());

// jsdom 은 레이아웃이 없어 clientWidth/Height 가 0 이다. 히트맵 영역의 실제 크기를 흉내 낸다.
function setArea(w: number, h: number) {
  const proto = HTMLElement.prototype;
  Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => w });
  Object.defineProperty(proto, "clientHeight", { configurable: true, get: () => h });
}
function resetArea() {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
}
after(resetArea);

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
      holdings={[
        make({ id: "n", name: "원가없음", current_value: 100, total_cost: 0, profit_loss_pct: 0 }),
        make({ id: "a", name: "가", current_value: 100 }),
        make({ id: "b", name: "나", current_value: 100 }),
      ]}
    />
  );
  assert.ok(screen.getByText("원가 없음"));
});

test("히트맵: 종목이 3개 미만이면 그리지 않는다(한 칸짜리 사각형이 오류처럼 보임)", () => {
  const { container } = render(
    <HoldingsHeatmap holdings={[make({ id: "a", current_value: 100 }), make({ id: "b", current_value: 50 })]} />
  );
  assert.equal(container.innerHTML, "");
});

const uneven = [30, 18, 12, 9, 7, 6, 5, 4, 3, 2.5, 1.5, 1, 0.6, 0.4].map((v, i) =>
  make({ id: `u${i}`, name: `종목${i}`, current_value: v * 1000, total_cost: 1000, profit_loss_pct: i % 2 ? -3 : 4 })
);

test("히트맵: 2% 미만 종목은 '기타 N종목' 한 칸으로 묶고, 묶인 종목은 목록에 나온다", () => {
  setArea(1030, 224);
  try {
    render(<HoldingsHeatmap holdings={uneven} />);
    // 1.5·1·0.6·0.4 → 4종목
    const other = screen.getByLabelText(/^기타 4종목 비중 3\.5%/);
    assert.match(other.className, /bg-zinc-200/);
    const list = screen.getByRole("list", { name: "비중이 작은 종목" });
    for (const n of ["종목10", "종목11", "종목12", "종목13"]) assert.match(list.textContent ?? "", new RegExp(n));
    assert.match(list.textContent ?? "", /0\.4%/);
    assert.equal(screen.queryByLabelText(/^종목13 비중/), null);
  } finally {
    resetArea();
  }
});

test("히트맵: 넓은 칸은 이름+수익률 두 줄, 좁은 칸은 수익률만, 더 좁으면 글자 없음 — px 기준", () => {
  setArea(1030, 224);
  try {
    render(<HoldingsHeatmap holdings={uneven} />);
    // 데스크톱: 비중 6% 칸(≈ 60px 너비 아님, 가로로 넓다)도 이름이 보인다
    assert.ok(screen.getByText("종목0"));
    const six = screen.getByLabelText(/^종목5 비중/);
    assert.ok((six.textContent ?? "").includes("종목5"), "데스크톱에서 6% 칸도 이름이 보인다");
  } finally {
    resetArea();
  }
  cleanup();
  setArea(318, 192);
  try {
    render(<HoldingsHeatmap holdings={uneven} />);
    const tiles = screen.getAllByRole("button");
    const withName = tiles.filter((t) => /종목\d+/.test(t.textContent ?? "") && t.textContent !== "");
    const onlyPct = tiles.filter((t) => /^[+-]\d+\.\d+%$/.test(t.textContent ?? ""));
    const empty = tiles.filter((t) => (t.textContent ?? "") === "");
    assert.ok(withName.length >= 1, "두 줄 칸 있음");
    assert.ok(empty.length >= 1, "글자 없는 칸 있음");
    assert.ok(withName.length + onlyPct.length + empty.length <= tiles.length);
    // 글자 없는 칸의 종목은 모두 목록에 있다
    const list = screen.getByRole("list", { name: "비중이 작은 종목" });
    for (const t of empty) {
      const label = t.getAttribute("aria-label") ?? "";
      const name = label.split(" 비중")[0];
      if (!name.startsWith("기타")) assert.match(list.textContent ?? "", new RegExp(name));
    }
  } finally {
    resetArea();
  }
});

test("히트맵: 칸을 누르면 아래에 이름·비중·수익률 한 줄이 나오고, 다시 누르면 닫힌다", () => {
  render(<HoldingsHeatmap holdings={holdings} />);
  const tile = screen.getByLabelText("KODEX 200 비중 60.0%, 수익률 +20.00%");
  assert.equal(tile.getAttribute("aria-pressed"), "false");
  fireEvent.click(tile);
  assert.equal(tile.getAttribute("aria-pressed"), "true");
  assert.ok(screen.getByText("KODEX 200 · 비중 60.0% · 수익률 +20.00%"));
  fireEvent.click(tile);
  assert.equal(screen.queryByText("KODEX 200 · 비중 60.0% · 수익률 +20.00%"), null);
});

test("히트맵: 기타 칸을 누르면 수익률 없이 이름·비중만 보여준다", () => {
  setArea(1030, 224);
  try {
    render(<HoldingsHeatmap holdings={uneven} />);
    fireEvent.click(screen.getByLabelText(/^기타 4종목/));
    assert.ok(screen.getByText("기타 4종목 · 비중 3.5%"));
  } finally {
    resetArea();
  }
});
