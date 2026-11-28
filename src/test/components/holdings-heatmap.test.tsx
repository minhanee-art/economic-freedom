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

// 목록은 기본으로 접혀 있다. 펼침 버튼을 눌러 연다
function openList() {
  fireEvent.click(screen.getByRole("button", { name: /^종목별 목록 펼치기/ }));
}

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
  const big = screen.getByLabelText(/^KODEX 200 비중/);
  assert.equal(big.textContent, "KODEX 200+20.00%");
  assert.equal(screen.getByLabelText(/^TIGER 미국 비중/).textContent, "TIGER 미국-5.00%");
});

test("히트맵: 접근성 라벨에 비중과 수익률이 들어간다", () => {
  render(<HoldingsHeatmap holdings={holdings} />);
  const tile = screen.getByLabelText("KODEX 200 비중 60.0%, 수익률 +20.00%");
  // 한국 관습: 상승은 빨강 계열 토큰, 하락은 파랑 계열 토큰
  assert.match(tile.className, /bg-heat-gain-strong/);
  const loss = screen.getByLabelText("TIGER 미국 비중 38.0%, 수익률 -5.00%");
  assert.match(loss.className, /bg-heat-loss\b/);
  // 칸 글자색도 테마 토큰을 따른다(다크의 밝은 강한 칸은 어두운 글자)
  assert.match(tile.className, /text-heat-on-strong/);
  assert.match(loss.className, /text-heat-on\b/);
});

test("히트맵: 칸 색은 :root(라이트)와 .dark(다크)에서 따로 정한다", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync("src/app/globals.css", "utf8");
  const block = (sel: string) => css.match(new RegExp(`^${sel} \\{([^}]*)\\}`, "m"))?.[1] ?? "";
  for (const sel of [":root", "\\.dark"]) {
    for (const t of ["gain-strong", "gain", "flat", "loss", "loss-strong", "on", "on-strong"]) {
      assert.match(block(sel), new RegExp(`--heat-${t}:`), `${sel} --heat-${t}`);
    }
  }
});

