// 매수 기록 API — 페이지네이션 + 매수 실행
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? 0);
  const limit = Number(searchParams.get("limit") ?? 20);

  const records = await sql`
    SELECT pr.*, json_agg(pi ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL) AS purchase_items
    FROM purchase_records pr
    LEFT JOIN purchase_items pi ON pi.record_id = pr.id
    WHERE pr.user_id = ${session.userId} AND pr.account_id = ${accountId}
    GROUP BY pr.id
    ORDER BY pr.date DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM purchase_records WHERE user_id = ${session.userId} AND account_id = ${accountId}`;
  return NextResponse.json({ records, count });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);

  const body = await request.json().catch(() => null);
  const date = body?.date;
  const items = body?.items;
  const totalSpent = body?.totalSpent;

  if (!date || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "date와 items가 필요합니다." }, { status: 400 });
  }
  for (const item of items) {
    const qty = Number(item?.quantity);
    const cost = Number(item?.cost);
    const price = Number(item?.price);
    if (!item?.holdingId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "유효하지 않은 매수 항목이 있습니다." }, { status: 400 });
    }
  }

  const holdingIds = [...new Set(items.map((i: { holdingId: string }) => i.holdingId))];
  const owned = await sql`SELECT id FROM holdings WHERE user_id = ${session.userId} AND account_id = ${accountId} AND id = ANY(${holdingIds}::uuid[])`.catch(() => null);
  if (!owned || owned.length !== holdingIds.length) {
    return NextResponse.json({ error: "유효하지 않거나 현재 계좌에 없는 종목이 포함됐습니다." }, { status: 400 });
  }

  const recordId = randomUUID();

  const queries: ReturnType<typeof sql>[] = [
    sql`
      INSERT INTO purchase_records (id, user_id, account_id, date, total_spent, total_value_after)
      VALUES (${recordId}, ${session.userId}, ${accountId}, ${date}, ${totalSpent ?? 0}, 0)
    `,
  ];
  for (const item of items) {
    queries.push(sql`
      INSERT INTO purchase_items (record_id, holding_id, code, name, quantity, price_at_purchase, cost)
      VALUES (${recordId}, ${item.holdingId}, ${item.code}, ${item.name}, ${item.quantity}, ${item.price}, ${item.cost})
    `);
    queries.push(sql`UPDATE holdings SET shares = shares + ${item.quantity} WHERE id = ${item.holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}`);
    queries.push(sql`
      INSERT INTO cost_basis (user_id, account_id, holding_id, total_cost, total_shares)
      VALUES (${session.userId}, ${accountId}, ${item.holdingId}, ${item.cost}, ${item.quantity})
      ON CONFLICT (user_id, holding_id)
      DO UPDATE SET total_cost = cost_basis.total_cost + EXCLUDED.total_cost,
                    total_shares = cost_basis.total_shares + EXCLUDED.total_shares,
                    account_id = EXCLUDED.account_id
    `);
  }
  queries.push(sql`
    UPDATE purchase_records
    SET total_value_after = (
      SELECT COALESCE(SUM(h.shares * h.current_price), 0)
      FROM holdings h WHERE h.user_id = ${session.userId} AND h.account_id = ${accountId}
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
