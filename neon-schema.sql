-- pension-manager Neon 스키마 (Supabase auth 제거, 커스텀 users 테이블 사용)

-- 1. users (인증용 — Supabase auth.users 대체)
--    password_hash는 Google OAuth 전용 계정을 위해 NULL 허용.
--    session_version은 JWT 폐기용 — 토큰의 sv 클레임과 다르면 무효. 비밀번호 설정·변경, Google 첫 연결 시 +1.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  session_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 기존 DB용 (src/lib/session-version.ts의 ensureSessionVersionSchema와 같은 문장)
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

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

-- 10. child_gifts (자녀 계좌 입금/증여 기록 — 증여와 정부지원금 등 비증여 입금 구분)
CREATE TABLE IF NOT EXISTS child_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount INTEGER NOT NULL,
  gift_type TEXT NOT NULL DEFAULT 'lump', -- 'lump'(일괄 증여) | 'installment'(분할/정기금 증여) | 'government_support'(정부지원금/비증여 입금)
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
-- (idx_holdings_user_code 는 계좌별 유니크 idx_holdings_user_account_code 로 대체됨 — 12절 참고)
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

-- ── 연금 설계 (가족 단위) ──────────────────────────────────────────────
-- 코드(src/lib/pension-data.ts ensurePensionSchema, src/lib/portfolio-accounts.ts)에서도
-- 같은 정의를 CREATE/ALTER IF NOT EXISTS로 보장한다. 여기서는 새 테이블의 FK 대상인
-- portfolio_accounts도 함께 정의한다(기존에는 코드에서만 생성).

-- 12. portfolio_accounts (가족/명의별 계좌) + 세제 유형
CREATE TABLE IF NOT EXISTS portfolio_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_type TEXT NOT NULL DEFAULT 'self',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);
ALTER TABLE portfolio_accounts ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
-- 'pension_savings'(연금저축) | 'irp' | 'dc' | 'isa' | 'general'(일반, 기존 계좌 기본값) | 'child'(자녀)
ALTER TABLE portfolio_accounts ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'general';

-- 계좌별 데이터 분리: 각 테이블의 account_id (src/lib/portfolio-accounts.ts ensurePortfolioAccountSchema 와 같은 문장).
-- NOT NULL 은 강제하지 않음 — 기존 행은 코드가 기본 계좌('내 계좌')로 채운다.
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE cost_basis ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE purchase_records ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE dividends ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE sell_items ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
ALTER TABLE dividend_calendar ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_holdings_user_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_holdings_user_account_code ON holdings(user_id, account_id, code);
CREATE INDEX IF NOT EXISTS idx_holdings_user_account ON holdings(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_records_user_account_date ON purchase_records(user_id, account_id, date);
CREATE INDEX IF NOT EXISTS idx_dividends_user_account_date ON dividends(user_id, account_id, date);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_account ON watchlist(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_dividend_calendar_user_account_date ON dividend_calendar(user_id, account_id, date);
ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_user_id_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_user_account_name ON watchlist(user_id, account_id, name);

-- 13. pension_contributions (계좌별 연간 납입액 — 세액공제 진행률 계산용)
CREATE TABLE IF NOT EXISTS pension_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0 CHECK (amount >= 0),
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, year)
);
CREATE INDEX IF NOT EXISTS idx_pension_contributions_user_year ON pension_contributions(user_id, year);

-- 14. pension_income_sources (국민연금·퇴직연금·연금보험 수동 입력, 본인/배우자 구분)
CREATE TABLE IF NOT EXISTS pension_income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member TEXT NOT NULL DEFAULT 'self' CHECK (member IN ('self', 'spouse')),
  source_type TEXT NOT NULL CHECK (source_type IN ('national_pension', 'retirement_pension', 'pension_insurance')),
  label TEXT,
  monthly_amount BIGINT NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  start_age INTEGER NOT NULL,
  end_age INTEGER, -- NULL = 종신
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pension_income_sources_user ON pension_income_sources(user_id);

-- profiles: 은퇴 목표·총급여 구간
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS retirement_target_monthly BIGINT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS retirement_age INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spouse_birth_year INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expected_return_pct NUMERIC(5,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS salary_bracket TEXT; -- 'low'(총급여 5,500만원 이하) | 'high'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spouse_salary_bracket TEXT; -- 배우자 총급여 구간, 값은 salary_bracket 과 같음. NULL = 미입력

-- 15. 텔레그램 채팅 소유 확인(연결 코드) — 코드(src/lib/telegram-link.ts ensureTelegramLinkSchema)에서도
--     같은 정의를 IF NOT EXISTS로 보장한다.
-- telegram_chat_verified_at: 연결 코드로 소유를 확인한 시각. NULL이면 telegram_chat_id가 있어도 리포트를 보내지 않는다.
ALTER TABLE portfolio_accounts ADD COLUMN IF NOT EXISTS telegram_chat_verified_at TIMESTAMPTZ;
-- 일회용 연결 코드 — 평문은 저장하지 않고 SHA-256 해시만. 10분 만료·1회용.
-- session_version: 발급 당시 users.session_version. 사용 시 값이 다르면(비밀번호 변경·Google 첫 연결 등) 무효.
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  session_version INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_account ON telegram_link_codes(account_id);
