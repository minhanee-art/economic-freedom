// 로그인 무차별 대입 방어 — 클라이언트 IP 추출과 메모리 폴백 한도
import assert from "node:assert/strict";
import test from "node:test";

import { authRateLimit, clientIp } from "@/lib/rate-limit";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/auth/login", { headers });
}

test("clientIp — Vercel이 설정한 x-vercel-forwarded-for를 우선 신뢰한다", () => {
  const ip = clientIp(
    req({
      "x-vercel-forwarded-for": "203.0.113.9",
      "x-forwarded-for": "198.51.100.1",
      "x-real-ip": "192.0.2.1",
    })
  );
  assert.equal(ip, "203.0.113.9");
});

test("clientIp — x-forwarded-for의 첫 IP만 쓰고 공백을 제거한다", () => {
  assert.equal(
    clientIp(req({ "x-forwarded-for": " 198.51.100.7 , 10.0.0.1, 10.0.0.2" })),
    "198.51.100.7"
  );
});

test("clientIp — 헤더가 없으면 x-real-ip, 그것도 없으면 unknown", () => {
  assert.equal(clientIp(req({ "x-real-ip": "192.0.2.44" })), "192.0.2.44");
  assert.equal(clientIp(req({})), "unknown");
});

test("clientIp — 빈 헤더 값은 unknown으로 떨어진다", () => {
  assert.equal(clientIp(req({ "x-forwarded-for": "   " })), "unknown");
});

test("authRateLimit — 10분에 10회까지 허용하고 11회째를 막는다", async () => {
  const id = "login:203.0.113.1:limit@test.local";
  for (let i = 1; i <= 10; i += 1) {
    assert.equal(await authRateLimit(id), true, `${i}번째 시도는 허용되어야 한다`);
  }
  assert.equal(await authRateLimit(id), false, "11번째 시도는 차단되어야 한다");
});

test("authRateLimit — 식별자가 다르면 한도를 공유하지 않는다", async () => {
  const a = "login:203.0.113.2:a@test.local";
  const b = "login:203.0.113.3:a@test.local";
  for (let i = 0; i < 10; i += 1) await authRateLimit(a);
  assert.equal(await authRateLimit(a), false);
  assert.equal(await authRateLimit(b), true);
});
