import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";
import type { RetirementGoalRow } from "@/lib/pension-data";

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

const emptyGoal: RetirementGoalRow = {
  targetMonthly: null,
  retirementAge: null,
  birthYear: null,
  spouseBirthYear: null,
  expectedReturnPct: null,
  salaryBracket: "low" as const,
  spouseSalaryBracket: null,
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

test("배우자 총급여 구간을 은퇴 목표와 함께 저장하고, 저장 후 배우자 공제율에 반영한다", async () => {
  // 서버가 저장한 목표를 그대로 돌려주는 스텁
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method: init?.method ?? "GET", body });
    return new Response(JSON.stringify({ goal: { ...emptyGoal, ...body } }), { status: 200 });
  }) as typeof fetch;
  const familyAccounts = [
    { id: "a1", name: "내 연금저축", owner_type: "self", account_type: "pension_savings" as const, value: 0, annual_dividend: 0 },
    { id: "b1", name: "배우자 연금저축", owner_type: "spouse", account_type: "pension_savings" as const, value: 0, annual_dividend: 0 },
  ];
  render(
    <RetirementClient
      year={2026}
      initialAccounts={familyAccounts}
      initialContributions={{ a1: 4_000_000, b1: 4_000_000 }}
      initialSources={[]}
      initialGoal={emptyGoal}
    />
  );
  // 미입력: 배우자는 13.2%로 가정하고 안내한다
  assert.ok(screen.getByText(/배우자: .*공제율 13\.2%.*배우자 소득 구간 미입력 — 낮은 공제율로 가정/));

  const select = screen.getByRole("combobox", { name: /배우자 총급여 구간/ }) as HTMLSelectElement;
  assert.equal(select.value, "");
  fireEvent.change(select, { target: { value: "low" } });
  fireEvent.click(screen.getByRole("button", { name: "목표 저장" }));
  await waitFor(() => assert.equal(requests.length, 1));
  assert.equal(requests[0].url, "/api/pension/goal");
  assert.equal(requests[0].method, "PATCH");
  assert.equal((requests[0].body as { spouseSalaryBracket: unknown }).spouseSalaryBracket, "low");

  // 저장 후: 배우자 400만원 × 16.5% = 66만원, 가정 안내 사라짐
  await waitFor(() => assert.ok(screen.getByText(/배우자: .*예상 공제액 ₩660,000 · 공제율 16\.5%/)));
  assert.equal(screen.queryByText(/배우자 소득 구간 미입력/), null);
  assert.ok(screen.getByText("₩1,320,000"), "가족 합계 예상 공제액");
});

test("배우자 총급여 구간을 미입력으로 되돌리면 null로 저장한다", async () => {
  render(
    <RetirementClient
      year={2026}
      initialAccounts={accounts}
      initialContributions={{}}
      initialSources={[]}
      initialGoal={{ ...emptyGoal, spouseSalaryBracket: "high" }}
    />
  );
  const select = screen.getByRole("combobox", { name: /배우자 총급여 구간/ }) as HTMLSelectElement;
  assert.equal(select.value, "high");
  fireEvent.change(select, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "목표 저장" }));
  await waitFor(() => assert.equal(requests.length, 1));
  assert.equal((requests[0].body as { spouseSalaryBracket: unknown }).spouseSalaryBracket, null);
});

// ── 배우자 항목: 기본으로 숨기고, 배우자 데이터가 있거나 '배우자 정보 추가'를 누르면 보인다 ──

/** 서버가 받은 항목을 저장한 목표로 돌려주는 스텁 */
function echoGoalFetch(base: RetirementGoalRow) {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method: init?.method ?? "GET", body });
    return new Response(JSON.stringify({ goal: { ...base, ...body } }), { status: 200 });
  }) as typeof fetch;
}

const realConfirm = globalThis.confirm;
let confirmMessages: string[] = [];
function stubConfirm(answer: boolean) {
  confirmMessages = [];
  globalThis.confirm = ((message?: string) => {
    confirmMessages.push(String(message));
    return answer;
  }) as typeof confirm;
}
after(() => {
  globalThis.confirm = realConfirm;
});

const spouseAccount = { id: "b1", name: "배우자 IRP", owner_type: "spouse", account_type: "irp" as const, value: 0, annual_dividend: 0 };
const spouseSource = {
  id: "s2",
  member: "spouse" as const,
  source_type: "national_pension" as const,
  label: null,
  monthly_amount: 500_000,
  start_age: 65,
  end_age: null,
  memo: null,
};

