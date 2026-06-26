-- =============================================================
-- AI PCN Checker — migration 004
-- Extra fields extracted from uploaded PCNs:
--   vehicles: colour, vehicle_type
--   pcns:     contravention_time
-- (contravention_code was added in migration 002.)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
-- =============================================================

alter table public.vehicles
  add column if not exists colour text;

alter table public.vehicles
  add column if not exists vehicle_type text;

alter table public.pcns
  add column if not exists contravention_time text;
