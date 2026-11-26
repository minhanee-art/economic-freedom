import test, { before } from "node:test";
import assert from "node:assert/strict";

// SECRET은 모듈 평가 시점에 만들어지므로, import 전에 테스트용 키를 넣는다.
let signToken: typeof import("@/lib/session").signToken;
let verifyToken: typeof import("@/lib/session").verifyToken;
let getBearerSession: typeof import("@/lib/session").getBearerSession;
let getRequestSession: typeof import("@/lib/session").getRequestSession;

before(async () => {
  process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";
  const session = await import("@/lib/session");
  signToken = session.signToken;
  verifyToken = session.verifyToken;
  getBearerSession = session.getBearerSession;
  getRequestSession = session.getRequestSession;
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

test("getBearerSession: 토큰 뒤에 값이 더 붙으면 거부한다", async () => {
  const token = await signToken("user-789");
  const request = new Request("https://example.com", {
    headers: { authorization: `Bearer ${token} extra` },
  });
  assert.equal(await getBearerSession(request), null);
});

test("verifyToken: 다른 비밀키로 서명한 토큰은 거부한다", async () => {
  const { SignJWT } = await import("jose");
  const forged = await new SignJWT({ sub: "user-123" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("attacker-secret"));
  assert.equal(await verifyToken(forged), null);
});

test("verifyToken: alg none 토큰은 거부한다", async () => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: "user-123" })}.`;
  assert.equal(await verifyToken(unsigned), null);
});

test("verifyToken: 만료된 토큰은 거부한다", async () => {
  const { SignJWT } = await import("jose");
  const expired = await new SignJWT({ sub: "user-123" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  assert.equal(await verifyToken(expired), null);
});

test("signToken: 발급 시각(iat)과 30일 만료(exp)를 담는다", async () => {
  const { decodeJwt } = await import("jose");
  const payload = decodeJwt(await signToken("user-1"));
  assert.equal(typeof payload.iat, "number");
  assert.equal((payload.exp ?? 0) - (payload.iat ?? 0), 30 * 24 * 60 * 60);
});

// ── getRequestSession: 쿠키 우선, 없으면 Bearer ──────────────

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/holdings", { headers });
}

test("getRequestSession: 세션 쿠키로 사용자를 찾는다", async () => {
  const token = await signToken("cookie-user");
  const session = await getRequestSession(requestWith({ cookie: `theme=dark; pension-session=${token}` }));
  assert.deepEqual(session, { userId: "cookie-user", source: "cookie" });
});

test("getRequestSession: 쿠키가 없으면 Bearer 토큰을 쓴다", async () => {
  const token = await signToken("bearer-user");
  const session = await getRequestSession(requestWith({ authorization: `Bearer ${token}` }));
  assert.deepEqual(session, { userId: "bearer-user", source: "bearer" });
});

test("getRequestSession: 둘 다 있으면 쿠키가 우선한다", async () => {
  const cookieToken = await signToken("cookie-user");
  const bearerToken = await signToken("bearer-user");
  const session = await getRequestSession(
    requestWith({ cookie: `pension-session=${cookieToken}`, authorization: `Bearer ${bearerToken}` })
  );
  assert.deepEqual(session, { userId: "cookie-user", source: "cookie" });
});

test("getRequestSession: 쿠키가 무효하면 Bearer로 넘어간다", async () => {
  const bearerToken = await signToken("bearer-user");
  const session = await getRequestSession(
    requestWith({ cookie: "pension-session=garbage", authorization: `Bearer ${bearerToken}` })
  );
  assert.deepEqual(session, { userId: "bearer-user", source: "bearer" });
});

test("getRequestSession: 인증 정보가 없거나 모두 무효하면 null", async () => {
  assert.equal(await getRequestSession(requestWith({})), null);
  assert.equal(
    await getRequestSession(requestWith({ cookie: "pension-session=bad", authorization: "Bearer bad" })),
    null
  );
  // 이름이 비슷한 다른 쿠키는 세션으로 보지 않는다
  const token = await signToken("user-1");
  assert.equal(await getRequestSession(requestWith({ cookie: `x-pension-session=${token}` })), null);
});
