// 로그인 API — 이메일/비밀번호 검증 후 JWT 쿠키 발급
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signToken, setSessionCookie } from "@/lib/session";
import { authRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요." }, { status: 400 });
  }

  // 무차별 대입 방어 — IP+이메일 기준 (bcrypt 비교 전에 차단)
  if (!(await authRateLimit(`login:${clientIp(request)}:${String(email).toLowerCase()}`))) {
    return NextResponse.json({ error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const [user] = await sql`SELECT id, password_hash FROM users WHERE email = ${email} LIMIT 1`;
  if (!user) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  // Google OAuth 전용 계정(password_hash NULL)은 비밀번호 로그인을 사용할 수 없다.
  if (!user.password_hash) {
    return NextResponse.json({ error: "이 계정은 Google 로그인을 사용합니다." }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = await signToken(user.id);
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, token);
  return res;
}
