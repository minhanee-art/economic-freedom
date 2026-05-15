// 공통 DB 쿼리 함수
import { sql } from "@/lib/db";

export async function getHoldings(userId: string) {
  return sql`SELECT * FROM holdings WHERE user_id = ${userId} ORDER BY target_pct DESC`;
}

export async function getCostBases(userId: string) {
  return sql`SELECT * FROM cost_basis WHERE user_id = ${userId}`;
}

export async function getProfile(userId: string) {
  const [row] = await sql`SELECT * FROM profiles WHERE id = ${userId}`;
  return row ?? null;
}

export async function getDividends(userId: string) {
  return sql`SELECT * FROM dividends WHERE user_id = ${userId} ORDER BY date DESC`;
}

export async function getPurchaseRecords(userId: string, limit = 20, offset = 0) {
  return sql`
    SELECT pr.*, json_agg(pi ORDER BY pi.id) AS purchase_items
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