test("배우자 데이터가 없으면 배우자 입력란·배우자 목록 블록 없이 '배우자 정보 추가' 버튼만 보인다", async () => {
  echoGoalFetch(emptyGoal);
  render(<RetirementClient year={2026} initialAccounts={accounts} initialContributions={{}} initialSources={[]} initialGoal={emptyGoal} />);
  assert.ok(screen.getByRole("button", { name: "배우자 정보 추가" }));
  assert.equal(screen.queryByLabelText(/배우자 출생연도/), null);
  assert.equal(screen.queryByRole("combobox", { name: /배우자 총급여 구간/ }), null);
  assert.equal(screen.queryByRole("button", { name: "배우자 정보 제거" }), null);
  // 연금 소득원: 배우자 빈 블록('배우자' 제목 + '입력한 항목이 없습니다.')이 없다. 구성원 선택지의 '배우자'는 남는다.
  assert.equal(screen.getAllByText("입력한 항목이 없습니다.").length, 1);
  assert.ok(screen.getAllByRole("option", { name: "배우자" }).length >= 1);
  assert.equal(screen.queryByText(/배우자 소득 구간 미입력/), null);

  // 접힌 상태로 저장하면 배우자 항목은 보내지 않는다
  fireEvent.click(screen.getByRole("button", { name: "목표 저장" }));
  await waitFor(() => assert.equal(requests.length, 1));
  const body = requests[0].body as Record<string, unknown>;
  assert.equal("spouseBirthYear" in body, false);
  assert.equal("spouseSalaryBracket" in body, false);
});

test("'배우자 정보 추가'를 누르면 배우자 입력란이 보이고, 입력값을 저장한다", async () => {
  echoGoalFetch(emptyGoal);
  render(<RetirementClient year={2026} initialAccounts={accounts} initialContributions={{}} initialSources={[]} initialGoal={emptyGoal} />);
  fireEvent.click(screen.getByRole("button", { name: "배우자 정보 추가" }));
  const birth = screen.getByLabelText(/배우자 출생연도/) as HTMLInputElement;
  const select = screen.getByRole("combobox", { name: /배우자 총급여 구간/ }) as HTMLSelectElement;
  assert.equal(screen.queryByRole("button", { name: "배우자 정보 추가" }), null);
  // 연금 소득원에 배우자 블록이 생긴다
  assert.equal(screen.getAllByText("입력한 항목이 없습니다.").length, 2);

  fireEvent.change(birth, { target: { value: "1982" } });
  fireEvent.change(select, { target: { value: "low" } });
  fireEvent.click(screen.getByRole("button", { name: "목표 저장" }));
  await waitFor(() => assert.equal(requests.length, 1));
  const body = requests[0].body as Record<string, unknown>;
  assert.equal(body.spouseBirthYear, 1982);
  assert.equal(body.spouseSalaryBracket, "low");
  // 저장 후에도 펼친 상태를 유지한다(저장된 배우자 데이터가 생겼으므로)
  await waitFor(() => assert.ok(screen.getByText("저장했습니다.")));
  assert.ok(screen.getByLabelText(/배우자 출생연도/));
});

test("저장된 값 없이 추가만 했다면 '배우자 정보 제거'는 확인 없이 접기만 한다", () => {
  stubConfirm(true);
  render(<RetirementClient year={2026} initialAccounts={accounts} initialContributions={{}} initialSources={[]} initialGoal={emptyGoal} />);
  fireEvent.click(screen.getByRole("button", { name: "배우자 정보 추가" }));
  fireEvent.change(screen.getByLabelText(/배우자 출생연도/), { target: { value: "1982" } });
  fireEvent.click(screen.getByRole("button", { name: "배우자 정보 제거" }));
  assert.equal(confirmMessages.length, 0);
  assert.equal(requests.length, 0);
  assert.equal(screen.queryByLabelText(/배우자 출생연도/), null);
  // 다시 열면 입력하던 값은 비어 있다
  fireEvent.click(screen.getByRole("button", { name: "배우자 정보 추가" }));
  assert.equal((screen.getByLabelText(/배우자 출생연도/) as HTMLInputElement).value, "");
});

