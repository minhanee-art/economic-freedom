// holdings CRUD API
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";
import { inferHoldingClassification, normalizePortfolioCategory } from "@/lib/holding-classification";

const INT_MAX = 2_147_483_647;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  const rows = await sql`SELECT * FROM holdings WHERE user_id = ${session.userId} AND account_id = ${accountId} ORDER BY target_pct DESC`;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  const { id, current_price, target_pct, code, name, shares, avg_price, category, sub_category } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  if (current_price !== undefined) {
    const p = Number(current_price);
    if (!Number.isFinite(p) || p < 0) return NextResponse.json({ error: "current_price는 0 이상이어야 합니다." }, { status: 400 });
    await sql`UPDATE holdings SET current_price = ${Math.round(p)} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  }
  if (target_pct !== undefined) {
    const t = Number(target_pct);
    if (!Number.isFinite(t) || t < 0 || t > 100) return NextResponse.json({ error: "target_pct는 0~100이어야 합니다." }, { status: 400 });
    await sql`UPDATE holdings SET target_pct = ${t} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  }
  if (code !== undefined) {
    const nextCode = String(code).trim();
    if (nextCode && !/^[0-9A-Za-z]{1,12}$/.test(nextCode)) {
      return NextResponse.json({ error: "종목코드는 숫자/영문 12자 이하여야 합니다." }, { status: 400 });
    }
    await sql`UPDATE holdings SET code = ${nextCode} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  }
  if (name !== undefined) {
    const nextName = String(name).trim();
    if (!nextName) return NextResponse.json({ error: "상품명을 입력해주세요." }, { status: 400 });
    await sql`UPDATE holdings SET name = ${nextName} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  }
  if (category !== undefined) {
    const nextCategory = normalizePortfolioCategory(String(category).trim());
    await sql`UPDATE holdings SET category = ${nextCategory} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  }
  if (sub_category !== undefined) {
    const nextSubCategory = String(sub_category).trim() || "기타";
    await sql`UPDATE holdings SET sub_category = ${nextSubCategory} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  }
  if (shares !== undefined || avg_price !== undefined) {
    const [currentHolding] = await sql`
      SELECT shares
      FROM holdings
      WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}
    `;
    if (!currentHolding) return NextResponse.json({ error: "현재 계좌에서 종목을 찾을 수 없습니다." }, { status: 404 });

    const nextShares = shares !== undefined ? Number(shares) : Number(currentHolding.shares ?? 0);
    if (!Number.isInteger(nextShares) || nextShares < 0) {
      return NextResponse.json({ error: "보유수량은 0 이상 정수여야 합니다." }, { status: 400 });
    }
    const nextAvgPrice = Number(avg_price ?? 0);
    if (!Number.isFinite(nextAvgPrice) || nextAvgPrice < 0 || (nextShares > 0 && nextAvgPrice <= 0)) {
      return NextResponse.json({ error: "보유수량이 있으면 평단가는 0보다 커야 합니다." }, { status: 400 });
    }
    const roundedAvgPrice = Math.round(nextAvgPrice);
    const totalCost = nextShares * roundedAvgPrice;
    await sql`UPDATE holdings SET shares = ${nextShares} WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
    if (nextShares > 0) {
      await sql`
        INSERT INTO cost_basis (user_id, account_id, holding_id, total_cost, total_shares)
        VALUES (${session.userId}, ${accountId}, ${id}, ${totalCost}, ${nextShares})
        ON CONFLICT (user_id, holding_id)
        DO UPDATE SET total_cost = EXCLUDED.total_cost,
                      total_shares = EXCLUDED.total_shares,
                      account_id = EXCLUDED.account_id
      `;
    } else {
      await sql`DELETE FROM cost_basis WHERE holding_id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
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
  const [costBasis] = await sql`
    SELECT id, user_id, account_id, holding_id, total_cost, total_shares, updated_at::text
    FROM cost_basis
    WHERE holding_id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}
  `;
  return NextResponse.json({ ok: true, holding: row, costBasis: costBasis ?? null });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  const { id } = await request.json();
  await sql`DELETE FROM holdings WHERE id = ${id} AND user_id = ${session.userId} AND account_id = ${accountId}`;
  return NextResponse.json({ ok: true });
}
