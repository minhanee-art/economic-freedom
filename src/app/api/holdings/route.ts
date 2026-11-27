// holdings CRUD API
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { getRequestSession } from "@/lib/session";
import { selectRequestAccount } from "@/lib/account-selection";
import { inferHoldingClassification, normalizePortfolioCategory } from "@/lib/holding-classification";

const INT_MAX = 2_147_483_647;

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
  const rows = await sql`SELECT * FROM holdings WHERE user_id = ${session.userId} AND account_id = ${accountId} ORDER BY target_pct DESC`;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  const name = String(body.name ?? "").trim();
  const inferred = inferHoldingClassification(name, String(body.sub_category ?? body.category ?? ""));
  const category = body.category !== undefined
    ? normalizePortfolioCategory(String(body.category).trim())
    : inferred.category;
  const subCategory = String(body.sub_category ?? inferred.subCategory).trim() || inferred.subCategory;
  const currentPrice = Number(body.current_price ?? 0);
  const targetPct = Number(body.target_pct ?? 0);
  const shares = Number(body.shares ?? 0);
  const avgPrice = Number(body.avg_price ?? 0);

  if (!code || !name || !category) return NextResponse.json({ error: "종목코드, 종목명, 대분류가 필요합니다." }, { status: 400 });
  if (!Number.isFinite(currentPrice) || currentPrice < 0 || currentPrice > INT_MAX) return NextResponse.json({ error: "현재가는 0 이상이어야 합니다." }, { status: 400 });
  if (!Number.isFinite(targetPct) || targetPct < 0 || targetPct > 100) return NextResponse.json({ error: "설정비중은 0~100이어야 합니다." }, { status: 400 });
  if (!Number.isInteger(shares) || shares < 0 || shares > INT_MAX) return NextResponse.json({ error: "보유수량은 0 이상 정수여야 합니다." }, { status: 400 });
  if (!Number.isFinite(avgPrice) || avgPrice < 0 || avgPrice > INT_MAX || (shares > 0 && avgPrice <= 0)) {
    return NextResponse.json({ error: "보유수량을 입력할 때는 평단가가 0보다 커야 합니다." }, { status: 400 });
  }

  const holdingId = randomUUID();
  const roundedCurrentPrice = Math.round(currentPrice);
  const roundedAvgPrice = Math.round(avgPrice);
  const totalCost = shares * roundedAvgPrice;
  const queries: ReturnType<typeof sql>[] = [
    sql`
      INSERT INTO holdings (id, user_id, account_id, code, name, category, sub_category, current_price, shares, target_pct)
      VALUES (${holdingId}, ${session.userId}, ${accountId}, ${code}, ${name}, ${category}, ${subCategory}, ${roundedCurrentPrice}, ${shares}, ${targetPct})
    `,
  ];

  let purchaseRecordId: string | null = null;
  if (shares > 0) {
    purchaseRecordId = randomUUID();
    const today = new Date().toISOString().split("T")[0];
    queries.push(sql`
      INSERT INTO cost_basis (user_id, account_id, holding_id, total_cost, total_shares)
      VALUES (${session.userId}, ${accountId}, ${holdingId}, ${totalCost}, ${shares})
      ON CONFLICT (user_id, holding_id)
      DO UPDATE SET total_cost = EXCLUDED.total_cost,
                    total_shares = EXCLUDED.total_shares,
                    account_id = EXCLUDED.account_id
    `);
    queries.push(sql`
      INSERT INTO purchase_records (id, user_id, account_id, date, total_spent, total_value_after)
      VALUES (${purchaseRecordId}, ${session.userId}, ${accountId}, ${today}, ${totalCost}, 0)
    `);
    queries.push(sql`
      INSERT INTO purchase_items (record_id, holding_id, code, name, quantity, price_at_purchase, cost)
      VALUES (${purchaseRecordId}, ${holdingId}, ${code}, ${name}, ${shares}, ${roundedAvgPrice}, ${totalCost})
    `);
    queries.push(sql`
      UPDATE purchase_records
      SET total_value_after = (
        SELECT COALESCE(SUM(h.shares * h.current_price), 0)
        FROM holdings h WHERE h.user_id = ${session.userId} AND h.account_id = ${accountId}
      )
      WHERE id = ${purchaseRecordId}
    `);
  }

  await sql.transaction(queries);

  const [row] = await sql`
    SELECT id, user_id, account_id, code, name, category, sub_category,
           current_price, shares,
           target_pct::float, expense_ratio::float,
           created_at::text, updated_at::text
    FROM holdings
    WHERE id = ${holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}
  `;
  const [costBasis] = await sql`
    SELECT id, user_id, account_id, holding_id, total_cost, total_shares, updated_at::text
    FROM cost_basis
    WHERE holding_id = ${holdingId} AND user_id = ${session.userId} AND account_id = ${accountId}
  `;
  return NextResponse.json({ ...row, holding: row, costBasis: costBasis ?? null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
  const { id, current_price, target_pct, code, name, shares, avg_price, category, sub_category } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  // 요청에 들어 있는 필드만 바꾼다 (읽은 값을 되쓰지 않는다). 검증을 모두 끝낸 뒤 한 트랜잭션으로 실행해,
  // 중간에 400이 나도 일부만 반영되지 않는다.
  const queries: ReturnType<typeof sql>[] = [];
  if (current_price !== undefined) {
    const p = Number(current_price);
    if (!Number.isFinite(p) || p < 0) return NextResponse.json({ error: "current_price는 0 이상이어야 합니다." }, { status: 400 });
    queries.push(sql`UPDATE holdings SET current_price = ${Math.round(p)} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`);
  }
  if (target_pct !== undefined) {
    const t = Number(target_pct);
    if (!Number.isFinite(t) || t < 0 || t > 100) return NextResponse.json({ error: "target_pct는 0~100이어야 합니다." }, { status: 400 });
    queries.push(sql`UPDATE holdings SET target_pct = ${t} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`);
  }
  if (code !== undefined) {
    const nextCode = String(code).trim();
    if (nextCode && !/^[0-9A-Za-z]{1,12}$/.test(nextCode)) {
      return NextResponse.json({ error: "종목코드는 숫자/영문 12자 이하여야 합니다." }, { status: 400 });
    }
    queries.push(sql`UPDATE holdings SET code = ${nextCode} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`);
  }
  if (name !== undefined) {
    const nextName = String(name).trim();
    if (!nextName) return NextResponse.json({ error: "상품명을 입력해주세요." }, { status: 400 });
    queries.push(sql`UPDATE holdings SET name = ${nextName} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`);
  }
  if (category !== undefined) {
    const nextCategory = normalizePortfolioCategory(String(category).trim());
    queries.push(sql`UPDATE holdings SET category = ${nextCategory} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`);
  }
  if (sub_category !== undefined) {
    const nextSubCategory = String(sub_category).trim() || "기타";
    queries.push(sql`UPDATE holdings SET sub_category = ${nextSubCategory} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`);
  }

  // 종목 존재 여부를 알려 주는 문장의 위치 (수량·평단 편집이 있을 때만)
  let existsIndex = -1;
  let avgOnly = false;
  if (shares !== undefined) {
    // 수량을 절대값으로 지정하는 편집 — 나중 요청이 이기는 것(last-write-wins)이 의도된 동작이다.
    const nextShares = Number(shares);
    if (!Number.isInteger(nextShares) || nextShares < 0 || nextShares > INT_MAX) {
      return NextResponse.json({ error: "보유수량은 0 이상 정수여야 합니다." }, { status: 400 });
    }
    const nextAvgPrice = Number(avg_price ?? 0);
    if (!Number.isFinite(nextAvgPrice) || nextAvgPrice < 0 || nextAvgPrice > INT_MAX || (nextShares > 0 && nextAvgPrice <= 0)) {
      return NextResponse.json({ error: "보유수량이 있으면 평단가는 0보다 커야 합니다." }, { status: 400 });
    }
    const totalCost = nextShares * Math.round(nextAvgPrice);
    if (totalCost > INT_MAX) return NextResponse.json({ error: "수량 × 평단가가 너무 큽니다." }, { status: 400 });
    existsIndex = queries.length;
    queries.push(sql`UPDATE holdings SET shares = ${nextShares} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId} RETURNING id`);
    if (nextShares > 0) {
      // 종목이 없으면 아무 것도 넣지 않도록 holdings 에서 골라 넣는다 (FK 오류 대신 아래 404).
      queries.push(sql`
        INSERT INTO cost_basis (user_id, account_id, holding_id, total_cost, total_shares)
        SELECT ${session.userId}, ${accountId}, h.id, ${totalCost}, ${nextShares}
        FROM holdings h WHERE h.id = ${id} AND h.user_id = ${session.userId} AND h.account_id = ${accountId}
        ON CONFLICT (user_id, holding_id)
        DO UPDATE SET total_cost = EXCLUDED.total_cost,
                      total_shares = EXCLUDED.total_shares,
                      account_id = EXCLUDED.account_id
      `);
    } else {
      queries.push(sql`DELETE FROM cost_basis WHERE holding_id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`);
    }
  } else if (avg_price !== undefined) {
    // 평단가만 바꾸는 편집 — 수량은 건드리지 않는다. 현재 수량을 앱에서 읽어 되쓰면 동시에 들어온 매도를
    // 되돌리므로, 보유 행을 FOR UPDATE 로 잠그고 같은 문장 안에서 최신 수량으로 원가만 다시 계산한다.
    const nextAvgPrice = Number(avg_price);
    if (!Number.isFinite(nextAvgPrice) || nextAvgPrice < 0 || nextAvgPrice > INT_MAX) {
      return NextResponse.json({ error: "보유수량이 있으면 평단가는 0보다 커야 합니다." }, { status: 400 });
    }
    if (Math.round(nextAvgPrice) <= 0) {
      // 평단가 0 은 수량이 0일 때만 허용된다. 쓰기 전에 읽기만 해서 거른다 (이 값을 다시 쓰지는 않는다).
      const [current] = await sql`SELECT shares FROM holdings WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
      if (current && Number(current.shares) > 0) {
        return NextResponse.json({ error: "보유수량이 있으면 평단가는 0보다 커야 합니다." }, { status: 400 });
      }
    }
    avgOnly = true;
    existsIndex = queries.length;
    queries.push(sql`
      WITH h AS (
        SELECT id, shares FROM holdings
        WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}
        FOR UPDATE
      ),
      costed AS (
        INSERT INTO cost_basis (user_id, account_id, holding_id, total_cost, total_shares)
        SELECT ${session.userId}, ${accountId}, h.id, h.shares::bigint * ${Math.round(nextAvgPrice)}::int, h.shares
        FROM h WHERE h.shares > 0 AND ${Math.round(nextAvgPrice)}::int > 0
        ON CONFLICT (user_id, holding_id)
        DO UPDATE SET total_cost = EXCLUDED.total_cost,
                      total_shares = EXCLUDED.total_shares,
                      account_id = EXCLUDED.account_id
        RETURNING id
      ),
      cleared AS (
        DELETE FROM cost_basis WHERE holding_id IN (SELECT id FROM h WHERE shares = 0) RETURNING id
      )
      SELECT (SELECT COUNT(*) FROM h)::int AS found, COALESCE((SELECT shares FROM h), 0)::int AS shares
    `);
  }

  if (queries.length > 0) {
    const results = (await sql.transaction(queries)) as Record<string, unknown>[][];
    if (existsIndex >= 0) {
      const head = results[existsIndex]?.[0];
      if (avgOnly) {
        if (!head || Number(head.found) === 0) return NextResponse.json({ error: "현재 계좌에서 종목을 찾을 수 없습니다." }, { status: 404 });
      } else if (!head) {
        return NextResponse.json({ error: "현재 계좌에서 종목을 찾을 수 없습니다." }, { status: 404 });
      }
    }
  }
  const [row] = await sql`
    SELECT id, user_id, account_id, code, name, category, sub_category,
           current_price, shares,
           target_pct::float, expense_ratio::float,
           created_at::text, updated_at::text
    FROM holdings
    WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}
  `;
  if (!row) return NextResponse.json({ error: "현재 계좌에서 종목을 찾을 수 없습니다." }, { status: 404 });
  const [costBasis] = await sql`
    SELECT id, user_id, account_id, holding_id, total_cost, total_shares, updated_at::text
    FROM cost_basis
    WHERE holding_id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}
  `;
  return NextResponse.json({ ok: true, holding: row, costBasis: costBasis ?? null });
}

export async function DELETE(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
  const { id } = await request.json();
  await sql`DELETE FROM holdings WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  return NextResponse.json({ ok: true });
}
