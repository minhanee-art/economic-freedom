// 설정 API — 프로필 업데이트, 보유 종목 전체 삭제
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getRequestSession } from "@/lib/session";
import { selectRequestAccount } from "@/lib/account-selection";

export async function PATCH(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const { monthlyBudget, displayName } = body;

  if (monthlyBudget !== undefined && (!Number.isInteger(monthlyBudget) || monthlyBudget < 0 || monthlyBudget > 2_147_483_647)) {
    return NextResponse.json({ error: "monthlyBudget는 0 이상의 정수여야 합니다." }, { status: 400 });
  }

  // displayName이 전달된 경우에만 갱신 — 빈 값이면 NULL로 초기화 허용(COALESCE 제거)
  if (Object.prototype.hasOwnProperty.call(body, "displayName")) {
    const name = typeof displayName === "string" && displayName.trim() ? displayName.trim().slice(0, 50) : null;
    await sql`
      UPDATE profiles
      SET monthly_budget = COALESCE(${monthlyBudget ?? null}, monthly_budget),
          display_name = ${name}
      WHERE id = ${session.userId}
    `;
  } else {
    await sql`UPDATE profiles SET monthly_budget = COALESCE(${monthlyBudget ?? null}, monthly_budget) WHERE id = ${session.userId}`;
  }
  return NextResponse.json({ ok: true });
}

/**
 * 보유 종목 전체 삭제 — 현재 계좌의 종목을 모두 지워 빈 상태로 되돌린다. 예시 종목을 다시 넣지 않는다.
 * 종목에 딸린 매수 항목·매도·배당 기록은 FK(ON DELETE CASCADE)로 함께 지워지므로,
 * 항목이 모두 사라진 매수 기록 묶음(purchase_records)과 원가도 같은 트랜잭션에서 지운다.
 */
export async function DELETE(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
  await sql.transaction([
    sql`DELETE FROM purchase_records WHERE user_id = ${session.userId} AND account_id = ${accountId}`,
    sql`DELETE FROM cost_basis WHERE user_id = ${session.userId} AND account_id = ${accountId}`,
    sql`DELETE FROM holdings WHERE user_id = ${session.userId} AND account_id = ${accountId}`,
  ]);
  return NextResponse.json({ ok: true });
}
