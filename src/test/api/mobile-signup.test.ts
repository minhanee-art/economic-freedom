// 모바일 회원가입 + 웹 가입과의 공유 로직(검증·레이트리밋·정규화) 테스트
import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { createFakeSql, jsonRequest, rawRequest, readJson } from "@/test/api-helpers";

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
  },
});

let mobileSignup: typeof import("@/app/api/mobile/auth/signup/route");
let webSignup: typeof import("@/app/api/auth/signup/route");
let verifyToken: typeof import("@/lib/session").verifyToken;
let getRequestSession: typeof import("@/lib/session").getRequestSession;

before(async () => {
  const session = await import("@/lib/session");
  verifyToken = session.verifyToken;
  getRequestSession = session.getRequestSession;
  [mobileSignup, webSignup] = await Promise.all([
    import("@/app/api/mobile/auth/signup/route"),
    import("@/app/api/auth/signup/route"),
  ]);
});

function newUserHandler(query: string) {
  if (query.includes("SELECT id FROM users")) return [];
  if (query.includes("INSERT INTO users")) return [{ id: "user-new" }];
  return [];
}

beforeEach(() => {
  db.reset();
  db.setHandler(newUserHandler);
  rateLimit.allow = true;
  rateLimit.keys.length = 0;
});

test("mobile 가입: 성공하면 로그인과 같은 형태로 토큰을 본문에 준다", async () => {
  const { DEFAULT_HOLDINGS } = await import("@/lib/constants");
  const response = await mobileSignup.POST(jsonRequest("POST", { email: " New@B.com ", password: "secret123" }));
  assert.equal(response.status, 201);

  const body = await readJson<{ ok: boolean; token: string; user: { id: string; email: string; displayName: null } }>(response);
  assert.equal(body.ok, true);
  assert.deepEqual(body.user, { id: "user-new", email: "new@b.com", displayName: null });
  assert.equal(await verifyToken(body.token), "user-new");
  assert.equal(response.headers.get("set-cookie"), null, "앱 가입은 쿠키를 쓰지 않는다");

  // 웹 가입과 같은 기본 데이터 생성
  assert.equal(db.find("INSERT INTO holdings").length, DEFAULT_HOLDINGS.length);
  assert.equal(db.find("INSERT INTO profiles").length, 1);
  // 이메일은 정규화해서 저장
  assert.equal(db.find("INSERT INTO users")[0].values[0], "new@b.com");
});

test("mobile 가입: 발급한 토큰으로 Bearer 인증이 된다", async () => {
  const response = await mobileSignup.POST(jsonRequest("POST", { email: "new@b.com", password: "secret123" }));
  const { token } = await readJson<{ token: string }>(response);
  const session = await getRequestSession(
    new Request("https://pension.test/api/holdings", { headers: { authorization: `Bearer ${token}` } })
  );
  assert.deepEqual(session, { userId: "user-new", source: "bearer" });
});

test("mobile 가입: 비밀번호는 bcrypt 해시로 저장한다", async () => {
  await mobileSignup.POST(jsonRequest("POST", { email: "new@b.com", password: "secret123" }));
  const stored = db.find("INSERT INTO users")[0].values[1];
  assert.notEqual(stored, "secret123");
  assert.match(String(stored), /^\$2[aby]\$/);
});

for (const [name, route] of [
  ["mobile", () => mobileSignup],
  ["web", () => webSignup],
] as const) {
  test(`${name} 가입: 입력 검증이 같다`, async () => {
    const cases: unknown[] = [
      { email: "new@b.com" },
      { password: "secret123" },
      { email: "new@b.com", password: "12345" },
      { email: "   ", password: "secret123" },
      { email: "new@b.com", password: 123456 },
      { email: ["new@b.com"], password: "secret123" },
      { email: "new@b.com", password: "a".repeat(73) },
      { email: "new@b.com", password: "가".repeat(25) }, // 75바이트
      null,
    ];
    for (const body of cases) {
      const response = await route().POST(jsonRequest("POST", body));
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(typeof (await readJson(response)).error, "string");
    }
    assert.equal(db.calls.length, 0, "검증 실패 시 DB 조회 없음");
    assert.equal(rateLimit.keys.length, 0, "검증 실패는 레이트리밋을 소모하지 않는다");

    assert.equal((await route().POST(rawRequest("POST", "{broken"))).status, 400);
  });

  test(`${name} 가입: 72바이트 비밀번호까지는 받는다`, async () => {
    const response = await route().POST(jsonRequest("POST", { email: "new@b.com", password: "a".repeat(72) }));
    assert.equal(response.status, 201);
  });

  test(`${name} 가입: 웹·모바일이 같은 IP 레이트리밋 키를 쓴다`, async () => {
    await route().POST(jsonRequest("POST", { email: "new@b.com", password: "secret123" }));
    assert.deepEqual(rateLimit.keys, ["signup:127.0.0.1"]);

    rateLimit.allow = false;
    const limited = await route().POST(jsonRequest("POST", { email: "new@b.com", password: "secret123" }));
    assert.equal(limited.status, 429);
  });

  test(`${name} 가입: 대소문자만 다른 기존 이메일도 409`, async () => {
    db.setHandler((query) => (query.includes("SELECT id FROM users") ? [{ id: "u1" }] : []));
    const response = await route().POST(jsonRequest("POST", { email: "DUP@b.com", password: "secret123" }));
    assert.equal(response.status, 409);
    const lookup = db.find("SELECT id FROM users")[0];
    assert.match(lookup.query, /lower\(email\)/);
    assert.deepEqual(lookup.values, ["dup@b.com"]);
    assert.equal(db.find("INSERT INTO users").length, 0);
  });

  test(`${name} 가입: 동시 가입 UNIQUE 위반은 409`, async () => {
    db.setHandler((query) => {
      if (query.includes("INSERT INTO users")) throw Object.assign(new Error("duplicate"), { code: "23505" });
      return [];
    });
    const response = await route().POST(jsonRequest("POST", { email: "race@b.com", password: "secret123" }));
    assert.equal(response.status, 409);
  });
}
