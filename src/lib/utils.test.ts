import test from "node:test";
import assert from "node:assert/strict";

import {
  formatDate,
  formatKRW,
  formatKRWFull,
  formatSignedKRW,
  formatKRWAxis,
  formatKRWCompact,
  formatAmountInput,
  parseAmountInput,
  pnlTextClass,
  pnlArrow,
  formatPercent,
  formatPctPoint,
  cn,
} from "@/lib/utils";

test("formatKRW(요약): 억·만원 단위, 만원 단위 반올림", () => {
  assert.equal(formatKRW(162_890_500), "1억 6,289만원");
  assert.equal(formatKRW(100_000_000), "1억원");
  assert.equal(formatKRW(1_234_000_000), "12억 3,400만원");
  assert.equal(formatKRW(16_895_000), "1,690만원");
  assert.equal(formatKRW(10_000), "1만원");
  assert.equal(formatKRW(99_999_999), "1억원");
});

test("formatKRW(요약): 만원 미만은 원 단위, 음수는 부호", () => {
  assert.equal(formatKRW(1_234), "1,234원");
  assert.equal(formatKRW(0), "0원");
  assert.equal(formatKRW(-1_500_000), "-150만원");
  assert.equal(formatKRW(-1_234), "-1,234원");
  assert.equal(formatKRW(Number.NaN), "0원");
});

test("formatKRWFull(전체): 천 단위 구분 + 원", () => {
  assert.equal(formatKRWFull(162_890_500), "162,890,500원");
  assert.equal(formatKRWFull(0), "0원");
  assert.equal(formatKRWFull(-2_500), "-2,500원");
});

test("formatSignedKRW: 양수에 + 부호", () => {
  assert.equal(formatSignedKRW(920_500), "+92만원");
  assert.equal(formatSignedKRW(920_500, true), "+920,500원");
  assert.equal(formatSignedKRW(-920_500), "-92만원");
  assert.equal(formatSignedKRW(0), "0원");
});

test("formatKRWAxis: 차트 축용 짧은 표기", () => {
  assert.equal(formatKRWAxis(160_000_000), "1.6억");
  assert.equal(formatKRWAxis(4_500_000), "450만");
  assert.equal(formatKRWAxis(9_500), "9,500");
});

test("formatKRWCompact: 텔레그램 리포트 형식 유지", () => {
  assert.equal(formatKRWCompact(150_000_000), "1.5억");
  assert.equal(formatKRWCompact(1_234), "₩1,234");
  assert.equal(formatKRWCompact(-1_500_000), "-150만");
});

test("금액 입력 표시: 천 단위 구분 넣기와 되돌리기", () => {
  assert.equal(formatAmountInput("2500000"), "2,500,000");
  assert.equal(formatAmountInput("002,5a00"), "2,500");
  assert.equal(formatAmountInput(""), "");
  assert.equal(parseAmountInput("2,500,000"), "2500000");
});

test("손익 색: 상승 빨강(gain)·하락 파랑(loss)·보합", () => {
  assert.equal(pnlTextClass(1), "text-gain");
  assert.equal(pnlTextClass(-1), "text-loss");
  assert.equal(pnlTextClass(0), "text-ink-mute");
  assert.equal(pnlTextClass(null), "text-ink-mute");
  assert.equal(pnlArrow(3), "▲");
  assert.equal(pnlArrow(-3), "▼");
  assert.equal(pnlArrow(0), "");
});

test("formatPercent: 소수 둘째 자리와 부호", () => {
  assert.equal(formatPercent(1.234), "+1.23%");
  assert.equal(formatPercent(-0.5), "-0.50%");
  assert.equal(formatPercent(0), "+0.00%");
});

test("formatPctPoint: 소수 첫째 자리와 p 단위", () => {
  assert.equal(formatPctPoint(1.24), "+1.2%p");
  assert.equal(formatPctPoint(-3.06), "-3.1%p");
});

test("formatDate: 패턴과 잘못된 입력", () => {
  assert.equal(formatDate("2026-01-05"), "2026-01-05");
  assert.equal(formatDate("2026-01-05", "yyyy년 M월 d일"), "2026년 1월 5일");
  assert.equal(formatDate("잘못된 날짜"), "");
});

test("cn: falsy 값을 제외하고 공백으로 잇는다", () => {
  assert.equal(cn("a", "b"), "a b");
  assert.equal(cn("a", undefined, false, "b"), "a b");
  assert.equal(cn(), "");
});
