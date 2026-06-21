// Google OAuth 2.0 인증 시작 — state(CSRF 토큰) 발급 후 Google 로그인 페이지로 리다이렉트
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const state = randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });
  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
  // 콜백에서 대조할 state를 HTTP-only 쿠키로 저장 (CSRF 방지)
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
