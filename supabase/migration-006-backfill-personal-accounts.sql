-- =============================================================
-- AI PCN Checker — migration 006  (Feature B · phase 2 · BACKFILL)
-- Give every EXISTING user a personal account and link their current
-- vehicles + pcns to it. Idempotent and safe to re-run:
--   * only creates accounts for users who don't already have one
--   * only sets account_id where it is currently NULL
--   * never touches user_id, so the app keeps working either way
--
-- Run migration-005 FIRST. Review the before-counts, then run this.
-- Runs as the Supabase SQL Editor (postgres), so it bypasses RLS.
-- =============================================================

-- ---------- BEFORE: how much will this affect? (optional pre-check) ----------
-- select
--   (select count(*) from auth.users)                               as users,
--   (select count(*) from public.account_users)                     as memberships,
--   (select count(*) from public.vehicles where account_id is null) as vehicles_unassigned,
--   (select count(*) from public.pcns     where account_id is null) as pcns_unassigned;

-- ---------- Backfill ----------
do $$
declare
  r   record;
  acc uuid;
begin
  for r in
    select u.id as user_id, coalesce(nullif(u.email, ''), 'My account') as name
    from auth.users u
    left join public.account_users au on au.user_id = u.id
    where au.user_id is null            -- only users without any account
  loop
    insert into public.accounts (type, name) values ('personal', r.name)
      returning id into acc;

    insert into public.account_users (account_id, user_id, role)
      values (acc, r.user_id, 'owner');

    update public.vehicles set account_id = acc
      where user_id = r.user_id and account_id is null;

    update public.pcns set account_id = acc
      where user_id = r.user_id and account_id is null;
  end loop;
end $$;

-- ---------- AFTER: verify (this is the result the editor shows) ----------
-- Both *_unassigned should now be 0.
select
  (select count(*) from public.accounts)                          as accounts,
  (select count(*) from public.account_users)                     as memberships,
  (select count(*) from public.vehicles where account_id is null) as vehicles_unassigned,
  (select count(*) from public.pcns     where account_id is null) as pcns_unassigned;

-- =============================================================
-- ROLLBACK (only if needed) — reverts the data linkage non-destructively.
-- Removing the auto-created account rows is optional and left manual.
--   update public.vehicles set account_id = null;
--   update public.pcns     set account_id = null;
-- =============================================================
