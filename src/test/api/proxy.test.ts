import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { answerSessionVersion, createFakeSql } from "@/test/api-helpers";

process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";

// 토큰 폐기 확인용 가짜 users.session_version
const versions = new Map<string, number>();
const db = createFakeSql((query, values) => answerSessionVersion(query, values, versions) ?? []);
mock.module("@/lib/db", { namedExports: { sql: db.sql } });

let proxy: typeof import("@/proxy").proxy;
let signToken: typeof import("@/lib/session").signToken;
let NextRequest: typeof import("next/server").NextRequest;

before(async () => {
  const [proxyModule, sessionModule, server] = await Promise.all([
    import("@/proxy"),
    import("@/lib/session"),
    import("next/server"),
  ]);
  proxy = proxyModule.proxy;
  signToken = sessionModule.signToken;
  NextRequest = server.NextRequest;
});

beforeEach(() => {
  db.reset();
  versions.clear();
  versions.set("user-1", 0);
});

function request(path: string, cookie?: string, authorization?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (authorization) headers.authorization = authorization;
  return new NextRequest(new URL(path, "https://pension.test"), { headers });
}

test("세션이 없으면 프록시 대상 API는 401 JSON을 돌려준다", async () => {
  for (const path of ["/api/prices", "/api/market/search", "/api/market/indices"]) {
    const response = await proxy(request(path) as never);
    assert.equal(response.status, 401, path);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  }
});

test("세션이 없으면 대시보드 페이지는 로그인으로 보낸다", async () => {
  const response = await proxy(request("/dashboard/holdings") as never);
  assert.equal(response.status, 307);
  const location = new URL(response.headers.get("location") ?? "");
  assert.equal(location.pathname, "/login");
});

test("유효한 세션 쿠키가 있으면 통과시킨다", async () => {
  const token = await signToken("user-1", 0);
  const response = await proxy(request("/api/prices", `pension-session=${token}`) as never);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("변조된 세션 쿠키는 통과시키지 않는다", async () => {
  const token = await signToken("user-1", 0);
  const response = await proxy(request("/api/prices", `pension-session=${token}x`) as never);
  assert.equal(response.status, 401);
});

test("유효한 Bearer 토큰이 있으면 프록시 대상 API를 통과시킨다", async () => {
  const token = await signToken("user-1", 0);
  for (const path of ["/api/prices", "/api/market/search", "/api/market/indices"]) {
    const response = await proxy(request(path, undefined, `Bearer ${token}`) as never);
    assert.equal(response.headers.get("x-middleware-next"), "1", path);
  }
});

test("변조된 Bearer 토큰은 401이며 리다이렉트하지 않는다", async () => {
  const token = await signToken("user-1", 0);
  const response = await proxy(request("/api/market/search", undefined, `Bearer ${token}x`) as never);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("location"), null);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("프록시 대상 경로가 의도한 목록과 일치한다", async () => {
  const { config } = await import("@/proxy");
  assert.deepEqual(config.matcher, ["/dashboard/:path*", "/api/market/:path*", "/api/prices"]);
});

// ── 토큰 폐기: 페이지는 낙관적(DB 조회 없음), API는 폐기 여부까지 확인 ─────────

test("API 경로: 폐기된(세션 버전이 바뀐) 토큰은 쿠키든 Bearer든 401", async () => {
  const token = await signToken("user-1", 0);
  versions.set("user-1", 1);
  for (const path of ["/api/prices", "/api/market/search"]) {
    assert.equal((await proxy(request(path, `pension-session=${token}`) as never)).status, 401, path);
    assert.equal((await proxy(request(path, undefined, `Bearer ${token}`) as never)).status, 401, path);
  }
});

test("API 경로: 삭제된 사용자의 토큰은 401", async () => {
  const token = await signToken("user-1", 0);
  versions.delete("user-1");
  const response = await proxy(request("/api/market/indices", undefined, `Bearer ${token}`) as never);
  assert.equal(response.status, 401);
});

test("API 경로: 요청당 세션 버전 PK 조회는 한 번", async () => {
  const token = await signToken("user-1", 0);
  await proxy(request("/api/prices", undefined, `Bearer ${token}`) as never);
  assert.equal(db.find("SELECT session_version FROM users").length, 1);
});

test("대시보드 페이지: 서명만 확인하고 DB를 조회하지 않는다(폐기 판정은 페이지의 getSession)", async () => {
  const token = await signToken("user-1", 0);
  versions.set("user-1", 1);
  const response = await proxy(request("/dashboard", `pension-session=${token}`) as never);
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(db.calls.length, 0);
});

test("안내 페이지(/guide/telegram)는 프록시 대상이 아니라 로그인 없이 열린다", async () => {
  const { config } = await import("@/proxy");
  // Next는 matcher에 걸린 경로에만 프록시를 실행한다 — 공개 경로는 목록에 없어야 한다
  const matches = (path: string) =>
    config.matcher.some((pattern) => new RegExp(`^${pattern.replace(/:path\*/g, ".*")}$`).test(path));
  assert.equal(matches("/guide/telegram"), false);
  assert.equal(matches("/privacy"), false);
  assert.equal(matches("/dashboard/settings"), true);
});
