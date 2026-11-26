// 인증 보강 통합 테스트 — 실제 Postgres에 neon-schema.sql(+ 코드 안 CREATE/ALTER)을 적용하고
// 세션 버전 기반 토큰 폐기, Google 첫 연결 시 계정 선점 차단, 요청 단위 계좌 선택의 소유권 검증을 실제 SQL로 확인한다.
// TEST_DATABASE_URL이 없으면 전체를 건너뛴다. 실행: scripts/verify-snapshot-db.sh
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach, mock } from "node:test";
import bcrypt from "bcryptjs";

import { authRequest } from "@/test/api-helpers";
import { createPgTestDb, type PgTestDb } from "@/test/pg-sql";

process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";
process.env.GOOGLE_CLIENT_ID ||= "test-client";
process.env.GOOGLE_CLIENT_SECRET ||= "test-secret";

const connectionString = process.env.TEST_DATABASE_URL;
const skip = connectionString
  ? false
  : "TEST_DATABASE_URL이 없어 건너뜀 (scripts/verify-snapshot-db.sh로 실행)";

const U = {
  squat: { id: "bbbbbbbb-0000-4000-8000-000000000001", email: "victim@pension.local" },
  other: { id: "bbbbbbbb-0000-4000-8000-000000000002", email: "other@pension.local" },
};
const ATTACKER_PASSWORD = "attacker-password";

mock.module("@/lib/rate-limit", {
  namedExports: { authRateLimit: async () => true, clientIp: () => "127.0.0.1" },
});

const google = { profile: {} as Record<string, unknown> };
const realFetch = globalThis.fetch;

let db: PgTestDb;
let session: typeof import("@/lib/session");
let password: typeof import("@/app/api/auth/password/route");
let login: typeof import("@/app/api/auth/login/route");
let googleCallback: typeof import("@/app/api/auth/google/callback/route");
let me: typeof import("@/app/api/me/route");
let holdings: typeof import("@/app/api/holdings/route");
let NextRequest: typeof import("next/server").NextRequest;

before(async () => {
  if (!connectionString) return;
  db = await createPgTestDb(connectionString);
  mock.module("@/lib/db", { namedExports: { sql: db.sql } });

  await db.pool.query(readFileSync("neon-schema.sql", "utf8"));
  const accounts = await import("@/lib/portfolio-accounts");
  await accounts.ensurePortfolioAccountSchema();

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ access_token: "google-access" });
    if (url.startsWith("https://www.googleapis.com/oauth2/v2/userinfo")) return Response.json(google.profile);
    throw new Error(`예상하지 못한 fetch: ${url}`);
  }) as typeof fetch;

  session = await import("@/lib/session");
  password = await import("@/app/api/auth/password/route");
  login = await import("@/app/api/auth/login/route");
  googleCallback = await import("@/app/api/auth/google/callback/route");
  me = await import("@/app/api/me/route");
  holdings = await import("@/app/api/holdings/route");
  NextRequest = (await import("next/server")).NextRequest;
});

after(async () => {
  globalThis.fetch = realFetch;
  if (db) await db.pool.end();
});

async function seedUser(id: string, email: string, passwordHash: string | null) {
  await db.sql`INSERT INTO users (id, email, password_hash) VALUES (${id}, ${email}, ${passwordHash})`;
  await db.sql`INSERT INTO profiles (id, email) VALUES (${id}, ${email})`;
  const [acc] = await db.sql`
    INSERT INTO portfolio_accounts (user_id, name, telegram_chat_id, display_order)
    VALUES (${id}, ${"내 계좌"}, ${"99999"}, ${0}) RETURNING id
  `;
  const [acc2] = await db.sql`
    INSERT INTO portfolio_accounts (user_id, name, telegram_chat_id, display_order)
    VALUES (${id}, ${"자녀 계좌"}, ${"88888"}, ${1}) RETURNING id
  `;
  await db.sql`
    INSERT INTO holdings (user_id, account_id, code, name, category, sub_category)
    VALUES (${id}, ${acc.id}, ${"069500"}, ${"첫 계좌 종목"}, ${"주식"}, ${"국장"}),
           (${id}, ${acc2.id}, ${"360750"}, ${"둘째 계좌 종목"}, ${"주식"}, ${"미장"})
  `;
  return { accountId: String(acc.id), secondAccountId: String(acc2.id) };
}

