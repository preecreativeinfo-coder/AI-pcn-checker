-- =============================================================
-- AI PCN Checker — migration 002
-- Adds: extra PCN statuses (appealed, cancelled), a contravention
-- code column, and a cached AI analysis column.
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

-- Cached result of the AI Analysis so we don't re-run (and re-bill) the
-- model on every page view. Refreshed when the user clicks "AI Analysis".
alter table public.pcns
  add column if not exists ai_analysis jsonb;
