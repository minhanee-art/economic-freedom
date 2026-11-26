// 배당금 CRUD API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getRequestSession } from "@/lib/session";
import { selectRequestAccount } from "@/lib/account-selection";
import { checkRecordDate, isUuid, MAX_MEMO_LENGTH, toPositiveInt } from "@/lib/record-validation";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
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
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
  const { holdingId, amount: rawAmount, date: rawDate, memo: rawMemo } = await request.json().catch(() => ({}));
  if (!holdingId || rawAmount === undefined || rawAmount === null || rawAmount === "" || !rawDate) {
    return NextResponse.json({ error: "holdingId, amount, date 필요" }, { status: 400 });
  }
  // 금액은 1 이상 정수(INTEGER 컬럼), 날짜는 형식·실존·미래(KST) 검증
  const amount = toPositiveInt(rawAmount);
  if (amount === null) {
    return NextResponse.json({ error: "배당금은 1원 이상의 정수여야 합니다." }, { status: 400 });
  }
  const dateCheck = checkRecordDate(rawDate);
  if (!dateCheck.ok) return NextResponse.json({ error: dateCheck.error }, { status: 400 });
  const date = dateCheck.date;
  if (rawMemo !== undefined && rawMemo !== null && typeof rawMemo !== "string") {
    return NextResponse.json({ error: "메모는 문자열이어야 합니다." }, { status: 400 });
  }
  const memo = typeof rawMemo === "string" && rawMemo.trim() ? rawMemo : null;
  if (memo && memo.length > MAX_MEMO_LENGTH) {
    return NextResponse.json({ error: `메모는 ${MAX_MEMO_LENGTH}자 이하여야 합니다.` }, { status: 400 });
  }
  if (!isUuid(holdingId)) {
    return NextResponse.json({ error: "현재 계좌 보유 종목이 아닙니다." }, { status: 400 });
  }
  const [owned] = await sql`SELECT id FROM holdings WHERE id = ${holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  if (!owned) return NextResponse.json({ error: "현재 계좌 보유 종목이 아닙니다." }, { status: 400 });

  const [row] = await sql`
    WITH ins AS (
      INSERT INTO dividends (user_id, account_id, holding_id, amount, date, memo)
      VALUES (${session.userId}, ${accountId}, ${holdingId}, ${amount}, ${date}, ${memo})
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
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
  const { id } = await request.json();
  await sql`DELETE FROM dividends WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  return NextResponse.json({ ok: true });
}
