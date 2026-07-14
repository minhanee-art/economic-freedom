// 공통 DB 쿼리 함수
import { sql } from "@/lib/db";
import type { Holding, CostBasis, Profile, Dividend, PurchaseRecord, PurchaseItem } from "@/types";

export type PurchaseRecordRow = PurchaseRecord & { purchase_items: PurchaseItem[] | null };
export type WatchlistRow = { id: string; name: string; code: string | null; market: "KR" | "US" };
export type DividendCalendarRow = { id: string; date: string; stock: string; type: string; note: string };

export async function getHoldings(userId: string): Promise<Holding[]> {
  const rows = await sql`
    SELECT id, user_id, code, name, category, sub_category,
           current_price, shares,
           target_pct::float, expense_ratio::float,
           created_at::text, updated_at::text
    FROM holdings WHERE user_id = ${userId} ORDER BY target_pct DESC
  `;
  return rows as unknown as Holding[];
}

export async function getCostBases(userId: string): Promise<CostBasis[]> {
  const rows = await sql`
    SELECT id, user_id, holding_id, total_cost, total_shares,
           updated_at::text
    FROM cost_basis WHERE user_id = ${userId}
  `;
  return rows as unknown as CostBasis[];
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const [row] = await sql`
    SELECT id, email, display_name, monthly_budget,
           last_price_update::text, created_at::text
    FROM profiles WHERE id = ${userId}
  `;
  return (row ?? null) as unknown as Profile | null;
}

export async function getDividends(userId: string): Promise<Dividend[]> {
  const rows = await sql`
    SELECT id, user_id, holding_id, amount, memo,
           date::text, created_at::text
    FROM dividends WHERE user_id = ${userId} ORDER BY date DESC
  `;
  return rows as unknown as Dividend[];
}

export async function getPurchaseRecords(userId: string, limit = 20, offset = 0): Promise<PurchaseRecordRow[]> {
  const rows = await sql`
    SELECT pr.id, pr.user_id, pr.total_spent, pr.total_value_after,
           pr.date::text, pr.created_at::text,
           json_agg(pi ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL) AS purchase_items
    FROM purchase_records pr
    LEFT JOIN purchase_items pi ON pi.record_id = pr.id
    WHERE pr.user_id = ${userId}
    GROUP BY pr.id
    ORDER BY pr.date DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows as unknown as PurchaseRecordRow[];
}

export async function getPurchaseRecordsCount(userId: string): Promise<number> {
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM purchase_records WHERE user_id = ${userId}`;
  return count;
}

export async function getWatchlist(userId: string): Promise<WatchlistRow[]> {
  const rows = await sql`
    SELECT id, name, code, market, created_at::text
    FROM watchlist WHERE user_id = ${userId} ORDER BY created_at ASC
  `;
  return rows as unknown as WatchlistRow[];
}

export async function getDividendCalendar(userId: string): Promise<DividendCalendarRow[]> {
  const rows = await sql`
    SELECT id, date::text, stock, type, note
    FROM dividend_calendar WHERE user_id = ${userId} ORDER BY date ASC
  `;
  return rows as unknown as DividendCalendarRow[];
}

// ── 자녀 계좌 / 증여 관리 ──────────────────────────────

export type ChildRow = { id: string; name: string; birth_date: string; created_at: string };
export type ChildGiftRow = {
  id: string; child_id: string; date: string; amount: number; gift_type: string;
  reported: boolean; report_date: string | null; memo: string | null; created_at: string;
};
export type ChildHoldingRow = {
  id: string; child_id: string; code: string; name: string;
  shares: number; avg_price: number; current_price: number; created_at: string; updated_at: string;
};

export async function getChildren(userId: string): Promise<ChildRow[]> {
  const rows = await sql`
    SELECT id, name, birth_date::text, created_at::text
    FROM children WHERE user_id = ${userId} ORDER BY created_at ASC
  `;
  return rows as unknown as ChildRow[];
}

export async function getChild(userId: string, childId: string): Promise<ChildRow | null> {
  const [row] = await sql`
    SELECT id, name, birth_date::text, created_at::text
    FROM children WHERE id = ${childId} AND user_id = ${userId}
  `;
  return (row ?? null) as unknown as ChildRow | null;
}

/** childId 생략 시 사용자의 전체 자녀 증여 기록(요약용) */
export async function getChildGifts(userId: string, childId?: string): Promise<ChildGiftRow[]> {
  const rows = childId
    ? await sql`
        SELECT id, child_id, date::text, amount, gift_type, reported, report_date::text, memo, created_at::text
        FROM child_gifts WHERE user_id = ${userId} AND child_id = ${childId} ORDER BY date DESC
      `
    : await sql`
        SELECT id, child_id, date::text, amount, gift_type, reported, report_date::text, memo, created_at::text
        FROM child_gifts WHERE user_id = ${userId} ORDER BY date DESC
      `;
  return rows as unknown as ChildGiftRow[];
}

export async function getChildHoldings(userId: string, childId: string): Promise<ChildHoldingRow[]> {
  const rows = await sql`
    SELECT id, child_id, code, name, shares, avg_price, current_price, created_at::text, updated_at::text
    FROM child_holdings WHERE user_id = ${userId} AND child_id = ${childId} ORDER BY created_at ASC
  `;
  return rows as unknown as ChildHoldingRow[];
}
