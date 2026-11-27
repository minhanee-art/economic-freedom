// Google OAuth 콜백 — 계정 선점 차단·토큰 폐기 테스트. Google 엔드포인트는 fetch 스텁으로 대신한다.
import test, { after, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { createFakeSql, type SqlHandler } from "@/test/api-helpers";

process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";
process.env.GOOGLE_CLIENT_ID ||= "test-client";
process.env.GOOGLE_CLIENT_SECRET ||= "test-secret";

const db = createFakeSql();
mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/portfolio-accounts", {
  namedExports: {
    ACCOUNT_COOKIE: "pension-account",
    ensurePortfolioAccountSchema: async () => {},
    getActivePortfolioAccountId: async () => "acc-new",
    getPortfolioAccounts: async () => [],
  },
});

type GoogleProfile = { id?: string; email?: string; verified_email?: boolean; name?: string };
const google = { profile: {} as GoogleProfile, calls: [] as string[] };
const realFetch = globalThis.fetch;

let callback: typeof import("@/app/api/auth/google/callback/route");
let NextRequest: typeof import("next/server").NextRequest;

before(async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    google.calls.push(url);
    if (url.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ access_token: "google-access" });
    if (url.startsWith("https://www.googleapis.com/oauth2/v2/userinfo")) return Response.json(google.profile);
    throw new Error(`예상하지 못한 fetch: ${url}`);
  }) as typeof fetch;
  callback = await import("@/app/api/auth/google/callback/route");
  NextRequest = (await import("next/server")).NextRequest;
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  db.reset();
  google.calls.length = 0;
  google.profile = { id: "g-victim", email: "Victim@Example.com", verified_email: true, name: "피해자" };
});

function callbackRequest(state = "s1", cookieState = "s1") {
  return new NextRequest(`https://pension.test/api/auth/google/callback?code=c1&state=${state}`, {
    headers: { cookie: `g_oauth_state=${cookieState}` },
  });
}

/** 가짜 users 테이블 하나로 콜백이 보내는 쿼리에 답한다 */
type Row = { id: string; email: string; google_id: string | null; password_hash: string | null; session_version: number };
function usersTable(rows: Row[], overrides: Partial<Record<"link" | "insert", SqlHandler>> = {}): SqlHandler {
  return (query, values) => {
    if (query.startsWith("ALTER TABLE")) return [];
    if (query.startsWith("SELECT id, session_version FROM users WHERE google_id")) {
      const row = rows.find((item) => item.google_id === values[0]);
      return row ? [{ id: row.id, session_version: row.session_version }] : [];
    }
    if (query.startsWith("SELECT id, google_id FROM users WHERE lower(email)")) {
      const row = rows.find((item) => item.email.toLowerCase() === values[0]);
      return row ? [{ id: row.id, google_id: row.google_id }] : [];
    }
    if (query.startsWith("WITH linked AS")) {
      if (overrides.link) return overrides.link(query, values);
      const [googleId, userId] = values as [string, string];
      const row = rows.find((item) => item.id === userId && item.google_id === null);
      if (!row) return [];
      row.google_id = googleId;
      row.password_hash = null;
      row.session_version += 1;
      return [{ id: row.id, session_version: row.session_version }];
    }
    if (query.startsWith("INSERT INTO users")) {
      if (overrides.insert) return overrides.insert(query, values);
      const [email, googleId] = values as [string, string];
      const row = { id: "user-new", email, google_id: googleId, password_hash: null, session_version: 0 };
      rows.push(row);
      return [{ id: row.id, session_version: 0 }];
    }
    return [];
  };
}

async function tokenVersion(response: Response): Promise<number | undefined> {
  const { decodeJwt } = await import("jose");
  const cookie = response.headers.get("set-cookie") ?? "";
  const token = decodeURIComponent(/pension-session=([^;]+)/.exec(cookie)?.[1] ?? "");
  return token ? (decodeJwt(token).sv as number) : undefined;
}

const location = (response: Response) => new URL(response.headers.get("location") ?? "").pathname + new URL(response.headers.get("location") ?? "").search;
const writes = () => db.calls.filter((call) => /^(UPDATE|INSERT|WITH|DELETE)/.test(call.query));

// ── 기본 흐름 ───────────────────────────────────

test("state가 맞지 않으면 실패로 보내고 Google·DB를 호출하지 않는다", async () => {
  const response = await callback.GET(callbackRequest("s1", "other"));
  assert.equal(location(response), "/login?error=google_failed");
  assert.equal(google.calls.length, 0);
  assert.equal(db.calls.length, 0);
});

test("Google이 확인하지 않은 이메일은 생성·연결 근거로 쓰지 않는다", async () => {
  google.profile.verified_email = false;
  const rows: Row[] = [{ id: "u-attacker", email: "victim@example.com", google_id: null, password_hash: "$2b$attacker", session_version: 0 }];
  db.setHandler(usersTable(rows));
  const response = await callback.GET(callbackRequest());
  assert.equal(location(response), "/login?error=google_unverified");
  assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /pension-session=/);
  assert.equal(writes().length, 0);
  assert.equal(rows[0].password_hash, "$2b$attacker");
});