test("히트맵: 종목별 비중·수익률은 아래 목록에 이름·비중·수익률을 표시한다", () => {
  render(<HoldingsHeatmap holdings={holdings} />);
  openList();
  const list = screen.getByRole("list", { name: "종목별 비중·수익률" });
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
    openList();
    // 1.5·1·0.6·0.4 → 4종목
    const other = screen.getByLabelText(/^기타 4종목 비중 3\.5%/);
    assert.match(other.className, /bg-heat-flat/);
    const list = screen.getByRole("list", { name: "종목별 비중·수익률" });
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
    assert.ok((screen.getByLabelText(/^종목0 비중/).textContent ?? "").includes("종목0"));
    const six = screen.getByLabelText(/^종목5 비중/);
    assert.ok((six.textContent ?? "").includes("종목5"), "데스크톱에서 6% 칸도 이름이 보인다");
  } finally {
    resetArea();
  }
  cleanup();
  setArea(318, 192);
  try {
    render(<HoldingsHeatmap holdings={uneven} />);
    openList();
    const tiles = screen.getAllByRole("button").filter((b) => b.hasAttribute("data-heat-tile"));
    const withName = tiles.filter((t) => /종목\d+/.test(t.textContent ?? "") && t.textContent !== "");
    const onlyPct = tiles.filter((t) => /^[+-]\d+\.\d+%$/.test(t.textContent ?? ""));
    const empty = tiles.filter((t) => (t.textContent ?? "") === "");
    assert.ok(withName.length >= 1, "두 줄 칸 있음");
    assert.ok(empty.length >= 1, "글자 없는 칸 있음");
    assert.ok(withName.length + onlyPct.length + empty.length <= tiles.length);
    // 글자 없는 칸의 종목은 모두 목록에 있다
    const list = screen.getByRole("list", { name: "종목별 비중·수익률" });
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

test("히트맵: 처음 2종목이었다가 14종목이 되면 그때 크기를 재서 실제 비율로 배치한다", () => {
  setArea(1030, 224);
  try {
    const { rerender } = render(<HoldingsHeatmap holdings={uneven.slice(0, 2)} />);
    assert.equal(screen.queryByRole("list"), null);
    rerender(<HoldingsHeatmap holdings={uneven} />);
    // 실제 비율(≈4.6)로 배치하면 가장 큰 칸이 전체 높이를 쓴다. 폰 비율(1.6)이면 그렇지 않다
    const first = screen.getByLabelText(/^종목0 비중/).closest("[role=listitem]") as HTMLElement;
    assert.equal(first.style.height, "100%");
    assert.ok((screen.getByLabelText(/^종목0 비중/).textContent ?? "").includes("종목0"));
  } finally {
    resetArea();
  }
});

test("히트맵: 3→2→3종목으로 바뀌어도 ResizeObserver 를 붙이고 떼어 낸다", () => {
  const live = new Set<unknown>();
  let created = 0;
  class FakeRO {
    constructor() { created += 1; }
    observe(el: unknown) { live.add(el); }
    disconnect() { live.clear(); }
  }
  const g = globalThis as unknown as { ResizeObserver?: unknown };
  const prev = g.ResizeObserver;
  g.ResizeObserver = FakeRO;
  try {
    const { rerender } = render(<HoldingsHeatmap holdings={holdings} />);
    assert.equal(live.size, 1);
    rerender(<HoldingsHeatmap holdings={holdings.slice(0, 2)} />);
    assert.equal(live.size, 0, "그리지 않을 때는 감시를 뗀다");
    rerender(<HoldingsHeatmap holdings={holdings} />);
    assert.equal(live.size, 1, "다시 그리면 새 요소를 감시한다");
    assert.ok(created >= 2);
  } finally {
    g.ResizeObserver = prev;
  }
});

test("히트맵: 이름이 칸 안에 없는 종목(수익률만 나오는 칸 포함)은 모두 아래 목록에 있다", () => {
  for (const [w, h] of [[248, 192], [318, 192], [1030, 224]]) {
    setArea(w, h);
    try {
      render(<HoldingsHeatmap holdings={uneven} />);
      openList();
      const list = screen.getByRole("list", { name: "종목별 비중·수익률" }).textContent ?? "";
      for (const btn of screen.getAllByRole("button").filter((b) => b.hasAttribute("data-heat-tile"))) {
        const label = btn.getAttribute("aria-label") ?? "";
        const name = label.split(" 비중")[0];
        if (name.startsWith("기타")) continue;
        const nameShown = (btn.textContent ?? "").includes(name);
        assert.ok(nameShown || list.includes(name), `${w}px: ${name} 의 이름을 볼 곳이 없다`);
      }
    } finally {
      resetArea();
      cleanup();
    }
  }
});

test("히트맵: 기타 칸은 한 줄 자리에 이름, 범례에 기타 항목, 목록에 '기타' 표시", () => {
  setArea(1030, 224);
  try {
    render(<HoldingsHeatmap holdings={uneven} />);
    openList();
    const other = screen.getByLabelText(/^기타 4종목/);
    assert.ok((other.textContent ?? "").includes("기타 4종목"));
    // 글자가 있는 기타 칸에는 빗금을 두지 않는다(글자가 깔끔하게 읽히도록)
    assert.equal(other.hasAttribute("data-heat-hatch"), false);
    assert.ok(screen.getByText(/기타\(2% 미만 묶음/));
    const list = screen.getByRole("list", { name: "종목별 비중·수익률" });
    assert.equal((list.textContent ?? "").split("· 기타").length - 1, 4);
  } finally {
    resetArea();
  }
});

test("히트맵: 고른 종목이 사라지면 선택을 지운다(다시 나타나도 되살아나지 않는다)", () => {
  const { rerender } = render(<HoldingsHeatmap holdings={holdings} />);
  fireEvent.click(screen.getByLabelText(/^KODEX 200 비중/));
  assert.ok(screen.getByText(/KODEX 200 · 비중/));
  rerender(<HoldingsHeatmap holdings={holdings.slice(0, 2)} />);
  rerender(<HoldingsHeatmap holdings={holdings} />);
  assert.equal(screen.queryByText(/KODEX 200 · 비중/), null);
  assert.equal(screen.getByLabelText(/^KODEX 200 비중/).getAttribute("aria-pressed"), "false");
});

test("히트맵: 칸은 대시보드의 44px 최소 크기 규칙에서 빠진다(다른 버튼은 그대로)", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /#main-content :is\(button[^{]*\):not\(\.sr-only, \[data-heat-tile\]\)/);
  render(<HoldingsHeatmap holdings={holdings} />);
  // 칸이 아닌 버튼(목록 펼침)은 44px 규칙을 그대로 받는다
  for (const b of screen.getAllByRole("button")) {
    if (!b.hasAttribute("data-heat-tile")) assert.match(b.className, /min-h-11/);
  }
});

test("히트맵: 고른 종목이 값이 줄어 기타로 묶이면 선택을 지운다", () => {
  const base = [
    make({ id: "a", name: "가", current_value: 500 }),
    make({ id: "b", name: "나", current_value: 300 }),
    make({ id: "c", name: "다", current_value: 190 }),
    make({ id: "d", name: "라", current_value: 12 }),
  ];
  const { rerender } = render(<HoldingsHeatmap holdings={base} />);
  fireEvent.click(screen.getByLabelText(/^라 비중/));
  assert.ok(screen.getByText(/^라 · 비중/));
  // 라(1.2%)와 마(1.0%)가 2% 미만 둘 → 기타로 묶인다
  rerender(<HoldingsHeatmap holdings={[...base, make({ id: "e", name: "마", current_value: 10 })]} />);
  assert.equal(screen.queryByText(/^라 · 비중/), null);
});

test("히트맵: 글자가 없는 기타 칸에는 빗금으로 보합 칸과 구별한다", () => {
  setArea(318, 192);
  try {
    render(<HoldingsHeatmap holdings={uneven} />);
    const other = screen.getByLabelText(/^기타 4종목/);
    assert.equal(other.textContent, "");
    assert.ok(other.hasAttribute("data-heat-hatch"));
  } finally {
    resetArea();
  }
});

test("히트맵: 목록은 기본으로 접혀 있고 종목 수가 보인다(측정 전후로 높이가 같다)", () => {
  const heights: (string | undefined)[] = [];
  for (const [w, h] of [[0, 0], [318, 192], [1030, 224]]) {
    setArea(w, h);
    try {
      render(<HoldingsHeatmap holdings={uneven} />);
      assert.equal(screen.queryByRole("list", { name: "종목별 비중·수익률" }), null);
      const toggle = screen.getByRole("button", { name: "종목별 목록 펼치기 · 14종목" });
      assert.equal(toggle.getAttribute("aria-expanded"), "false");
      heights.push(toggle.className);
    } finally {
      resetArea();
      cleanup();
    }
  }
  assert.ok(heights.every((c) => c === heights[0]));
});

test("히트맵: 펼침 버튼으로 목록을 펼치고 다시 접는다(aria-expanded·aria-controls)", () => {
  render(<HoldingsHeatmap holdings={uneven} />);
  const toggle = screen.getByRole("button", { name: /^종목별 목록 펼치기/ });
  fireEvent.click(toggle);
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(toggle.textContent?.includes("종목별 목록 접기"), true);
  const list = screen.getByRole("list", { name: "종목별 비중·수익률" });
  assert.equal(toggle.getAttribute("aria-controls"), list.id);
  assert.equal(list.querySelectorAll("li").length, 14);
  fireEvent.click(toggle);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(screen.queryByRole("list", { name: "종목별 비중·수익률" }), null);
});

test("히트맵: 범례는 접혀 있어도 보인다", () => {
  setArea(1030, 224);
  try {
    render(<HoldingsHeatmap holdings={uneven} />);
    assert.ok(screen.getByText("+10% 이상"));
    assert.ok(screen.getByText(/기타\(2% 미만 묶음/));
  } finally {
    resetArea();
  }
});

test("히트맵: 접힌 채 기타 칸을 누르면 목록을 펼치라는 안내가 나오고(자동으로 펼치지 않는다), 펼치면 안내가 바뀐다", () => {
  setArea(1030, 224);
  try {
    render(<HoldingsHeatmap holdings={uneven} />);
    fireEvent.click(screen.getByLabelText(/^기타 4종목/));
    assert.ok(screen.getByText(/'종목별 목록 펼치기'를 눌러/));
    assert.equal(screen.queryByRole("list", { name: "종목별 비중·수익률" }), null);
    openList();
    assert.ok(screen.getByText(/'· 기타' 표시로/));
    assert.equal(screen.queryByText(/'종목별 목록 펼치기'를 눌러/), null);
  } finally {
    resetArea();
  }
});

test("히트맵: 일반 칸을 눌렀을 때는 목록 안내가 나오지 않는다", () => {
  render(<HoldingsHeatmap holdings={holdings} />);
  fireEvent.click(screen.getByLabelText(/^KODEX 200 비중/));
  assert.equal(screen.queryByText(/묶인 종목은/), null);
});

test("히트맵: 아래 목록은 화면 크기 측정과 무관하다(측정 전후로 아래 내용이 밀리지 않도록)", () => {
  const listText = () => screen.getByRole("list", { name: "종목별 비중·수익률" }).textContent;
  const texts: (string | null)[] = [];
  for (const [w, h] of [[0, 0], [248, 192], [318, 192], [1030, 224]]) {
    setArea(w, h);
    try {
      render(<HoldingsHeatmap holdings={uneven} />);
      openList();
      texts.push(listText());
      // 모든 종목이 목록에 있다
      const names = Array.from(screen.getByRole("list", { name: "종목별 비중·수익률" }).querySelectorAll("li")).map(
        (li) => li.querySelector("span span:last-child")?.textContent ?? ""
      );
      assert.equal(names.length, 14);
    } finally {
      resetArea();
      cleanup();
    }
  }
  assert.ok(texts.every((t) => t === texts[0]));
});
