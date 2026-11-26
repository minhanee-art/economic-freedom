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
  fireEvent.submit(screen.getByRole("button", { name: "회원가입" }).closest("form") as HTMLFormElement);

  assert.ok(await screen.findByText("가입 완료"));
  assert.equal(fetchCalls[0].url, "/api/auth/signup");
  assert.deepEqual(router.push, [], "가입은 바로 이동하지 않는다");
});

test("AuthForm 로그인: initialError가 있으면 처음부터 안내 문구를 보여준다", () => {
  render(<AuthForm mode="login" initialError="이 이메일은 이미 다른 Google 계정에 연결되어 있습니다." />);
  assert.ok(screen.getByText("이 이메일은 이미 다른 Google 계정에 연결되어 있습니다."));
});
