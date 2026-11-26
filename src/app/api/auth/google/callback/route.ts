// Google OAuth 콜백 — 코드 교환 → 사용자 생성/조회/연결 → JWT 쿠키 발급
//
// 계정 선점(pre-hijacking) 차단: 이메일/비밀번호 가입은 이메일 소유를 확인하지 않으므로,
// 남이 피해자 이메일로 먼저 가입해 둘 수 있다. 그래서 Google이 검증한 이메일로 그 계정에 "처음" 연결할 때
// 연결 전 자격 증명을 신뢰하지 않는다 — 한 SQL 문으로 원자적으로
//   1) 비밀번호를 무효화(password_hash = NULL), 2) session_version을 올려 기존 토큰을 모두 폐기,
//   3) 연결 전에 설정된 외부 전송 채널(텔레그램 chat_id)을 지운다.
// 사용자는 설정 화면에서 비밀번호를 다시 설정할 수 있다(비밀번호 API가 NULL 계정의 설정을 허용).
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { signToken, setSessionCookie } from "@/lib/session";
import { DEFAULT_HOLDINGS } from "@/lib/constants";
import { ensurePortfolioAccountSchema, getActivePortfolioAccountId } from "@/lib/portfolio-accounts";
import { normalizeEmail } from "@/lib/auth-account";
import { ensureSessionVersionSchema, toSessionVersion } from "@/lib/session-version";

type GoogleUserInfo = {
  id?: unknown;
  email?: unknown;
  verified_email?: unknown;
  email_verified?: unknown;
  name?: unknown;
};

type SignedInUser = { id: string; sessionVersion: number; linked: boolean };

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "23505";
}

async function findByGoogleId(googleId: string): Promise<SignedInUser | null> {
  const [row] = await sql`SELECT id, session_version FROM users WHERE google_id = ${googleId}`;
  return row ? { id: String(row.id), sessionVersion: toSessionVersion(row.session_version), linked: false } : null;
}

/**
 * 같은 이메일의 기존 계정에 Google을 처음 연결한다. 비밀번호 무효화·토큰 폐기·텔레그램 chat_id 삭제를 한 문장으로.
 * google_id가 이미 채워진 계정(다른 Google 계정에 연결됨)은 건드리지 않는다(조건부 UPDATE).
 */
async function linkExistingAccount(userId: string, googleId: string): Promise<SignedInUser | null> {
  const [row] = await sql`
    WITH linked AS (
      UPDATE users
      SET google_id = ${googleId}, password_hash = NULL, session_version = session_version + 1
      WHERE id = ${userId} AND google_id IS NULL
      RETURNING id, session_version
    ), cleared AS (
      UPDATE portfolio_accounts SET telegram_chat_id = NULL
      WHERE user_id IN (SELECT id FROM linked)
    )
    SELECT id, session_version FROM linked
  `;
  return row ? { id: String(row.id), sessionVersion: toSessionVersion(row.session_version), linked: true } : null;
}

async function createGoogleUser(email: string, googleId: string, name: string): Promise<SignedInUser | null> {
  const inserted = await sql`
    INSERT INTO users (email, google_id)
    VALUES (${email}, ${googleId})
    RETURNING id, session_version
  `.catch((err: unknown) => {
    if (isUniqueViolation(err)) return null;
    throw err;
  });
  if (!inserted) return null;
  const [row] = inserted;
  const userId = String(row.id);

  const accountId = await getActivePortfolioAccountId(userId);
  for (const h of DEFAULT_HOLDINGS) {
    await sql`
      INSERT INTO holdings (user_id, account_id, code, name, category, sub_category, current_price, target_pct)
      VALUES (${userId}, ${accountId}, ${h.code}, ${h.name}, ${h.category}, ${h.sub_category}, ${h.current_price ?? 0}, ${h.target_pct})
      ON CONFLICT DO NOTHING
    `;
  }
  await sql`
    INSERT INTO profiles (id, email, display_name, monthly_budget)
    VALUES (${userId}, ${email}, ${name}, 300000)
    ON CONFLICT DO NOTHING
  `;
  return { id: userId, sessionVersion: toSessionVersion(row.session_version), linked: false };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const fail = (reason: "google_failed" | "google_unverified" | "google_conflict") =>
    NextResponse.redirect(`${origin}/login?error=${reason}`);

  // state(CSRF) 대조 — 시작 라우트가 심은 쿠키와 일치해야 한다
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("g_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("google_failed");
  }

  // 코드 → 액세스 토큰 교환
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("google_failed");
  const { access_token } = await tokenRes.json();

  // 구글 사용자 정보 조회
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userRes.ok) return fail("google_failed");
  const info = (await userRes.json()) as GoogleUserInfo;
  const googleId = typeof info.id === "string" ? info.id : "";
  const email = normalizeEmail(info.email);
  if (!googleId || !email) return fail("google_failed");
  // Google이 소유를 확인한 이메일만 계정 생성·연결 근거로 쓴다 (v2 userinfo는 verified_email)
  if (info.verified_email !== true && info.email_verified !== true) return fail("google_unverified");
  const name = typeof info.name === "string" && info.name.trim() ? info.name.trim() : email;

  await ensureSessionVersionSchema();

  let user = await findByGoogleId(googleId);
  if (!user) {
    // 같은 이메일의 기존 계정 — 가입 시 소문자로 저장하지만 예전 행은 대소문자가 섞였을 수 있다
    const [existing] = await sql`
      SELECT id, google_id FROM users
      WHERE lower(email) = ${email}
      ORDER BY (email = ${email}) DESC
      LIMIT 1
    `;
    if (existing) {
      // 이미 다른 Google 계정에 연결된 이메일이면 연결을 바꾸지 않는다(덮어쓰면 계정 탈취 경로가 된다)
      if (existing.google_id) return fail("google_conflict");
      await ensurePortfolioAccountSchema();
      user = await linkExistingAccount(String(existing.id), googleId);
    } else {
      user = await createGoogleUser(email, googleId, name);
    }
    // 동시 콜백 경합 — 다른 요청이 먼저 같은 Google 계정을 연결/생성했으면 그 행을 쓴다
    user ??= await findByGoogleId(googleId);
    if (!user) return fail("google_conflict");
  }

  const token = await signToken(user.id, user.sessionVersion);
  // 처음 연결된 경우 비밀번호가 무효화되었으므로 비밀번호 설정이 있는 설정 화면으로 보낸다
  const res = NextResponse.redirect(`${origin}${user.linked ? "/dashboard/settings" : "/dashboard"}`);
  setSessionCookie(res, token);
  res.cookies.delete("g_oauth_state");
  return res;
}
