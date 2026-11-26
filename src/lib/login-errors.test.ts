import test from "node:test";
import assert from "node:assert/strict";

import { loginErrorMessage } from "@/lib/login-errors";

test("알려진 코드는 고정 한국어 문구로 매핑된다", () => {
  assert.match(loginErrorMessage("google_unverified")!, /이메일 인증/);
  assert.match(loginErrorMessage("google_conflict")!, /이미 다른 Google 계정/);
  assert.match(loginErrorMessage("google_failed")!, /Google 로그인에 실패/);
});

test("모르는 코드는 입력값을 노출하지 않고 일반 문구를 쓴다", () => {
  const msg = loginErrorMessage("<script>alert(1)</script>")!;
  assert.ok(!msg.includes("script"));
  assert.match(msg, /오류가 발생/);
  assert.equal(loginErrorMessage("constructor"), loginErrorMessage("zzz"));
});

test("코드가 없으면 null, 배열이면 첫 값", () => {
  assert.equal(loginErrorMessage(undefined), null);
  assert.equal(loginErrorMessage(""), null);
  assert.equal(loginErrorMessage(["google_conflict", "x"]), loginErrorMessage("google_conflict"));
});
