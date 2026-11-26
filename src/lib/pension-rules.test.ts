import test from "node:test";
import assert from "node:assert/strict";

import { getPensionRules, pensionIncomeTaxRate, unverifiedRuleTopics, SUPPORTED_RULE_YEARS } from "@/lib/pension-rules";

test("getPensionRules: 등록 연도는 exact, 이후 연도는 직전 연도 값을 쓴다", () => {
  assert.equal(getPensionRules(2026).exact, true);
  const future = getPensionRules(2030);
  assert.equal(future.exact, false);
  assert.equal(future.year, SUPPORTED_RULE_YEARS[SUPPORTED_RULE_YEARS.length - 1]);
  assert.equal(getPensionRules(2000).year, SUPPORTED_RULE_YEARS[0]);
});

test("2026 수치: 공제 한도·공제율·납입 한도", () => {
  const r = getPensionRules(2026);
  assert.equal(r.taxCredit.pensionSavingsLimit, 6_000_000);
  assert.equal(r.taxCredit.combinedLimit, 9_000_000);
  assert.equal(r.taxCredit.rates.low.rate, 0.165);
  assert.equal(r.taxCredit.rates.high.rate, 0.132);
  assert.equal(r.annualContributionLimit, 18_000_000);
  assert.equal(r.isa.annualLimit, 20_000_000);
});

test("종신계약 세율: 2025년 4.4%, 2026년 3.3%", () => {
  assert.equal(getPensionRules(2025).pensionIncomeTax.lifetimeContractRate, 0.044);
  assert.equal(getPensionRules(2026).pensionIncomeTax.lifetimeContractRate, 0.033);
});

test("pensionIncomeTaxRate: 나이 구간별 세율, 55세 미만은 null", () => {
  const r = getPensionRules(2026);
  assert.equal(pensionIncomeTaxRate(r, 54), null);
  assert.equal(pensionIncomeTaxRate(r, 55), 0.055);
  assert.equal(pensionIncomeTaxRate(r, 69), 0.055);
  assert.equal(pensionIncomeTaxRate(r, 70), 0.044);
  assert.equal(pensionIncomeTaxRate(r, 85), 0.033);
});

test("모든 출처에 URL이 있고, 미검증 항목은 목록으로 나온다", () => {
  const r = getPensionRules(2026);
  assert.ok(r.sources.length > 0);
  for (const s of r.sources) assert.match(s.url, /^https:\/\//);
  assert.ok(unverifiedRuleTopics(r).some((t) => t.includes("지방소득세")));
});
