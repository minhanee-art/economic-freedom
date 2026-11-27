// 대시보드 즉시 매수/매도 API
//
// 매도는 "보유 수량 검사 + 매도 기록 + 보유 수량·원가 차감"을 하나의 SQL 문(데이터 변경 CTE)으로 처리한다.
// Neon HTTP 트랜잭션은 앞 쿼리 결과로 분기할 수 없어, 트랜잭션 밖에서 수량을 읽고 검사하면 동시 매도 두 건이
// 같은 수량을 보고 둘 다 통과한다(10주 보유에 8주 매도 두 건 → 매도 기록 16주, 보유 0). 그래서 보유 행을
// FOR UPDATE로 잠그고, 잠근 뒤 최신 수량으로 검사한 결과(ok)가 참일 때만 INSERT/UPDATE가 실행되게 한다.
// 수량이 모자라면 아무것도 바꾸지 않고 409를 돌려준다 (0에서 조용히 멈추지 않는다).
//
// 매수는 shares = shares + q, total_cost = total_cost + cost 처럼 현재 값에 더하는 갱신만 하므로
// 동시 요청이 와도 서로를 덮어쓰지 않는다 (행 잠금으로 직렬화된다).
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { getRequestSession } from "@/lib/session";
import { selectRequestAccount } from "@/lib/account-selection";
import { checkRecordDate, INT_MAX, isUuid, todayKstDateKey, toPositiveInt } from "@/lib/record-validation";

