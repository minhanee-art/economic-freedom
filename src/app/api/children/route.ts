// 자녀 프로필 CRUD API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const rows = await sql`
    SELECT id, name, birth_date::text, created_at::text
    FROM children WHERE user_id = ${session.userId} ORDER BY created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const birthDate = typeof body?.birthDate === "string" ? body.birthDate : "";
  if (!name || name.length > 50) {
    return NextResponse.json({ error: "이름을 입력해주세요 (50자 이하)." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || isNaN(new Date(birthDate).getTime())) {
    return NextResponse.json({ error: "생년월일(YYYY-MM-DD)을 올바르게 입력해주세요." }, { status: 400 });
  }
  if (new Date(birthDate) > new Date()) {
    return NextResponse.json({ error: "생년월일이 미래일 수 없습니다." }, { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO children (user_id, name, birth_date)
    VALUES (${session.userId}, ${name}, ${birthDate})
    RETURNING id, name, birth_date::text, created_at::text
  `;
  return NextResponse.json(row, { status: 201 });
}
