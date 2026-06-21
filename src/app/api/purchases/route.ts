// 매수 기록 API — 페이지네이션 + 매수 실행
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? 0);
  const limit = Number(searchParams.get("limit") ?? 20);

  const records = await sql`
    SELECT pr.*, json_agg(pi ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL) AS purchase_items
    FROM purchase_records pr
    LEFT JOIN purchase_items pi ON pi.record_id = pr.id
    WHERE pr.user_id = ${session.userId}
    GROUP BY pr.id
    ORDER BY pr.date DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM purchase_records WHERE user_id = ${session.userId}`;
  return NextResponse.json({ records, count });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const date = body?.date;
  const items = body?.items;
  const totalSpent = body?.totalSpent;

  // 입력 검증 — 누락/비정상 입력으로 인한 500·데이터 오염 방지
  if (!date || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "date와 items가 필요합니다." }, { status: 400 });
  }
  for (const item of items) {
    const qty = Number(item?.quantity);
    const cost = Number(item?.cost);
    if (!item?.holdingId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost < 0) {
      return NextResponse.json({ error: "유효하지 않은 매수 항목이 있습니다." }, { status: 400 });
    }
  }

  const recordId = randomUUID();

  // 모든 쓰기를 하나의 원자적 트랜잭션으로 묶는다 — 중간 실패 시 전체 롤백되어
  // purchase_records / purchase_items / holdings / cost_basis 정합성이 깨지지 않는다.
  const queries: ReturnType<typeof sql>[] = [
    sql`
      INSERT INTO purchase_records (id, user_id, date, total_spent, total_value_after)
      VALUES (${recordId}, ${session.userId}, ${date}, ${totalSpent ?? 0}, 0)
    `,
  ];
  for (const item of items) {
    queries.push(sql`
      INSERT INTO purchase_items (record_id, holding_id, code, name, quantity, price_at_purchase, cost)
      VALUES (${recordId}, ${item.holdingId}, ${item.code}, ${item.name}, ${item.quantity}, ${item.price}, ${item.cost})
    `);
    queries.push(sql`UPDATE holdings SET shares = shares + ${item.quantity} WHERE id = ${item.holdingId} AND user_id = ${session.userId}`);
    queries.push(sql`
      INSERT INTO cost_basis (user_id, holding_id, total_cost, total_shares)
      VALUES (${session.userId}, ${item.holdingId}, ${item.cost}, ${item.quantity})
      ON CONFLICT (user_id, holding_id)
      DO UPDATE SET total_cost = cost_basis.total_cost + EXCLUDED.total_cost,
                    total_shares = cost_basis.total_shares + EXCLUDED.total_shares
    `);
  }
  // 매수 직후 포트폴리오 평가금액(현재가 기준) 스냅샷 — 0 하드코딩 대신 실제 값 저장
  queries.push(sql`
    UPDATE purchase_records
    SET total_value_after = (
      SELECT COALESCE(SUM(h.shares * h.current_price), 0)
      FROM holdings h WHERE h.user_id = ${session.userId}
    )
    WHERE id = ${recordId}
  `);

  try {
    await sql.transaction(queries);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recordId }, { status: 201 });
}
