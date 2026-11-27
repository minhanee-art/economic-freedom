import test from "node:test";
import assert from "node:assert/strict";

import type { AccountSnapshotRow, RetirementGoalRow } from "@/lib/pension-data";
import { buildPensionSummary } from "@/lib/pension-summary";

const account = (id: string, owner_type: string, account_type: AccountSnapshotRow["account_type"], value = 0): AccountSnapshotRow => ({
  id,
  name: `계좌 ${id}`,
  owner_type,
  account_type,
  value,
  annual_dividend: 0,
});

const goal: RetirementGoalRow = {
  targetMonthly: 3_000_000,
  retirementAge: 60,
  birthYear: 1966,
  spouseBirthYear: 1981,
  expectedReturnPct: 0,
  salaryBracket: "low",
  spouseSalaryBracket: null,
};

const contribution = (account_id: string, amount: number) => ({
  id: `c-${account_id}`,
  account_id,
  year: 2026,
  amount,
  memo: null,
  updated_at: "2026-11-27",
});

test("summary: 부부 각 600만원 — 기존 progress 는 가족 합계, byOwner 에 명의자별 값", () => {
  const s = buildPensionSummary({
    year: 2026,
    asOf: "2026-11-27T00:00:00.000Z",
    accounts: [account("a", "self", "pension_savings"), account("b", "spouse", "pension_savings"), account("k", "child", "pension_savings")],
    contributions: [contribution("a", 6_000_000), contribution("b", 6_000_000), contribution("k", 1_000_000)],
    sources: [],
    goal,
  });
  assert.ok(s.taxCredit);
  // 모바일이 읽는 기존 필드
  assert.equal(s.taxCredit.progress.estimatedCredit, 1_782_000);
  assert.equal(s.taxCredit.progress.remainingCreditRoom, 6_000_000);
  assert.equal(s.taxCredit.progress.maxCredit, 2_673_000);
  assert.equal(typeof s.taxCredit.progress.progressPct, "number");
  assert.equal(s.taxCredit.contributionsRecorded, true);
  assert.equal(s.taxCredit.salaryBracket, "low");
  assert.equal(s.taxCredit.salaryBracketAssumed, true, "배우자 구간이 가정이므로 알린다");
  assert.equal(s.taxCredit.accounts.length, 3);
  // 새 필드
  assert.deepEqual(
    s.taxCredit.byOwner.map((o) => [o.ownerType, o.progress.estimatedCredit, o.salaryBracketAssumed]),
    [
      ["self", 990_000, false],
      ["spouse", 792_000, true],
    ]
  );
  assert.deepEqual(
    s.taxCredit.excludedAccounts.map((e) => [e.id, e.name, e.reason]),
    [["k", "계좌 k", "child_or_other_owner"]]
  );
  assert.equal(s.taxCredit.accounts.find((a) => a.id === "k")!.included, false);
});

test("summary: 배우자 구간을 저장하면 배우자 공제율에 반영하고 가정 안내를 끈다", () => {
  const s = buildPensionSummary({
    year: 2026,
    asOf: "x",
    accounts: [account("a", "self", "pension_savings"), account("b", "spouse", "pension_savings")],
    contributions: [contribution("a", 6_000_000), contribution("b", 6_000_000)],
    sources: [],
    goal: { ...goal, salaryBracket: "high", spouseSalaryBracket: "low" },
  });
  assert.ok(s.taxCredit);
  assert.equal(s.goal.spouseSalaryBracket, "low", "goal 응답에 배우자 구간이 실린다");
  assert.equal(s.taxCredit.salaryBracket, "high", "기존 필드는 본인 구간");
  assert.equal(s.taxCredit.salaryBracketAssumed, false, "둘 다 입력했으므로 가정 없음");
  assert.deepEqual(
    s.taxCredit.byOwner.map((o) => [o.ownerType, o.salaryBracket, o.progress.estimatedCredit, o.salaryBracketAssumed]),
    [
      ["self", "high", 792_000, false],
      ["spouse", "low", 990_000, false],
    ]
  );
  assert.equal(s.taxCredit.progress.estimatedCredit, 1_782_000);
});

test("summary: 프로필이 없으면 goal 기본값에 spouseSalaryBracket 이 null 로 있다", () => {
  const s = buildPensionSummary({ year: 2026, asOf: "x", accounts: [], contributions: [], sources: [], goal: null });
  assert.equal(s.goal.spouseSalaryBracket, null);
});

test("summary: 공제 대상 계좌가 모두 자녀 명의면 계산하지 않고 이유를 준다", () => {
  const s = buildPensionSummary({
    year: 2026,
    asOf: "x",
    accounts: [account("k", "child", "pension_savings")],
    contributions: [],
    sources: [],
    goal,
  });
  assert.equal(s.taxCredit, null);
  assert.equal(s.taxCreditUnavailableReason, "only_excluded_owner_accounts");
});

test("summary: 배우자(45세) 명의 잔액은 배우자 55세부터, 기존 cashflow 필드 유지", () => {
  const s = buildPensionSummary({
    year: 2026,
    asOf: "x",
    accounts: [account("b", "spouse", "pension_savings", 24_000_000), account("k", "child", "irp", 5_000_000)],
    contributions: [],
    sources: [],
    goal,
  });
  const cf = s.retirement.cashflow;
  assert.ok(cf);
  assert.equal(cf.atRetirement.age, 60);
  assert.equal(cf.atRetirement.layers.private, 0);
  assert.equal(cf.coveragePctAtRetirement, 0);
  assert.equal(cf.expectedReturnAssumed, false);
  assert.equal(cf.rows.find((r) => r.age === 70)!.layers.private, 100_000);
  assert.deepEqual(
    cf.annuities.map((a) => [a.ownerType, a.startAge, a.ownerStartAge]),
    [
      ["self", 60, 60],
      ["spouse", 70, 55],
    ]
  );
  assert.deepEqual(
    cf.excludedAccounts.map((e) => [e.id, e.name, e.reason]),
    [["k", "계좌 k", "child_or_other_owner"]]
  );
});

test("summary: 80세 사용자 — 은퇴 시점 행은 올해(80세)이고 계좌 연금 소득이 있다", () => {
  const s = buildPensionSummary({
    year: 2026,
    asOf: "x",
    accounts: [account("a", "self", "pension_savings", 24_000_000)],
    contributions: [],
    sources: [],
    goal: { ...goal, birthYear: 1946, spouseBirthYear: null },
  });
  const cf = s.retirement.cashflow;
  assert.ok(cf);
  assert.equal(cf.atRetirement.age, 80);
  assert.equal(cf.atRetirement.layers.private, 100_000);
  assert.equal(cf.pensionIncomeTaxRateAtRetirement, 0.033);
});
