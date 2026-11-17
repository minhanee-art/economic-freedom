import test from "node:test";
import assert from "node:assert/strict";

import {
  ADULT_EXEMPTION,
  MINOR_EXEMPTION,
  ANNUITY_DISCOUNT_RATE,
  getAge,
  isMinor,
  exemptionLimit,
  cumulativeGiftsWithin10Years,
  getBracket,
  calcGiftTax,
  applySelfReportCredit,
  presentValueOfInstallments,
  reportDeadline,
} from "@/lib/gift-tax";

test("getAge: 생일 전후로 만 나이가 바뀐다", () => {
  assert.equal(getAge("2000-05-10", new Date(2026, 4, 9)), 25);
  assert.equal(getAge("2000-05-10", new Date(2026, 4, 10)), 26);
  assert.equal(getAge("2000-12-31", new Date(2026, 0, 1)), 25);
});

test("isMinor: 만 19세 미만만 미성년자", () => {
  assert.equal(isMinor("2007-01-02", new Date(2026, 0, 1)), true);
  assert.equal(isMinor("2007-01-01", new Date(2026, 0, 1)), false);
});

test("exemptionLimit: 미성년 2천만원, 성년 5천만원", () => {
  assert.equal(exemptionLimit("2015-03-01", new Date(2026, 0, 1)), MINOR_EXEMPTION);
  assert.equal(exemptionLimit("2000-03-01", new Date(2026, 0, 1)), ADULT_EXEMPTION);
  assert.equal(MINOR_EXEMPTION, 20_000_000);
  assert.equal(ADULT_EXEMPTION, 50_000_000);
});

test("cumulativeGiftsWithin10Years: 10년 창 밖과 비증여 항목은 제외한다", () => {
  const at = new Date(2026, 5, 1);
  const total = cumulativeGiftsWithin10Years(
    [
      { date: "2020-06-01", amount: 10_000_000 },
      { date: "2022-06-01", amount: 5_000_000, gift_type: "installment" },
      { date: "2015-01-01", amount: 99_000_000 },
      { date: "2023-06-01", amount: 7_000_000, gift_type: "sale" },
      { date: "2026-06-01", amount: 1_000_000 },
      { date: "2026-08-01", amount: 50_000_000 },
    ],
    at
  );
  assert.equal(total, 16_000_000);
});

test("cumulativeGiftsWithin10Years: 증여가 없으면 0", () => {
  assert.equal(cumulativeGiftsWithin10Years([], new Date(2026, 0, 1)), 0);
});

test("getBracket: 구간 경계에서 세율이 올라간다", () => {
  assert.equal(getBracket(100_000_000).rate, 0.1);
  assert.equal(getBracket(100_000_001).rate, 0.2);
  assert.equal(getBracket(500_000_000).rate, 0.2);
  assert.equal(getBracket(1_000_000_000).rate, 0.3);
  assert.equal(getBracket(3_000_000_000).rate, 0.4);
  assert.equal(getBracket(3_000_000_001).rate, 0.5);
});

test("calcGiftTax: 과세표준 × 세율 − 누진공제", () => {
  assert.deepEqual(calcGiftTax(0), { tax: 0, rate: 0 });
  assert.deepEqual(calcGiftTax(-1), { tax: 0, rate: 0 });
  assert.deepEqual(calcGiftTax(100_000_000), { tax: 10_000_000, rate: 0.1 });
  assert.deepEqual(calcGiftTax(500_000_000), { tax: 90_000_000, rate: 0.2 });
  assert.deepEqual(calcGiftTax(1_000_000_000), { tax: 240_000_000, rate: 0.3 });
  assert.deepEqual(calcGiftTax(3_000_000_000), { tax: 1_040_000_000, rate: 0.4 });
  assert.deepEqual(calcGiftTax(5_000_000_000), { tax: 2_040_000_000, rate: 0.5 });
});

test("calcGiftTax: 세액은 원 단위로 반올림한다", () => {
  const { tax } = calcGiftTax(123_456_789);
  assert.equal(tax, Math.round(123_456_789 * 0.2 - 10_000_000));
  assert.equal(Number.isInteger(tax), true);
});

test("applySelfReportCredit: 3% 공제 후 반올림", () => {
  assert.equal(applySelfReportCredit(10_000_000), 9_700_000);
  assert.equal(applySelfReportCredit(0), 0);
  assert.equal(applySelfReportCredit(123), 119);
});

test("presentValueOfInstallments: 입력이 0 이하면 0", () => {
  assert.equal(presentValueOfInstallments(0, 12), 0);
  assert.equal(presentValueOfInstallments(1_000_000, 0), 0);
  assert.equal(presentValueOfInstallments(-1_000_000, 12), 0);
});

test("presentValueOfInstallments: 연금현가 공식과 일치한다", () => {
  const monthly = 1_000_000;
  const months = 120;
  const i = ANNUITY_DISCOUNT_RATE / 12;
  const expected = Math.round((monthly * (1 - Math.pow(1 + i, -months))) / i);
  const actual = presentValueOfInstallments(monthly, months);
  assert.ok(Math.abs(actual - expected) <= 1, `expected≈${expected}, actual=${actual}`);
});

test("presentValueOfInstallments: 기간이 길수록 현재가치가 크다", () => {
  const short = presentValueOfInstallments(1_000_000, 12);
  const long = presentValueOfInstallments(1_000_000, 24);
  assert.ok(long > short);
  assert.ok(short < 12_000_000);
});

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test("reportDeadline: 증여일이 속한 달의 말일부터 3개월", () => {
  assert.equal(ymd(reportDeadline("2026-01-15")), "2026-04-30");
  assert.equal(ymd(reportDeadline("2026-01-31")), "2026-04-30");
  assert.equal(ymd(reportDeadline("2026-02-10")), "2026-05-31");
  assert.equal(ymd(reportDeadline("2026-06-30")), "2026-09-30");
  assert.equal(ymd(reportDeadline("2026-12-05")), "2027-03-31");
  assert.equal(ymd(reportDeadline("2024-01-31")), "2024-04-30");
});
