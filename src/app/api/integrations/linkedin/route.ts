import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { decryptToken } from "@/lib/token-crypto";
import { fetchLinkedInProfile, isLinkedInEnabled } from "@/lib/sync-linkedin";

export const runtime = "nodejs";

// GET /api/integrations/linkedin → the CONNECTED user's importable profile photo.
// This is the approval step: we return the photo URL (clearly LinkedIn-sourced)
// so the UI can preview it and let the user CHOOSE to apply it. Applying, manual
// upload, and removal all remain the user's action — nothing is auto-applied.
export async function GET() {
  if (!isLinkedInEnabled()) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: row } = await admin
    .from("integrations")
    .select("access_token")
    .eq("user_id", user.id)
    .eq("provider", "linkedin")
    .maybeSingle();

  if (!row?.access_token) return NextResponse.json({ connected: false });

  let token: string;
  try {
    token = decryptToken(row.access_token as string);
  } catch {
    return NextResponse.json({ connected: true, photo: null, error: "token_unreadable" });
  }

  const profile = await fetchLinkedInProfile(token);
  if (!profile) {
    // Token likely revoked or the member has no accessible photo — record it so
    // the card can prompt a reconnect, mirroring the Google/HubSpot sync_error UX.
    await admin.from("integrations")
      .update({ sync_error: "LinkedIn access expired or was revoked — reconnect to import your photo." })
      .eq("user_id", user.id).eq("provider", "linkedin");
    return NextResponse.json({ connected: true, photo: null, error: "revoked_or_no_photo" });
  }

  return NextResponse.json({
    connected: true,
    photo: profile.picture ?? null, // clearly labelled LinkedIn-sourced in the UI
    name: profile.name ?? null,
    source: "linkedin",
  });
}

// DELETE /api/integrations/linkedin → disconnect (revoke our stored tokens).
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  await admin.from("integrations").delete().eq("user_id", user.id).eq("provider", "linkedin");

  return NextResponse.json({ ok: true });
}
