// 공통 DB 쿼리 함수
import { sql } from "@/lib/db";

export async function getHoldings(userId: string) {
  return sql`
    SELECT id, user_id, code, name, category, sub_category,
           current_price, shares,
           target_pct::float, expense_ratio::float,
           created_at::text, updated_at::text
    FROM holdings WHERE user_id = ${userId} ORDER BY target_pct DESC
  `;
}

export async function getCostBases(userId: string) {
  return sql`
    SELECT id, user_id, holding_id, total_cost, total_shares,
           updated_at::text
    FROM cost_basis WHERE user_id = ${userId}
  `;
}

export async function getProfile(userId: string) {
  const [row] = await sql`
    SELECT id, email, display_name, monthly_budget,
           last_price_update::text, created_at::text
    FROM profiles WHERE id = ${userId}
  `;
  return row ?? null;
}

export async function getDividends(userId: string) {
  return sql`
    SELECT id, user_id, holding_id, amount, memo,
           date::text, created_at::text
    FROM dividends WHERE user_id = ${userId} ORDER BY date DESC
  `;
}

export async function getPurchaseRecords(userId: string, limit = 20, offset = 0) {
  return sql`
    SELECT pr.id, pr.user_id, pr.total_spent, pr.total_value_after,
           pr.date::text, pr.created_at::text,
           json_agg(pi ORDER BY pi.id) AS purchase_items
    FROM purchase_records pr
    LEFT JOIN purchase_items pi ON pi.record_id = pr.id
    WHERE pr.user_id = ${userId}
    GROUP BY pr.id
    ORDER BY pr.date DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getPurchaseRecordsCount(userId: string): Promise<number> {
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM purchase_records WHERE user_id = ${userId}`;
  return count;
}
