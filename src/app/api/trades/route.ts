// 대시보드 즉시 매수/매도 API
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";

const INT_MAX = 2_147_483_647;

type TradeAction = "buy" | "sell";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);

  const body = await request.json().catch(() => null) as {
    holdingId?: string;
    action?: TradeAction;
    quantity?: number;
    price?: number;
    date?: string;
  } | null;

  const holdingId = body?.holdingId;
  const action = body?.action;
  const quantity = Number(body?.quantity);
  const price = Number(body?.price);
  const date = body?.date || new Date().toISOString().split("T")[0];

  if (!holdingId || (action !== "buy" && action !== "sell")) {
    return NextResponse.json({ error: "holdingId와 action이 필요합니다." }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > INT_MAX || !Number.isFinite(price) || price < 0 || price > INT_MAX) {
    return NextResponse.json({ error: "수량과 가격이 올바르지 않습니다." }, { status: 400 });
  }

  const [holding] = await sql`
    SELECT id, code, name, shares
    FROM holdings
    WHERE id = ${holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}
  `.catch(() => []);

  if (!holding) {
    return NextResponse.json({ error: "현재 계좌에서 종목을 찾을 수 없습니다." }, { status: 404 });
  }

  if (action === "sell" && Number(holding.shares) < quantity) {
    return NextResponse.json({ error: "보유 수량보다 많이 매도할 수 없습니다." }, { status: 400 });
  }

  const totalAmount = Math.round(quantity * price);
  const queries: ReturnType<typeof sql>[] = [];

  if (action === "buy") {
    const recordId = randomUUID();
    queries.push(sql`
      INSERT INTO purchase_records (id, user_id, account_id, date, total_spent, total_value_after)
      VALUES (${recordId}, ${session.userId}, ${accountId}, ${date}, ${totalAmount}, 0)
    `);
    queries.push(sql`
      INSERT INTO purchase_items (record_id, holding_id, code, name, quantity, price_at_purchase, cost)
      VALUES (${recordId}, ${holdingId}, ${holding.code}, ${holding.name}, ${quantity}, ${Math.round(price)}, ${totalAmount})
    `);
    queries.push(sql`
      UPDATE holdings
      SET shares = shares + ${quantity}, current_price = ${Math.round(price)}
      WHERE id = ${holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}
    `);
    queries.push(sql`
      INSERT INTO cost_basis (user_id, account_id, holding_id, total_cost, total_shares)
      VALUES (${session.userId}, ${accountId}, ${holdingId}, ${totalAmount}, ${quantity})
      ON CONFLICT (user_id, holding_id)
      DO UPDATE SET total_cost = cost_basis.total_cost + EXCLUDED.total_cost,
                    total_shares = cost_basis.total_shares + EXCLUDED.total_shares,
                    account_id = EXCLUDED.account_id
    `);
    queries.push(sql`
      UPDATE purchase_records
      SET total_value_after = (
        SELECT COALESCE(SUM(h.shares * h.current_price), 0)
        FROM holdings h WHERE h.user_id = ${session.userId} AND h.account_id = ${accountId}
      )
      WHERE id = ${recordId}
    `);
  } else {
    queries.push(sql`
      INSERT INTO sell_items (user_id, account_id, holding_id, code, name, quantity, price, date)
      VALUES (${session.userId}, ${accountId}, ${holdingId}, ${holding.code}, ${holding.name}, ${quantity}, ${Math.round(price)}, ${date})
    `);
    queries.push(sql`
      UPDATE holdings
      SET shares = GREATEST(0, shares - ${quantity}), current_price = ${Math.round(price)}
      WHERE id = ${holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}
    `);
    queries.push(sql`
      UPDATE cost_basis
      SET total_cost = GREATEST(0, ROUND(total_cost - (total_cost::numeric / NULLIF(total_shares, 0)) * ${quantity})),
          total_shares = GREATEST(0, total_shares - ${quantity})
      WHERE user_id = ${session.userId} AND account_id = ${accountId} AND holding_id = ${holdingId} AND total_shares > 0
    `);
  }

  try {
    await sql.transaction(queries);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const [updatedHolding] = await sql`
    SELECT id, user_id, account_id, code, name, category, sub_category,
           current_price, shares,
           target_pct::float, expense_ratio::float,
           created_at::text, updated_at::text
    FROM holdings
    WHERE id = ${holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}
  `;
  const [updatedCostBasis] = await sql`
    SELECT id, user_id, account_id, holding_id, total_cost, total_shares, updated_at::text
    FROM cost_basis
    WHERE holding_id = ${holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}
  `;

  return NextResponse.json({
    ok: true,
    action,
    holding: updatedHolding,
    costBasis: updatedCostBasis ?? null,
  });
}
