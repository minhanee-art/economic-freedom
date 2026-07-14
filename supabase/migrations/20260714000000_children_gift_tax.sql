-- 자녀 계좌 관리 + 증여 기록 기능. 기존 테이블은 전혀 건드리지 않는 순수 추가.

CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS child_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount INTEGER NOT NULL,
  gift_type TEXT NOT NULL DEFAULT 'lump',
  reported BOOLEAN NOT NULL DEFAULT false,
  report_date DATE,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS child_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  shares INTEGER NOT NULL DEFAULT 0,
  avg_price INTEGER NOT NULL DEFAULT 0,
  current_price INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (child_id, code)
);

CREATE INDEX IF NOT EXISTS idx_children_user ON children(user_id);
CREATE INDEX IF NOT EXISTS idx_child_gifts_child_date ON child_gifts(child_id, date);
CREATE INDEX IF NOT EXISTS idx_child_gifts_user ON child_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_child_holdings_child ON child_holdings(child_id);

CREATE OR REPLACE TRIGGER trg_child_holdings_updated_at
  BEFORE UPDATE ON child_holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
