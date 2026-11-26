import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let waitFor: typeof import("@testing-library/react").waitFor;
let RetirementClient: typeof import("@/app/dashboard/retirement/retirement-client").RetirementClient;

const realFetch = globalThis.fetch;
let requests: { url: string; method: string; body: unknown }[] = [];

before(async () => {
  setupDom();
  const rtl = await import("@testing-library/react");
  ({ render, screen, fireEvent, cleanup, waitFor } = rtl);
  ({ RetirementClient } = await import("@/app/dashboard/retirement/retirement-client"));
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  cleanup();
  requests = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method: init?.method ?? "GET", body });
    return new Response(JSON.stringify({ ok: true, goal: { salaryBracket: "low" } }), { status: 200 });
  }) as typeof fetch;
});

const accounts = [
  { id: "a1", name: "연금저축", owner_type: "self", account_type: "pension_savings" as const, value: 10_000_000, annual_dividend: 0 },
  { id: "a2", name: "일반", owner_type: "self", account_type: "general" as const, value: 0, annual_dividend: 1_200_000 },
];

const emptyGoal = {
  targetMonthly: null,
  retirementAge: null,
  birthYear: null,
  spouseBirthYear: null,
  expectedReturnPct: null,
  salaryBracket: "low" as const,
};

test("세금 화면에 참고용 문구와 예상 공제액을 보여준다", () => {
  render(
    <RetirementClient
      year={2026}
      initialAccounts={accounts}
      initialContributions={{ a1: 4_000_000 }}
      initialSources={[]}
      initialGoal={emptyGoal}
    />
  );
  assert.ok(screen.getAllByText(/참고용이며 실제 세액과 다를 수 있습니다/).length >= 1);
  // 400만원 × 16.5%
  assert.ok(screen.getByText("₩660,000"));
  assert.ok(screen.getByText(/내 연금 알아보기/));
  assert.ok(screen.getByText(/목표 월 생활비·은퇴 나이·출생연도를 저장하면/));
});

test("목표가 있으면 은퇴 시점 현금흐름과 부족액을 계산한다", () => {
  render(
    <RetirementClient
      year={2026}
      initialAccounts={accounts}
      initialContributions={{}}
      initialSources={[
        { id: "s1", member: "self", source_type: "national_pension", label: null, monthly_amount: 1_000_000, start_age: 60, end_age: null, memo: null },
      ]}
      initialGoal={{ ...emptyGoal, targetMonthly: 2_000_000, retirementAge: 60, birthYear: 1966, expectedReturnPct: 0 }}
    />
  );
  // 60세: 국민연금 100만 + 연금저축 1,000만÷240개월 ≈ 41,667 + 배당 10만
  assert.ok(screen.getAllByText(/참고용이며 실제 세액과 다를 수 있습니다/).length >= 2);
  assert.ok(screen.getByText(/60세 예상 월 114.2만/));
});

test("총급여 구간을 바꾸면 은퇴 목표 API로 저장한다", async () => {
  render(
    <RetirementClient year={2026} initialAccounts={accounts} initialContributions={{}} initialSources={[]} initialGoal={emptyGoal} />
  );
  fireEvent.click(screen.getByLabelText(/총급여 5,500만원 초과/));
  await waitFor(() => assert.equal(requests.length, 1));
  assert.deepEqual(requests[0], { url: "/api/pension/goal", method: "PATCH", body: { salaryBracket: "high" } });
});
