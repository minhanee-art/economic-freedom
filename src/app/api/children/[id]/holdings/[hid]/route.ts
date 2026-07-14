// 자녀 보유 종목 개별 수정/삭제 API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

const INT_MAX = 2_147_483_647;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; hid: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id: childId, hid } = await params;

  const body = await request.json().catch(() => null);
  const shares = body?.shares !== undefined ? Number(body.shares) : undefined;
  const avgPrice = body?.avgPrice !== undefined ? Number(body.avgPrice) : undefined;
  const currentPrice = body?.currentPrice !== undefined ? Number(body.currentPrice) : undefined;

  for (const v of [shares, avgPrice, currentPrice]) {
    if (v !== undefined && (!Number.isFinite(v) || v < 0 || v > INT_MAX)) {
      return NextResponse.json({ error: "값이 올바르지 않습니다." }, { status: 400 });
    }
  }

  const [row] = await sql`
    UPDATE child_holdings
    SET shares = COALESCE(${shares !== undefined ? Math.round(shares) : null}, shares),
        avg_price = COALESCE(${avgPrice !== undefined ? Math.round(avgPrice) : null}, avg_price),
        current_price = COALESCE(${currentPrice !== undefined ? Math.round(currentPrice) : null}, current_price)
    WHERE id = ${hid} AND child_id = ${childId} AND user_id = ${session.userId}
    RETURNING id, child_id, code, name, shares, avg_price, current_price, created_at::text, updated_at::text
  `;
  if (!row) return NextResponse.json({ error: "종목을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; hid: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id: childId, hid } = await params;
  await sql`DELETE FROM child_holdings WHERE id = ${hid} AND child_id = ${childId} AND user_id = ${session.userId}`;
  return NextResponse.json({ ok: true });
}
