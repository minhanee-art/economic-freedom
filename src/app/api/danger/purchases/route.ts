// 매수 기록 전체 삭제 API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  await sql`DELETE FROM purchase_records WHERE user_id = ${session.userId}`;
  await sql`DELETE FROM cost_basis WHERE user_id = ${session.userId}`;
  await sql`UPDATE holdings SET shares = 0 WHERE user_id = ${session.userId}`;
  return NextResponse.json({ ok: true });
}
