// 배당 캘린더 단건 삭제
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  const { id } = await params;
  await sql`DELETE FROM dividend_calendar WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  return NextResponse.json({ success: true });
}
