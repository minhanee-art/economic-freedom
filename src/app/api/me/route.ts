// 현재 로그인 사용자 프로필 조회 API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const [row] = await sql`
    SELECT display_name, email FROM profiles WHERE id = ${session.userId}
  `;
  return NextResponse.json({ displayName: row?.display_name ?? null, email: row?.email ?? null });
}
