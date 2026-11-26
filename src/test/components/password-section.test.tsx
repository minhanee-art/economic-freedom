import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let PasswordSection: typeof import("@/components/settings/password-section").PasswordSection;

const realFetch = globalThis.fetch;
let calls: { url: string; method: string; body: unknown }[] = [];
let hasPassword = true;
let postResponse: { status: number; body: unknown } = { status: 200, body: { ok: true, hasPassword: true } };

before(async () => {
  setupDom();
  const rtl = await import("@testing-library/react");
  ({ render, screen, fireEvent, cleanup } = rtl);
  ({ PasswordSection } = await import("@/components/settings/password-section"));
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  cleanup();
  calls = [];
  hasPassword = true;
  postResponse = { status: 200, body: { ok: true, hasPassword: true } };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url: String(input), method, body: init?.body ? JSON.parse(String(init.body)) : null });
    const payload = method === "GET" ? { status: 200, body: { hasPassword } } : postResponse;
    return new Response(JSON.stringify(payload.body), {
      status: payload.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit(name: string) {
  fireEvent.submit(screen.getByRole("button", { name }).closest("form") as HTMLFormElement);
}

test("PasswordSection: 비밀번호가 있으면 현재 비밀번호와 함께 변경을 요청한다", async () => {
  render(<PasswordSection />);
  assert.ok(await screen.findByRole("heading", { name: "비밀번호 변경" }));

  fill("현재 비밀번호", "old-password");
  fill("새 비밀번호 (6자 이상)", "new-password");
  fill("새 비밀번호 확인", "new-password");
  submit("비밀번호 변경");

  assert.ok(await screen.findByText("비밀번호를 변경했습니다."));
  assert.deepEqual(calls.at(-1), {
    url: "/api/auth/password",
    method: "POST",
    body: { currentPassword: "old-password", newPassword: "new-password" },
  });
});

test("PasswordSection: Google 전용 계정은 현재 비밀번호 없이 설정한다", async () => {
  hasPassword = false;
  render(<PasswordSection />);
  assert.ok(await screen.findByRole("heading", { name: "비밀번호 설정" }));
  assert.equal(screen.queryByLabelText("현재 비밀번호"), null);

  fill("새 비밀번호 (6자 이상)", "first-password");
  fill("새 비밀번호 확인", "first-password");
  submit("비밀번호 설정");

  assert.ok(await screen.findByText("비밀번호를 설정했습니다."));
  assert.deepEqual(calls.at(-1)?.body, { newPassword: "first-password" });
  // 설정 후에는 변경 모드로 바뀐다
  assert.ok(await screen.findByRole("heading", { name: "비밀번호 변경" }));
});

test("PasswordSection: 확인 값이 다르면 요청하지 않는다", async () => {
  render(<PasswordSection />);
  await screen.findByRole("heading", { name: "비밀번호 변경" });

  fill("현재 비밀번호", "old-password");
  fill("새 비밀번호 (6자 이상)", "new-password");
  fill("새 비밀번호 확인", "other-password");
  submit("비밀번호 변경");

  assert.ok(await screen.findByRole("alert"));
  assert.equal(calls.filter((call) => call.method === "POST").length, 0);
});

test("PasswordSection: 서버 오류 문구를 보여준다", async () => {
  postResponse = { status: 403, body: { error: "현재 비밀번호가 올바르지 않습니다." } };
  render(<PasswordSection />);
  await screen.findByRole("heading", { name: "비밀번호 변경" });

  fill("현재 비밀번호", "wrong");
  fill("새 비밀번호 (6자 이상)", "new-password");
  fill("새 비밀번호 확인", "new-password");
  submit("비밀번호 변경");

  assert.ok(await screen.findByText("현재 비밀번호가 올바르지 않습니다."));
});
