// 설정 API — 프로필 업데이트, 포트폴리오 리셋
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { DEFAULT_HOLDINGS } from "@/lib/constants";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { monthlyBudget } = await request.json();
  await sql`UPDATE profiles SET monthly_budget = ${monthlyBudget} WHERE id = ${session.userId}`;
  return NextResponse.json({ ok: true });
}

/** 포트폴리오 리셋 — holdings/cost_basis 삭제 후 기본 종목 재생성 */
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  await sql`DELETE FROM cost_basis WHERE user_id = ${session.userId}`;
  await sql`DELETE FROM holdings WHERE user_id = ${session.userId}`;
  for (const h of DEFAULT_HOLDINGS) {
    await sql`
      INSERT INTO holdings (user_id, code, name, category, sub_category, current_price, target_pct)
      VALUES (${session.userId}, ${h.code}, ${h.name}, ${h.category}, ${h.sub_category ?? "기타"}, ${h.current_price ?? 0}, ${h.target_pct})
    `;
  }
  return NextResponse.json({ ok: true });
}
