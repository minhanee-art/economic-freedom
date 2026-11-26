// 비밀번호 설정/변경 API — 로그인한 사용자(쿠키 또는 Bearer).
// 비밀번호가 있는 계정은 현재 비밀번호 확인 필수, Google 전용 계정(password_hash NULL)은 새 비밀번호만으로 설정한다.
// 설정·변경 모두 session_version을 올려 다른 기기의 기존 토큰을 폐기하고, 요청한 클라이언트에는 새 토큰을 준다
// (쿠키 세션은 새 쿠키, Bearer는 응답 본문의 token).
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getRequestSession, setSessionCookie, signToken } from "@/lib/session";
import { authRateLimit } from "@/lib/rate-limit";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_LONG_MESSAGE, hashPassword, validateNewPassword } from "@/lib/auth-account";
import { ensureSessionVersionSchema, toSessionVersion } from "@/lib/session-version";

const UNAUTHORIZED = { error: "로그인이 필요합니다." };

/** 비밀번호 설정 여부 — 설정 화면이 "설정"/"변경" 중 무엇을 보여줄지 정한다. */
export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const [user] = await sql`SELECT password_hash IS NOT NULL AS has_password FROM users WHERE id = ${session.userId}`;
  // 토큰은 유효하지만 계정이 삭제된 경우
  if (!user) return NextResponse.json(UNAUTHORIZED, { status: 401 });
  return NextResponse.json({ hasPassword: Boolean(user.has_password) });
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const body = (await request.json().catch(() => null)) as { currentPassword?: unknown; newPassword?: unknown } | null;
  const newPassword = body?.newPassword;
  const problem = validateNewPassword(newPassword);
  if (problem) {
    const error = problem === "too_long" ? PASSWORD_TOO_LONG_MESSAGE : `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
    return NextResponse.json({ error }, { status: 400 });
  }

  // 탈취된 세션으로 현재 비밀번호를 대입하는 것을 막는다 — 사용자 기준, bcrypt 비교 전에 차단
  if (!(await authRateLimit(`password:${session.userId}`))) {
    return NextResponse.json({ error: "시도가 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const [user] = await sql`SELECT password_hash FROM users WHERE id = ${session.userId}`;
  if (!user) return NextResponse.json(UNAUTHORIZED, { status: 401 });
  await ensureSessionVersionSchema();

  const currentHash = user.password_hash ? String(user.password_hash) : null;
  let updated: Record<string, unknown>[];
  if (currentHash) {
    const currentPassword = body?.currentPassword;
    if (typeof currentPassword !== "string" || !currentPassword) {
      return NextResponse.json({ error: "현재 비밀번호를 입력해주세요." }, { status: 400 });
    }
    if (!(await bcrypt.compare(currentPassword, currentHash))) {
      // 401은 "로그아웃됨"으로 읽히므로 403
      return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 403 });
    }
    const nextHash = await hashPassword(newPassword as string);
    // 확인한 해시가 그대로일 때만 바꾼다(동시 변경 방지)
    updated = await sql`
      UPDATE users SET password_hash = ${nextHash}, session_version = session_version + 1
      WHERE id = ${session.userId} AND password_hash = ${currentHash}
      RETURNING id, session_version
    `;
  } else {
    const nextHash = await hashPassword(newPassword as string);
    // Google 전용 계정 — 아직 비밀번호가 없을 때만 설정
    updated = await sql`
      UPDATE users SET password_hash = ${nextHash}, session_version = session_version + 1
      WHERE id = ${session.userId} AND password_hash IS NULL
      RETURNING id, session_version
    `;
  }

  if (updated.length === 0) {
    return NextResponse.json({ error: "비밀번호가 방금 변경되었습니다. 새로고침 후 다시 시도해주세요." }, { status: 409 });
  }

  // 이 요청의 토큰도 방금 폐기되었으므로 새 버전으로 다시 발급한다.
  const token = await signToken(session.userId, toSessionVersion(updated[0].session_version));
  if (session.source === "bearer") {
    return NextResponse.json({ ok: true, hasPassword: true, token });
  }
  const res = NextResponse.json({ ok: true, hasPassword: true });
  setSessionCookie(res, token);
  return res;
}
