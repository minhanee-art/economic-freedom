// 자녀 명의 보유 종목 CRUD API (간이 관리 — 성인 holdings와 별도 테이블)
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

const INT_MAX = 2_147_483_647;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id } = await params;
  const rows = await sql`
    SELECT id, child_id, code, name, shares, avg_price, current_price, created_at::text, updated_at::text
    FROM child_holdings WHERE child_id = ${id} AND user_id = ${session.userId} ORDER BY created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id: childId } = await params;

  const [child] = await sql`SELECT id FROM children WHERE id = ${childId} AND user_id = ${session.userId}`;
  if (!child) return NextResponse.json({ error: "자녀를 찾을 수 없습니다." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const shares = Number(body?.shares ?? 0);
  const avgPrice = Number(body?.avgPrice ?? 0);
  const currentPrice = Number(body?.currentPrice ?? 0);

  if (!code || !name) {
    return NextResponse.json({ error: "종목코드와 종목명을 입력해주세요." }, { status: 400 });
  }
  for (const [label, v] of [["shares", shares], ["avgPrice", avgPrice], ["currentPrice", currentPrice]] as const) {
    if (!Number.isFinite(v) || v < 0 || v > INT_MAX) {
      return NextResponse.json({ error: `${label} 값이 올바르지 않습니다.` }, { status: 400 });
    }
  }

  const [row] = await sql`
    INSERT INTO child_holdings (child_id, user_id, code, name, shares, avg_price, current_price)
    VALUES (${childId}, ${session.userId}, ${code}, ${name}, ${Math.round(shares)}, ${Math.round(avgPrice)}, ${Math.round(currentPrice)})
    ON CONFLICT (child_id, code) DO UPDATE SET
      name = EXCLUDED.name, shares = EXCLUDED.shares, avg_price = EXCLUDED.avg_price, current_price = EXCLUDED.current_price
    RETURNING id, child_id, code, name, shares, avg_price, current_price, created_at::text, updated_at::text
  `;
  return NextResponse.json(row, { status: 201 });
}
