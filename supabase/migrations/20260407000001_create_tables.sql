-- ============================================
-- Pension Manager - Database Schema
-- ============================================

-- 1. profiles (사용자 프로필)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  monthly_budget integer not null default 300000,
  created_at timestamptz not null default now()
);

-- 2. holdings (보유 종목)
create table holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null,
  sub_category text not null,
  current_price integer not null default 0,
  shares integer not null default 0,
  target_pct numeric(5,2) not null default 0,
  expense_ratio numeric(5,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. purchase_records (매수 기록)
create table purchase_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null default current_date,
  total_spent integer not null default 0,
  total_value_after integer not null default 0,
  created_at timestamptz not null default now()
);

-- 4. purchase_items (매수 상세)
create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references purchase_records(id) on delete cascade,
  holding_id uuid not null references holdings(id) on delete cascade,
  code text not null,
  name text not null,
  quantity integer not null,
  price_at_purchase integer not null,
  cost integer not null
);

-- 5. dividends (배당금 기록)
create table dividends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  holding_id uuid not null references holdings(id) on delete cascade,
  amount integer not null,
  date date not null default current_date,
  memo text,
  created_at timestamptz not null default now()
);

-- 6. cost_basis (원가 기록)
create table cost_basis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  holding_id uuid not null references holdings(id) on delete cascade,
  total_cost integer not null default 0,
  total_shares integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ============================================
-- 인덱스
-- ============================================

create unique index idx_holdings_user_code on holdings(user_id, code);
create index idx_purchase_records_user_date on purchase_records(user_id, date);
create index idx_dividends_user_date on dividends(user_id, date);
create unique index idx_cost_basis_user_holding on cost_basis(user_id, holding_id);

-- ============================================
-- updated_at 자동 갱신 트리거
-- ============================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_holdings_updated_at
  before update on holdings
  for each row execute function update_updated_at();

create trigger trg_cost_basis_updated_at
  before update on cost_basis
  for each row execute function update_updated_at();
