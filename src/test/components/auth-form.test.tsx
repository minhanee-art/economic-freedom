import test, { after, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";

const router = { push: [] as string[] };

mock.module("next/navigation", {
  namedExports: {
    useRouter: () => ({
      push: (path: string) => {
        router.push.push(path);
      },
    }),
  },
});

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let AuthForm: typeof import("@/components/ui/auth-form").AuthForm;

const realFetch = globalThis.fetch;
let fetchCalls: { url: string; body: unknown }[] = [];
let fetchResponse: { status: number; body: unknown } = { status: 200, body: { ok: true } };

before(async () => {
  setupDom();
  const rtl = await import("@testing-library/react");
  render = rtl.render;
  screen = rtl.screen;
  fireEvent = rtl.fireEvent;
  cleanup = rtl.cleanup;
  ({ AuthForm } = await import("@/components/ui/auth-form"));
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  cleanup();
  localStorage.clear();
  router.push = [];
  fetchCalls = [];
  fetchResponse = { status: 200, body: { ok: true } };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({
      url: typeof input === "string" ? input : input.toString(),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify(fetchResponse.body), {
      status: fetchResponse.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

function fillAndSubmit(email = "a@b.com", password = "secret123") {
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: password } });
  fireEvent.submit(screen.getByRole("button", { name: "로그인" }).closest("form") as HTMLFormElement);
}

test("AuthForm 로그인: 성공하면 대시보드로 이동한다", async () => {
  render(<AuthForm mode="login" />);
  fillAndSubmit();

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(fetchCalls[0], {
    url: "/api/auth/login",
    body: { email: "a@b.com", password: "secret123" },
  });
  assert.deepEqual(router.push, ["/dashboard"]);
});

test("AuthForm 로그인: 실패하면 서버 메시지를 보여주고 이동하지 않는다", async () => {
  fetchResponse = { status: 401, body: { error: "이메일 또는 비밀번호가 올바르지 않습니다." } };
  render(<AuthForm mode="login" />);
  fillAndSubmit();

  assert.ok(await screen.findByText("이메일 또는 비밀번호가 올바르지 않습니다."));
  assert.deepEqual(router.push, []);
  assert.equal((screen.getByRole("button", { name: "로그인" }) as HTMLButtonElement).disabled, false);
});

test("AuthForm 로그인: 아이디 저장을 체크하면 이메일을 남기고, 해제하면 지운다", async () => {
  render(<AuthForm mode="login" />);
  fireEvent.click(screen.getByLabelText("아이디 저장"));
  fillAndSubmit("me@b.com");

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(localStorage.getItem("pension-manager-saved-email"), "me@b.com");

  cleanup();
  localStorage.setItem("pension-manager-saved-email", "old@b.com");
  render(<AuthForm mode="login" />);
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "new@b.com" } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "secret123" } });
  const checkbox = screen.getByLabelText("아이디 저장") as HTMLInputElement;
  fireEvent.click(checkbox); // 체크 해제
  fireEvent.submit(screen.getByRole("button", { name: "로그인" }).closest("form") as HTMLFormElement);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(localStorage.getItem("pension-manager-saved-email"), null);
});

test("AuthForm 로그인: 저장된 이메일을 불러와 체크 상태로 시작한다", async () => {
  localStorage.setItem("pension-manager-saved-email", "saved@b.com");
  render(<AuthForm mode="login" />);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal((screen.getByLabelText("이메일") as HTMLInputElement).value, "saved@b.com");
  assert.equal((screen.getByLabelText("아이디 저장") as HTMLInputElement).checked, true);
});

test("AuthForm 회원가입: 성공하면 가입 완료 화면을 보여준다", async () => {
  render(<AuthForm mode="signup" />);
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "new@b.com" } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "secret123" } });
  fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "secret123" } });
  fireEvent.submit(screen.getByRole("button", { name: "회원가입" }).closest("form") as HTMLFormElement);

  assert.ok(await screen.findByText("가입 완료"));
  assert.equal(fetchCalls[0].url, "/api/auth/signup");
  assert.deepEqual(router.push, [], "가입은 바로 이동하지 않는다");
});

