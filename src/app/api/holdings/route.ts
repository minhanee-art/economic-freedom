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
  const { id, current_price, target_pct } = await request.json();
  if (current_price !== undefined) {
    await sql`UPDATE holdings SET current_price = ${current_price} WHERE id = ${id} AND user_id = ${session.userId}`;
  }
  if (target_pct !== undefined) {
    await sql`UPDATE holdings SET target_pct = ${target_pct} WHERE id = ${id} AND user_id = ${session.userId}`;
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
