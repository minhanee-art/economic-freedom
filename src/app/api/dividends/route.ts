// 배당금 CRUD API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const rows = await sql`
    SELECT d.id, d.user_id, d.holding_id, d.amount, d.date::text AS date, d.memo, d.created_at,
           h.name AS holding_name, h.code AS holding_code
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
  const { holdingId, amount, date, memo } = await request.json().catch(() => ({}));
  if (!holdingId || !Number.isFinite(Number(amount)) || !date) {
    return NextResponse.json({ error: "holdingId, amount, date 필요" }, { status: 400 });
  }
  // 소유 종목 검증
  const [owned] = await sql`SELECT id FROM holdings WHERE id = ${holdingId} AND user_id = ${session.userId}`;
  if (!owned) return NextResponse.json({ error: "보유 종목이 아닙니다." }, { status: 400 });

  // 추가 직후 종목명/날짜(YYYY-MM-DD)를 포함해 반환 — 클라이언트가 바로 정상 렌더하도록.
  // (holding_id,date) UNIQUE 충돌 시 갱신해 수동 추가에서도 500이 나지 않게 한다.
  const [row] = await sql`
    WITH ins AS (
      INSERT INTO dividends (user_id, holding_id, amount, date, memo)
      VALUES (${session.userId}, ${holdingId}, ${amount}, ${date}, ${memo ?? null})
      ON CONFLICT (holding_id, date) DO UPDATE SET amount = EXCLUDED.amount, memo = EXCLUDED.memo
      RETURNING *
    )
    SELECT ins.id, ins.user_id, ins.holding_id, ins.amount, ins.date::text AS date, ins.memo, ins.created_at,
           h.name AS holding_name, h.code AS holding_code
    FROM ins LEFT JOIN holdings h ON h.id = ins.holding_id
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
