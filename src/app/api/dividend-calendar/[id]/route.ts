// 배당 캘린더 단건 삭제
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getRequestSession } from "@/lib/session";
import { selectRequestAccount } from "@/lib/account-selection";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
  const { id } = await params;
  await sql`DELETE FROM dividend_calendar WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  return NextResponse.json({ success: true });
}
