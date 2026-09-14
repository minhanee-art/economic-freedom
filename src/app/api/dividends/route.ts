// 배당금 CRUD API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  const rows = await sql`
    SELECT d.id, d.user_id, d.account_id, d.holding_id, d.amount, d.date::text AS date, d.memo, d.created_at,
           h.name AS holding_name, h.code AS holding_code
    FROM dividends d
    LEFT JOIN holdings h ON h.id = d.holding_id
    WHERE d.user_id = ${session.userId} AND d.account_id = ${accountId}
    ORDER BY d.date DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  const { holdingId, amount, date, memo } = await request.json().catch(() => ({}));
  if (!holdingId || !Number.isFinite(Number(amount)) || !date) {
    return NextResponse.json({ error: "holdingId, amount, date 필요" }, { status: 400 });
  }
  const [owned] = await sql`SELECT id FROM holdings WHERE id = ${holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  if (!owned) return NextResponse.json({ error: "현재 계좌 보유 종목이 아닙니다." }, { status: 400 });

  const [row] = await sql`
    WITH ins AS (
      INSERT INTO dividends (user_id, account_id, holding_id, amount, date, memo)
      VALUES (${session.userId}, ${accountId}, ${holdingId}, ${amount}, ${date}, ${memo ?? null})
      ON CONFLICT (holding_id, date) DO UPDATE SET amount = EXCLUDED.amount, memo = EXCLUDED.memo, account_id = EXCLUDED.account_id
      RETURNING *
    )
    SELECT ins.id, ins.user_id, ins.account_id, ins.holding_id, ins.amount, ins.date::text AS date, ins.memo, ins.created_at,
           h.name AS holding_name, h.code AS holding_code
    FROM ins LEFT JOIN holdings h ON h.id = ins.holding_id
  `;
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  const { id } = await request.json();
  await sql`DELETE FROM dividends WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  return NextResponse.json({ ok: true });
}
