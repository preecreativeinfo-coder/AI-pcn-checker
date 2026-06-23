-- =============================================================
-- AI PCN Checker — Supabase setup
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (uses IF NOT EXISTS / idempotent guards).
-- =============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ---------- Tables ----------
create table if not exists public.vehicles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  registration_number text not null,
  make                text not null,
  model               text not null,
  created_at          timestamptz not null default now()
);

create table if not exists public.pcns (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  vehicle_id    uuid references public.vehicles(id) on delete set null,
  pcn_reference text not null,
  issuer        text not null,
  issue_date    text,
  amount        numeric(10,2),
  status        text not null default 'pending'
                  check (status in ('pending','paid','contested')),
  due_date      text,
  location      text,
  file_path     text,
  ocr_raw_text  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists vehicles_user_id_idx on public.vehicles(user_id);
create index if not exists pcns_user_id_idx     on public.pcns(user_id);

-- ---------- updated_at trigger for pcns ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pcns_set_updated_at on public.pcns;
create trigger pcns_set_updated_at
  before update on public.pcns
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------
alter table public.vehicles enable row level security;
alter table public.pcns     enable row level security;

-- vehicles: each user only sees / writes their own rows
drop policy if exists "vehicles_select_own" on public.vehicles;
drop policy if exists "vehicles_insert_own" on public.vehicles;
drop policy if exists "vehicles_update_own" on public.vehicles;
drop policy if exists "vehicles_delete_own" on public.vehicles;

create policy "vehicles_select_own" on public.vehicles
  for select using (auth.uid() = user_id);
create policy "vehicles_insert_own" on public.vehicles
  for insert with check (auth.uid() = user_id);
create policy "vehicles_update_own" on public.vehicles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vehicles_delete_own" on public.vehicles
  for delete using (auth.uid() = user_id);

-- pcns: each user only sees / writes their own rows
drop policy if exists "pcns_select_own" on public.pcns;
drop policy if exists "pcns_insert_own" on public.pcns;
drop policy if exists "pcns_update_own" on public.pcns;
drop policy if exists "pcns_delete_own" on public.pcns;

create policy "pcns_select_own" on public.pcns
  for select using (auth.uid() = user_id);
create policy "pcns_insert_own" on public.pcns
  for insert with check (auth.uid() = user_id);
create policy "pcns_update_own" on public.pcns
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pcns_delete_own" on public.pcns
  for delete using (auth.uid() = user_id);

-- ---------- Storage bucket for uploaded PCN files ----------
insert into storage.buckets (id, name, public)
values ('pcn-files', 'pcn-files', false)
on conflict (id) do nothing;

-- Storage policies: users can manage files only inside a folder named after their uid
-- (frontend uploads to:  <user_id>/<timestamp>_pcn.<ext> )
drop policy if exists "pcn_files_select_own" on storage.objects;
drop policy if exists "pcn_files_insert_own" on storage.objects;
drop policy if exists "pcn_files_update_own" on storage.objects;
drop policy if exists "pcn_files_delete_own" on storage.objects;

create policy "pcn_files_select_own" on storage.objects
  for select using (
    bucket_id = 'pcn-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "pcn_files_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'pcn-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "pcn_files_update_own" on storage.objects
  for update using (
    bucket_id = 'pcn-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "pcn_files_delete_own" on storage.objects
  for delete using (
    bucket_id = 'pcn-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
