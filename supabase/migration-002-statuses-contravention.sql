-- =============================================================
-- AI PCN Checker — migration 002
-- Adds: extra PCN statuses (appealed, cancelled) and a
-- contravention code column.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
-- =============================================================

-- ---------- Expand the status check constraint ----------
alter table public.pcns
  drop constraint if exists pcns_status_check;

alter table public.pcns
  add constraint pcns_status_check
  check (status in ('pending','paid','contested','appealed','cancelled'));

-- ---------- New columns ----------
alter table public.pcns
  add column if not exists contravention_code text;
