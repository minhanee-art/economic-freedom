// 배당 기록 전체 삭제 API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  await sql`DELETE FROM dividends WHERE user_id = ${session.userId}`;
  return NextResponse.json({ ok: true });
}
