// 매수 기록 한 건 삭제 API — DELETE /api/purchases/{recordId}
//
// 매수 POST(/api/purchases, /api/trades buy, /api/import, /api/holdings 초기 수량)는 기록마다
//   holdings.shares += quantity, cost_basis.total_cost += cost, cost_basis.total_shares += quantity
// 를 더한다. 삭제는 기록의 종목별 합계를 그대로 빼서 이 효과를 정확히 되돌린다.
//
// 원가는 평균단가(누적) 방식이라, 이 매수 이후에 같은 종목 매도가 있었다면 매도가 이 매수분 원가까지 섞어
// 차감했으므로 단순 차감으로는 정확히 복원되지 않는다. 남은 기록에서 재계산하는 방식도 검토했지만,
// 보유 종목 편집(PATCH /api/holdings)이 기록 없이 수량·원가를 덮어쓰기 때문에 기록이 원장(source of truth)이
// 아니어서 재계산하면 사용자가 직접 맞춘 값을 지워 버린다. 그래서 정확히 되돌릴 수 없는 경우는 409로 거절하고
// 아무것도 바꾸지 않는다 (0에서 멈추는 방식은 원가·수량을 조용히 틀리게 만든다).
//   - sold_after: 이 매수일 이후(또는 이 기록 입력 이후)의 같은 종목 매도 기록이 있음
//   - shares_short: 현재 보유 수량이 되돌릴 수량보다 적음 (직접 편집·매도로 줄어든 경우)
//   - cost_basis_mismatch: 원가 기록이 없거나 되돌릴 수량·금액보다 작음
//
// 기록 삭제·보유 수량·원가 갱신은 하나의 SQL 문(데이터 변경 CTE)으로 처리해 원자적이다.
// Neon HTTP 트랜잭션은 앞 쿼리 결과로 분기할 수 없으므로, 검사와 변경을 한 문장에 넣고 행을 FOR UPDATE로 잠근다.
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getRequestSession } from "@/lib/session";
import { selectRequestAccount } from "@/lib/account-selection";
import { isUuid } from "@/lib/record-validation";

type Conflict = {
  holdingId: string;
  code: string | null;
  name: string | null;
  reason: "sold_after" | "shares_short" | "cost_basis_mismatch";
};

