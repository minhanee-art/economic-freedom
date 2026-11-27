// GET /api/me 인증 테스트 — 세션 모듈을 스텁하지 않고 실제 JWT로 검증한다.
// 쿠키·Bearer·무인증·폐기된 토큰(session_version 불일치)·삭제된 사용자에서 각각 기대대로 응답하는지 확인한다.
import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { answerSessionVersion, authRequest, createFakeSql, readJson } from "@/test/api-helpers";

process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";

const db = createFakeSql();
const versions = new Map<string, number>();
mock.module("@/lib/db", { namedExports: { sql: db.sql } });
// next/headers의 cookies()는 요청 컨텍스트가 없으면 던진다 — GET이 요청 헤더만 보는지 함께 확인된다.
mock.module("next/headers", {
  namedExports: {
    cookies: async () => {
      throw new Error("cookies()는 Route Handler 테스트에서 쓰면 안 된다");
    },
  },
});

let me: typeof import("@/app/api/me/route");
let signToken: typeof import("@/lib/session").signToken;

before(async () => {
  me = await import("@/app/api/me/route");
  ({ signToken } = await import("@/lib/session"));
});

beforeEach(() => {
  db.reset();
  versions.clear();
  versions.set("user-1", 0);
  db.setHandler((query, values) => {
    const version = answerSessionVersion(query, values, versions);
    if (version) return version;
    if (query.includes("FROM profiles p")) {
      return [{ display_name: "홍", email: "a@b.com", has_password: true }];
    }
    return [];
  });
});

const expected = { authenticated: true, displayName: "홍", email: "a@b.com", hasPassword: true };

test("GET: 쿠키 세션이면 프로필을 돌려준다", async () => {
  const response = await me.GET(authRequest("GET", { cookie: await signToken("user-1", 0) }));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), expected);
});

test("GET: Bearer 토큰이면 같은 응답 형태로 프로필을 돌려준다", async () => {
  const response = await me.GET(authRequest("GET", { bearer: await signToken("user-1", 0) }));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), expected);
  assert.deepEqual(db.find("FROM profiles p")[0].values, ["user-1"]);
});

test("GET: 무인증이면 401이고 프로필을 조회하지 않는다", async () => {
  const response = await me.GET(authRequest("GET"));
  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), { authenticated: false, error: "인증 필요" });
  assert.equal(db.find("FROM profiles p").length, 0);
});

test("GET: 폐기된 Bearer 토큰(session_version 불일치)은 401", async () => {
  const stale = await signToken("user-1", 0);
  versions.set("user-1", 1); // 비밀번호 변경 등으로 버전이 올라감
  const response = await me.GET(authRequest("GET", { bearer: stale }));
  assert.equal(response.status, 401);
  assert.equal(db.find("FROM profiles p").length, 0);
});

test("GET: 폐기된 쿠키 토큰도 401", async () => {
  const stale = await signToken("user-1", 0);
  versions.set("user-1", 1);
  const response = await me.GET(authRequest("GET", { cookie: stale }));
  assert.equal(response.status, 401);
});

test("GET: 삭제된 사용자의 Bearer 토큰은 401", async () => {
  const token = await signToken("user-1", 0);
  versions.delete("user-1");
  const response = await me.GET(authRequest("GET", { bearer: token }));
  assert.equal(response.status, 401);
});

test("GET: 쿠키는 폐기됐지만 Bearer가 유효하면 Bearer로 인증된다", async () => {
  const stale = await signToken("user-1", 0);
  versions.set("user-1", 1);
  const fresh = await signToken("user-1", 1);
  const response = await me.GET(authRequest("GET", { cookie: stale, bearer: fresh }));
  assert.equal(response.status, 200);
});

test("GET: 서명이 틀린 Bearer 토큰은 401", async () => {
  const response = await me.GET(authRequest("GET", { bearer: "not-a-jwt" }));
  assert.equal(response.status, 401);
});
