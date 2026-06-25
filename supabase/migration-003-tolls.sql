-- =============================================================
-- AI PCN Checker — migration 003
-- Adds the "road tolls & charges" tracker table.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
-- =============================================================

create table if not exists public.tolls (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  vehicle_id  uuid references public.vehicles(id) on delete set null,
  description text not null,
  amount      numeric(10,2) not null default 0,
  charge_date text,            -- ISO date the charge applies to
  location    text,
  created_at  timestamptz not null default now()
);

create index if not exists tolls_user_id_idx on public.tolls(user_id);

-- ---------- Row Level Security ----------
alter table public.tolls enable row level security;

drop policy if exists "tolls_select_own" on public.tolls;
drop policy if exists "tolls_insert_own" on public.tolls;
drop policy if exists "tolls_update_own" on public.tolls;
drop policy if exists "tolls_delete_own" on public.tolls;

create policy "tolls_select_own" on public.tolls
  for select using (auth.uid() = user_id);
create policy "tolls_insert_own" on public.tolls
  for insert with check (auth.uid() = user_id);
create policy "tolls_update_own" on public.tolls
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tolls_delete_own" on public.tolls
  for delete using (auth.uid() = user_id);
