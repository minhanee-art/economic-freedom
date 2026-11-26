// 이메일/비밀번호 계정 공통 로직 — 웹(/api/auth/*)과 모바일(/api/mobile/auth/*)이 같은 검증·레이트리밋을 쓴다.
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { DEFAULT_HOLDINGS } from "@/lib/constants";
import { authRateLimit, clientIp } from "@/lib/rate-limit";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";
import { ensureSessionVersionSchema, toSessionVersion } from "@/lib/session-version";

export const MIN_PASSWORD_LENGTH = 6;
/** bcrypt는 72바이트 이후를 무시하므로 그보다 긴 비밀번호는 받지 않는다. */
export const MAX_PASSWORD_BYTES = 72;
const BCRYPT_COST = 12;

const SIGNUP_INPUT_ERROR = "이메일과 비밀번호(6자 이상)를 입력해주세요.";
const PASSWORD_TOO_LONG_ERROR = "비밀번호는 72바이트(영문 72자, 한글 약 24자) 이하로 입력해주세요.";

export type AuthFailure = { ok: false; status: number; error: string };

/** 이메일 비교·저장 기준 — 앞뒤 공백 제거 + 소문자. */
export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export type PasswordProblem = "too_short" | "too_long";

/** 새 비밀번호 검증(가입·변경 공통). 문제가 없으면 null. */
export function validateNewPassword(password: unknown): PasswordProblem | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) return "too_short";
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return "too_long";
  return null;
}

export const PASSWORD_TOO_LONG_MESSAGE = PASSWORD_TOO_LONG_ERROR;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export type SignupResult = { ok: true; user: { id: string; email: string; sessionVersion: number } } | AuthFailure;

/**
 * 이메일/비밀번호 가입 — 검증 → IP 레이트리밋 → 중복 확인 → users·기본 종목·프로필 생성.
 * 토큰 발급과 응답 형태(쿠키/본문)는 호출하는 라우트가 정한다.
 */
export async function signupWithPassword(request: Request, input: { email?: unknown; password?: unknown }): Promise<SignupResult> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, status: 400, error: SIGNUP_INPUT_ERROR };
  const passwordProblem = validateNewPassword(input.password);
  if (passwordProblem) {
    return { ok: false, status: 400, error: passwordProblem === "too_long" ? PASSWORD_TOO_LONG_ERROR : SIGNUP_INPUT_ERROR };
  }
  const password = input.password as string;

  // 무차별 대입/스팸 가입 방어 — IP 기준, 웹·모바일이 같은 버킷을 쓴다
  if (!(await authRateLimit(`signup:${clientIp(request)}`))) {
    return { ok: false, status: 429, error: "가입 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." };
  }

  // 대소문자만 다른 기존 계정도 중복으로 본다
  const existing = await sql`SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1`;
  if (existing.length > 0) return { ok: false, status: 409, error: "이미 가입된 이메일입니다." };

  const passwordHash = await hashPassword(password);
  await ensureSessionVersionSchema();
  // 동시 가입 레이스 — 위 SELECT를 통과한 두 요청이 동시에 INSERT하면 UNIQUE(email) 위반.
  // 미처리 500 대신 409로 변환한다.
  const insertedUsers = await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${passwordHash})
    RETURNING id, session_version
  `.catch((err: { code?: string }) => {
    if (err?.code === "23505") return null;
    throw err;
  });
  if (!insertedUsers) return { ok: false, status: 409, error: "이미 가입된 이메일입니다." };

  const userId = String(insertedUsers[0].id);
  const sessionVersion = toSessionVersion(insertedUsers[0].session_version);
  const accountId = await getActivePortfolioAccountId(userId);

  // 기본 종목 자동 생성
  for (const h of DEFAULT_HOLDINGS) {
    await sql`
      INSERT INTO holdings (user_id, account_id, code, name, category, sub_category, current_price, target_pct)
      VALUES (${userId}, ${accountId}, ${h.code}, ${h.name}, ${h.category}, ${h.sub_category}, ${h.current_price ?? 0}, ${h.target_pct})
      ON CONFLICT DO NOTHING
    `;
  }

  // 기본 프로필 생성
  await sql`
    INSERT INTO profiles (id, email, monthly_budget)
    VALUES (${userId}, ${email}, 300000)
    ON CONFLICT DO NOTHING
  `;

  return { ok: true, user: { id: userId, email, sessionVersion } };
}
