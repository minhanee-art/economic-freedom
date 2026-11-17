// 수익률 리포트 문구 — 금액/부호 포맷과 스냅샷 없는 기간 처리
import assert from "node:assert/strict";
import test from "node:test";

import { formatReturnReport, type PortfolioReturnSummary } from "@/lib/portfolio-returns";

function summary(over: Partial<PortfolioReturnSummary> = {}): PortfolioReturnSummary {
  return {
    accountId: "acc-1",
    accountName: "내 계좌",
    telegramChatId: null,
    asOfDate: "2026-11-17",
    totalValue: 3217000,
    totalCost: 2935000,
    totalPnL: 282000,
    totalPnLPct: (282000 / 2935000) * 100,
    periods: {
      day: {
        key: "day",
        label: "일별",
        targetDate: "2026-11-16",
        snapshotDate: "2026-11-16",
        valueChange: 12000,
        netContribution: 0,
        returnAmount: 12000,
        returnPct: 0.375,
      },
      week: {
        key: "week",
        label: "주간",
        targetDate: "2026-11-10",
        snapshotDate: null,
        valueChange: null,
        netContribution: null,
        returnAmount: null,
        returnPct: null,
      },
      month: {
        key: "month",
        label: "월간",
        targetDate: "2026-10-18",
        snapshotDate: "2026-10-18",
        valueChange: -45000,
        netContribution: 300000,
        returnAmount: -345000,
        returnPct: -1.05,
      },
    },
    ...over,
  };
}

test("formatReturnReport — 계좌명·기준일·평가금액·원가·손익을 담는다", () => {
  const text = formatReturnReport(summary());
  assert.match(text, /📊 내 계좌 수익률 리포트/);
  assert.match(text, /📅 2026-11-17/);
  assert.match(text, /💎 평가금액: 3,217,000원/);
  assert.match(text, /💰 총 원가: 2,935,000원/);
  assert.match(text, /📈 누적 손익: \+282,000원 \(\+9\.61%\)/);
});

test("formatReturnReport — 기간별 수익률은 부호와 함께 표시한다", () => {
  const text = formatReturnReport(summary());
  assert.match(text, /· 일별: \+0\.38% \(\+12,000원\)/);
  assert.match(text, /· 월간: -1\.05% \(-345,000원\)/);
});

test("formatReturnReport — 스냅샷이 없는 기간은 '기준 스냅샷 없음'", () => {
  const text = formatReturnReport(summary());
  assert.match(text, /· 주간: 기준 스냅샷 없음/);
});

test("formatReturnReport — 손실 계좌는 누적 손익이 음수 부호로 나온다", () => {
  const text = formatReturnReport(
    summary({ totalValue: 900000, totalCost: 1000000, totalPnL: -100000, totalPnLPct: -10 })
  );
  assert.match(text, /📈 누적 손익: -100,000원 \(-10\.00%\)/);
});

test("formatReturnReport — 원가는 반올림해서 표시한다", () => {
  const text = formatReturnReport(summary({ totalCost: 2935000.6 }));
  assert.match(text, /💰 총 원가: 2,935,001원/);
});
