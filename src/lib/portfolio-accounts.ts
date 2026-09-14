// 가족/명의별 포트폴리오 계좌 선택 헬퍼
import { cookies } from "next/headers";
import { sql } from "@/lib/db";

export const ACCOUNT_COOKIE = "portfolio-account-id";

export type PortfolioAccount = {
  id: string;
  user_id: string;
  name: string;
  owner_type: "self" | "spouse" | "child" | "other";
  display_order: number;
  created_at: string;
};

let schemaReady: Promise<void> | null = null;

export async function ensurePortfolioAccountSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS portfolio_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        owner_type TEXT NOT NULL DEFAULT 'self',
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, name)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sell_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        holding_id UUID NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL,
        date DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`ALTER TABLE holdings ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE cost_basis ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE purchase_records ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE dividends ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE sell_items ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE dividend_calendar ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE`;

    await sql`DROP INDEX IF EXISTS idx_holdings_user_code`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_holdings_user_account_code ON holdings(user_id, account_id, code)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_holdings_user_account ON holdings(user_id, account_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_purchase_records_user_account_date ON purchase_records(user_id, account_id, date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_dividends_user_account_date ON dividends(user_id, account_id, date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_watchlist_user_account ON watchlist(user_id, account_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_dividend_calendar_user_account_date ON dividend_calendar(user_id, account_id, date)`;
    await sql`ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_user_id_name_key`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_user_account_name ON watchlist(user_id, account_id, name)`;
  })();
  await schemaReady;
}

export async function getPortfolioAccounts(userId: string): Promise<PortfolioAccount[]> {
  await ensurePortfolioAccountSchema();
  await ensureDefaultPortfolioAccount(userId);
  const rows = await sql`
    SELECT id, user_id, name, owner_type, display_order, created_at::text
    FROM portfolio_accounts
    WHERE user_id = ${userId}
    ORDER BY display_order ASC, created_at ASC
  `;
  return rows as unknown as PortfolioAccount[];
}

export async function ensureDefaultPortfolioAccount(userId: string): Promise<string> {
  await ensurePortfolioAccountSchema();
  let [account] = await sql`
    SELECT id FROM portfolio_accounts
    WHERE user_id = ${userId}
    ORDER BY display_order ASC, created_at ASC
    LIMIT 1
  `;

  if (!account) {
    [account] = await sql`
      INSERT INTO portfolio_accounts (user_id, name, owner_type, display_order)
      VALUES (${userId}, '내 계좌', 'self', 0)
      ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
  }

  const accountId = String(account.id);
  await assignLegacyRowsToAccount(userId, accountId);
  return accountId;
}

export async function assignLegacyRowsToAccount(userId: string, accountId: string): Promise<void> {
  await sql`UPDATE holdings SET account_id = ${accountId} WHERE user_id = ${userId} AND account_id IS NULL`;
  await sql`UPDATE cost_basis cb SET account_id = h.account_id FROM holdings h WHERE cb.holding_id = h.id AND cb.user_id = ${userId} AND cb.account_id IS NULL`;
  await sql`UPDATE purchase_records SET account_id = ${accountId} WHERE user_id = ${userId} AND account_id IS NULL`;
  await sql`UPDATE dividends d SET account_id = h.account_id FROM holdings h WHERE d.holding_id = h.id AND d.user_id = ${userId} AND d.account_id IS NULL`;
  await sql`UPDATE sell_items s SET account_id = h.account_id FROM holdings h WHERE s.holding_id = h.id AND s.user_id = ${userId} AND s.account_id IS NULL`;
  await sql`UPDATE watchlist SET account_id = ${accountId} WHERE user_id = ${userId} AND account_id IS NULL`;
  await sql`UPDATE dividend_calendar SET account_id = ${accountId} WHERE user_id = ${userId} AND account_id IS NULL`;
}

export async function getActivePortfolioAccountId(userId: string): Promise<string> {
  const accounts = await getPortfolioAccounts(userId);
  const cookieStore = await cookies();
  const cookieAccountId = cookieStore.get(ACCOUNT_COOKIE)?.value;
  const active = accounts.find((account) => account.id === cookieAccountId) ?? accounts[0];
  return active.id;
}

export async function createPortfolioAccount(
  userId: string,
  name: string,
  ownerType: PortfolioAccount["owner_type"] = "other"
): Promise<PortfolioAccount> {
  await ensurePortfolioAccountSchema();
  const cleanName = name.trim().slice(0, 30);
  if (!cleanName) throw new Error("계좌 이름이 필요합니다.");
  const [{ next_order }] = await sql`
    SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
    FROM portfolio_accounts
    WHERE user_id = ${userId}
  `;
  const [row] = await sql`
    INSERT INTO portfolio_accounts (user_id, name, owner_type, display_order)
    VALUES (${userId}, ${cleanName}, ${ownerType}, ${next_order})
    RETURNING id, user_id, name, owner_type, display_order, created_at::text
  `;
  return row as unknown as PortfolioAccount;
}
