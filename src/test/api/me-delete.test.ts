import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

import { createFakeSql, createSessionState, jsonRequest, rawRequest, readJson } from "@/test/api-helpers";

const session = createSessionState("user-1");
const db = createFakeSql();
const rateLimit = { allow: true, keys: [] as string[] };
const bearer = { userId: null as string | null };

mock.module("@/lib/session", {
  namedExports: {
    ...session.namedExports,
    getBearerSession: async () => (bearer.userId ? { userId: bearer.userId } : null),
    clearSessionCookie: (res: { cookies: { set: (n: string, v: string, o: object) => void } }) =>
      res.cookies.set("pension-session", "", { maxAge: 0, path: "/" }),
  },
});
mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/rate-limit", {
  namedExports: {
    authRateLimit: async (key: string) => {
      rateLimit.keys.push(key);
      return rateLimit.allow;
    },
    clientIp: () => "127.0.0.1",
  },
});

let me: typeof import("@/app/api/me/route");
let passwordHash: string;

before(async () => {
  passwordHash = await bcrypt.hash("correct-password", 4);
  me = await import("@/app/api/me/route");
});

function stubUser(user: { email: string; password_hash: string | null } | null) {
  db.setHandler((query) => {
    if (query.includes("SELECT email, password_hash FROM users")) return user ? [user] : [];
    return [];
  });
}

beforeEach(() => {
  db.reset();
  session.state.userId = "user-1";
  bearer.userId = null;
  rateLimit.allow = true;
  rateLimit.keys.length = 0;
});

test("DELETE: 세션이 없으면 401이고 아무것도 지우지 않는다", async () => {
  session.state.userId = null;
  const response = await me.DELETE(jsonRequest("DELETE", { password: "x" }));
  assert.equal(response.status, 401);
  assert.equal(db.find("DELETE FROM users").length, 0);
});

test("DELETE: 레이트리밋에 걸리면 429, DB를 조회하지 않는다", async () => {
  rateLimit.allow = false;
  const response = await me.DELETE(jsonRequest("DELETE", { password: "x" }));
  assert.equal(response.status, 429);
  assert.deepEqual(rateLimit.keys, ["delete-account:127.0.0.1:user-1"]);
  assert.equal(db.calls.length, 0);
});

test("DELETE: 비밀번호 계정은 password가 없으면 400", async () => {
  stubUser({ email: "a@b.com", password_hash: passwordHash });
  const response = await me.DELETE(jsonRequest("DELETE", {}));
  assert.equal(response.status, 400);
  assert.equal(db.find("DELETE FROM users").length, 0);
});

test("DELETE: 본문이 JSON이 아니면 400", async () => {
  stubUser({ email: "a@b.com", password_hash: passwordHash });
  const response = await me.DELETE(rawRequest("DELETE", "{broken"));
  assert.equal(response.status, 400);
});

test("DELETE: 비밀번호가 틀리면 403이고 삭제하지 않는다", async () => {
  stubUser({ email: "a@b.com", password_hash: passwordHash });
  const response = await me.DELETE(jsonRequest("DELETE", { password: "wrong" }));
  assert.equal(response.status, 403);
  assert.equal(db.find("DELETE FROM users").length, 0);
});

test("DELETE: 비밀번호 계정은 확인 이메일만으로는 삭제할 수 없다", async () => {
  stubUser({ email: "a@b.com", password_hash: passwordHash });
  const response = await me.DELETE(jsonRequest("DELETE", { confirmEmail: "a@b.com" }));
  assert.equal(response.status, 400);
  assert.equal(db.find("DELETE FROM users").length, 0);
});

test("DELETE: 비밀번호가 맞으면 users 행을 지우고 세션 쿠키를 만료시킨다", async () => {
  stubUser({ email: "a@b.com", password_hash: passwordHash });
  const response = await me.DELETE(jsonRequest("DELETE", { password: "correct-password" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true });

  const deletes = db.find("DELETE FROM users");
  assert.equal(deletes.length, 1);
  assert.deepEqual(deletes[0].values, ["user-1"]);
  assert.match(response.headers.get("set-cookie") ?? "", /pension-session=;.*Max-Age=0/i);
});

test("DELETE: Bearer 토큰 세션으로도 삭제할 수 있다", async () => {
  session.state.userId = null; // 쿠키 세션 없음
  bearer.userId = "mobile-user";
  stubUser({ email: "a@b.com", password_hash: passwordHash });
  const response = await me.DELETE(jsonRequest("DELETE", { password: "correct-password" }));
  assert.equal(response.status, 200);
  assert.deepEqual(db.find("DELETE FROM users")[0].values, ["mobile-user"]);
});

test("DELETE: Google 전용 계정은 confirmEmail이 없으면 400", async () => {
  stubUser({ email: "g@b.com", password_hash: null });
  const response = await me.DELETE(jsonRequest("DELETE", { password: "anything" }));
  assert.equal(response.status, 400);
  assert.equal(db.find("DELETE FROM users").length, 0);
});

test("DELETE: Google 전용 계정은 이메일이 다르면 403", async () => {
  stubUser({ email: "g@b.com", password_hash: null });
  const response = await me.DELETE(jsonRequest("DELETE", { confirmEmail: "other@b.com" }));
  assert.equal(response.status, 403);
  assert.equal(db.find("DELETE FROM users").length, 0);
});

test("DELETE: Google 전용 계정은 이메일이 일치하면(대소문자 무시) 삭제한다", async () => {
  stubUser({ email: "g@b.com", password_hash: null });
  const response = await me.DELETE(jsonRequest("DELETE", { confirmEmail: " G@B.com " }));
  assert.equal(response.status, 200);
  assert.equal(db.find("DELETE FROM users").length, 1);
});

test("DELETE: 사용자 행이 이미 없으면 401", async () => {
  stubUser(null);
  const response = await me.DELETE(jsonRequest("DELETE", { password: "x" }));
  assert.equal(response.status, 401);
});

test("GET: 비밀번호 보유 여부를 함께 돌려준다", async () => {
  db.setHandler(() => [{ display_name: "홍", email: "a@b.com", has_password: false }]);
  const response = await me.GET();
  assert.deepEqual(await readJson(response), {
    authenticated: true,
    displayName: "홍",
    email: "a@b.com",
    hasPassword: false,
  });
});
