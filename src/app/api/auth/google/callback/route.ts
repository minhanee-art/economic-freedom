// Google OAuth 콜백 — 코드 교환 → 사용자 생성/조회 → JWT 쿠키 발급
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { signToken, setSessionCookie } from "@/lib/session";
import { DEFAULT_HOLDINGS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const failUrl = `${origin}/login?error=google_failed`;

  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(failUrl);

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
  if (!tokenRes.ok) return NextResponse.redirect(failUrl);
  const { access_token } = await tokenRes.json();

  // 구글 사용자 정보 조회
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userRes.ok) return NextResponse.redirect(failUrl);
  const { id: googleId, email, name } = await userRes.json();
  if (!googleId || !email) return NextResponse.redirect(failUrl);

  // 기존 구글 계정 조회
  let user = (await sql`SELECT id FROM users WHERE google_id = ${googleId}`)[0];

  if (!user) {
    // 이메일 중복 확인 — 이미 이메일/비밀번호로 가입한 경우 계정 연결
    const existing = (await sql`SELECT id FROM users WHERE email = ${email}`)[0];
    if (existing) {
      await sql`UPDATE users SET google_id = ${googleId} WHERE id = ${existing.id}`;
      user = existing;
    } else {
      // 신규 사용자 생성
      [user] = await sql`
        INSERT INTO users (email, google_id)
        VALUES (${email}, ${googleId})
        RETURNING id
      `;
      for (const h of DEFAULT_HOLDINGS) {
        await sql`
          INSERT INTO holdings (user_id, code, name, category, sub_category, current_price, target_pct)
          VALUES (${user.id}, ${h.code}, ${h.name}, ${h.category}, ${h.sub_category}, ${h.current_price ?? 0}, ${h.target_pct})
          ON CONFLICT DO NOTHING
        `;
      }
      await sql`
        INSERT INTO profiles (id, email, display_name, monthly_budget)
        VALUES (${user.id}, ${email}, ${name ?? email}, 300000)
        ON CONFLICT DO NOTHING
      `;
    }
  }

  const token = await signToken(user.id);
  const res = NextResponse.redirect(`${origin}/dashboard`);
  setSessionCookie(res, token);
  return res;
}
