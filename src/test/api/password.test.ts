// 비밀번호 설정/변경 API 테스트 — 실제 JWT(쿠키·Bearer)로 인증한다.
import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

import { authRequest, createFakeSql, rawRequest, readJson } from "@/test/api-helpers";

process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";

const USER_A = "user-a";
const USER_B = "user-b";

// 가짜 users 테이블 — id → password_hash, id → session_version
const users = new Map<string, string | null>();
const versions = new Map<string, number>();
const db = createFakeSql();
function usersHandler(query: string, values: unknown[]) {
  if (query.startsWith("SELECT session_version FROM users")) {
    const id = values[0] as string;
    return users.has(id) ? [{ session_version: versions.get(id) ?? 0 }] : [];
  }
  if (query.startsWith("ALTER TABLE users")) return [];
  if (query.startsWith("SELECT")) {
    const id = values[0] as string;
    if (!users.has(id)) return [];
    const hash = users.get(id) ?? null;
    return query.includes("has_password") ? [{ has_password: hash !== null }] : [{ password_hash: hash }];
  }
  if (query.startsWith("UPDATE users")) {
    const [nextHash, id, expected] = values as [string, string, string | undefined];
    if (!users.has(id)) return [];
    const current = users.get(id) ?? null;
    const matches = query.includes("IS NULL") ? current === null : current === expected;
    if (!matches) return [];
    users.set(id, nextHash);
    if (query.includes("session_version = session_version + 1")) versions.set(id, (versions.get(id) ?? 0) + 1);
    return [{ id, session_version: versions.get(id) ?? 0 }];
  }
  return [];
}

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
  namedExports: { ACCOUNT_COOKIE: "pension-account", getActivePortfolioAccountId: async () => "acc-1" },
});

let route: typeof import("@/app/api/auth/password/route");
let signToken: typeof import("@/lib/session").signToken;
let tokenA = "";
let tokenB = "";

before(async () => {
  const session = await import("@/lib/session");
  signToken = session.signToken;
  tokenA = await session.signToken(USER_A, 0);
  tokenB = await session.signToken(USER_B, 0);
  route = await import("@/app/api/auth/password/route");
});

beforeEach(async () => {
  db.reset();
  db.setHandler(usersHandler);
  users.clear();
  versions.clear();
  versions.set(USER_A, 0);
  versions.set(USER_B, 0);
  users.set(USER_A, await bcrypt.hash("old-password", 4));
  users.set(USER_B, null); // Google 전용 계정
  rateLimit.allow = true;
  rateLimit.keys.length = 0;
});

const post = (auth: { cookie?: string; bearer?: string }, body: unknown) =>
  route.POST(authRequest("POST", { ...auth, body }));

// ── 인증 ─────────────────────────────────────

test("무인증이면 GET·POST 모두 401이고 DB를 건드리지 않는다", async () => {
  assert.equal((await route.GET(authRequest("GET"))).status, 401);
  assert.equal((await post({}, { currentPassword: "old-password", newPassword: "new-password" })).status, 401);
  assert.equal((await post({ bearer: `${tokenA}x` }, { newPassword: "new-password" })).status, 401);
  assert.equal(db.calls.length, 0);
});

test("GET: 비밀번호 설정 여부를 쿠키·Bearer로 조회한다", async () => {
  const a = await route.GET(authRequest("GET", { cookie: tokenA }));
  assert.deepEqual(await readJson(a), { hasPassword: true });
  const b = await route.GET(authRequest("GET", { bearer: tokenB }));
  assert.deepEqual(await readJson(b), { hasPassword: false });
});

test("GET: 토큰은 유효하지만 계정이 없으면 401", async () => {
  users.delete(USER_A);
  assert.equal((await route.GET(authRequest("GET", { bearer: tokenA }))).status, 401);
});

// ── 비밀번호 변경 (기존 비밀번호 있음) ───────────────

for (const mode of ["cookie", "bearer"] as const) {
  test(`${mode}: 현재 비밀번호가 맞으면 변경한다`, async () => {
    const response = await post({ [mode]: tokenA }, { currentPassword: "old-password", newPassword: "new-password" });
    assert.equal(response.status, 200);
    const body = await readJson<{ ok: boolean; hasPassword: boolean; token?: string }>(response);
    assert.equal(body.ok, true);
    assert.equal(body.hasPassword, true);
    assert.ok(await bcrypt.compare("new-password", users.get(USER_A) ?? ""));
    // 새 토큰은 요청 방식대로 — 쿠키 세션은 Set-Cookie, Bearer는 본문 token (아래 토큰 폐기 테스트 참고)
    assert.equal(Boolean(response.headers.get("set-cookie")), mode === "cookie");
    assert.equal(typeof body.token === "string", mode === "bearer");
  });
}

