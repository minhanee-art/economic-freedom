// 매수 기록 API — 페이지네이션 + 매수 실행
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? 0);
  const limit = Number(searchParams.get("limit") ?? 20);

  const records = await sql`
    SELECT pr.*, json_agg(pi ORDER BY pi.id) AS purchase_items
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
  const { date, items, totalSpent } = await request.json();

  const [record] = await sql`
    INSERT INTO purchase_records (user_id, date, total_spent, total_value_after)
    VALUES (${session.userId}, ${date}, ${totalSpent}, 0)
    RETURNING id
  `;

  for (const item of items) {
    await sql`
      INSERT INTO purchase_items (record_id, holding_id, code, name, quantity, price_at_purchase, cost)
      VALUES (${record.id}, ${item.holdingId}, ${item.code}, ${item.name}, ${item.quantity}, ${item.price}, ${item.cost})
    `;
    await sql`UPDATE holdings SET shares = shares + ${item.quantity} WHERE id = ${item.holdingId} AND user_id = ${session.userId}`;

    const [cb] = await sql`SELECT * FROM cost_basis WHERE user_id = ${session.userId} AND holding_id = ${item.holdingId}`;
    if (cb) {
      await sql`UPDATE cost_basis SET total_cost = total_cost + ${item.cost}, total_shares = total_shares + ${item.quantity} WHERE id = ${cb.id}`;
    } else {
      await sql`INSERT INTO cost_basis (user_id, holding_id, total_cost, total_shares) VALUES (${session.userId}, ${item.holdingId}, ${item.cost}, ${item.quantity})`;
    }
  }

  return NextResponse.json({ ok: true, recordId: record.id }, { status: 201 });
}
