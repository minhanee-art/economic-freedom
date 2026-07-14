// 자녀 증여 기록 CRUD API
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
    SELECT id, child_id, date::text, amount, gift_type, reported, report_date::text, memo, created_at::text
    FROM child_gifts WHERE child_id = ${id} AND user_id = ${session.userId} ORDER BY date DESC
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

  // 소유권 검증 — 타인 자녀에게 증여 기록 생성 방지(IDOR)
  const [child] = await sql`SELECT id FROM children WHERE id = ${childId} AND user_id = ${session.userId}`;
  if (!child) return NextResponse.json({ error: "자녀를 찾을 수 없습니다." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date : "";
  const amount = Number(body?.amount);
  const giftType = body?.giftType === "installment" ? "installment" : "lump";
  const memo = typeof body?.memo === "string" ? body.memo.slice(0, 200) : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
    return NextResponse.json({ error: "날짜(YYYY-MM-DD)를 올바르게 입력해주세요." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > INT_MAX) {
    return NextResponse.json({ error: "증여 금액을 올바르게 입력해주세요." }, { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO child_gifts (child_id, user_id, date, amount, gift_type, memo)
    VALUES (${childId}, ${session.userId}, ${date}, ${amount}, ${giftType}, ${memo})
    RETURNING id, child_id, date::text, amount, gift_type, reported, report_date::text, memo, created_at::text
  `;
  return NextResponse.json(row, { status: 201 });
}
