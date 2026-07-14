// 자녀 프로필 수정/삭제 API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const birthDate = typeof body?.birthDate === "string" ? body.birthDate : undefined;

  if (name !== undefined && (!name || name.length > 50)) {
    return NextResponse.json({ error: "이름을 입력해주세요 (50자 이하)." }, { status: 400 });
  }
  if (birthDate !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || isNaN(new Date(birthDate).getTime()))) {
    return NextResponse.json({ error: "생년월일(YYYY-MM-DD)을 올바르게 입력해주세요." }, { status: 400 });
  }

  const [row] = await sql`
    UPDATE children
    SET name = COALESCE(${name ?? null}, name),
        birth_date = COALESCE(${birthDate ?? null}, birth_date)
    WHERE id = ${id} AND user_id = ${session.userId}
    RETURNING id, name, birth_date::text, created_at::text
  `;
  if (!row) return NextResponse.json({ error: "자녀를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id } = await params;
  // child_gifts/child_holdings는 FK ON DELETE CASCADE로 함께 삭제됨
  await sql`DELETE FROM children WHERE id = ${id} AND user_id = ${session.userId}`;
  return NextResponse.json({ ok: true });
}
