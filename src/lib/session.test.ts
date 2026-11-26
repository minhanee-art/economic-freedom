import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { answerSessionVersion, createFakeSql } from "@/test/api-helpers";

// 토큰 폐기 확인용 가짜 users.session_version — 없는 사용자는 삭제된 것으로 본다.
const versions = new Map<string, number>();
const db = createFakeSql((query, values) => answerSessionVersion(query, values, versions) ?? []);
mock.module("@/lib/db", { namedExports: { sql: db.sql } });

const KNOWN_USERS = ["user-123", "user-456", "user-789", "user-1", "cookie-user", "bearer-user"];

// SECRET은 모듈 평가 시점에 만들어지므로, import 전에 테스트용 키를 넣는다.
let decodeToken: typeof import("@/lib/session").decodeToken;
let getOptimisticRequestSession: typeof import("@/lib/session").getOptimisticRequestSession;
let signToken: typeof import("@/lib/session").signToken;
let verifyToken: typeof import("@/lib/session").verifyToken;
let getBearerSession: typeof import("@/lib/session").getBearerSession;
let getRequestSession: typeof import("@/lib/session").getRequestSession;

before(async () => {
  process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";
  const session = await import("@/lib/session");
  signToken = session.signToken;
  decodeToken = session.decodeToken;
  getOptimisticRequestSession = session.getOptimisticRequestSession;
  verifyToken = session.verifyToken;
  getBearerSession = session.getBearerSession;
  getRequestSession = session.getRequestSession;
});

beforeEach(() => {
  db.reset();
  versions.clear();
  for (const id of KNOWN_USERS) versions.set(id, 0);
});

test("signToken·verifyToken: 같은 사용자 id를 되돌려준다", async () => {
  const token = await signToken("user-123", 0);
  assert.equal(await verifyToken(token), "user-123");
});

test("verifyToken: 변조된 토큰은 거부한다", async () => {
  const token = await signToken("user-123", 0);
  const [header, payload, signature] = token.split(".");
  const forged = `${header}.${payload}.${signature.slice(0, -2)}xx`;
  assert.equal(await verifyToken(forged), null);
});

test("verifyToken: 형식이 잘못된 값은 거부한다", async () => {
  assert.equal(await verifyToken(""), null);
  assert.equal(await verifyToken("not-a-jwt"), null);
});

test("getBearerSession: Bearer 토큰으로 사용자를 찾는다", async () => {
  const token = await signToken("user-456", 0);
  const request = new Request("https://example.com/api/portfolio", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.deepEqual(await getBearerSession(request), { userId: "user-456" });
});

test("getBearerSession: 헤더가 없거나 형식이 다르면 null", async () => {
  const token = await signToken("user-456", 0);

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
  const token = await signToken("user-789", 0);
  const request = new Request("https://example.com", {
    headers: { authorization: `bearer ${token}` },
  });
  assert.deepEqual(await getBearerSession(request), { userId: "user-789" });
});

test("getBearerSession: 토큰 뒤에 값이 더 붙으면 거부한다", async () => {
  const token = await signToken("user-789", 0);
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
  const payload = decodeJwt(await signToken("user-1", 0));
  assert.equal(typeof payload.iat, "number");
  assert.equal((payload.exp ?? 0) - (payload.iat ?? 0), 30 * 24 * 60 * 60);
});

// ── getRequestSession: 쿠키 우선, 없으면 Bearer ──────────────

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/holdings", { headers });
}

test("getRequestSession: 세션 쿠키로 사용자를 찾는다", async () => {
  const token = await signToken("cookie-user", 0);
  const session = await getRequestSession(requestWith({ cookie: `theme=dark; pension-session=${token}` }));
  assert.deepEqual(session, { userId: "cookie-user", source: "cookie" });
});

test("getRequestSession: 쿠키가 없으면 Bearer 토큰을 쓴다", async () => {
  const token = await signToken("bearer-user", 0);
  const session = await getRequestSession(requestWith({ authorization: `Bearer ${token}` }));
  assert.deepEqual(session, { userId: "bearer-user", source: "bearer" });
});

test("getRequestSession: 둘 다 있으면 쿠키가 우선한다", async () => {
  const cookieToken = await signToken("cookie-user", 0);
  const bearerToken = await signToken("bearer-user", 0);
  const session = await getRequestSession(
    requestWith({ cookie: `pension-session=${cookieToken}`, authorization: `Bearer ${bearerToken}` })
  );
  assert.deepEqual(session, { userId: "cookie-user", source: "cookie" });
});

test("getRequestSession: 쿠키가 무효하면 Bearer로 넘어간다", async () => {
  const bearerToken = await signToken("bearer-user", 0);
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
  const token = await signToken("user-1", 0);
  assert.equal(await getRequestSession(requestWith({ cookie: `x-pension-session=${token}` })), null);
});

// ── 토큰 폐기: session_version ──────────────────────────

