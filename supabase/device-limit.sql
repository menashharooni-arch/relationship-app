-- Two devices per account.
--
-- A "device" is one browser profile or one app install, identified by the
-- long-lived `sc_device` cookie the proxy plants. Every tab and window of the
-- same browser shares that cookie, so opening five tabs costs one slot, not
-- five. Two different browser APPS on the same computer (Chrome and Safari)
-- keep separate cookie jars and therefore count as two devices — no cookie can
-- see across that boundary, and the only thing that could is fingerprinting,
-- which this deliberately does not do.
--
-- Rows are the source of truth for the limit. The proxy reads them on a cached
-- path and fails OPEN on any error: a database blip must never lock somebody
-- out of their own account (see the 2026-08-27 brownout).
--
-- RLS: a user may only ever see and delete their OWN devices. There is no
-- update policy — last_seen is moved by the upsert below, which runs as the
-- same user and is covered by insert+select.

create table if not exists public.user_devices (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  device_id   text        not null,
  label       text,                                   -- "iPhone · Safari", shown in Settings
  user_agent  text,
  is_native   boolean     not null default false,      -- the iOS shell, not a browser
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  primary key (user_id, device_id)
);

alter table public.user_devices enable row level security;

-- Oldest-first is how a slot is freed and how the list is shown.
create index if not exists user_devices_user_last_seen_idx
  on public.user_devices (user_id, last_seen desc);

drop policy if exists "own devices readable" on public.user_devices;
create policy "own devices readable" on public.user_devices
  for select using (auth.uid() = user_id);

drop policy if exists "own devices insertable" on public.user_devices;
create policy "own devices insertable" on public.user_devices
  for insert with check (auth.uid() = user_id);

-- last_seen is refreshed on every cache miss; without this the upsert's
-- ON CONFLICT ... DO UPDATE is rejected by RLS.
drop policy if exists "own devices updatable" on public.user_devices;
create policy "own devices updatable" on public.user_devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own devices deletable" on public.user_devices;
create policy "own devices deletable" on public.user_devices
  for delete using (auth.uid() = user_id);

-- ── Claiming a slot, atomically ─────────────────────────────────────────────
--
-- Doing this as SELECT-count-then-INSERT from the app races with itself: two
-- devices signing in at the same moment both read "1 device" and both insert,
-- leaving three. Postgres has to decide, not the application, so the whole
-- thing is one statement inside one function.
--
-- Returns TRUE when this device holds a slot (it already did, or it just took
-- a free one) and FALSE when the account is full and this device is not one of
-- the two. Never throws for the ordinary "full" case — the caller needs to tell
-- "denied" apart from "database is down", and an exception would blur them.
create or replace function public.claim_device_slot(
  p_device_id  text,
  p_label      text default null,
  p_user_agent text default null,
  p_is_native  boolean default false,
  p_limit      int default 2
)
returns boolean
language plpgsql
security invoker              -- runs as the caller, so RLS still applies
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_known boolean;
  v_count int;
begin
  if v_user is null or p_device_id is null or length(p_device_id) = 0 then
    return false;
  end if;

  -- Lock this user's rows for the rest of the transaction so a simultaneous
  -- sign-in on another device cannot read a stale count.
  perform 1 from public.user_devices where user_id = v_user for update;

  select exists (
    select 1 from public.user_devices
    where user_id = v_user and device_id = p_device_id
  ) into v_known;

  if v_known then
    update public.user_devices
       set last_seen  = now(),
           label      = coalesce(p_label, label),
           user_agent = coalesce(p_user_agent, user_agent),
           is_native  = p_is_native
     where user_id = v_user and device_id = p_device_id;
    return true;
  end if;

  select count(*) into v_count from public.user_devices where user_id = v_user;
  if v_count >= p_limit then
    return false;
  end if;

  insert into public.user_devices (user_id, device_id, label, user_agent, is_native)
  values (v_user, p_device_id, p_label, p_user_agent, p_is_native)
  on conflict (user_id, device_id) do update
    set last_seen = now();
  return true;
end;
$$;

revoke all on function public.claim_device_slot(text, text, text, boolean, int) from public;
grant execute on function public.claim_device_slot(text, text, text, boolean, int) to authenticated;
