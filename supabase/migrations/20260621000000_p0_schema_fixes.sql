-- P0 스키마 정합화: 코드가 사용하지만 스키마/마이그레이션에 누락돼 있던 항목 추가.
-- 운영 Neon DB에 그대로 실행 가능(모두 IF NOT EXISTS / 멱등).

-- 1) users: Google OAuth 지원 (auth/google/callback이 사용)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- 2) watchlist.code (감정분석/기술적분석 cron 및 watchlist CRUD가 사용)
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS code TEXT;

-- 3) dividend_calendar (배당 캘린더 CRUD + cron이 사용)
CREATE TABLE IF NOT EXISTS dividend_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  stock TEXT NOT NULL,
  type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dividend_calendar_user_date ON dividend_calendar(user_id, date);

-- 4) sell_items (매도 거래 영속화 — 임포트 재실행 시 매도 중복 차감 방지)
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
CREATE INDEX IF NOT EXISTS idx_sell_items_user ON sell_items(user_id);

-- 5) purchase_records.total_value_after: 포트폴리오 평가금액(원)이 INT 범위를 넘을 수 있어 BIGINT로 확장
ALTER TABLE purchase_records ALTER COLUMN total_value_after TYPE BIGINT;
