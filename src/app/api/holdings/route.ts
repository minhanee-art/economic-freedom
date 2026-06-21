// holdings CRUD API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const rows = await sql`SELECT * FROM holdings WHERE user_id = ${session.userId} ORDER BY target_pct DESC`;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const body = await request.json();
  const [row] = await sql`
    INSERT INTO holdings (user_id, code, name, category, sub_category, current_price, target_pct)
    VALUES (${session.userId}, ${body.code}, ${body.name}, ${body.category}, ${body.sub_category ?? "기타"}, ${body.current_price ?? 0}, ${body.target_pct ?? 0})
    RETURNING *
  `;
  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id, current_price, target_pct } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  if (current_price !== undefined) {
    const p = Number(current_price);
    if (!Number.isFinite(p) || p < 0) return NextResponse.json({ error: "current_price는 0 이상이어야 합니다." }, { status: 400 });
    await sql`UPDATE holdings SET current_price = ${Math.round(p)} WHERE id = ${id} AND user_id = ${session.userId}`;
  }
  if (target_pct !== undefined) {
    const t = Number(target_pct);
    if (!Number.isFinite(t) || t < 0 || t > 100) return NextResponse.json({ error: "target_pct는 0~100이어야 합니다." }, { status: 400 });
    await sql`UPDATE holdings SET target_pct = ${t} WHERE id = ${id} AND user_id = ${session.userId}`;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id } = await request.json();
  await sql`DELETE FROM holdings WHERE id = ${id} AND user_id = ${session.userId}`;
  return NextResponse.json({ ok: true });
}
