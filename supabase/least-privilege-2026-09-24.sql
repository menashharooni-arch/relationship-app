-- NOT YET APPLIED — needs the owner's go-ahead (it changes production grants).
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Defense in depth for the browser-held keys (anon key + a user's JWT).
-- Today every table has RLS on, and the only client policies are own-row ones,
-- so nothing is exposed. But the table GRANTS to anon/authenticated are still
-- the Supabase defaults (SELECT/INSERT/UPDATE/DELETE on everything), so RLS is
-- the ONLY wall: one mistaken policy, or RLS switched off on one table, and
-- that table is readable/writable from any browser. The app itself only ever
-- touches two tables with a user session (checked 2026-09-24):
--   profiles     SELECT own row   (pages + api/profile, api/referrals/claim …)
--   user_devices SELECT, DELETE   (api/devices, settings/devices)
-- plus rpc claim_device_slot from the proxy. Everything else goes through the
-- server's service-role client, which grants do not affect.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;
grant select on public.profiles to authenticated;
grant select, delete on public.user_devices to authenticated;

-- New tables start closed to browser roles too.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Two-device limit: today the limit is a caller-supplied argument
-- (p_limit: 1000 bypasses it) and users may INSERT their own device rows
-- directly. Fixed limit inside a SECURITY DEFINER function instead, and no
-- direct writes. (tests/device-limit.test.ts pins "security invoker" and the
-- p_limit comparison; update it together with supabase/device-limit.sql.)
create or replace function public.claim_device_slot(
  p_device_id  text,
  p_label      text default null,
  p_user_agent text default null,
  p_is_native  boolean default false,
  p_limit      int default 2
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_limit constant int := 2;
  v_known boolean;
  v_count int;
begin
  if v_user is null or p_device_id is null or length(p_device_id) = 0 or length(p_device_id) > 128 then
    return false;
  end if;

  perform 1 from public.user_devices where user_id = v_user for update;

  select exists (
    select 1 from public.user_devices
    where user_id = v_user and device_id = p_device_id
  ) into v_known;

  if v_known then
    update public.user_devices
       set last_seen  = now(),
           label      = coalesce(left(p_label, 200), label),
           user_agent = coalesce(left(p_user_agent, 500), user_agent),
           is_native  = p_is_native
     where user_id = v_user and device_id = p_device_id;
    return true;
  end if;

  select count(*) into v_count from public.user_devices where user_id = v_user;
  if v_count >= v_limit then
    return false;
  end if;

  insert into public.user_devices (user_id, device_id, label, user_agent, is_native)
  values (v_user, p_device_id, left(p_label, 200), left(p_user_agent, 500), p_is_native)
  on conflict (user_id, device_id) do update
    set last_seen = now();
  return true;
end;
$$;

revoke all on function public.claim_device_slot(text, text, text, boolean, int) from public, anon;
grant execute on function public.claim_device_slot(text, text, text, boolean, int) to authenticated;

drop policy if exists "own devices insertable" on public.user_devices;
drop policy if exists "own devices updatable" on public.user_devices;
