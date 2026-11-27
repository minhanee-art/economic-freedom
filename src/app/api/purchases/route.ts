// 매수 기록 API — 페이지네이션 + 매수 실행
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { getRequestSession } from "@/lib/session";
import { selectRequestAccount } from "@/lib/account-selection";
import { checkRecordDate, INT_MAX, isUuid, MAX_PURCHASE_ITEMS, toPositiveInt } from "@/lib/record-validation";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? 0);
  const limit = Number(searchParams.get("limit") ?? 20);

  const records = await sql`
    SELECT pr.id, pr.user_id, pr.account_id, pr.total_spent, pr.total_value_after,
           pr.date::text AS date, pr.created_at,
           json_agg(pi ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL) AS purchase_items
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
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;

  const body = await request.json().catch(() => null);
  const rawItems: unknown = body?.items;

  if (!body?.date || !Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "date와 items가 필요합니다." }, { status: 400 });
  }
  const dateCheck = checkRecordDate(body.date);
  if (!dateCheck.ok) return NextResponse.json({ error: dateCheck.error }, { status: 400 });
  const date = dateCheck.date;
  if (rawItems.length > MAX_PURCHASE_ITEMS) {
    return NextResponse.json({ error: `한 번에 ${MAX_PURCHASE_ITEMS}개 종목까지 기록할 수 있습니다.` }, { status: 400 });
  }

  // 수량·단가·금액은 모두 1 이상 정수(INTEGER 컬럼) — 소수/0/음수/범위 초과는 400
  const items: { holdingId: string; quantity: number; price: number; cost: number }[] = [];
  for (const raw of rawItems as Record<string, unknown>[]) {
    const holdingId = typeof raw?.holdingId === "string" ? raw.holdingId.toLowerCase() : "";
    const quantity = toPositiveInt(raw?.quantity);
    const price = toPositiveInt(raw?.price);
    const cost = toPositiveInt(raw?.cost);
    if (!isUuid(holdingId) || quantity === null || price === null || cost === null) {
      return NextResponse.json(
        { error: "유효하지 않은 매수 항목이 있습니다. 수량·단가·금액은 1 이상의 정수여야 합니다." },
        { status: 400 }
      );
    }
    items.push({ holdingId, quantity, price, cost });
  }
  const totalSpent = items.reduce((sum, item) => sum + item.cost, 0);
  if (totalSpent > INT_MAX) {
    return NextResponse.json({ error: "총 매수 금액이 너무 큽니다." }, { status: 400 });
  }

  // 종목코드·이름은 클라이언트 값 대신 서버 보유 종목에서 가져온다
  const holdingIds = [...new Set(items.map((i) => i.holdingId))];
  const owned = await sql`SELECT id, code, name FROM holdings WHERE user_id = ${session.userId} AND account_id = ${accountId} AND id = ANY(${holdingIds}::uuid[])`.catch(() => null);
  if (!owned || owned.length !== holdingIds.length) {
    return NextResponse.json({ error: "유효하지 않거나 현재 계좌에 없는 종목이 포함됐습니다." }, { status: 400 });
  }
  const holdingById = new Map(owned.map((h) => [String(h.id), { code: String(h.code), name: String(h.name) }]));

  const recordId = randomUUID();

  const queries: ReturnType<typeof sql>[] = [
    sql`
      INSERT INTO purchase_records (id, user_id, account_id, date, total_spent, total_value_after)
      VALUES (${recordId}, ${session.userId}, ${accountId}, ${date}, ${totalSpent}, 0)
    `,
  ];
  for (const item of items) {
    const holding = holdingById.get(item.holdingId)!;
    queries.push(sql`
      INSERT INTO purchase_items (record_id, holding_id, code, name, quantity, price_at_purchase, cost)
      VALUES (${recordId}, ${item.holdingId}, ${holding.code}, ${holding.name}, ${item.quantity}, ${item.price}, ${item.cost})
    `);
    // 현재가를 모르는 종목(앱에서 종목명·코드만으로 추가한 0원 종목)은 기록 단가를 현재가로 채운다 — 평가금액이 0원(-100%)으로 보이지 않게.
    // 이미 현재가가 있으면 그대로 둔다(시세 갱신 값을 기록 단가로 덮지 않는다).
    queries.push(sql`
      UPDATE holdings
      SET shares = shares + ${item.quantity},
          current_price = CASE WHEN current_price > 0 THEN current_price ELSE ${item.price} END
      WHERE id = ${item.holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}
    `);
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
