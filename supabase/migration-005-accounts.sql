-- =============================================================
-- AI PCN Checker — migration 005  (Feature B · phase 1)
-- Multi-tenant accounts. ADDITIVE ONLY: new tables + nullable
-- columns + RLS for the new tables. Existing vehicles/pcns rows
-- are untouched (account_id stays NULL until the phase-2 backfill).
-- Nothing here changes behaviour for current personal users.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run.
--
-- DO NOT run the phase-2 backfill or phase-3 RLS switch yet — those
-- are separate, reviewed scripts.
-- =============================================================

-- ---------- Tables ----------
create table if not exists public.accounts (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('personal','business_fleet','business_agency')),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.account_users (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner','admin','manager','viewer')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists account_users_user_idx on public.account_users(user_id);
create index if not exists clients_account_idx     on public.clients(account_id);

-- ---------- Additive nullable columns on existing tables ----------
alter table public.vehicles add column if not exists account_id uuid references public.accounts(id);
alter table public.vehicles add column if not exists client_id  uuid references public.clients(id);
alter table public.pcns     add column if not exists account_id uuid references public.accounts(id);

create index if not exists vehicles_account_idx on public.vehicles(account_id);
create index if not exists pcns_account_idx     on public.pcns(account_id);

-- ---------- Membership helper (used by new-table RLS now, vehicles/pcns in phase 3) ----------
create or replace function public.is_account_member(acc uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.account_users au
    where au.account_id = acc and au.user_id = auth.uid()
  );
$$;

-- ---------- RLS for the new tables ----------
alter table public.accounts      enable row level security;
alter table public.account_users enable row level security;
alter table public.clients       enable row level security;

-- Accounts: a member can read their account.
drop policy if exists "accounts_read_member" on public.accounts;
create policy "accounts_read_member" on public.accounts
  for select using (public.is_account_member(id));

-- A user may create an account (they then add themselves as owner via account_users).
drop policy if exists "accounts_insert_self" on public.accounts;
create policy "accounts_insert_self" on public.accounts
  for insert with check (true);

-- account_users: members can read the membership of accounts they belong to.
drop policy if exists "account_users_read_member" on public.account_users;
create policy "account_users_read_member" on public.account_users
  for select using (public.is_account_member(account_id));

-- A user may insert their OWN membership row (bootstrap: first owner of a new account).
drop policy if exists "account_users_insert_self" on public.account_users;
create policy "account_users_insert_self" on public.account_users
  for insert with check (user_id = auth.uid());

-- clients: any member of the owning account can read/write client records.
drop policy if exists "clients_rw_member" on public.clients;
create policy "clients_rw_member" on public.clients
  for all using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));
