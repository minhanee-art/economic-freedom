import test from "node:test";
import assert from "node:assert/strict";

import {
  formatDate,
  formatKRW,
  formatFullKRW,
  formatPercent,
  formatPctPoint,
  cn,
} from "@/lib/utils";

test("formatKRW: 억·만 단위로 축약한다", () => {
  assert.equal(formatKRW(100_000_000), "1억");
  assert.equal(formatKRW(150_000_000), "1.5억");
  assert.equal(formatKRW(1_234_000_000), "12.3억");
  assert.equal(formatKRW(10_000), "1만");
  assert.equal(formatKRW(15_000), "1.5만");
  assert.equal(formatKRW(99_999_999), "10000.0만");
});

test("formatKRW: 만원 미만은 원 단위로 표시한다", () => {
  assert.equal(formatKRW(1_234), "₩1,234");
  assert.equal(formatKRW(0), "₩0");
});

test("formatKRW: 음수는 부호를 앞에 붙인다", () => {
  assert.equal(formatKRW(-1_500_000), "-150만");
  assert.equal(formatKRW(-1_234), "-₩1,234");
});

test("formatFullKRW: 천 단위 구분 기호를 넣는다", () => {
  assert.equal(formatFullKRW(1_234_567), "₩1,234,567");
  assert.equal(formatFullKRW(0), "₩0");
  assert.equal(formatFullKRW(-2_500), "₩-2,500");
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
