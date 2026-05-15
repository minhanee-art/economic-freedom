// 배당금 CRUD API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const rows = await sql`
    SELECT d.*, h.name AS holding_name, h.code AS holding_code
    FROM dividends d
    LEFT JOIN holdings h ON h.id = d.holding_id
    WHERE d.user_id = ${session.userId}
    ORDER BY d.date DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { holdingId, amount, date, memo } = await request.json();
  const [row] = await sql`
    INSERT INTO dividends (user_id, holding_id, amount, date, memo)
    VALUES (${session.userId}, ${holdingId}, ${amount}, ${date}, ${memo ?? null})
    RETURNING *
  `;
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id } = await request.json();
  await sql`DELETE FROM dividends WHERE id = ${id} AND user_id = ${session.userId}`;
  return NextResponse.json({ ok: true });
}
