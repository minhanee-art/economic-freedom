import test from "node:test";
import assert from "node:assert/strict";

import {
  parseContributionBody,
  parseIncomeSourceBody,
  parseRetirementGoalBody,
  parseYear,
} from "@/lib/pension-validation";

const now = new Date(2026, 10, 26);

test("parseYear: 2000~내년만 허용, 문자열 연도도 받는다", () => {
  assert.equal(parseYear(2026, now), 2026);
  assert.equal(parseYear("2025", now), 2025);
  assert.equal(parseYear(2027, now), 2027);
  assert.equal(parseYear(2028, now), null);
  assert.equal(parseYear(1999, now), null);
  assert.equal(parseYear(2026.5, now), null);
});

test("parseContributionBody: 계좌·연도·금액 검증", () => {
  assert.deepEqual(parseContributionBody({ accountId: "a", year: 2026, amount: 100, memo: " 메모 " }, now), {
    ok: true,
    value: { accountId: "a", year: 2026, amount: 100, memo: "메모" },
  });
  assert.equal(parseContributionBody({ year: 2026, amount: 1 }, now).ok, false);
  assert.equal(parseContributionBody({ accountId: "a", year: 2026, amount: -1 }, now).ok, false);
  assert.equal(parseContributionBody({ accountId: "a", year: 2026, amount: 1.5 }, now).ok, false);
  assert.equal(parseContributionBody(null, now).ok, false);
});

test("parseIncomeSourceBody: 정상 입력과 종신(endAge 없음)", () => {
  const parsed = parseIncomeSourceBody({
    member: "spouse",
    sourceType: "national_pension",
    monthlyAmount: 850_000,
    startAge: 65,
  });
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.equal(parsed.value.endAge, null);
    assert.equal(parsed.value.member, "spouse");
  }
});

test("parseIncomeSourceBody: 잘못된 값은 거부", () => {
  const base = { member: "self", sourceType: "pension_insurance", monthlyAmount: 1, startAge: 60 };
  assert.equal(parseIncomeSourceBody({ ...base, member: "child" }).ok, false);
  assert.equal(parseIncomeSourceBody({ ...base, sourceType: "lotto" }).ok, false);
  assert.equal(parseIncomeSourceBody({ ...base, monthlyAmount: -1 }).ok, false);
  assert.equal(parseIncomeSourceBody({ ...base, startAge: 20 }).ok, false);
  assert.equal(parseIncomeSourceBody({ ...base, endAge: 59 }).ok, false);
  assert.equal(parseIncomeSourceBody({ ...base, endAge: 70 }).ok, true);
});

test("parseRetirementGoalBody: 있는 항목만 담고, 현재 나이는 출생연도로 바꾼다", () => {
  assert.deepEqual(parseRetirementGoalBody({ targetMonthly: 3_000_000, currentAge: 45 }, now), {
    ok: true,
    value: { targetMonthly: 3_000_000, birthYear: 1981 },
  });
  assert.deepEqual(parseRetirementGoalBody({ salaryBracket: "high" }, now), {
    ok: true,
    value: { salaryBracket: "high" },
  });
  assert.deepEqual(parseRetirementGoalBody({ birthYear: 1980, currentAge: 10 }, now), {
    ok: true,
    value: { birthYear: 1980 },
  });
  assert.deepEqual(parseRetirementGoalBody({ expectedReturnPct: 4.567, retirementAge: "" }, now), {
    ok: true,
    value: { expectedReturnPct: 4.57, retirementAge: null },
  });
});

test("parseRetirementGoalBody: 범위 밖·빈 본문은 거부", () => {
  assert.equal(parseRetirementGoalBody({}, now).ok, false);
  assert.equal(parseRetirementGoalBody({ retirementAge: 20 }, now).ok, false);
  assert.equal(parseRetirementGoalBody({ expectedReturnPct: 50 }, now).ok, false);
  assert.equal(parseRetirementGoalBody({ salaryBracket: "mid" }, now).ok, false);
  assert.equal(parseRetirementGoalBody({ birthYear: 2030 }, now).ok, false);
});
