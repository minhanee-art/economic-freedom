// 자녀 계좌 입금/증여 기록 개별 수정(신고여부 등)/삭제 API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

const INT_MAX = 2_147_483_647;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; gid: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id: childId, gid } = await params;

  const body = await request.json().catch(() => null);
  const reported = typeof body?.reported === "boolean" ? body.reported : undefined;
  const reportDate = typeof body?.reportDate === "string" ? body.reportDate : undefined;
  const amount = body?.amount !== undefined ? Number(body.amount) : undefined;
  const memo = typeof body?.memo === "string" ? body.memo.slice(0, 200) : undefined;

  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0 || amount > INT_MAX)) {
    return NextResponse.json({ error: "금액을 올바르게 입력해주세요." }, { status: 400 });
  }
  if (reportDate !== undefined && reportDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || isNaN(new Date(reportDate).getTime()))) {
    return NextResponse.json({ error: "신고일(YYYY-MM-DD)을 올바르게 입력해주세요." }, { status: 400 });
  }

  const [row] = await sql`
    UPDATE child_gifts
    SET reported = COALESCE(${reported ?? null}, reported),
        report_date = CASE WHEN ${reportDate === undefined} THEN report_date ELSE ${reportDate ?? null} END,
        amount = COALESCE(${amount ?? null}, amount),
        memo = CASE WHEN ${memo === undefined} THEN memo ELSE ${memo ?? null} END
    WHERE id = ${gid} AND child_id = ${childId} AND user_id = ${session.userId}
    RETURNING id, child_id, date::text, amount, gift_type, reported, report_date::text, memo, created_at::text
  `;
  if (!row) return NextResponse.json({ error: "증여 기록을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; gid: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id: childId, gid } = await params;
  await sql`DELETE FROM child_gifts WHERE id = ${gid} AND child_id = ${childId} AND user_id = ${session.userId}`;
  return NextResponse.json({ ok: true });
}
