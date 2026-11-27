import assert from "node:assert/strict";
import test from "node:test";
import { buildOnboardingSteps, isOnboardingComplete, type OnboardingFacts } from "@/lib/onboarding-steps";

const empty: OnboardingFacts = { hasPensionAccount: false, hasHoldings: false, hasPurchase: false, hasRetirementGoal: false };

test("빈 계정: 세 단계 모두 미완료, 순서는 연금 계좌 → 첫 매수 기록 → 은퇴 목표", () => {
  const steps = buildOnboardingSteps(empty);
  assert.deepEqual(steps.map((s) => s.key), ["pension-account", "first-purchase", "retirement-goal"]);
  assert.ok(steps.every((s) => !s.done));
  assert.equal(isOnboardingComplete(empty), false);
});

test("각 단계는 해당 화면으로 연결된다", () => {
  const hrefs = Object.fromEntries(buildOnboardingSteps(empty).map((s) => [s.key, s.href]));
  assert.equal(hrefs["pension-account"], "/dashboard/retirement#account-types");
  assert.equal(hrefs["first-purchase"], "/dashboard#holdings");
  assert.equal(hrefs["retirement-goal"], "/dashboard/retirement#retirement-goal");
});

test("종목만 있고 매수 기록이 없으면 2단계는 미완료이고 동작 이름이 '매수 기록'", () => {
  const step = buildOnboardingSteps({ ...empty, hasHoldings: true }).find((s) => s.key === "first-purchase")!;
  assert.equal(step.done, false);
  assert.equal(step.actionLabel, "매수 기록");
  assert.equal(buildOnboardingSteps(empty).find((s) => s.key === "first-purchase")!.actionLabel, "종목 추가");
});

test("세 단계를 모두 마치면 완료", () => {
  const facts: OnboardingFacts = { hasPensionAccount: true, hasHoldings: true, hasPurchase: true, hasRetirementGoal: true };
  assert.equal(isOnboardingComplete(facts), true);
  assert.equal(isOnboardingComplete({ ...facts, hasRetirementGoal: false }), false);
});
