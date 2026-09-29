import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signToken } from "@/lib/session";
import { authRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { email, password } = await request.json().catch(() => ({ email: "", password: "" }));
  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요." }, { status: 400 });
  }

  if (!(await authRateLimit(`mobile-login:${clientIp(request)}:${normalizedEmail}`))) {
    return NextResponse.json({ error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const [user] = await sql`
    SELECT u.id, u.password_hash, p.display_name
    FROM users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.email = ${normalizedEmail}
    LIMIT 1
  `;

  if (!user?.password_hash) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const valid = await bcrypt.compare(String(password), String(user.password_hash));
  if (!valid) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = await signToken(String(user.id));
  return NextResponse.json({
    ok: true,
    token,
    user: {
      id: String(user.id),
      email: normalizedEmail,
      displayName: user.display_name ? String(user.display_name) : null,
    },
  });
}
