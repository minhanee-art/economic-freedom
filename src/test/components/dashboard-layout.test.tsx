import test, { after, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";

let pathname = "/dashboard/pnl";
const refreshCalls: number[] = [];

mock.module("next/navigation", {
  namedExports: {
    usePathname: () => pathname,
    useRouter: () => ({
      push: () => {},
      prefetch: () => {},
      refresh: () => refreshCalls.push(1),
    }),
  },
});

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let within: typeof import("@testing-library/react").within;
let DashboardLayout: typeof import("@/app/dashboard/layout").default;
let nav: typeof import("@/lib/dashboard-navigation");

const realFetch = globalThis.fetch;
let posted: unknown[] = [];

before(async () => {
  setupDom();
  const rtl = await import("@testing-library/react");
  ({ render, screen, fireEvent, cleanup, within } = rtl);
  DashboardLayout = (await import("@/app/dashboard/layout")).default;
  nav = await import("@/lib/dashboard-navigation");
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  cleanup();
  pathname = "/dashboard/pnl";
  posted = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (url === "/api/me") return new Response(JSON.stringify({ authenticated: true, email: "user@example.com" }));
    if (url === "/api/accounts" && (!init?.method || init.method === "GET")) {
      return new Response(JSON.stringify({ accounts: [{ id: "a1", name: "내 계좌", owner_type: "self" }], activeAccountId: "a1" }));
    }
    if (url === "/api/accounts" && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      posted.push(body);
      return new Response(JSON.stringify({ account: { id: "a2", name: body.name, owner_type: body.ownerType } }), { status: 201 });
    }
    return new Response("{}");
  }) as typeof fetch;
});

test("내비 데이터: 하단 탭은 앱과 같은 홈/자산/배당/연금/설정, 연금 설계는 1차 메뉴", () => {
  assert.deepEqual(nav.bottomNavItems.map((i) => i.shortLabel), ["홈", "자산", "배당", "연금", "설정"]);
  const labels = nav.dashboardNavGroups.map((g) => g.label);
  assert.ok(labels.includes("연금 설계"));
  assert.ok(labels.includes("기록"));
  assert.ok(!labels.includes("투자 실행"));
  const pension = nav.dashboardNavGroups.find((g) => g.label === "연금 설계")!;
  assert.deepEqual(pension.items.map((i) => i.href), ["/dashboard/retirement"]);
  assert.equal(nav.isNavItemActive({ href: "/dashboard" }, "/dashboard/pnl"), false);
  assert.equal(nav.isNavItemActive({ href: "/dashboard/children" }, "/dashboard/children/abc"), true);
});

test("레이아웃: 본문 건너뛰기 링크, 하단 내비 이름, 현재 위치 aria-current", async () => {
  render(<DashboardLayout><p>본문</p></DashboardLayout>);
  const skip = screen.getByRole("link", { name: "본문 바로가기" });
  assert.equal(skip.getAttribute("href"), "#main-content");
  assert.ok(document.getElementById("main-content"));

  const bottom = screen.getByRole("navigation", { name: "주요 메뉴" });
  const current = within(bottom).getByRole("link", { name: /자산/ });
  assert.equal(current.getAttribute("aria-current"), "page");
  assert.equal(within(bottom).getByRole("link", { name: /홈/ }).getAttribute("aria-current"), null);
  // 메뉴 검색은 없앴다
  assert.equal(screen.queryByText("메뉴 검색"), null);
});

test("레이아웃: 드롭다운은 클릭으로 열고 Esc 로 닫으며 aria-expanded 를 맞춘다", () => {
  render(<DashboardLayout><p>본문</p></DashboardLayout>);
  const main = screen.getByRole("navigation", { name: "대메뉴" });
  const group = within(main).getByRole("button", { name: /자산/ });
  assert.equal(group.getAttribute("aria-expanded"), "false");

  fireEvent.mouseEnter(group);
  assert.equal(group.getAttribute("aria-expanded"), "false", "마우스를 올리기만 해서는 열리지 않는다");

  fireEvent.click(group);
  assert.equal(group.getAttribute("aria-expanded"), "true");
  const panel = document.getElementById(group.getAttribute("aria-controls")!)!;
  assert.equal(panel.hidden, false);
  assert.equal(within(panel).getByRole("link", { name: /자산·손익/ }).getAttribute("aria-current"), "page");

  fireEvent.keyDown(group, { key: "Escape" });
  assert.equal(group.getAttribute("aria-expanded"), "false");
  assert.equal(panel.hidden, true);
});

test("레이아웃: 연금 설계는 드롭다운이 아닌 바로 가는 링크", () => {
  render(<DashboardLayout><p>본문</p></DashboardLayout>);
  const main = screen.getByRole("navigation", { name: "대메뉴" });
  assert.equal(within(main).getByRole("link", { name: "연금 설계" }).getAttribute("href"), "/dashboard/retirement");
});

test("레이아웃: 계좌 추가는 window.prompt 대신 인라인 폼(이름·명의)으로 저장한다", async () => {
  const promptCalls: unknown[] = [];
  window.prompt = ((...args: unknown[]) => {
    promptCalls.push(args);
    return null;
  }) as typeof window.prompt;

  render(<DashboardLayout><p>본문</p></DashboardLayout>);
  const add = await screen.findByRole("button", { name: "계좌 추가" });
  fireEvent.click(add);
  assert.equal(add.getAttribute("aria-expanded"), "true");

  // 이름 없이 저장하면 이유를 알려준다
  const form = screen.getByRole("form", { name: "계좌 추가" });
  fireEvent.click(within(form).getByRole("button", { name: "계좌 추가" }));
  assert.ok(await screen.findByText(/계좌 이름을 입력해 주세요/));

  fireEvent.change(screen.getByLabelText("계좌 이름"), { target: { value: "아내 IRP" } });
  fireEvent.change(screen.getByLabelText("명의"), { target: { value: "spouse" } });
  fireEvent.submit(form);

  await screen.findByRole("option", { name: "아내 IRP" });
  assert.deepEqual(posted, [{ name: "아내 IRP", ownerType: "spouse" }]);
  assert.equal(promptCalls.length, 0);
});
