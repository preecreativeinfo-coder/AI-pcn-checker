-- =============================================================
-- AI PCN Checker — migration 007  (Feature B · phase 3 · RLS)
-- Account-scoped row access for vehicles + pcns, ADDED ALONGSIDE the
-- existing user_id policies (RLS permissive policies are OR'd), so:
--   * personal users: unchanged (they're the owner of their account)
--   * business/agency: any member can SEE the account's rows; only
--     owner/admin/manager can WRITE.
--
-- Run AFTER migration-005 + the phase-2 backfill (006). Safe to re-run.
-- =============================================================

-- Writer check: member with a write-capable role.
create or replace function public.account_can_write(acc uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.account_users au
    where au.account_id = acc
      and au.user_id = auth.uid()
      and au.role in ('owner','admin','manager')
  );
$$;

-- ---------- vehicles ----------
drop policy if exists "vehicles_select_account" on public.vehicles;
create policy "vehicles_select_account" on public.vehicles
  for select using (account_id is not null and public.is_account_member(account_id));

drop policy if exists "vehicles_update_account" on public.vehicles;
create policy "vehicles_update_account" on public.vehicles
  for update using (account_id is not null and public.account_can_write(account_id))
  with check (account_id is not null and public.account_can_write(account_id));

drop policy if exists "vehicles_delete_account" on public.vehicles;
create policy "vehicles_delete_account" on public.vehicles
  for delete using (account_id is not null and public.account_can_write(account_id));

-- ---------- pcns ----------
drop policy if exists "pcns_select_account" on public.pcns;
create policy "pcns_select_account" on public.pcns
  for select using (account_id is not null and public.is_account_member(account_id));

drop policy if exists "pcns_update_account" on public.pcns;
create policy "pcns_update_account" on public.pcns
  for update using (account_id is not null and public.account_can_write(account_id))
  with check (account_id is not null and public.account_can_write(account_id));

drop policy if exists "pcns_delete_account" on public.pcns;
create policy "pcns_delete_account" on public.pcns
  for delete using (account_id is not null and public.account_can_write(account_id));

-- Note: INSERT keeps the existing user_id policies — each user inserts their
-- own rows (user_id = auth.uid()) tagged with the shared account_id, which is
-- sufficient and non-breaking. Role-based write limits for viewers are also
-- enforced in the app for this first version.