test("signToken: 세션 버전을 sv 클레임에 담고, 잘못된 버전은 거부한다", async () => {
  const { decodeJwt } = await import("jose");
  assert.equal(decodeJwt(await signToken("user-1", 3)).sv, 3);
  await assert.rejects(signToken("user-1", -1));
  await assert.rejects(signToken("user-1", 1.5));
});

test("verifyToken: DB의 세션 버전과 같을 때만 통과한다(비밀번호 변경 등으로 올라가면 폐기)", async () => {
  const token = await signToken("user-1", 0);
  assert.equal(await verifyToken(token), "user-1");
  versions.set("user-1", 1);
  assert.equal(await verifyToken(token), null);
  assert.equal(await verifyToken(await signToken("user-1", 1)), "user-1");
  // 버전이 DB보다 앞서는 토큰도 거부(정확히 일치해야 함)
  assert.equal(await verifyToken(await signToken("user-1", 2)), null);
});

test("verifyToken: 삭제된 사용자(users 행 없음)의 토큰은 거부한다", async () => {
  const token = await signToken("user-1", 0);
  versions.delete("user-1");
  assert.equal(await verifyToken(token), null);
});

test("verifyToken: 사용자 id로 PK 조회 한 번만 한다", async () => {
  await verifyToken(await signToken("user-1", 0));
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].query, /^SELECT session_version FROM users WHERE id = \?$/);
  assert.deepEqual(db.calls[0].values, ["user-1"]);
});

test("verifyToken: 서명이 틀린 토큰은 DB를 조회하지 않는다", async () => {
  const token = await signToken("user-1", 0);
  assert.equal(await verifyToken(`${token}x`), null);
  assert.equal(db.calls.length, 0);
});

test("verifyToken: sv 클레임이 없는 기존 토큰은 버전 0으로 보고, 폐기 후에는 거부한다", async () => {
  const { SignJWT } = await import("jose");
  const legacy = await new SignJWT({ sub: "user-1" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  assert.equal(await verifyToken(legacy), "user-1");
  versions.set("user-1", 1);
  assert.equal(await verifyToken(legacy), null);
});

test("decodeToken: sv 클레임 형식이 잘못되면 거부한다", async () => {
  const { SignJWT } = await import("jose");
  for (const sv of ["0", -1, 1.5, null]) {
    const token = await new SignJWT({ sub: "user-1", sv })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    assert.equal(await decodeToken(token), null, `sv=${JSON.stringify(sv)}`);
  }
});

test("getRequestSession: 폐기된 쿠키는 거부하고 유효한 Bearer로 넘어간다", async () => {
  const cookieToken = await signToken("cookie-user", 0);
  const bearerToken = await signToken("bearer-user", 0);
  versions.set("cookie-user", 1);
  assert.equal(await getRequestSession(requestWith({ cookie: `pension-session=${cookieToken}` })), null);
  const session = await getRequestSession(
    requestWith({ cookie: `pension-session=${cookieToken}`, authorization: `Bearer ${bearerToken}` })
  );
  assert.deepEqual(session, { userId: "bearer-user", source: "bearer" });
});

test("getBearerSession: 폐기된 토큰은 null", async () => {
  const token = await signToken("user-456", 0);
  versions.set("user-456", 5);
  const request = new Request("https://example.com", { headers: { authorization: `Bearer ${token}` } });
  assert.equal(await getBearerSession(request), null);
});

test("getOptimisticRequestSession: 서명만 확인하고 DB를 조회하지 않는다", async () => {
  const token = await signToken("user-1", 0);
  versions.set("user-1", 9); // 폐기되었어도 낙관적 검사는 통과 — 실제 판정은 페이지/핸들러 몫
  assert.deepEqual(await getOptimisticRequestSession(requestWith({ cookie: `pension-session=${token}` })), {
    userId: "user-1",
    source: "cookie",
  });
  assert.deepEqual(await getOptimisticRequestSession(requestWith({ authorization: `Bearer ${token}` })), {
    userId: "user-1",
    source: "bearer",
  });
  assert.equal(await getOptimisticRequestSession(requestWith({ cookie: `pension-session=${token}x` })), null);
  assert.equal(db.calls.length, 0);
});

test("getSessionVersion: 컬럼이 아직 없으면(42703) 스키마를 만든 뒤 다시 읽는다", async () => {
  let failed = false;
  db.setHandler((query, values) => {
    if (query.startsWith("SELECT session_version") && !failed) {
      failed = true;
      throw Object.assign(new Error("column does not exist"), { code: "42703" });
    }
    return answerSessionVersion(query, values, versions) ?? [];
  });
  assert.equal(await verifyToken(await signToken("user-1", 0)), "user-1");
  assert.equal(db.find("ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version").length, 1);
  assert.equal(db.find("SELECT session_version").length, 2);
});

test("getSessionVersion: 그 밖의 DB 오류는 삼키지 않는다(통과시키지 않음)", async () => {
  db.setHandler(() => {
    throw Object.assign(new Error("connection reset"), { code: "08006" });
  });
  await assert.rejects(verifyToken(await signToken("user-1", 0)), /connection reset/);
});