test("변경: 현재 비밀번호가 없으면 400, 틀리면 403이며 바뀌지 않는다", async () => {
  const before = users.get(USER_A);
  const missing = await post({ cookie: tokenA }, { newPassword: "new-password" });
  assert.equal(missing.status, 400);
  assert.match((await readJson<{ error: string }>(missing)).error, /현재 비밀번호/);

  const wrong = await post({ cookie: tokenA }, { currentPassword: "wrong", newPassword: "new-password" });
  assert.equal(wrong.status, 403);
  assert.equal(users.get(USER_A), before);
  assert.equal(db.find("UPDATE users").length, 0);
});

test("변경: 해시는 bcrypt로 저장하고 평문을 남기지 않는다", async () => {
  await post({ cookie: tokenA }, { currentPassword: "old-password", newPassword: "new-password" });
  const update = db.find("UPDATE users")[0];
  assert.ok(!update.values.includes("new-password"));
  assert.match(String(update.values[0]), /^\$2[aby]\$/);
});

test("변경: 확인 이후 다른 요청이 먼저 바꿨으면 409", async () => {
  db.setHandler((query, values) => {
    if (query.startsWith("UPDATE users")) users.set(USER_A, "changed-elsewhere");
    return usersHandler(query, values);
  });
  const response = await post({ cookie: tokenA }, { currentPassword: "old-password", newPassword: "new-password" });
  assert.equal(response.status, 409);
});

// ── Google 전용 계정 비밀번호 설정 ────────────────

test("Google 전용 계정은 새 비밀번호만으로 설정한다", async () => {
  const response = await post({ bearer: tokenB }, { newPassword: "first-password" });
  assert.equal(response.status, 200);
  assert.ok(await bcrypt.compare("first-password", users.get(USER_B) ?? ""));
  assert.match(db.find("UPDATE users")[0].query, /password_hash IS NULL/);
});

test("Google 전용 계정: 그 사이 비밀번호가 생겼다면 덮어쓰지 않는다(409)", async () => {
  db.setHandler((query, values) => {
    if (query.startsWith("UPDATE users")) users.set(USER_B, "set-elsewhere");
    return usersHandler(query, values);
  });
  const response = await post({ bearer: tokenB }, { newPassword: "first-password" });
  assert.equal(response.status, 409);
  assert.equal(users.get(USER_B), "set-elsewhere");
});

test("Google 전용 계정으로 비밀번호를 설정한 뒤에는 현재 비밀번호가 필요하다", async () => {
  const first = await post({ bearer: tokenB }, { newPassword: "first-password" });
  const { token } = await readJson<{ token: string }>(first);
  const again = await post({ bearer: token }, { newPassword: "second-password" });
  assert.equal(again.status, 400);
});

// ── 타 사용자 차단 ───────────────────────────────

test("자기 계정만 바꾼다 — B의 토큰으로 A의 비밀번호를 건드릴 수 없다", async () => {
  const beforeA = users.get(USER_A);
  // 본문에 다른 사용자 id를 넣어도 무시된다
  const response = await post({ bearer: tokenB }, { userId: USER_A, id: USER_A, newPassword: "hijack-pass" });
  assert.equal(response.status, 200);
  assert.equal(users.get(USER_A), beforeA);
  for (const call of db.calls) {
    assert.ok(!call.values.includes(USER_A), call.query);
  }
});

test("B가 A의 현재 비밀번호를 알아도 B 계정 기준으로만 검사한다", async () => {
  users.set(USER_B, await bcrypt.hash("b-password", 4));
  const response = await post({ bearer: tokenB }, { currentPassword: "old-password", newPassword: "hijack-pass" });
  assert.equal(response.status, 403);
});

test("쿠키와 Bearer가 함께 오면 쿠키 사용자 기준", async () => {
  const response = await post({ cookie: tokenA, bearer: tokenB }, { newPassword: "first-password" });
  // A는 비밀번호가 있으므로 현재 비밀번호 요구
  assert.equal(response.status, 400);
  assert.equal(users.get(USER_B), null);
});

// ── 검증·레이트리밋 ─────────────────────────────

