// 회원가입 API — 이메일/비밀번호 → users 테이블 + JWT 쿠키 발급
import { NextResponse } from "next/server";
import { signToken, setSessionCookie } from "@/lib/session";
import { signupWithPassword } from "@/lib/auth-account";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await signupWithPassword(request, body ?? {});
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const token = await signToken(result.user.id);
  const res = NextResponse.json({ ok: true }, { status: 201 });
  setSessionCookie(res, token);
  return res;
}
