// 모바일 회원가입 API — 웹 가입과 같은 검증·레이트리밋, 토큰은 쿠키 대신 본문으로 돌려준다.
import { NextResponse } from "next/server";
import { signToken } from "@/lib/session";
import { signupWithPassword } from "@/lib/auth-account";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await signupWithPassword(request, body ?? {});
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const token = await signToken(result.user.id, result.user.sessionVersion);
  return NextResponse.json(
    {
      ok: true,
      token,
      user: { id: result.user.id, email: result.user.email, displayName: null },
    },
    { status: 201 }
  );
}
