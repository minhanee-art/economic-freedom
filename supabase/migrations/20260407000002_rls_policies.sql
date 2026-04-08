-- ============================================
-- Row Level Security 정책
-- ============================================

-- profiles
alter table profiles enable row level security;

create policy "profiles_select" on profiles
  for select using (id = auth.uid());
create policy "profiles_insert" on profiles
  for insert with check (id = auth.uid());
create policy "profiles_update" on profiles
  for update using (id = auth.uid());
create policy "profiles_delete" on profiles
  for delete using (id = auth.uid());

-- holdings
alter table holdings enable row level security;

create policy "holdings_select" on holdings
  for select using (user_id = auth.uid());
create policy "holdings_insert" on holdings
  for insert with check (user_id = auth.uid());
create policy "holdings_update" on holdings
  for update using (user_id = auth.uid());
create policy "holdings_delete" on holdings
  for delete using (user_id = auth.uid());

-- purchase_records
alter table purchase_records enable row level security;

create policy "purchase_records_select" on purchase_records
  for select using (user_id = auth.uid());
create policy "purchase_records_insert" on purchase_records
  for insert with check (user_id = auth.uid());
create policy "purchase_records_update" on purchase_records
  for update using (user_id = auth.uid());
create policy "purchase_records_delete" on purchase_records
  for delete using (user_id = auth.uid());

-- purchase_items (record_id를 통해 간접 권한 확인)
alter table purchase_items enable row level security;

create policy "purchase_items_select" on purchase_items
  for select using (
    exists (
      select 1 from purchase_records
      where purchase_records.id = purchase_items.record_id
        and purchase_records.user_id = auth.uid()
    )
  );
create policy "purchase_items_insert" on purchase_items
  for insert with check (
    exists (
      select 1 from purchase_records
      where purchase_records.id = purchase_items.record_id
        and purchase_records.user_id = auth.uid()
    )
  );
create policy "purchase_items_update" on purchase_items
  for update using (
    exists (
      select 1 from purchase_records
      where purchase_records.id = purchase_items.record_id
        and purchase_records.user_id = auth.uid()
    )
  );
create policy "purchase_items_delete" on purchase_items
  for delete using (
    exists (
      select 1 from purchase_records
      where purchase_records.id = purchase_items.record_id
        and purchase_records.user_id = auth.uid()
    )
  );

-- dividends
alter table dividends enable row level security;

create policy "dividends_select" on dividends
  for select using (user_id = auth.uid());
create policy "dividends_insert" on dividends
  for insert with check (user_id = auth.uid());
create policy "dividends_update" on dividends
  for update using (user_id = auth.uid());
create policy "dividends_delete" on dividends
  for delete using (user_id = auth.uid());

-- cost_basis
alter table cost_basis enable row level security;

create policy "cost_basis_select" on cost_basis
  for select using (user_id = auth.uid());
create policy "cost_basis_insert" on cost_basis
  for insert with check (user_id = auth.uid());
create policy "cost_basis_update" on cost_basis
  for update using (user_id = auth.uid());
create policy "cost_basis_delete" on cost_basis
  for delete using (user_id = auth.uid());