async function userRow(id: string) {
  const [row] = await db.sql`SELECT password_hash, google_id, session_version FROM users WHERE id = ${id}`;
  return row;
}

let seeded: Record<keyof typeof U, { accountId: string; secondAccountId: string }>;

beforeEach(async () => {
  if (!db) return;
  await db.sql`DELETE FROM users`;
  seeded = {
    squat: await seedUser(U.squat.id, U.squat.email, await bcrypt.hash(ATTACKER_PASSWORD, 4)),
    other: await seedUser(U.other.id, U.other.email, await bcrypt.hash("other-password", 4)),
  };
  google.profile = { id: "g-victim", email: "Victim@Pension.local", verified_email: true, name: "피해자" };
});

const callbackRequest = () =>
  new NextRequest("https://pension.test/api/auth/google/callback?code=c1&state=s1", {
    headers: { cookie: "g_oauth_state=s1" },
  });

// 맨 앞에 둔다 — 아직 아무도 ensureSessionVersionSchema를 부르지 않은 상태에서 컬럼 누락 복구를 확인
test("컬럼이 없는 기존 운영 DB: 첫 토큰 검증 때 session_version을 추가하고 기존 토큰(sv 없음)은 그대로 유효", { skip }, async () => {
  await db.sql`ALTER TABLE users DROP COLUMN session_version`;
  const { SignJWT } = await import("jose");
  const legacy = await new SignJWT({ sub: U.other.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));

  assert.equal(await session.verifyToken(legacy), U.other.id);
  const [column] = await db.sql`
    SELECT data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'session_version'
  `;
  assert.deepEqual(column, { data_type: "integer", is_nullable: "NO", column_default: "0" });
  assert.equal((await userRow(U.other.id)).session_version, 0, "기존 행은 0으로 채워진다");
});

test("neon-schema.sql: users.session_version INTEGER NOT NULL DEFAULT 0", { skip }, async () => {
  const [column] = await db.sql`
    SELECT data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'session_version'
  `;
  assert.deepEqual(column, { data_type: "integer", is_nullable: "NO", column_default: "0" });
});

// ── 토큰 폐기 ───────────────────────────────────

test("비밀번호 변경: session_version +1, 이전 토큰(다른 기기 포함)은 거부, 응답의 새 토큰은 통과", { skip }, async () => {
  const oldToken = await session.signToken(U.other.id, 0);
  const otherDevice = await session.signToken(U.other.id, 0);
  const response = await password.POST(
    authRequest("POST", { bearer: oldToken, body: { currentPassword: "other-password", newPassword: "next-password" } })
  );
  assert.equal(response.status, 200);
  const { token } = (await response.json()) as { token: string };

  assert.equal((await userRow(U.other.id)).session_version, 1);
  assert.equal(await session.verifyToken(oldToken), null);
  assert.equal(await session.verifyToken(otherDevice), null);
  assert.equal(await session.verifyToken(token), U.other.id);
  // 다른 사용자의 버전은 그대로
  assert.equal((await userRow(U.squat.id)).session_version, 0);
});

test("계정 삭제: 삭제된 사용자의 토큰은 거부된다", { skip }, async () => {
  const token = await session.signToken(U.other.id, 0);
  const response = await me.DELETE(authRequest("DELETE", { bearer: token, body: { password: "other-password" } }));
  assert.equal(response.status, 200);
  assert.equal(await session.verifyToken(token), null);
  assert.equal(await session.getRequestSession(authRequest("GET", { bearer: token })), null);
});

// ── 계정 선점 차단 ─────────────────────────────