test("이미 연결된 Google 계정은 그 계정으로 로그인하고 현재 세션 버전으로 토큰을 준다", async () => {
  const rows: Row[] = [{ id: "u1", email: "victim@example.com", google_id: "g-victim", password_hash: null, session_version: 3 }];
  db.setHandler(usersTable(rows));
  const response = await callback.GET(callbackRequest());
  assert.equal(location(response), "/dashboard");
  assert.equal(await tokenVersion(response), 3);
  assert.equal(writes().length, 0, "기존 연결 계정은 아무것도 바꾸지 않는다");
});

test("새 사용자: 정규화한 이메일로 만들고 프로필만 넣는다 — 종목은 만들지 않는다(빈 계정)", async () => {
  const rows: Row[] = [];
  db.setHandler(usersTable(rows));
  const response = await callback.GET(callbackRequest());
  assert.equal(location(response), "/dashboard");
  assert.equal(await tokenVersion(response), 0);
  assert.deepEqual(db.find("INSERT INTO users")[0].values, ["victim@example.com", "g-victim"]);
  assert.equal(db.find("INSERT INTO profiles").length, 1);
  assert.equal(db.find("INSERT INTO holdings").length, 0, "Google 가입도 예시 종목을 넣지 않는다");
});

// ── 계정 선점 차단 ─────────────────────────────

test("선점된 비밀번호 계정에 처음 연결: 비밀번호 무효화·세션 버전 증가·텔레그램 chat_id 삭제를 한 문장으로", async () => {
  // 공격자가 피해자 이메일(대소문자 다르게)로 먼저 가입해 둔 상태
  const rows: Row[] = [{ id: "u-squat", email: "victim@example.com", google_id: null, password_hash: "$2b$attacker", session_version: 0 }];
  db.setHandler(usersTable(rows));

  const response = await callback.GET(callbackRequest());

  const link = db.find("WITH linked AS");
  assert.equal(link.length, 1);
  assert.match(link[0].query, /password_hash = NULL/);
  assert.match(link[0].query, /session_version = session_version \+ 1/);
  assert.match(link[0].query, /WHERE id = \? AND google_id IS NULL/);
  assert.match(link[0].query, /UPDATE portfolio_accounts SET telegram_chat_id = NULL WHERE user_id IN \(SELECT id FROM linked\)/);
  assert.deepEqual(link[0].values, ["g-victim", "u-squat"]);

  assert.equal(rows[0].password_hash, null, "공격자 비밀번호는 더 이상 통하지 않는다");
  assert.equal(rows[0].google_id, "g-victim");
  // 새 토큰은 올라간 버전 — 공격자가 가진 버전 0 토큰은 무효
  assert.equal(await tokenVersion(response), 1);
  // 비밀번호 재설정을 할 수 있는 설정 화면으로 보낸다
  assert.equal(location(response), "/dashboard/settings");
  // 이메일 조회는 소문자 기준 + 정확히 같은 행 우선
  const lookup = db.find("SELECT id, google_id FROM users")[0];
  assert.match(lookup.query, /lower\(email\) = \?/);
  assert.deepEqual(lookup.values, ["victim@example.com", "victim@example.com"]);
});

test("이미 다른 Google 계정에 연결된 이메일이면 연결을 바꾸지 않고 실패", async () => {
  const rows: Row[] = [{ id: "u1", email: "victim@example.com", google_id: "g-someone-else", password_hash: null, session_version: 0 }];
  db.setHandler(usersTable(rows));
  const response = await callback.GET(callbackRequest());
  assert.equal(location(response), "/login?error=google_conflict");
  assert.equal(writes().length, 0);
  assert.equal(rows[0].google_id, "g-someone-else");
});

test("동시 콜백: 연결 UPDATE가 0건이면(다른 요청이 먼저 연결) 연결된 행으로 로그인한다", async () => {
  const rows: Row[] = [{ id: "u1", email: "victim@example.com", google_id: null, password_hash: "$2b$x", session_version: 0 }];
  db.setHandler(
    usersTable(rows, {
      link: () => {
        // 다른 요청이 이미 연결·버전 증가를 끝낸 상태
        Object.assign(rows[0], { google_id: "g-victim", password_hash: null, session_version: 1 });
        return [];
      },
    })
  );
  const response = await callback.GET(callbackRequest());
  assert.equal(location(response), "/dashboard");
  assert.equal(await tokenVersion(response), 1);
});

test("동시 가입: INSERT가 UNIQUE 위반이고 Google 계정 행도 없으면 실패(500 아님)", async () => {
  db.setHandler(
    usersTable([], {
      insert: () => {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      },
    })
  );
  const response = await callback.GET(callbackRequest());
  assert.equal(location(response), "/login?error=google_conflict");
});

test("Google 응답에 id나 이메일이 없으면 실패", async () => {
  for (const profile of [{ email: "a@b.com", verified_email: true }, { id: "g1", verified_email: true }]) {
    db.reset();
    google.profile = profile;
    const response = await callback.GET(callbackRequest());
    assert.equal(location(response), "/login?error=google_failed");
    assert.equal(db.calls.length, 0);
  }
});
