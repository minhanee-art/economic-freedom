import test from "node:test";
import assert from "node:assert/strict";

import {
  computeFamilyTaxCredit,
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

// ── 명의자별 계산 (가족 계좌를 한 사람처럼 합치지 않는다) ──

test("세액공제: 부부가 연금저축에 각 600만원 → 명의자별 한도로 1,200만원 모두 공제 대상", () => {
  const family = computeFamilyTaxCredit(
    [
      { ownerType: "self", accountType: "pension_savings", amount: 6_000_000, accountId: "a" },
      { ownerType: "spouse", accountType: "pension_savings", amount: 6_000_000, accountId: "b" },
      { ownerType: "child", accountType: "pension_savings", amount: 1_000_000, accountId: "c" },
    ],
    { self: "low", spouse: null },
    rules
  );
  assert.equal(family.byOwner.length, 2);
  const [self, spouse] = family.byOwner;
  assert.equal(self.ownerType, "self");
  assert.equal(self.progress.creditableTotal, 6_000_000);
  assert.equal(self.progress.estimatedCredit, 990_000, "600만원 × 16.5%");
  assert.equal(self.salaryBracketAssumed, false);
  assert.equal(spouse.ownerType, "spouse");
  assert.equal(spouse.progress.creditableTotal, 6_000_000);
  assert.equal(spouse.salaryBracketAssumed, true, "배우자 소득 구간은 입력이 없어 가정");
  assert.equal(spouse.progress.estimatedCredit, 792_000, "600만원 × 13.2%(가정)");

  assert.equal(family.total.creditableTotal, 12_000_000, "한 사람 한도(600만원)로 자르지 않는다");
  assert.equal(family.total.nonCreditablePaid, 0);
  assert.equal(family.total.estimatedCredit, 1_782_000);
  assert.equal(family.total.maxCredit, 1_485_000 + 1_188_000);
  assert.equal(family.total.remainingCreditRoom, 6_000_000, "각자 IRP로 300만원씩 더 공제 가능");
  assert.equal(family.total.remainingPensionSavingsRoom, 0);
  assert.equal(Math.round(family.total.progressPct), 67);

  assert.deepEqual(family.excluded, [
    { accountId: "c", ownerType: "child", accountType: "pension_savings", amount: 1_000_000, reason: "child_or_other_owner" },
  ]);
});

test("세액공제: 배우자 구간을 입력하면 그 구간의 공제율을 쓰고 가정으로 표시하지 않는다", () => {
  const low = rules.taxCredit.rates.low.rate;
  const high = rules.taxCredit.rates.high.rate;
  const family = computeFamilyTaxCredit(
    [
      { ownerType: "self", accountType: "pension_savings", amount: 6_000_000 },
      { ownerType: "spouse", accountType: "irp", amount: 9_000_000 },
    ],
    { self: "high", spouse: "low" },
    rules
  );
  const [self, spouse] = family.byOwner;
  assert.equal(self.salaryBracket, "high");
  assert.equal(self.salaryBracketAssumed, false);
  assert.equal(self.progress.rate, high);
  assert.equal(self.progress.estimatedCredit, Math.round(6_000_000 * high));

  assert.equal(spouse.salaryBracket, "low");
  assert.equal(spouse.salaryBracketAssumed, false, "입력했으므로 가정 아님");
  assert.equal(spouse.progress.rate, low, "본인과 다른 구간의 공제율");
  assert.equal(spouse.progress.estimatedCredit, Math.round(9_000_000 * low));

  assert.equal(family.total.estimatedCredit, self.progress.estimatedCredit + spouse.progress.estimatedCredit);
  assert.ok(family.byOwner.every((o) => !o.salaryBracketAssumed));
});

test("세액공제: 배우자 구간 미입력이면 낮은 공제율로 가정하고, 입력하면 공제액이 바뀐다", () => {
  const items = [{ ownerType: "spouse", accountType: "pension_savings" as const, amount: 6_000_000 }];
  const missing = computeFamilyTaxCredit(items, { self: "low", spouse: null }, rules).byOwner[0];
  assert.equal(missing.ownerType, "spouse");
  assert.equal(missing.salaryBracket, "high", "미입력 → 총급여 5,500만원 초과(낮은 공제율)로 가정");
  assert.equal(missing.salaryBracketAssumed, true);
  assert.equal(missing.progress.estimatedCredit, Math.round(6_000_000 * rules.taxCredit.rates.high.rate));

  const entered = computeFamilyTaxCredit(items, { self: "low", spouse: "low" }, rules).byOwner[0];
  assert.equal(entered.salaryBracketAssumed, false);
  assert.equal(entered.progress.estimatedCredit, Math.round(6_000_000 * rules.taxCredit.rates.low.rate));

  // 배우자가 'high'를 직접 고른 경우: 공제액은 가정과 같지만 가정 표시는 하지 않는다
  const enteredHigh = computeFamilyTaxCredit(items, { self: "low", spouse: "high" }, rules).byOwner[0];
  assert.equal(enteredHigh.progress.estimatedCredit, missing.progress.estimatedCredit);
  assert.equal(enteredHigh.salaryBracketAssumed, false);
});

test("세액공제: 본인 구간이 미입력이어도 배우자 구간은 따로 적용한다", () => {
  const family = computeFamilyTaxCredit(
    [
      { ownerType: "self", accountType: "pension_savings", amount: 6_000_000 },
      { ownerType: "spouse", accountType: "pension_savings", amount: 6_000_000 },
    ],
    { self: null, spouse: "low" },
    rules
  );
  assert.deepEqual(
    family.byOwner.map((o) => [o.ownerType, o.salaryBracket, o.salaryBracketAssumed]),
    [
      ["self", "high", true],
      ["spouse", "low", false],
    ]
  );
});

test("세액공제: 한 명의자 안에서는 기존처럼 600만원 한도로 자른다", () => {
  const family = computeFamilyTaxCredit(
    [
      { ownerType: "self", accountType: "pension_savings", amount: 6_000_000 },
      { ownerType: "self", accountType: "pension_savings", amount: 6_000_000 },
    ],
    { self: "low", spouse: null },
    rules
  );
  assert.equal(family.byOwner.length, 1);
  assert.equal(family.total.creditableTotal, 6_000_000);
  assert.equal(family.total.estimatedCredit, 990_000);
  assert.deepEqual(family.total, family.byOwner[0].progress);
});

test("현금흐름: 배우자(45세) 명의 연금 잔액은 본인 60세가 아니라 배우자 55세부터 받는다", () => {
  const coupleGoal: RetirementGoal = {
    targetMonthly: 3_000_000,
    retirementAge: 60,
    birthYear: 1966, // 2026년 60세
    spouseBirthYear: 1981, // 2026년 45세
    expectedReturnPct: 0,
  };
  const result = computeRetirementCashflow(
    coupleGoal,
    [],
    [{ id: "sp", ownerType: "spouse", accountType: "pension_savings", value: 24_000_000, annualDividend: 0 }],
    { currentYear: 2026, payoutYears: 20, horizonAge: 95 }
  );
  const spouse = result.annuities.find((a) => a.ownerType === "spouse")!;
  assert.equal(spouse.ownerStartAge, 55);
  assert.equal(spouse.startAge, 70, "본인 나이 기준 70세(배우자 55세)");
  assert.equal(spouse.monthlyPrivate, 100_000);
  assert.equal(result.annuity.monthlyPrivate, 0, "본인 명의 계좌는 없음");

  const at = (age: number) => result.rows.find((row) => row.age === age)!;
  assert.equal(at(60).layers.private, 0, "배우자 55세 전에는 연금수령 불가");
  assert.equal(at(69).layers.private, 0);
  assert.equal(at(70).layers.private, 100_000);
  assert.equal(at(89).layers.private, 100_000);
  assert.equal(at(90).layers.private, 0);
  assert.deepEqual(result.excludedAccounts, []);

  // 배우자 출생연도가 없으면 수령 시점을 지어내지 않고 제외한다
  const unknown = computeRetirementCashflow(
    { ...coupleGoal, spouseBirthYear: null },
    [],
    [{ id: "sp", ownerType: "spouse", accountType: "pension_savings", value: 24_000_000, annualDividend: 0 }],
    { currentYear: 2026 }
  );
  assert.equal(unknown.rows.every((row) => row.layers.private === 0), true);
  assert.deepEqual(unknown.excludedAccounts, [
    { id: "sp", ownerType: "spouse", accountType: "pension_savings", value: 24_000_000, reason: "spouse_birth_year_missing" },
  ]);
});

test("현금흐름: 80세 사용자(은퇴 나이 60)는 현재 잔액을 올해부터 나눠 받는다", () => {
  const result = computeRetirementCashflow(
    { targetMonthly: 1_000_000, retirementAge: 60, birthYear: 1946, spouseBirthYear: null, expectedReturnPct: 0 },
    [],
    [
      { accountType: "pension_savings", value: 24_000_000, annualDividend: 0 },
      { accountType: "dc", value: 12_000_000, annualDividend: 0 },
    ],
    { currentYear: 2026, payoutYears: 20, horizonAge: 90 }
  );
  assert.equal(result.currentAge, 80);
  assert.equal(result.annuity.startAge, 80, "과거(60~79세)에 배치하지 않는다");
  assert.equal(result.rows[0].age, 80);
  assert.equal(result.atRetirement.layers.private, 100_000);
  assert.equal(result.atRetirement.layers.retirement, 50_000);
  assert.equal(result.rows.find((r) => r.age === 90)!.layers.private, 100_000);
  assert.equal(result.coveragePctAtRetirement, 15);
});

test("현금흐름: 자녀·기타 명의 계좌는 연금화·배당 모두 제외", () => {
  const result = computeRetirementCashflow(
    goal,
    [],
    [
      { id: "k", ownerType: "child", accountType: "general", value: 10_000_000, annualDividend: 1_200_000 },
      { id: "o", ownerType: "other", accountType: "irp", value: 24_000_000, annualDividend: 0 },
      { id: "s", ownerType: "spouse", accountType: "general", value: 1, annualDividend: 120_000 },
    ],
    { currentYear: 2026 }
  );
  assert.equal(result.atRetirement.layers.dividend, 10_000, "배우자 배당만 포함");
  assert.equal(result.atRetirement.layers.private, 0);
  assert.deepEqual(
    result.excludedAccounts.map((e) => [e.id, e.reason]),
    [
      ["k", "child_or_other_owner"],
      ["o", "child_or_other_owner"],
    ]
  );
});