const CONFLICT_MESSAGES: Record<Conflict["reason"], string> = {
  sold_after: "이 매수 이후 같은 종목의 매도 기록이 있어 원가를 정확히 되돌릴 수 없습니다.",
  shares_short: "현재 보유 수량이 이 매수 수량보다 적어 되돌릴 수 없습니다.",
  cost_basis_mismatch: "원가 기록이 이 매수 내역과 맞지 않아 되돌릴 수 없습니다.",
};

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
  const userId = session.userId;

  const { id } = await params;
  // 다른 사용자·다른 계좌의 기록과 같은 응답(404) — 존재 여부를 드러내지 않는다
  if (!isUuid(id)) return NextResponse.json({ error: "매수 기록을 찾을 수 없습니다." }, { status: 404 });

  const [result] = await sql`
    WITH rec AS (
      SELECT id, date, created_at
      FROM purchase_records
      WHERE id = ${id} AND user_id = ${userId} AND account_id = ${accountId}
      FOR UPDATE
    ),
    items AS (
      SELECT pi.holding_id,
             MAX(pi.code) AS code,
             MAX(pi.name) AS name,
             SUM(pi.quantity)::bigint AS quantity,
             SUM(pi.cost)::bigint AS cost
      FROM purchase_items pi
      JOIN rec ON pi.record_id = rec.id
      GROUP BY pi.holding_id
    ),
    locked_h AS (
      SELECT h.id, h.shares
      FROM holdings h
      WHERE h.id IN (SELECT holding_id FROM items) AND h.user_id = ${userId} AND h.account_id = ${accountId}
      FOR UPDATE
    ),
    locked_cb AS (
      SELECT cb.holding_id, cb.total_cost, cb.total_shares
      FROM cost_basis cb
      WHERE cb.holding_id IN (SELECT holding_id FROM items) AND cb.user_id = ${userId}
      FOR UPDATE
    ),
    plan AS (
      SELECT i.holding_id, i.code, i.name, i.quantity, i.cost,
             CASE
               WHEN EXISTS (
                 SELECT 1 FROM sell_items s, rec
                 WHERE s.holding_id = i.holding_id AND s.user_id = ${userId}
                   AND (s.date >= rec.date OR s.created_at >= rec.created_at)
               ) THEN 'sold_after'
               WHEN h.id IS NULL OR h.shares < i.quantity THEN 'shares_short'
               WHEN cb.holding_id IS NULL
                 OR cb.total_shares < i.quantity
                 OR cb.total_cost < i.cost
                 -- 수량이 남는데 원가가 0 이하가 되면 평단이 깨진다
                 OR (cb.total_shares > i.quantity AND cb.total_cost <= i.cost) THEN 'cost_basis_mismatch'
             END AS conflict
      FROM items i
      LEFT JOIN locked_h h ON h.id = i.holding_id
      LEFT JOIN locked_cb cb ON cb.holding_id = i.holding_id
    ),
    ok AS (
      SELECT EXISTS (SELECT 1 FROM rec) AND NOT EXISTS (SELECT 1 FROM plan WHERE conflict IS NOT NULL) AS ok
    ),
    upd_h AS (
      UPDATE holdings h
      SET shares = h.shares - p.quantity, updated_at = NOW()
      FROM plan p, ok
      WHERE ok.ok AND h.id = p.holding_id AND h.user_id = ${userId} AND h.account_id = ${accountId}
      RETURNING h.id, h.shares
    ),
    upd_cb AS (
      UPDATE cost_basis cb
      SET total_shares = cb.total_shares - p.quantity,
          total_cost = CASE WHEN cb.total_shares - p.quantity = 0 THEN 0 ELSE cb.total_cost - p.cost END,
          updated_at = NOW()
      FROM plan p, ok
      WHERE ok.ok AND cb.holding_id = p.holding_id AND cb.user_id = ${userId}
      RETURNING cb.holding_id, cb.total_cost, cb.total_shares
    ),
    del AS (
      DELETE FROM purchase_records pr
      USING ok
      WHERE ok.ok AND pr.id IN (SELECT id FROM rec)
      RETURNING pr.id
    )
    SELECT
      (SELECT COUNT(*) FROM rec)::int AS found,
      (SELECT COUNT(*) FROM del)::int AS deleted,
      COALESCE((
        SELECT json_agg(json_build_object('holdingId', p.holding_id, 'code', p.code, 'name', p.name, 'reason', p.conflict) ORDER BY p.code)
        FROM plan p WHERE p.conflict IS NOT NULL
      ), '[]'::json) AS conflicts,
      COALESCE((
        SELECT json_agg(json_build_object(
                 'holdingId', p.holding_id,
                 'code', p.code,
                 'name', p.name,
                 'removedQuantity', p.quantity,
                 'removedCost', p.cost,
                 'shares', h.shares,
                 'totalCost', cb.total_cost,
                 'totalShares', cb.total_shares
               ) ORDER BY p.code)
        FROM plan p
        JOIN upd_h h ON h.id = p.holding_id
        LEFT JOIN upd_cb cb ON cb.holding_id = p.holding_id
      ), '[]'::json) AS holdings
  `;

  if (!result || Number(result.found) === 0) {
    return NextResponse.json({ error: "매수 기록을 찾을 수 없습니다." }, { status: 404 });
  }
  if (Number(result.deleted) === 0) {
    const conflicts = (result.conflicts ?? []) as Conflict[];
    const first = conflicts[0];
    return NextResponse.json(
      {
        error: first
          ? `${first.name ?? first.code ?? "종목"}: ${CONFLICT_MESSAGES[first.reason]} 보유 종목 편집에서 수량·평단가를 직접 수정해주세요.`
          : "매수 기록을 삭제하지 못했습니다.",
        conflicts,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, recordId: id, holdings: result.holdings ?? [] });
}