type TradeAction = "buy" | "sell";

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;

  const body = await request.json().catch(() => null) as {
    holdingId?: unknown;
    action?: TradeAction;
    quantity?: unknown;
    price?: unknown;
    date?: unknown;
  } | null;

  const holdingId = typeof body?.holdingId === "string" ? body.holdingId.toLowerCase() : "";
  const action = body?.action;

  if (!holdingId || (action !== "buy" && action !== "sell")) {
    return NextResponse.json({ error: "holdingId와 action이 필요합니다." }, { status: 400 });
  }
  // UUID가 아니면 Postgres 캐스팅 오류가 나므로 쿼리 전에 404로 돌려준다 (다른 계좌 종목과 같은 응답)
  if (!isUuid(holdingId)) {
    return NextResponse.json({ error: "현재 계좌에서 종목을 찾을 수 없습니다." }, { status: 404 });
  }

  // 수량은 1 이상 정수, 단가는 0 이상(소수는 반올림해 저장), 금액은 INTEGER 컬럼 범위 이내
  const quantity = toPositiveInt(body?.quantity);
  const rawPrice = body?.price;
  const price =
    typeof rawPrice === "number" || (typeof rawPrice === "string" && rawPrice.trim() !== "") ? Number(rawPrice) : NaN;
  if (quantity === null || !Number.isFinite(price) || price < 0 || price > INT_MAX) {
    return NextResponse.json({ error: "수량과 가격이 올바르지 않습니다." }, { status: 400 });
  }
  const totalAmount = Math.round(quantity * price);
  if (totalAmount > INT_MAX) {
    return NextResponse.json({ error: "거래 금액이 너무 큽니다." }, { status: 400 });
  }
  const roundedPrice = Math.round(price);

  // 날짜는 없으면 오늘(KST), 있으면 YYYY-MM-DD·실제 날짜·오늘(KST) 이하만 허용
  const dateCheck = checkRecordDate(body?.date === undefined || body?.date === "" ? todayKstDateKey() : body.date);
  if (!dateCheck.ok) return NextResponse.json({ error: dateCheck.error }, { status: 400 });
  const date = dateCheck.date;

  if (action === "sell") {
    const sold = await sellAtomically({ userId: session.userId, accountId, holdingId, quantity, price: roundedPrice, date });
    if (!sold.ok) return sold.response;
  } else {
    const [holding] = await sql`
      SELECT id, code, name, shares
      FROM holdings
      WHERE id = ${holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}
    `.catch(() => []);

    if (!holding) {
      return NextResponse.json({ error: "현재 계좌에서 종목을 찾을 수 없습니다." }, { status: 404 });
    }

    const recordId = randomUUID();
    const queries: ReturnType<typeof sql>[] = [];
    queries.push(sql`
      INSERT INTO purchase_records (id, user_id, account_id, date, total_spent, total_value_after)
      VALUES (${recordId}, ${session.userId}, ${accountId}, ${date}, ${totalAmount}, 0)
    `);
    queries.push(sql`
      INSERT INTO purchase_items (record_id, holding_id, code, name, quantity, price_at_purchase, cost)
      VALUES (${recordId}, ${holdingId}, ${holding.code}, ${holding.name}, ${quantity}, ${roundedPrice}, ${totalAmount})
    `);
    queries.push(sql`
      UPDATE holdings
      SET shares = shares + ${quantity}, current_price = ${roundedPrice}
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

    try {
      await sql.transaction(queries);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
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

type SellInput = { userId: string; accountId: string; holdingId: string; quantity: number; price: number; date: string };
type SellResult = { ok: true } | { ok: false; response: NextResponse };

/**
 * 보유 수량 검사와 매도 반영을 한 SQL 문으로 처리한다.
 * - held: 보유 행을 FOR UPDATE로 잠근다. 동시 매도는 여기서 기다렸다가, 앞 요청이 커밋한 뒤의 최신 수량을 읽는다.
 * - ok: 잠근 최신 수량이 매도 수량 이상일 때만 참 — 아래 INSERT/UPDATE는 모두 ok.ok 조건으로만 실행된다.
 * - 원가는 평균단가 비율로 차감하고, 수량이 0이 되면 원가도 0으로 맞춘다.
 */
async function sellAtomically(input: SellInput): Promise<SellResult> {
  const { userId, accountId, holdingId, quantity, price, date } = input;
  let result: Record<string, unknown> | undefined;
  try {
    [result] = await sql`
      WITH held AS (
        SELECT id, code, name, shares
        FROM holdings
        WHERE id = ${holdingId} AND user_id = ${userId} AND account_id = ${accountId}
        FOR UPDATE
      ),
      ok AS (
        SELECT EXISTS (SELECT 1 FROM held WHERE held.shares >= ${quantity}::int) AS ok
      ),
      ins AS (
        INSERT INTO sell_items (user_id, account_id, holding_id, code, name, quantity, price, date)
        SELECT ${userId}, ${accountId}, held.id, held.code, held.name, ${quantity}::int, ${price}::int, ${date}::date
        FROM held, ok
        WHERE ok.ok
        RETURNING id
      ),
      upd_h AS (
        UPDATE holdings h
        SET shares = h.shares - ${quantity}::int, current_price = ${price}::int, updated_at = NOW()
        FROM ok
        WHERE ok.ok AND h.id = ${holdingId} AND h.user_id = ${userId} AND h.account_id = ${accountId}
        RETURNING h.id, h.shares
      ),
      upd_cb AS (
        UPDATE cost_basis cb
        SET total_cost = CASE
                           WHEN cb.total_shares <= ${quantity}::int THEN 0
                           ELSE GREATEST(0, ROUND(cb.total_cost - (cb.total_cost::numeric / cb.total_shares) * ${quantity}::int))
                         END,
            total_shares = GREATEST(0, cb.total_shares - ${quantity}::int),
            updated_at = NOW()
        FROM ok
        WHERE ok.ok AND cb.holding_id IN (SELECT id FROM held) AND cb.user_id = ${userId}
          AND cb.total_shares > 0
        RETURNING cb.holding_id
      )
      SELECT
        (SELECT COUNT(*) FROM held)::int AS found,
        (SELECT shares FROM held) AS shares,
        (SELECT COUNT(*) FROM ins)::int AS sold,
        (SELECT COUNT(*) FROM upd_h)::int AS updated
    `;
  } catch (err) {
    return { ok: false, response: NextResponse.json({ error: (err as Error).message }, { status: 500 }) };
  }

  if (!result || Number(result.found) === 0) {
    return { ok: false, response: NextResponse.json({ error: "현재 계좌에서 종목을 찾을 수 없습니다." }, { status: 404 }) };
  }
  if (Number(result.sold) === 0 || Number(result.updated) === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "보유 수량보다 많이 매도할 수 없습니다.", shares: Number(result.shares ?? 0) },
        { status: 409 }
      ),
    };
  }
  return { ok: true };
}
