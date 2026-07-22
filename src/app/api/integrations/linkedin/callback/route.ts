import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { encryptToken } from "@/lib/token-crypto";
import { verifyState } from "@/lib/oauth-state";
import { exchangeLinkedInCode, fetchLinkedInProfile, GUEST_STATE, isLinkedInEnabled } from "@/lib/sync-linkedin";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function GET(request: NextRequest) {
  // Return the user to where they started the connect (set by /connect?next=…,
  // same-origin paths only) — default is Settings. Clear the cookie either way.
  const returnRaw = request.cookies.get("li_return_to")?.value ?? "";
  const returnTo = returnRaw.startsWith("/") && !returnRaw.startsWith("//") ? returnRaw : "/settings/flows";
  const DONE = (status: string) => {
    const url = new URL(returnTo, APP_URL);
    url.searchParams.set("integration", "linkedin");
    url.searchParams.set("status", status);
    const res = NextResponse.redirect(url.toString());
    res.cookies.set("li_return_to", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (!isLinkedInEnabled()) return DONE("error");

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // The user declined consent (or LinkedIn returned an error) — not a failure
  // on our side, just send them back cleanly.
  if (error || !code || !state) return DONE("error");

  // Reject a forged/unsigned state (arbitrary user_id) so tokens can't be
  // written onto another user's row.
  const userId = verifyState(state);
  if (!userId) return DONE("error");

  const tokens = await exchangeLinkedInCode(code);
  if (!tokens?.access_token) return DONE("error");

  // ── Guest one-shot photo import ────────────────────────────────────────────
  // A signed-out visitor on the free-card builder: there is no account row to
  // store tokens on, so nothing is persisted — we use the access token once,
  // right here, to read the consented userinfo photo, copy it into our storage
  // (LinkedIn CDN URLs expire), and hand the durable URL back to the builder
  // via ?li_photo=. The token is then simply dropped.
  if (userId === GUEST_STATE) {
    const profile = await fetchLinkedInProfile(tokens.access_token);
    if (!profile?.picture) return DONE("nophoto");
    try {
      // Same download/cap/re-encode pipeline as every other photo import.
      const imgRes = await fetch(profile.picture, { redirect: "follow", signal: AbortSignal.timeout(8000) });
      if (!imgRes.ok) throw new Error(`source ${imgRes.status}`);
      const ct = imgRes.headers.get("content-type") ?? "";
      if (!ct.startsWith("image/")) throw new Error("not an image");
      const bytes = Buffer.from(await imgRes.arrayBuffer());
      if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("too large");
      const sharp = (await import("sharp")).default;
      const body = await sharp(bytes).rotate().resize(1000, 1000, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();

      const admin = getAdminSupabase();
      const path = `guest-linkedin/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await admin.storage
        .from("card-uploads")
        .upload(path, body, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = admin.storage.from("card-uploads").getPublicUrl(path);

      // The photo rides back as a query param the builder reads and applies to
      // the draft (mirrors DONE, plus li_photo).
      const url = new URL(returnTo, APP_URL);
      url.searchParams.set("integration", "linkedin");
      url.searchParams.set("status", "photo");
      url.searchParams.set("li_photo", publicUrl);
      const res = NextResponse.redirect(url.toString());
      res.cookies.set("li_return_to", "", { maxAge: 0, path: "/" });
      return res;
    } catch (e) {
      console.error("[linkedin/callback] guest photo import failed:", e);
      return DONE("error");
    }
  }

  try {
    const admin = getAdminSupabase();
    const { error: dbErr } = await admin.from("integrations").upsert({
      user_id: userId,
      provider: "linkedin",
      access_token: encryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expires_at: Date.now() + (tokens.expires_in ?? 0) * 1000,
      updated_at: new Date().toISOString(),
      sync_error: null, // upsert only touches listed columns — clear on reconnect
    }, { onConflict: "user_id,provider" });
    if (dbErr) throw dbErr;
  } catch (e) {
    console.error("[linkedin/callback] save failed:", e);
    return DONE("error");
  }

  // Connected. The user still explicitly APPROVES importing the photo from the
  // LinkedIn card in Settings — we never auto-apply it here.
  return DONE("connected");
}
