// 현재 로그인 사용자 프로필 조회(GET) / 계정 삭제(DELETE) API
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { clearSessionCookie, getBearerSession, getSession } from "@/lib/session";
import { authRateLimit, clientIp } from "@/lib/rate-limit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ authenticated: false, error: "인증 필요" }, { status: 401 });

  const [row] = await sql`
    SELECT p.display_name, p.email, (u.password_hash IS NOT NULL) AS has_password
    FROM profiles p
    JOIN users u ON u.id = p.id
    WHERE p.id = ${session.userId}
  `;
  return NextResponse.json({
    authenticated: true,
    displayName: row?.display_name ?? null,
    email: row?.email ?? null,
    // 계정 삭제 시 비밀번호(true) / 이메일 확인(false) 중 무엇을 요구하는지 UI가 알 수 있게 한다.
    hasPassword: row?.has_password ?? true,
  });
}

/**
 * 계정 삭제 — 쿠키 세션 또는 Bearer 토큰.
 * 본문: 비밀번호 계정은 { password }, Google 전용 계정(password_hash NULL)은 { confirmEmail }.
 * 사용자 데이터 테이블은 모두 users(id) ON DELETE CASCADE이므로 users 행 하나를 지우면 전부 삭제된다.
 */
export async function DELETE(request: Request) {
  const session = (await getBearerSession(request)) ?? (await getSession());
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  // 탈취된 세션으로 비밀번호를 추측하는 것을 막는다 (bcrypt 비교 전에 차단)
  if (!(await authRateLimit(`delete-account:${clientIp(request)}:${session.userId}`))) {
    return NextResponse.json({ error: "시도가 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { password?: unknown; confirmEmail?: unknown };

  const [user] = await sql`SELECT email, password_hash FROM users WHERE id = ${session.userId} LIMIT 1`;
  if (!user) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  if (user.password_hash) {
    if (typeof body.password !== "string" || !body.password) {
      return NextResponse.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
    }
    if (!(await bcrypt.compare(body.password, user.password_hash))) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 403 });
    }
  } else {
    if (typeof body.confirmEmail !== "string" || !body.confirmEmail.trim()) {
      return NextResponse.json({ error: "계정 이메일을 입력해주세요." }, { status: 400 });
    }
    if (body.confirmEmail.trim().toLowerCase() !== String(user.email).toLowerCase()) {
      return NextResponse.json({ error: "입력한 이메일이 계정 이메일과 일치하지 않습니다." }, { status: 403 });
    }
  }

  await sql`DELETE FROM users WHERE id = ${session.userId}`;

  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
