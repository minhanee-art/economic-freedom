-- 가족/명의별 포트폴리오 계좌 관리
-- 기존 데이터는 사용자별 기본 계좌('내 계좌')로 자동 귀속한다.

CREATE TABLE IF NOT EXISTS portfolio_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_type TEXT NOT NULL DEFAULT 'self',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

INSERT INTO portfolio_accounts (user_id, name, owner_type, display_order)
SELECT p.id, '내 계좌', 'self', 0
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM portfolio_accounts a WHERE a.user_id = p.id
)
ON CONFLICT DO NOTHING;

ALTER TABLE holdings ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE cost_basis ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE purchase_records ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE dividends ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE sell_items ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE dividend_calendar ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;

UPDATE holdings h
SET account_id = a.id
FROM portfolio_accounts a
WHERE h.user_id = a.user_id AND h.account_id IS NULL AND a.display_order = 0;

UPDATE cost_basis cb
SET account_id = h.account_id
FROM holdings h
WHERE cb.holding_id = h.id AND cb.user_id = h.user_id AND cb.account_id IS NULL;

UPDATE purchase_records pr
SET account_id = a.id
FROM portfolio_accounts a
WHERE pr.user_id = a.user_id AND pr.account_id IS NULL AND a.display_order = 0;

UPDATE dividends d
SET account_id = h.account_id
FROM holdings h
WHERE d.holding_id = h.id AND d.user_id = h.user_id AND d.account_id IS NULL;

UPDATE sell_items s
SET account_id = h.account_id
FROM holdings h
WHERE s.holding_id = h.id AND s.user_id = h.user_id AND s.account_id IS NULL;

UPDATE watchlist w
SET account_id = a.id
FROM portfolio_accounts a
WHERE w.user_id = a.user_id AND w.account_id IS NULL AND a.display_order = 0;

UPDATE dividend_calendar dc
SET account_id = a.id
FROM portfolio_accounts a
WHERE dc.user_id = a.user_id AND dc.account_id IS NULL AND a.display_order = 0;

DROP INDEX IF EXISTS idx_holdings_user_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_holdings_user_account_code ON holdings(user_id, account_id, code);
CREATE INDEX IF NOT EXISTS idx_holdings_user_account ON holdings(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_records_user_account_date ON purchase_records(user_id, account_id, date);
CREATE INDEX IF NOT EXISTS idx_dividends_user_account_date ON dividends(user_id, account_id, date);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_account ON watchlist(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_dividend_calendar_user_account_date ON dividend_calendar(user_id, account_id, date);

ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_user_id_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_user_account_name ON watchlist(user_id, account_id, name);