test("Google 첫 연결: 선점 계정의 비밀번호 무효화·토큰 폐기·텔레그램 chat_id 삭제, 다른 사용자는 그대로", { skip }, async () => {
  const attackerToken = await session.signToken(U.squat.id, 0);
  assert.equal(await session.verifyToken(attackerToken), U.squat.id);

  const response = await googleCallback.GET(callbackRequest());
  assert.equal(new URL(response.headers.get("location") ?? "").pathname, "/dashboard/settings");

  const row = await userRow(U.squat.id);
  assert.equal(row.password_hash, null);
  assert.equal(row.google_id, "g-victim");
  assert.equal(row.session_version, 1);

  // 공격자의 기존 토큰과 비밀번호 모두 더 이상 통하지 않는다
  assert.equal(await session.verifyToken(attackerToken), null);
  const attackerLogin = await login.POST(
    authRequest("POST", { body: { email: U.squat.email, password: ATTACKER_PASSWORD } })
  );
  assert.equal(attackerLogin.status, 401);

  // 피해자(콜백 응답 쿠키)의 토큰은 통과
  const cookie = response.headers.get("set-cookie") ?? "";
  const victimToken = decodeURIComponent(/pension-session=([^;]+)/.exec(cookie)?.[1] ?? "");
  assert.equal(await session.verifyToken(victimToken), U.squat.id);

  const chatIds = await db.sql`SELECT user_id, telegram_chat_id FROM portfolio_accounts ORDER BY user_id, display_order`;
  assert.deepEqual(
    chatIds.map((item) => [item.user_id, item.telegram_chat_id]),
    [
      [U.squat.id, null],
      [U.squat.id, null],
      [U.other.id, "99999"],
      [U.other.id, "88888"],
    ]
  );
  const other = await userRow(U.other.id);
  assert.ok(other.password_hash);
  assert.equal(other.session_version, 0);
});

test("Google 재로그인은 다시 무효화하지 않고, 다른 Google 계정은 같은 이메일 계정을 가로챌 수 없다", { skip }, async () => {
  await googleCallback.GET(callbackRequest());
  // 피해자가 설정에서 비밀번호를 다시 설정했다고 가정
  await db.sql`UPDATE users SET password_hash = ${"$2b$victim"} WHERE id = ${U.squat.id}`;

  const again = await googleCallback.GET(callbackRequest());
  assert.equal(new URL(again.headers.get("location") ?? "").pathname, "/dashboard");
  assert.deepEqual(await userRow(U.squat.id), { password_hash: "$2b$victim", google_id: "g-victim", session_version: 1 });

  google.profile = { id: "g-attacker", email: U.squat.email, verified_email: true };
  const hijack = await googleCallback.GET(callbackRequest());
  assert.equal(new URL(hijack.headers.get("location") ?? "").search, "?error=google_conflict");
  assert.equal((await userRow(U.squat.id)).google_id, "g-victim");
});

test("Google 확인 안 된 이메일은 기존 계정에 연결하지 않는다", { skip }, async () => {
  google.profile = { ...google.profile, verified_email: false };
  await googleCallback.GET(callbackRequest());
  const row = await userRow(U.squat.id);
  assert.equal(row.google_id, null);
  assert.ok(row.password_hash);
  assert.equal(row.session_version, 0);
});

// ── 요청 단위 계좌 선택 ─────────────────────────

test("계좌 지정: 자기 둘째 계좌는 헤더로 고를 수 있고, 남의 계좌 id는 404", { skip }, async () => {
  const token = await session.signToken(U.other.id, 0);

  const first = await holdings.GET(authRequest("GET", { bearer: token }));
  assert.deepEqual(((await first.json()) as { name: string }[]).map((item) => item.name), ["첫 계좌 종목"]);

  const second = await holdings.GET(
    authRequest("GET", { bearer: token, headers: { "x-portfolio-account-id": seeded.other.secondAccountId } })
  );
  assert.deepEqual(((await second.json()) as { name: string }[]).map((item) => item.name), ["둘째 계좌 종목"]);

  const byQuery = await holdings.GET(
    authRequest("GET", { bearer: token, url: `https://pension.test/api/holdings?accountId=${seeded.other.secondAccountId}` })
  );
  assert.deepEqual(((await byQuery.json()) as { name: string }[]).map((item) => item.name), ["둘째 계좌 종목"]);

  const foreign = await holdings.GET(
    authRequest("GET", { bearer: token, headers: { "x-portfolio-account-id": seeded.squat.accountId } })
  );
  assert.equal(foreign.status, 404);

  // UUID 형식이 아닌 값도 SQL 오류 없이 404
  const garbage = await holdings.GET(authRequest("GET", { bearer: token, headers: { "x-portfolio-account-id": "'; DROP" } }));
  assert.equal(garbage.status, 404);
});
