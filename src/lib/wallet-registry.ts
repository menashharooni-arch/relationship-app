import crypto from "node:crypto";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { passContentHash, passInputs } from "@/lib/wallet-pass";

// ── The PassKit web service's state ─────────────────────────────────────────
//
// A .pkpass never restyles in place. Redesign the pass and every wallet that
// already holds one keeps the old picture forever — the only way in is to tell
// the device to come back for a new copy. Apple's protocol for that:
//
//   1. The pass carries a webServiceURL and an authenticationToken.
//   2. On add, the device POSTs its APNs push token here (a registration).
//   3. When the pass changes, we push, empty payload, topic = pass type id.
//   4. The device asks which serials changed, then re-downloads each one.
//
// This module owns steps 1–3's storage and the "has it changed" decision.

/**
 * The pass's authenticationToken, derived rather than stored.
 *
 * An HMAC of the serial means the token is stable across every rebuild of the
 * pass without a row to keep in sync — and a pass minted a year ago still
 * authenticates. Storing a random token per pass would need a write on the
 * download path and a migration for every pass already in the wild.
 *
 * The secret prefers its own env var and falls back to the pass signing key,
 * which is already required for any pass to exist at all. That keeps this
 * working with no new configuration; the trade is that rotating the signing
 * certificate invalidates existing tokens, so those passes stop updating until
 * re-added. Set WALLET_AUTH_SECRET to decouple the two.
 */
function authSecret(): string | null {
  return process.env.WALLET_AUTH_SECRET || process.env.APPLE_PASS_KEY_PEM || null;
}

export function passAuthToken(serial: string): string | null {
  const secret = authSecret();
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(`wallet-pass:${serial}`).digest("hex");
}

/**
 * Constant-time check of the `Authorization: ApplePass <token>` header.
 *
 * timingSafeEqual throws on a length mismatch, so the lengths are compared
 * first — and both sides are hex digests of a fixed length, so that comparison
 * leaks nothing an attacker doesn't already know.
 */
export function verifyPassAuth(header: string | null, serial: string): boolean {
  const expected = passAuthToken(serial);
  if (!expected || !header) return false;
  const m = /^ApplePass\s+(.+)$/i.exec(header.trim());
  if (!m) return false;
  const got = Buffer.from(m[1].trim());
  const want = Buffer.from(expected);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// ── Registrations ───────────────────────────────────────────────────────────

/** 201 when this is a new registration, 200 when the device already had one. */
export async function registerDevice(
  deviceLibraryId: string, serial: string, pushToken: string,
): Promise<"created" | "existing"> {
  const admin = getAdminSupabase();
  const { data: existing } = await admin
    .from("wallet_registrations")
    .select("push_token")
    .eq("device_library_id", deviceLibraryId)
    .eq("serial", serial)
    .maybeSingle();

  // Upsert either way: a device that re-registers usually does so BECAUSE its
  // push token was reissued, and keeping the old one would silently strand the
  // pass. Apple still wants 200 rather than 201 in that case.
  await admin
    .from("wallet_registrations")
    .upsert(
      { device_library_id: deviceLibraryId, serial, push_token: pushToken },
      { onConflict: "device_library_id,serial" },
    );

  return existing ? "existing" : "created";
}

export async function unregisterDevice(deviceLibraryId: string, serial: string): Promise<void> {
  await getAdminSupabase()
    .from("wallet_registrations")
    .delete()
    .eq("device_library_id", deviceLibraryId)
    .eq("serial", serial);
}

/**
 * The serials this device holds, optionally only those changed since a tag.
 *
 * `passesUpdatedSince` is opaque to Apple — it hands back whatever we last
 * gave it. Epoch milliseconds as a string keeps the comparison a plain number
 * and the tag human-readable in a log.
 */
export async function serialsForDevice(
  deviceLibraryId: string, passesUpdatedSince: string | null,
): Promise<{ serialNumbers: string[]; lastUpdated: string }> {
  const admin = getAdminSupabase();
  const { data: regs } = await admin
    .from("wallet_registrations")
    .select("serial")
    .eq("device_library_id", deviceLibraryId);

  const serials = (regs ?? []).map((r) => r.serial as string);
  if (!serials.length) return { serialNumbers: [], lastUpdated: String(Date.now()) };

  const { data: passes } = await admin
    .from("wallet_passes")
    .select("serial, updated_at")
    .in("serial", serials);

  const since = Number(passesUpdatedSince);
  let newest = 0;
  const changed: string[] = [];
  for (const p of passes ?? []) {
    const at = new Date(p.updated_at as string).getTime();
    if (Number.isFinite(at)) newest = Math.max(newest, at);
    if (!Number.isFinite(since) || at > since) changed.push(p.serial as string);
  }

  // A pass with no row has never been fingerprinted — treat it as changed so
  // the device gets a current copy rather than being stuck on whatever it has.
  const known = new Set((passes ?? []).map((p) => p.serial as string));
  for (const s of serials) if (!known.has(s)) changed.push(s);

  return { serialNumbers: changed, lastUpdated: String(newest || Date.now()) };
}

// ── Change detection ────────────────────────────────────────────────────────

/** When this pass last actually changed — the Last-Modified the device sees. */
export async function passUpdatedAt(serial: string): Promise<Date | null> {
  const { data } = await getAdminSupabase()
    .from("wallet_passes")
    .select("updated_at")
    .eq("serial", serial)
    .maybeSingle();
  return data ? new Date(data.updated_at as string) : null;
}

export type TouchResult = "unchanged" | "updated" | "created" | "gone";

/**
 * Re-fingerprint one pass and, if it moved, wake every device holding it.
 *
 * Safe to call on any card at any time: when nothing about the pass changed it
 * writes nothing and pushes nothing, which is what makes it usable both as a
 * hot hook on card edits and as a periodic sweep over everything.
 */
export async function touchWalletPass(username: string): Promise<TouchResult> {
  const admin = getAdminSupabase();
  const inputs = await passInputs(username);
  if (!inputs) return "gone";

  const hash = passContentHash(inputs);
  const { data: row } = await admin
    .from("wallet_passes")
    .select("content_hash")
    .eq("serial", username)
    .maybeSingle();

  if (row && row.content_hash === hash) return "unchanged";

  await admin
    .from("wallet_passes")
    .upsert({ serial: username, content_hash: hash, updated_at: new Date().toISOString() }, { onConflict: "serial" });

  // First fingerprint: nothing has been told anything yet, so there is no
  // change to announce. Pushing here would wake every device on the day this
  // ships for a pass that didn't change.
  if (!row) return "created";

  await pushToDevices(username);
  return "updated";
}

/** Wake every device registered for this serial. */
export async function pushToDevices(serial: string): Promise<number> {
  const admin = getAdminSupabase();
  const { data: regs } = await admin
    .from("wallet_registrations")
    .select("device_library_id, push_token")
    .eq("serial", serial);
  if (!regs?.length) return 0;

  const { sendWalletPassPush } = await import("@/lib/apns");
  let sent = 0;
  for (const r of regs) {
    const res = await sendWalletPassPush(r.push_token as string);
    if (res === "sent") sent++;
    // A dead token means the pass is gone from that device — Apple never calls
    // the unregister endpoint when a user simply deletes a pass, so this is the
    // only signal we get and the row would otherwise accumulate forever.
    if (res === "gone") {
      await admin
        .from("wallet_registrations")
        .delete()
        .eq("device_library_id", r.device_library_id as string)
        .eq("serial", serial);
    }
  }
  return sent;
}