test("AuthForm 로그인: initialError가 있으면 처음부터 안내 문구를 보여준다", () => {
  render(<AuthForm mode="login" initialError="이 이메일은 이미 다른 Google 계정에 연결되어 있습니다." />);
  assert.ok(screen.getByText("이 이메일은 이미 다른 Google 계정에 연결되어 있습니다."));
});

test("AuthForm 회원가입: 비밀번호 확인이 다르면 요청하지 않고 오류로 초점을 옮긴다", async () => {
  render(<AuthForm mode="signup" />);
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "new@b.com" } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "secret123" } });
  fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "secret124" } });
  assert.ok(screen.getByText("비밀번호가 서로 다릅니다."), "입력 중에도 불일치를 알려준다");
  fireEvent.submit(screen.getByRole("button", { name: "회원가입" }).closest("form") as HTMLFormElement);

  const alert = await screen.findByRole("alert");
  assert.match(alert.textContent ?? "", /비밀번호가 서로 다릅니다/);
  assert.equal(fetchCalls.length, 0);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(document.activeElement, alert);
});

test("AuthForm 회원가입: 개인정보처리방침 동의 안내와 링크가 있다", () => {
  render(<AuthForm mode="signup" />);
  const link = screen.getByRole("link", { name: "개인정보처리방침" });
  assert.equal(link.getAttribute("href"), "/privacy");
  assert.match(link.parentElement?.textContent ?? "", /가입하면 개인정보처리방침에 동의한 것으로 봅니다/);
});

test("AuthForm: 네트워크 오류면 '로그인 중'에 멈추지 않고 alert로 알린다", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;
  render(<AuthForm mode="login" />);
  fillAndSubmit();

  const alert = await screen.findByRole("alert");
  assert.match(alert.textContent ?? "", /서버에 연결하지 못했습니다/);
  const button = screen.getByRole("button", { name: "로그인" }) as HTMLButtonElement;
  assert.equal(button.disabled, false);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(document.activeElement, alert);
});

test("AuthForm: 서버 오류 문구는 role=alert로 보인다", async () => {
  fetchResponse = { status: 401, body: { error: "이메일 또는 비밀번호가 올바르지 않습니다." } };
  render(<AuthForm mode="login" />);
  fillAndSubmit();
  const alert = await screen.findByRole("alert");
  assert.equal(alert.textContent, "이메일 또는 비밀번호가 올바르지 않습니다.");
});

test("AuthForm: 자동완성 속성이 모드에 맞다", () => {
  render(<AuthForm mode="login" />);
  assert.equal(screen.getByLabelText("이메일").getAttribute("autocomplete"), "email");
  assert.equal(screen.getByLabelText("비밀번호").getAttribute("autocomplete"), "current-password");
  cleanup();
  render(<AuthForm mode="signup" />);
  assert.equal(screen.getByLabelText("비밀번호").getAttribute("autocomplete"), "new-password");
  assert.equal(screen.getByLabelText("비밀번호 확인").getAttribute("autocomplete"), "new-password");
});

test("AuthForm: 비밀번호 표시 버튼으로 입력값을 보였다 숨긴다", () => {
  render(<AuthForm mode="login" />);
  const input = screen.getByLabelText("비밀번호") as HTMLInputElement;
  assert.equal(input.type, "password");
  fireEvent.click(screen.getByRole("button", { name: "비밀번호 표시" }));
  assert.equal(input.type, "text");
  fireEvent.click(screen.getByRole("button", { name: "비밀번호 숨기기" }));
  assert.equal(input.type, "password");
});

test("AuthForm: 제목은 한 번만, 그라디언트 버튼 없이", () => {
  const { container } = render(<AuthForm mode="login" />);
  assert.equal(container.querySelectorAll("h1").length, 1);
  assert.equal(screen.getByRole("heading", { level: 1 }).textContent, "로그인");
  assert.equal(screen.queryByText("계정에 로그인하세요"), null);
  assert.equal(container.innerHTML.includes("bg-gradient"), false);
});