test("새 비밀번호 검증: 짧거나 72바이트 초과·문자열 아님·잘못된 JSON은 400", async () => {
  for (const newPassword of ["12345", "a".repeat(73), 123456, undefined]) {
    const response = await post({ bearer: tokenB }, { newPassword });
    assert.equal(response.status, 400, String(newPassword));
  }
  const broken = await route.POST(
    new Request(rawRequest("POST", "{broken"), { headers: { authorization: `Bearer ${tokenB}`, "content-type": "application/json" } })
  );
  assert.equal(broken.status, 400);
  assert.equal(users.get(USER_B), null);
});

test("레이트리밋은 사용자 기준이며 초과하면 429, 비밀번호 비교 전에 막는다", async () => {
  await post({ cookie: tokenA }, { currentPassword: "wrong", newPassword: "new-password" });
  assert.deepEqual(rateLimit.keys, [`password:${USER_A}`]);

  rateLimit.allow = false;
  db.reset();
  db.setHandler(usersHandler);
  const response = await post({ cookie: tokenA }, { currentPassword: "old-password", newPassword: "new-password" });
  assert.equal(response.status, 429);
  // 토큰 폐기 확인(세션 버전 조회)만 하고 비밀번호 해시는 읽지 않는다
  assert.deepEqual(db.calls.map((call) => call.query), ["SELECT session_version FROM users WHERE id = ?"]);
});

// ── 토큰 폐기: 비밀번호 설정·변경 시 기존 토큰 무효화 ─────────────

const getAs = (auth: { cookie?: string; bearer?: string }) => route.GET(authRequest("GET", auth));
const cookieToken = (response: Response) =>
  decodeURIComponent(/pension-session=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1] ?? "");

test("쿠키로 변경: 세션 버전을 올리고, 이 브라우저에는 새 쿠키를 준다 — 다른 기기의 기존 토큰은 401", async () => {
  const otherDevice = await signToken(USER_A, 0); // 같은 사용자의 다른 기기(모바일 등)
  const response = await post({ cookie: tokenA }, { currentPassword: "old-password", newPassword: "new-password" });
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, hasPassword: true });
  assert.equal(versions.get(USER_A), 1);
  assert.match(db.find("UPDATE users")[0].query, /session_version = session_version \+ 1/);

  const fresh = cookieToken(response);
  assert.ok(fresh, "새 세션 쿠키");
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/i);
  assert.equal((await getAs({ cookie: fresh })).status, 200);
  assert.equal((await getAs({ cookie: tokenA })).status, 401);
  assert.equal((await getAs({ bearer: otherDevice })).status, 401);
});

test("Bearer로 변경: 새 토큰을 본문으로 주고 쿠키는 쓰지 않는다 — 이전 토큰은 401", async () => {
  const response = await post({ bearer: tokenA }, { currentPassword: "old-password", newPassword: "new-password" });
  assert.equal(response.status, 200);
  const body = await readJson<{ ok: boolean; hasPassword: boolean; token: string }>(response);
  assert.equal(body.ok, true);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal((await getAs({ bearer: body.token })).status, 200);
  assert.equal((await getAs({ bearer: tokenA })).status, 401);
});

test("Google 전용 계정의 첫 비밀번호 설정도 기존 토큰을 폐기한다", async () => {
  const response = await post({ bearer: tokenB }, { newPassword: "first-password" });
  assert.equal(response.status, 200);
  assert.equal(versions.get(USER_B), 1);
  assert.equal((await getAs({ bearer: tokenB })).status, 401);
});

test("현재 비밀번호가 틀리거나 동시 변경(409)이면 세션 버전을 올리지 않는다", async () => {
  assert.equal((await post({ cookie: tokenA }, { currentPassword: "wrong", newPassword: "new-password" })).status, 403);
  db.setHandler((query, values) => {
    if (query.startsWith("UPDATE users")) users.set(USER_A, "changed-elsewhere");
    return usersHandler(query, values);
  });
  assert.equal((await post({ cookie: tokenA }, { currentPassword: "old-password", newPassword: "new-password" })).status, 409);
  assert.equal(versions.get(USER_A), 0);
});

test("폐기된 토큰으로는 비밀번호를 바꿀 수 없다(401, 해시 조회 없음)", async () => {
  versions.set(USER_A, 3);
  const response = await post({ cookie: tokenA }, { currentPassword: "old-password", newPassword: "new-password" });
  assert.equal(response.status, 401);
  assert.equal(db.find("SELECT password_hash").length, 0);
});
