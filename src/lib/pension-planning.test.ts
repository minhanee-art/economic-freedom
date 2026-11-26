import test from "node:test";
import assert from "node:assert/strict";

import {
  computeRetirementCashflow,
  computeTaxCreditProgress,
  futureValue,
  monthlyAnnuityPayment,
  type RetirementGoal,
} from "@/lib/pension-planning";
import { getPensionRules } from "@/lib/pension-rules";

const rules = getPensionRules(2026);

test("세액공제: 납입이 없으면 0, 한도 전부 남음", () => {
  const p = computeTaxCreditProgress([], "low", rules);
  assert.equal(p.creditableTotal, 0);
  assert.equal(p.estimatedCredit, 0);
  assert.equal(p.remainingCreditRoom, 9_000_000);
  assert.equal(p.remainingPensionSavingsRoom, 6_000_000);
  assert.equal(p.maxCredit, 1_485_000);
});

test("세액공제: 연금저축은 600만원까지만, 합산은 900만원까지만 공제 대상", () => {
  const p = computeTaxCreditProgress(
    [
      { accountType: "pension_savings", amount: 8_000_000 },
      { accountType: "irp", amount: 2_000_000 },
    ],
    "low",
    rules
  );
  assert.equal(p.creditablePensionSavings, 6_000_000);
  assert.equal(p.creditableTotal, 8_000_000);
  assert.equal(p.nonCreditablePaid, 2_000_000);
  assert.equal(p.remainingCreditRoom, 1_000_000);
  assert.equal(p.remainingPensionSavingsRoom, 0, "연금저축 한도는 이미 소진");
  assert.equal(p.estimatedCredit, 1_320_000);

  const full = computeTaxCreditProgress([{ accountType: "irp", amount: 12_000_000 }], "high", rules);
  assert.equal(full.creditableTotal, 9_000_000);
  assert.equal(full.progressPct, 100);
  assert.equal(full.estimatedCredit, 1_188_000);
});

test("세액공제: DC 본인 납입은 퇴직연금으로, ISA·일반·자녀는 공제 대상 아님", () => {
  const p = computeTaxCreditProgress(
    [
      { accountType: "dc", amount: 1_000_000 },
      { accountType: "isa", amount: 21_000_000 },
      { accountType: "general", amount: 5_000_000 },
      { accountType: "child", amount: 5_000_000 },
    ],
    "low",
    rules
  );
  assert.equal(p.retirementPaid, 1_000_000);
  assert.equal(p.creditableTotal, 1_000_000);
  assert.equal(p.isaPaid, 21_000_000);
  assert.equal(p.overIsaAnnualLimit, true);
  assert.equal(p.overAnnualContributionLimit, false);
});

test("세액공제: 연금계좌 연 1,800만원 초과와 음수·NaN 납입 처리", () => {
  const p = computeTaxCreditProgress(
    [
      { accountType: "pension_savings", amount: 10_000_000 },
      { accountType: "irp", amount: 9_000_000 },
      { accountType: "irp", amount: -5 },
      { accountType: "irp", amount: Number.NaN },
    ],
    "low",
    rules
  );
  assert.equal(p.pensionPaid, 19_000_000);
  assert.equal(p.overAnnualContributionLimit, true);
});

test("monthlyAnnuityPayment / futureValue 기본값", () => {
  assert.equal(monthlyAnnuityPayment(0, 4, 20), 0);
  assert.equal(monthlyAnnuityPayment(2_400_000, 0, 20), 10_000);
  // 1억원, 연 4%, 20년 → 약 60.6만원
  assert.equal(monthlyAnnuityPayment(100_000_000, 4, 20), 605_980);
  assert.equal(futureValue(1_000_000, 10, 2), 1_210_000);
  assert.equal(futureValue(1_000_000, 10, -3), 1_000_000);
});

