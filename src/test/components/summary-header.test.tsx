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

  assert.ok(screen.getByText("110만원"), "총 평가금액");
  assert.ok(screen.getByText("▲ +10만원"), "총 손익");
  assert.ok(screen.getByText("+10.00%"), "손익률");
  assert.ok(screen.getByText("3만원"), "누적 배당");
  assert.ok(screen.getByText("50만원"), "월 적립금");
});

test("SummaryHeader: 손실이면 음수 부호와 하락(파랑) 토큰 클래스를 쓴다", async () => {
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

  const pnl = screen.getByText("▼ -10만원");
  assert.match(pnl.className, /text-loss/);
  assert.ok(screen.getByText("-10.00%"));
});

test("SummaryHeader: 원가가 0이면 손익은 '-', 월 적립금 0은 '미설정'", async () => {
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

  assert.equal(screen.queryByText("+0.00%"), null);
  assert.ok(screen.getByText("-"), "손익 자리");
  assert.ok(screen.getByText("미설정"), "월 적립금 0");
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

const baseProps = {
  totalValue: 1_100_000,
  totalCost: 1_000_000,
  totalDividend: 0,
  monthlyBudget: 0,
  onRefresh: () => {},
  isRefreshing: false,
};

const yields = {
  trailing12mTotal: 30_000,
  costYieldPct: 3,
  marketYieldPct: 2.7272,
  isPartialYear: false,
  coveredMonths: 12,
  hasRecords: true,
};

test("SummaryHeader: 투자·시가 배당률을 표시한다", () => {
  render(<SummaryHeader {...baseProps} dividendYields={yields} />);
  assert.ok(screen.getByText("투자 배당률"));
  assert.ok(screen.getByText("3.00%"));
  assert.ok(screen.getByText("시가 배당률"));
  assert.ok(screen.getByText("2.73%"));
  assert.equal(screen.queryByText(/12개월 미만/), null);
});

test("SummaryHeader: 배당 기록이 12개월 미만이면 안내를 보여준다", () => {
  render(<SummaryHeader {...baseProps} dividendYields={{ ...yields, isPartialYear: true, coveredMonths: 3 }} />);
  assert.ok(screen.getByText(/12개월 미만\(3개월\)/));
});

test("SummaryHeader: 분모가 0인 배당률은 숨긴다", () => {
  render(
    <SummaryHeader
      {...baseProps}
      dividendYields={{ ...yields, costYieldPct: null, marketYieldPct: null }}
    />
  );
  assert.equal(screen.queryByText("투자 배당률"), null);
  assert.equal(screen.queryByText("시가 배당률"), null);
});

test("SummaryHeader: 전일 대비 금액과 비율, 기준이 없으면 안내", () => {
  render(
    <SummaryHeader
      {...baseProps}
      dailyChange={{ amount: -10_000, pct: -0.9, baseDate: "2026-06-14", includesContribution: true }}
    />
  );
  const el = screen.getByTestId("daily-change");
  assert.match(el.textContent ?? "", /전일 대비 ▼ -1만원 \(-0\.90%\)/);
  assert.match(el.textContent ?? "", /매수·입출금 포함/);

  cleanup();
  render(<SummaryHeader {...baseProps} dailyChange={null} />);
  assert.match(screen.getByTestId("daily-change").textContent ?? "", /기준 기록 없음/);

  cleanup();
  render(<SummaryHeader {...baseProps} />);
  assert.equal(screen.queryByTestId("daily-change"), null);
});
