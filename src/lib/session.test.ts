import test, { before } from "node:test";
import assert from "node:assert/strict";

// SECRET은 모듈 평가 시점에 만들어지므로, import 전에 테스트용 키를 넣는다.
let signToken: typeof import("@/lib/session").signToken;
let verifyToken: typeof import("@/lib/session").verifyToken;
let getBearerSession: typeof import("@/lib/session").getBearerSession;

before(async () => {
  process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";
  const session = await import("@/lib/session");
  signToken = session.signToken;
  verifyToken = session.verifyToken;
  getBearerSession = session.getBearerSession;
});

test("signToken·verifyToken: 같은 사용자 id를 되돌려준다", async () => {
  const token = await signToken("user-123");
  assert.equal(await verifyToken(token), "user-123");
});

test("verifyToken: 변조된 토큰은 거부한다", async () => {
  const token = await signToken("user-123");
  const [header, payload, signature] = token.split(".");
  const forged = `${header}.${payload}.${signature.slice(0, -2)}xx`;
  assert.equal(await verifyToken(forged), null);
});

test("verifyToken: 형식이 잘못된 값은 거부한다", async () => {
  assert.equal(await verifyToken(""), null);
  assert.equal(await verifyToken("not-a-jwt"), null);
});

test("getBearerSession: Bearer 토큰으로 사용자를 찾는다", async () => {
  const token = await signToken("user-456");
  const request = new Request("https://example.com/api/portfolio", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.deepEqual(await getBearerSession(request), { userId: "user-456" });
});

test("getBearerSession: 헤더가 없거나 형식이 다르면 null", async () => {
  const token = await signToken("user-456");

  assert.equal(await getBearerSession(new Request("https://example.com")), null);

  const wrongScheme = new Request("https://example.com", {
    headers: { authorization: `Basic ${token}` },
  });
  assert.equal(await getBearerSession(wrongScheme), null);

  const noToken = new Request("https://example.com", {
    headers: { authorization: "Bearer" },
  });
  assert.equal(await getBearerSession(noToken), null);
});

test("getBearerSession: 대소문자 구분 없이 Bearer를 받는다", async () => {
  const token = await signToken("user-789");
  const request = new Request("https://example.com", {
    headers: { authorization: `bearer ${token}` },
  });
  assert.deepEqual(await getBearerSession(request), { userId: "user-789" });
});