const goal: RetirementGoal = {
  targetMonthly: 3_000_000,
  retirementAge: 60,
  birthYear: 1976, // 2026년 50세
  spouseBirthYear: 1979, // 3살 아래
  expectedReturnPct: 0,
};

test("현금흐름: 국민연금 개시 전 공백과 배우자 나이 차이를 반영한다", () => {
  const result = computeRetirementCashflow(
    goal,
    [
      { member: "self", sourceType: "national_pension", monthlyAmount: 1_200_000, startAge: 65, endAge: null },
      { member: "spouse", sourceType: "national_pension", monthlyAmount: 600_000, startAge: 65, endAge: null },
      { member: "self", sourceType: "pension_insurance", monthlyAmount: 300_000, startAge: 60, endAge: 69 },
    ],
    [
      { accountType: "irp", value: 24_000_000, annualDividend: 999_999 },
      { accountType: "general", value: 50_000_000, annualDividend: 1_200_000 },
    ],
    { currentYear: 2026, payoutYears: 20, horizonAge: 90 }
  );

  assert.equal(result.currentAge, 50);
  assert.equal(result.yearsToRetirement, 10);
  assert.equal(result.annuity.startAge, 60);
  assert.equal(result.annuity.monthlyPrivate, 100_000, "2,400만원 ÷ 240개월 (수익률 0%)");

  const at = (age: number) => result.rows.find((row) => row.age === age)!;
  // 60세: 연금보험 30만 + IRP 10만 + 일반계좌 배당 10만 (IRP 배당은 제외)
  assert.deepEqual(at(60).layers, { public: 0, retirement: 0, private: 400_000, dividend: 100_000 });
  assert.equal(at(60).shortfall, 2_500_000);
  // 65세: 본인 국민연금만 (배우자는 62세)
  assert.equal(at(65).layers.public, 1_200_000);
  // 68세: 배우자 65세 → 둘 다
  assert.equal(at(68).layers.public, 1_800_000);
  // 70세: 연금보험 종료
  assert.equal(at(70).layers.private, 100_000);
  // 80세: 계좌 연금화(60~79세) 종료
  assert.equal(at(80).layers.private, 0);
  assert.equal(result.rows[result.rows.length - 1].age, 90);
  assert.equal(result.firstCoveredAge, null);
  assert.equal(result.maxShortfall, 2_500_000);
  assert.equal(result.coveragePctAtRetirement, 17);
});

test("현금흐름: 55세 전 은퇴면 계좌 연금화는 55세부터, 목표 충족 나이를 찾는다", () => {
  const result = computeRetirementCashflow(
    { ...goal, retirementAge: 52, targetMonthly: 1_000_000, spouseBirthYear: null },
    [{ member: "self", sourceType: "retirement_pension", monthlyAmount: 1_000_000, startAge: 56, endAge: null }],
    [{ accountType: "dc", value: 12_000_000, annualDividend: 0 }],
    { currentYear: 2026, payoutYears: 10 }
  );
  assert.equal(result.annuity.startAge, 55);
  assert.equal(result.rows[0].age, 52);
  assert.equal(result.rows.find((r) => r.age === 54)!.layers.retirement, 0);
  assert.equal(result.rows.find((r) => r.age === 55)!.layers.retirement, 100_000);
  assert.equal(result.firstCoveredAge, 56);
});

test("현금흐름: 이미 은퇴 나이를 지났으면 남은 기간 0", () => {
  const result = computeRetirementCashflow(
    { ...goal, retirementAge: 45 },
    [],
    [{ accountType: "pension_savings", value: 1_000_000, annualDividend: 0 }],
    { currentYear: 2026, horizonAge: 50 }
  );
  assert.equal(result.yearsToRetirement, 0);
  assert.equal(result.projectedBalances.private, 1_000_000);
  assert.equal(result.rows[0].age, 50, "지난 나이는 건너뛴다");
  assert.equal(result.rows.length, 1);
});
