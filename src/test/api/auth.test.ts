import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

import { createFakeSql, jsonRequest, readJson, rawRequest } from "@/test/api-helpers";

process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";

const db = createFakeSql();
const rateLimit = { allow: true, keys: [] as string[] };

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
mock.module("@/lib/portfolio-accounts", {
  namedExports: {
    ACCOUNT_COOKIE: "pension-account",
    getActivePortfolioAccountId: async () => "acc-new",
    getPortfolioAccounts: async () => [],
    createPortfolioAccount: async () => ({ id: "acc-new", name: "기본", ownerType: "self" }),
  },
});

let login: typeof import("@/app/api/auth/login/route");
let signup: typeof import("@/app/api/auth/signup/route");
let logout: typeof import("@/app/api/auth/logout/route");

before(async () => {
  [login, signup, logout] = await Promise.all([
    import("@/app/api/auth/login/route"),
    import("@/app/api/auth/signup/route"),
    import("@/app/api/auth/logout/route"),
  ]);
});

beforeEach(() => {
  db.reset();
  rateLimit.allow = true;
  rateLimit.keys.length = 0;
});

// ── 로그인 ───────────────────────────────────

test("로그인: 값이 없으면 400", async () => {
  const response = await login.POST(jsonRequest("POST", { email: "a@b.com" }));
  assert.equal(response.status, 400);
  assert.match((await readJson<{ error: string }>(response)).error, /비밀번호/);
});

test("로그인: 본문이 JSON이 아니면 400", async () => {
  const response = await login.POST(rawRequest("POST", "{broken"));
  assert.equal(response.status, 400);
});

test("회원가입: 본문이 JSON이 아니면 400", async () => {
  const response = await signup.POST(rawRequest("POST", "{broken"));
  assert.equal(response.status, 400);
});

test("로그인: 시도가 많으면 429", async () => {
  rateLimit.allow = false;

  const response = await login.POST(jsonRequest("POST", { email: "a@b.com", password: "secret123" }));
  assert.equal(response.status, 429);
  assert.match((await readJson<{ error: string }>(response)).error, /너무 많습니다/);
});

test("로그인: 없는 이메일이면 401", async () => {
  db.setHandler(() => []);

  const response = await login.POST(jsonRequest("POST", { email: "none@b.com", password: "secret123" }));
  assert.equal(response.status, 401);
  assert.match((await readJson<{ error: string }>(response)).error, /올바르지 않습니다/);
});

test("로그인: 구글 전용 계정은 비밀번호 로그인을 막는다", async () => {
  db.setHandler(() => [{ id: "u1", password_hash: null }]);

  const response = await login.POST(jsonRequest("POST", { email: "g@b.com", password: "secret123" }));
  assert.equal(response.status, 401);
  assert.match((await readJson<{ error: string }>(response)).error, /Google 로그인/);
});

test("로그인: 비밀번호가 틀리면 401", async () => {
  const hash = await bcrypt.hash("right-password", 4);
  db.setHandler(() => [{ id: "u1", password_hash: hash }]);

  const response = await login.POST(jsonRequest("POST", { email: "a@b.com", password: "wrong-password" }));
  assert.equal(response.status, 401);
});

test("로그인: 비밀번호가 맞으면 세션 쿠키를 발급한다", async () => {
  const hash = await bcrypt.hash("right-password", 4);
  db.setHandler(() => [{ id: "u1", password_hash: hash }]);

  const response = await login.POST(jsonRequest("POST", { email: "A@B.com", password: "right-password" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true });

  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /pension-session=/);
  assert.match(cookie, /HttpOnly/i);
  // 레이트리밋 키는 소문자 이메일 기준
  assert.ok(rateLimit.keys.some((key) => key.includes("a@b.com")));
});

// ── 회원가입 ─────────────────────────────────

test("회원가입: 비밀번호가 6자 미만이면 400", async () => {
  const response = await signup.POST(jsonRequest("POST", { email: "new@b.com", password: "12345" }));
  assert.equal(response.status, 400);
});

test("회원가입: 가입 시도가 많으면 429", async () => {
  rateLimit.allow = false;

  const response = await signup.POST(jsonRequest("POST", { email: "new@b.com", password: "secret123" }));
  assert.equal(response.status, 429);
});

test("회원가입: 이미 있는 이메일이면 409", async () => {
  db.setHandler((query) => (query.includes("SELECT id FROM users") ? [{ id: "u1" }] : []));

  const response = await signup.POST(jsonRequest("POST", { email: "dup@b.com", password: "secret123" }));
  assert.equal(response.status, 409);
  assert.match((await readJson<{ error: string }>(response)).error, /이미 가입된/);
});

test("회원가입: 동시 가입으로 UNIQUE 위반이 나면 409", async () => {
  db.setHandler((query) => {
    if (query.includes("SELECT id FROM users")) return [];
    if (query.includes("INSERT INTO users")) {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    return [];
  });

  const response = await signup.POST(jsonRequest("POST", { email: "race@b.com", password: "secret123" }));
  assert.equal(response.status, 409);
});

test("회원가입: 성공하면 기본 종목·프로필을 만들고 쿠키를 준다", async () => {
  const { DEFAULT_HOLDINGS } = await import("@/lib/constants");
  db.setHandler((query) => {
    if (query.includes("SELECT id FROM users")) return [];
    if (query.includes("INSERT INTO users")) return [{ id: "user-new" }];
    return [];
  });

  const response = await signup.POST(jsonRequest("POST", { email: "new@b.com", password: "secret123" }));
  assert.equal(response.status, 201);
  assert.deepEqual(await readJson(response), { ok: true });

  assert.equal(db.find("INSERT INTO holdings").length, DEFAULT_HOLDINGS.length);
  const profileInserts = db.find("INSERT INTO profiles");
  assert.equal(profileInserts.length, 1);
  // 기본 월 예산은 SQL 리터럴로 들어간다
  assert.match(profileInserts[0].query, /300000/);
  assert.equal(profileInserts[0].values[0], "user-new");

  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /pension-session=/);
});

test("회원가입: 비밀번호는 평문으로 저장하지 않는다", async () => {
  let stored: unknown;
  db.setHandler((query, values) => {
    if (query.includes("INSERT INTO users")) {
      stored = values[1];
      return [{ id: "user-new" }];
    }
    return [];
  });

  await signup.POST(jsonRequest("POST", { email: "new@b.com", password: "secret123" }));
  assert.notEqual(stored, "secret123");
  assert.match(String(stored), /^\$2[aby]\$/);
});

// ── 로그아웃 ─────────────────────────────────

test("로그아웃: 세션 쿠키를 만료시킨다", async () => {
  const response = await logout.POST();
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true });

  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /pension-session=/);
  assert.match(cookie, /Max-Age=0/i);
});
