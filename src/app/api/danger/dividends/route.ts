// 배당 기록 전체 삭제 API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  await sql`DELETE FROM dividends WHERE user_id = ${session.userId} AND account_id = ${accountId}`;
  return NextResponse.json({ ok: true });
}
