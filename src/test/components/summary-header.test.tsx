import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let SummaryHeader: typeof import("@/components/portfolio/summary-header").SummaryHeader;

before(async () => {
  setupDom();
  const rtl = await import("@testing-library/react");
  render = rtl.render;
  screen = rtl.screen;
  fireEvent = rtl.fireEvent;
  cleanup = rtl.cleanup;
  ({ SummaryHeader } = await import("@/components/portfolio/summary-header"));
});

after(() => {
  cleanup();
});

beforeEach(() => {
  cleanup();
});

test("SummaryHeader: 평가금액·손익·배당·적립금을 보여준다", async () => {
  render(
    <SummaryHeader
      totalValue={1_100_000}
      totalCost={1_000_000}
      totalDividend={30_000}
      monthlyBudget={500_000}
      onRefresh={() => {}}
      isRefreshing={false}
    />
  );

  assert.ok(screen.getByText("110만"), "총 평가금액");
  assert.ok(screen.getByText("10만"), "총 손익");
  assert.ok(screen.getByText("+10.00%"), "손익률");
  assert.ok(screen.getByText("3만"), "누적 배당");
  assert.ok(screen.getByText("50만"), "월 적립금");
});

test("SummaryHeader: 손실이면 음수와 빨간색 클래스를 쓴다", async () => {
  render(
    <SummaryHeader
      totalValue={900_000}
      totalCost={1_000_000}
      totalDividend={0}
      monthlyBudget={0}
      onRefresh={() => {}}
      isRefreshing={false}
    />
  );

  const pnl = screen.getByText("-10만");
  assert.match(pnl.className, /text-red-300/);
  assert.ok(screen.getByText("-10.00%"));
});

test("SummaryHeader: 원가가 0이면 손익률은 0.00%", async () => {
  render(
    <SummaryHeader
      totalValue={0}
      totalCost={0}
      totalDividend={0}
      monthlyBudget={0}
      onRefresh={() => {}}
      isRefreshing={false}
    />
  );

  assert.ok(screen.getByText("+0.00%"));
});

test("SummaryHeader: 새로고침 버튼은 갱신 중에 잠긴다", async () => {
  let clicked = 0;
  render(
    <SummaryHeader
      totalValue={1_000_000}
      totalCost={1_000_000}
      totalDividend={0}
      monthlyBudget={0}
      onRefresh={() => {
        clicked += 1;
      }}
      isRefreshing={false}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "시세 새로고침" }));
  assert.equal(clicked, 1);

  cleanup();
  render(
    <SummaryHeader
      totalValue={1_000_000}
      totalCost={1_000_000}
      totalDividend={0}
      monthlyBudget={0}
      onRefresh={() => {
        clicked += 1;
      }}
      isRefreshing
    />
  );

  const button = screen.getByRole("button", { name: "갱신 중..." }) as HTMLButtonElement;
  assert.equal(button.disabled, true);
  fireEvent.click(button);
  assert.equal(clicked, 1);
});
