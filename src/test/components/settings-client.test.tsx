import test, { after, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";

// useSearchParams 는 지금 주소(jsdom window.location)를 그대로 읽는다 — pushState 뒤 다시 그리면 바뀐 값을 본다
mock.module("next/navigation", {
  namedExports: {
    useRouter: () => ({ push: () => {}, refresh: () => {}, prefetch: () => {}, replace: () => {} }),
    useSearchParams: () => new URLSearchParams(window.location.search),
    usePathname: () => window.location.pathname,
  },
});

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let within: typeof import("@testing-library/react").within;
let SettingsClient: typeof import("@/app/dashboard/settings/settings-client").SettingsClient;
let parseSettingsTab: typeof import("@/components/settings/settings-tabs").parseSettingsTab;
let settingsTabHref: typeof import("@/components/settings/settings-tabs").settingsTabHref;

const realFetch = globalThis.fetch;
let calls: { url: string; method: string; body: unknown }[] = [];

before(async () => {
  setupDom("https://pension.test/dashboard/settings");
  const rtl = await import("@testing-library/react");
  ({ render, screen, fireEvent, cleanup, within } = rtl);
  ({ SettingsClient } = await import("@/app/dashboard/settings/settings-client"));
  ({ parseSettingsTab, settingsTabHref } = await import("@/components/settings/settings-tabs"));
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  cleanup();
  calls = [];
  window.history.replaceState(null, "", "/dashboard/settings");
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    const body =
      url === "/api/auth/password" ? { hasPassword: true }
      : url === "/api/me" ? { authenticated: true, email: "user@example.com", hasPassword: true }
      : url === "/api/telegram-link" ? { accountName: "내 계좌", linked: false, chatIdMasked: null, verifiedAt: null, needsRelink: false, botUsername: null }
      : { ok: true };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
});

const profile = {
  id: "user-1",
  email: "user@example.com",
  display_name: "홍길동",
  monthly_budget: 500_000,
  last_price_update: null,
  created_at: "2026-01-01",
};

function renderSettings(props: Partial<Parameters<typeof SettingsClient>[0]> = {}) {
  return render(
    <SettingsClient profile={profile} holdings={[]} watchlist={[]} dividendCalendar={[]} userId="user-1" hasGoogle={false} hasPassword {...props} />
  );
}

const selectedTab = () => screen.getAllByRole("tab").find((t) => t.getAttribute("aria-selected") === "true")!;
const visiblePanel = () => screen.getAllByRole("tabpanel").find((p) => !p.hidden)!;

test("탭 쿼리 해석: 모르는 값·빈 값은 계정 탭, 링크는 ?tab= 과 해시를 붙인다", () => {
  assert.equal(parseSettingsTab(null), "account");
  assert.equal(parseSettingsTab("nope"), "account");
  assert.equal(parseSettingsTab("alerts"), "alerts");
  assert.equal(parseSettingsTab(["data", "x"]), "data");
  assert.equal(settingsTabHref("alerts", "dividend-calendar"), "/dashboard/settings?tab=alerts#dividend-calendar");
});

test("설정: 기본은 계정 탭 — 이메일을 입력칸이 아닌 글자로, 로그인 방식과 로그아웃을 한곳에", async () => {
  renderSettings();
  const tabs = screen.getAllByRole("tab");
  assert.deepEqual(tabs.map((t) => t.textContent), ["계정", "투자", "알림", "화면", "데이터 삭제"]);
  assert.equal(selectedTab().textContent, "계정");
  assert.equal(within(screen.getByRole("tablist")).getAllByRole("tab").filter((t) => t.tabIndex === 0).length, 1, "선택한 탭만 Tab 키로 들어간다");

  const panel = visiblePanel();
  assert.equal(panel.getAttribute("aria-labelledby"), selectedTab().id);
  const email = within(panel).getByText("user@example.com");
  assert.equal(email.tagName, "SPAN", "이메일은 읽기 전용 입력칸이 아니라 글자");
  assert.equal(email.id, "settings-email");
  assert.equal(within(panel).getByTestId("settings-login-method").firstChild?.textContent, "이메일·비밀번호");
  assert.ok(within(panel).getByRole("button", { name: "로그아웃" }));
  assert.ok(within(panel).getByRole("button", { name: "이메일 복사" }));
  // 표시 이름에는 무엇에 쓰이는지 설명이 붙는다
  const name = within(panel).getByRole("textbox", { name: "표시 이름" }) as HTMLInputElement;
  assert.equal(name.value, "홍길동");
  assert.equal(name.getAttribute("autocomplete"), "nickname");
  assert.match(document.getElementById(name.getAttribute("aria-describedby")!)!.textContent!, /이메일 대신 보이는 이름/);
  // 계정 삭제는 계정 탭 안(맨 아래)
  assert.ok(await within(panel).findByRole("heading", { name: "계정 삭제" }));
  // 다른 탭의 내용은 숨어 있다
  assert.equal(screen.getByTestId("settings-panel-data").hidden, true);
});

test("설정: Google 계정은 로그인 방식에 Google 이라 적는다", () => {
  renderSettings({ hasGoogle: true, hasPassword: false });
  assert.equal(screen.getByTestId("settings-login-method").firstChild?.textContent, "Google");
});

test("설정: ?tab= 딥링크로 그 탭이 열리고, 탭을 누르면 주소가 바뀐다(뒤로 가기용 기록 추가)", () => {
  window.history.replaceState(null, "", "/dashboard/settings?tab=alerts");
  renderSettings();
  assert.equal(selectedTab().textContent, "알림");
  assert.ok(within(visiblePanel()).getByRole("heading", { name: /배당 일정/ }));
  assert.ok(document.getElementById("dividend-calendar"), "홈의 '설정에서 등록' 링크가 가리키는 앵커");

  const before = window.history.length;
  fireEvent.click(screen.getByRole("tab", { name: "투자" }));
  assert.equal(window.location.search, "?tab=invest");
  assert.equal(window.history.length, before + 1);
  assert.equal(selectedTab().textContent, "투자");
  assert.ok(within(visiblePanel()).getByRole("textbox", { name: "월 적립금" }));
});

test("설정: 주소의 ?tab= 이 바뀌면(뒤로 가기·링크) 탭이 따라간다", () => {
  const view = renderSettings();
  fireEvent.click(screen.getByRole("tab", { name: "화면" }));
  assert.equal(selectedTab().textContent, "화면");
  // 뒤로 가기로 주소가 계정 탭으로 돌아온 상황
  window.history.replaceState(null, "", "/dashboard/settings?tab=account");
  view.rerender(
    <SettingsClient profile={profile} holdings={[]} watchlist={[]} dividendCalendar={[]} userId="user-1" hasGoogle={false} hasPassword />
  );
  assert.equal(selectedTab().textContent, "계정");
});

test("설정: 탭은 ←/→·Home/End 로 옮기고 옮긴 탭에 초점이 간다", () => {
  renderSettings();
  const account = screen.getByRole("tab", { name: "계정" });
  account.focus();
  fireEvent.keyDown(account, { key: "ArrowRight" });
  assert.equal(selectedTab().textContent, "투자");
  assert.equal(document.activeElement, selectedTab());
  fireEvent.keyDown(selectedTab(), { key: "End" });
  assert.equal(selectedTab().textContent, "데이터 삭제");
  fireEvent.keyDown(selectedTab(), { key: "ArrowRight" });
  assert.equal(selectedTab().textContent, "계정", "끝에서 오른쪽은 처음으로");
  fireEvent.keyDown(selectedTab(), { key: "ArrowLeft" });
  assert.equal(selectedTab().textContent, "데이터 삭제");
  fireEvent.keyDown(selectedTab(), { key: "Home" });
  assert.equal(selectedTab().textContent, "계정");
  assert.equal(window.location.search, "?tab=account");
});

test("설정: 표시 이름만 저장하면 월 적립금은 보내지 않는다(그대로 유지)", async () => {
  renderSettings();
  fireEvent.change(screen.getByRole("textbox", { name: "표시 이름" }), { target: { value: "  새 이름 " } });
  let headerName: unknown = "unset";
  const onSaved = (e: Event) => { headerName = (e as CustomEvent).detail; };
  window.addEventListener("settings:display-name-saved", onSaved);
  fireEvent.click(screen.getByRole("button", { name: "표시 이름 저장" }));
  assert.ok(await screen.findByText("표시 이름을 저장했습니다."));
  window.removeEventListener("settings:display-name-saved", onSaved);

  const patches = calls.filter((c) => c.url === "/api/settings" && c.method === "PATCH");
  assert.deepEqual(patches.map((c) => c.body), [{ displayName: "새 이름" }]);
  assert.equal(headerName, "새 이름", "헤더 이름도 새로고침 없이 바뀐다");
  assert.equal(screen.getByTestId("settings-toast").getAttribute("role"), "status");
  assert.equal(screen.getByTestId("settings-toast").getAttribute("aria-live"), "polite");
});

test("설정: 월 적립금만 저장하면 표시 이름은 보내지 않는다(그대로 유지)", async () => {
  window.history.replaceState(null, "", "/dashboard/settings?tab=invest");
  renderSettings();
  const input = screen.getByRole("textbox", { name: "월 적립금" }) as HTMLInputElement;
  assert.equal(input.value, "500,000");
  fireEvent.change(input, { target: { value: "1200000" } });
  assert.equal(input.value, "1,200,000", "입력 중에도 천 단위 쉼표");
  fireEvent.click(screen.getByRole("button", { name: "월 적립금 저장" }));
  assert.ok(await screen.findByText("월 적립금을 저장했습니다."));

  const patches = calls.filter((c) => c.url === "/api/settings" && c.method === "PATCH");
  assert.deepEqual(patches.map((c) => c.body), [{ monthlyBudget: 1_200_000 }]);
});

test("설정: 저장이 실패하면 그 칸 아래에 원인과 다시 시도 안내(role=alert)", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/settings" && init?.method === "PATCH") return new Response("{}", { status: 500 });
    return new Response(JSON.stringify({ hasPassword: true }), { status: 200 });
  }) as typeof fetch;
  renderSettings();
  fireEvent.click(screen.getByRole("button", { name: "표시 이름 저장" }));
  const alert = await screen.findByText(/표시 이름을 저장하지 못했습니다/);
  assert.equal(alert.getAttribute("role"), "alert");
});

test("설정: 데이터 삭제 탭의 전체 삭제는 확인 대화상자를 거친다", async () => {
  window.history.replaceState(null, "", "/dashboard/settings?tab=data");
  renderSettings();
  fireEvent.click(within(visiblePanel()).getByRole("button", { name: /배당 기록 전체 삭제/ }));
  const dialog = await screen.findByRole("alertdialog");
  assert.match(dialog.textContent ?? "", /배당 기록을 모두 삭제할까요/);
  fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 0);
});
