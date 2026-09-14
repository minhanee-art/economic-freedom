// 매수 기록 전체 삭제 API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  // 3개 문장을 하나의 원자적 트랜잭션으로 — 부분 실패 시 포트폴리오 정합성 깨짐 방지
  await sql.transaction([
    sql`DELETE FROM purchase_records WHERE user_id = ${session.userId} AND account_id = ${accountId}`,
    sql`DELETE FROM cost_basis WHERE user_id = ${session.userId} AND account_id = ${accountId}`,
    sql`UPDATE holdings SET shares = 0 WHERE user_id = ${session.userId} AND account_id = ${accountId}`,
  ]);
  return NextResponse.json({ ok: true });
}
