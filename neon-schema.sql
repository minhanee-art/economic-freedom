-- pension-manager Neon 스키마 (Supabase auth 제거, 커스텀 users 테이블 사용)

-- 1. users (인증용 — Supabase auth.users 대체)
--    password_hash는 Google OAuth 전용 계정을 위해 NULL 허용.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. profiles (사용자 프로필)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  monthly_budget INTEGER NOT NULL DEFAULT 300000,
  last_price_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. holdings (보유 종목)
CREATE TABLE IF NOT EXISTS holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  current_price INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  target_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  expense_ratio NUMERIC(5,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. purchase_records (매수 기록)
CREATE TABLE IF NOT EXISTS purchase_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_spent INTEGER NOT NULL DEFAULT 0,
  -- 포트폴리오 평가금액(원)은 INT 범위(~21억)를 넘을 수 있어 BIGINT 사용
  total_value_after BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. purchase_items (매수 상세)
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES purchase_records(id) ON DELETE CASCADE,
  holding_id UUID NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_at_purchase INTEGER NOT NULL,
  cost INTEGER NOT NULL
);

-- 6. dividends (배당금 기록)
CREATE TABLE IF NOT EXISTS dividends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  holding_id UUID NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (holding_id, date)
);

-- 7. cost_basis (원가 기록)
CREATE TABLE IF NOT EXISTS cost_basis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  holding_id UUID NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
  total_cost INTEGER NOT NULL DEFAULT 0,
  total_shares INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. watchlist (감정분석 대상 종목)
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  market TEXT NOT NULL DEFAULT 'KR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

-- 9. dividend_calendar (배당 캘린더)
CREATE TABLE IF NOT EXISTS dividend_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  stock TEXT NOT NULL,
  type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. sell_items (매도 거래 영속화 — 재임포트 시 중복 차감 방지)
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
);

-- 9. children (자녀 프로필 — 증여세 계산을 위해 생년월일 보관)
CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. child_gifts (자녀 증여 기록 — 일괄/분할(정기금) 증여 추적 + 신고 여부)
CREATE TABLE IF NOT EXISTS child_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount INTEGER NOT NULL,
  gift_type TEXT NOT NULL DEFAULT 'lump', -- 'lump'(일괄) | 'installment'(분할/정기금)
  reported BOOLEAN NOT NULL DEFAULT false,
  report_date DATE,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. child_holdings (자녀 명의 계좌 보유 종목 — 간이 관리, 성인 holdings와 별도)
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

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_holdings_user_code ON holdings(user_id, code);
CREATE INDEX IF NOT EXISTS idx_purchase_records_user_date ON purchase_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_dividends_user_date ON dividends(user_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_basis_user_holding ON cost_basis(user_id, holding_id);
CREATE INDEX IF NOT EXISTS idx_dividend_calendar_user_date ON dividend_calendar(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sell_items_user ON sell_items(user_id);
CREATE INDEX IF NOT EXISTS idx_children_user ON children(user_id);
CREATE INDEX IF NOT EXISTS idx_child_gifts_child_date ON child_gifts(child_id, date);
CREATE INDEX IF NOT EXISTS idx_child_gifts_user ON child_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_child_holdings_child ON child_holdings(child_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_holdings_updated_at
  BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_cost_basis_updated_at
  BEFORE UPDATE ON cost_basis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_child_holdings_updated_at
  BEFORE UPDATE ON child_holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
