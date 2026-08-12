-- Apple Wallet pass updates (PassKit web service).
--
-- A .pkpass never restyles in place: a design change only reaches a wallet if
-- the device is TOLD to re-download. Apple's mechanism for that is a web
-- service the pass points at (webServiceURL), devices registering themselves
-- against it, and a silent APNs push per registered device that makes iOS come
-- back for the current pass. These two tables are the state that requires.
--
-- Service-role only: RLS on with NO policies, and grants revoked from
-- anon/authenticated. Every reader is a server route holding the service key —
-- push tokens are device secrets and must never be reachable from a browser.

-- One row per pass we have ever served, holding the fingerprint of what that
-- pass last contained. `updated_at` is the value returned as Last-Modified and
-- compared against the device's If-Modified-Since, so it must only move when
-- the pass's CONTENT actually changes — bumping it on every request would make
-- every device re-download every pass, forever.
create table if not exists public.wallet_passes (
  serial text primary key,
  content_hash text not null,
  updated_at timestamptz not null default now()
);

-- One row per (device, pass). A device registers each pass separately and can
-- hold many; a pass can be in many wallets. The push token belongs to the
-- device+pass-type pair and is what APNs is addressed with.
--
-- No FK to wallet_passes: Apple can register a device for a serial in the same
-- breath as we first mint its row, and an ordering hiccup must not cost a
-- registration — a registration for an unknown serial is harmless (the sweep
-- simply finds nothing to push), whereas a lost one silently strands a pass.
create table if not exists public.wallet_registrations (
  device_library_id text not null,
  serial text not null,
  push_token text not null,
  created_at timestamptz not null default now(),
  primary key (device_library_id, serial)
);

-- The sweep's access path: "every device holding this pass".
create index if not exists wallet_registrations_serial_idx
  on public.wallet_registrations (serial);

alter table public.wallet_passes enable row level security;
alter table public.wallet_registrations enable row level security;
revoke all on public.wallet_passes from anon, authenticated;
revoke all on public.wallet_registrations from anon, authenticated;
