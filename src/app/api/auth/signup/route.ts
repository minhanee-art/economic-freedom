// 회원가입 API — 이메일/비밀번호 → users 테이블 + JWT 쿠키 발급
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signToken, setSessionCookie } from "@/lib/session";
import { DEFAULT_HOLDINGS } from "@/lib/constants";
import { authRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: "이메일과 비밀번호(6자 이상)를 입력해주세요." }, { status: 400 });
  }

  // 무차별 대입/스팸 가입 방어 — IP 기준
  if (!(await authRateLimit(`signup:${clientIp(request)}`))) {
    return NextResponse.json({ error: "가입 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length > 0) {
    return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // 동시 가입 레이스 — 위 SELECT를 통과한 두 요청이 동시에 INSERT하면 UNIQUE(email) 위반.
  // 미처리 500 대신 409로 변환한다.
  const insertedUsers = await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${passwordHash})
    RETURNING id
  `.catch((err: { code?: string }) => {
    if (err?.code === "23505") return null;
    throw err;
  });
  if (!insertedUsers) {
    return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
  }
  const user = insertedUsers[0];

  // 기본 종목 15개 자동 생성
  for (const h of DEFAULT_HOLDINGS) {
    await sql`
      INSERT INTO holdings (user_id, code, name, category, sub_category, current_price, target_pct)
      VALUES (${user.id}, ${h.code}, ${h.name}, ${h.category}, ${h.sub_category}, ${h.current_price ?? 0}, ${h.target_pct})
      ON CONFLICT DO NOTHING
    `;
  }

  // 기본 프로필 생성
  await sql`
    INSERT INTO profiles (id, email, monthly_budget)
    VALUES (${user.id}, ${email}, 300000)
    ON CONFLICT DO NOTHING
  `;

  const token = await signToken(user.id);
  const res = NextResponse.json({ ok: true }, { status: 201 });
  setSessionCookie(res, token);
  return res;
}