for (const [label, props] of [
  ["배우자 출생연도", { goal: { ...emptyGoal, spouseBirthYear: 1982 }, accounts, sources: [] }],
  ["배우자 총급여 구간", { goal: { ...emptyGoal, spouseSalaryBracket: "high" as const }, accounts, sources: [] }],
  ["배우자 명의 계좌", { goal: emptyGoal, accounts: [...accounts, spouseAccount], sources: [] }],
  ["배우자 연금 소득원", { goal: emptyGoal, accounts, sources: [spouseSource] }],
] as const) {
  test(`${label}가 저장되어 있으면 처음부터 배우자 입력란이 펼쳐져 있다`, () => {
    render(
      <RetirementClient
        year={2026}
        initialAccounts={[...props.accounts]}
        initialContributions={{}}
        initialSources={[...props.sources]}
        initialGoal={props.goal}
      />
    );
    assert.ok(screen.getByLabelText(/배우자 출생연도/));
    assert.ok(screen.getByRole("combobox", { name: /배우자 총급여 구간/ }));
    assert.equal(screen.queryByRole("button", { name: "배우자 정보 추가" }), null);
  });
}

test("'배우자 정보 제거'는 확인을 받은 뒤 배우자 출생연도·총급여 구간만 null로 저장하고 접는다", async () => {
  const saved = { ...emptyGoal, spouseBirthYear: 1982, spouseSalaryBracket: "low" as const };
  echoGoalFetch(saved);
  stubConfirm(true);
  render(<RetirementClient year={2026} initialAccounts={accounts} initialContributions={{}} initialSources={[]} initialGoal={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "배우자 정보 제거" }));
  assert.equal(confirmMessages.length, 1);
  assert.match(confirmMessages[0], /배우자 출생연도와 배우자 총급여 구간을 지웁니다/);
  await waitFor(() => assert.equal(requests.length, 1));
  assert.deepEqual(requests[0], {
    url: "/api/pension/goal",
    method: "PATCH",
    body: { spouseBirthYear: null, spouseSalaryBracket: null },
  });
  await waitFor(() => assert.ok(screen.getByRole("button", { name: "배우자 정보 추가" })));
  assert.equal(screen.queryByLabelText(/배우자 출생연도/), null);
  assert.ok(screen.getByText("배우자 출생연도·총급여 구간을 지웠습니다."));
});

test("제거 확인을 취소하면 아무것도 저장하지 않는다", () => {
  stubConfirm(false);
  render(
    <RetirementClient
      year={2026}
      initialAccounts={accounts}
      initialContributions={{}}
      initialSources={[]}
      initialGoal={{ ...emptyGoal, spouseBirthYear: 1982 }}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "배우자 정보 제거" }));
  assert.equal(confirmMessages.length, 1);
  assert.equal(requests.length, 0);
  assert.equal((screen.getByLabelText(/배우자 출생연도/) as HTMLInputElement).value, "1982");
});

test("배우자 명의 계좌가 남아 있으면 확인창과 화면에 안내하고, 계좌는 지우지 않으며 입력란은 펼친 채로 둔다", async () => {
  const saved = { ...emptyGoal, spouseBirthYear: 1982 };
  echoGoalFetch(saved);
  stubConfirm(true);
  render(
    <RetirementClient
      year={2026}
      initialAccounts={[...accounts, spouseAccount]}
      initialContributions={{}}
      initialSources={[]}
      initialGoal={saved}
    />
  );
  assert.ok(screen.getByText(/배우자 명의 계좌 1개가 있어 배우자 정보를 표시합니다/));
  fireEvent.click(screen.getByRole("button", { name: "배우자 정보 제거" }));
  assert.match(confirmMessages[0], /배우자 명의 계좌 1개는 지우지 않고 그대로 남습니다/);
  await waitFor(() => assert.equal(requests.length, 1));
  assert.deepEqual(requests[0].body, { spouseBirthYear: null, spouseSalaryBracket: null });
  assert.ok(requests.every((r) => r.url === "/api/pension/goal"), "계좌·소득원 API는 부르지 않는다");
  // 계좌가 남아 있으므로 펼친 채로, 지울 값이 없으니 제거 버튼은 사라진다
  await waitFor(() => assert.equal(screen.queryByRole("button", { name: "배우자 정보 제거" }), null));
  assert.equal((screen.getByLabelText(/배우자 출생연도/) as HTMLInputElement).value, "");
  assert.ok(screen.getByText(/배우자 명의 계좌 1개가 있어 배우자 정보를 표시합니다/));
});
