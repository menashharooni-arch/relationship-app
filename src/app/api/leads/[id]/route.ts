import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { mergeClientTags } from "@/lib/lead-tags";

async function getOwnerUsernames(userId: string): Promise<string[]> {
  const admin = getAdminSupabase();
  const [{ data: profile }, { data: cards }] = await Promise.all([
    admin.from("profiles").select("username").eq("id", userId).single(),
    admin.from("cards").select("username").eq("user_id", userId),
  ]);
  return [
    profile?.username ?? "__none__",
    ...(cards ?? []).map((c: { username: string }) => c.username),
  ];
}

const ALLOWED_PATCH_FIELDS = new Set([
  "status", "notes", "tags", "follow_up_date", "name", "email", "phone", "company", "message",
  "where_met", "convo_details", "company_description", "follow_up_sequence",
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await req.json();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only allow updates to specific fields
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (ALLOWED_PATCH_FIELDS.has(key)) body[key] = raw[key];
  }
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const usernames = await getOwnerUsernames(user.id);
  const admin = getAdminSupabase();

  // `tags` is server-owned in part: reserved tags drive org visibility
  // (sc-office-*), the Free paywall (sc-locked), and automation state (flow-*,
  // *-paused, preset-*). Never let the client set/clear those — read the row's
  // current tags (ownership-scoped) and preserve the reserved ones, honoring
  // only the client's non-reserved tags. Without this a user could plant a lead
  // in another org or unlock a paywalled lead. See lib/lead-tags.ts.
  if ("tags" in body) {
    const { data: cur } = await admin
      .from("leads")
      .select("tags")
      .eq("id", id)
      .in("card_owner", usernames)
      .maybeSingle();
    const clientTags = (Array.isArray(body.tags) ? body.tags : []).filter(
      (t): t is string => typeof t === "string"
    );
    body.tags = mergeClientTags(body.tags, cur?.tags as string[] | null);
    // The two channel-pause tags are the dashboard's own Email/Text automation
    // toggles — owner-facing controls, unlike the rest of the reserved set
    // (sc-office-*, sc-locked, flow-*, preset-*), which stays server-owned.
    // mergeClientTags preserves reserved tags verbatim, which silently froze
    // these toggles in BOTH directions (flipping them never changed the row) —
    // and once lead capture began recording a declined SMS consent as
    // sms-paused, a frozen toggle meant no owner could ever re-enable texts at
    // a contact's request. This caller is authenticated and every read/write is
    // ownership-scoped, so honoring the client's state for exactly these two
    // tags is safe.
    const CHANNEL_PAUSE_TAGS = ["email-paused", "sms-paused"] as const;
    let reconciled = body.tags as string[];
    for (const t of CHANNEL_PAUSE_TAGS) {
      reconciled = clientTags.includes(t)
        ? Array.from(new Set([...reconciled, t]))
        : reconciled.filter((x) => x !== t);
    }
    // Affirmative SMS consent (sms-ok) is set ONLY by an EXPLICIT owner signal:
    // the Text-automation toggle sends `sms_consent` (the owner asserting they
    // have permission to text this contact). sms-ok is server-owned, so this is
    // the only post-capture way it changes — an unrelated tag edit (adding a
    // label) never fabricates or revokes consent. The cron requires sms-ok to
    // send any automated text.
    const rawSmsConsent = typeof raw.sms_consent === "boolean" ? raw.sms_consent : undefined;
    if (rawSmsConsent === true) {
      reconciled = Array.from(new Set([...reconciled.filter((x) => x !== "sms-paused"), "sms-ok"]));
    } else if (rawSmsConsent === false) {
      reconciled = Array.from(new Set([...reconciled.filter((x) => x !== "sms-ok"), "sms-paused"]));
    }
    body.tags = reconciled;
  }

  const { error } = await admin
    .from("leads")
    .update(body)
    .eq("id", id)
    .in("card_owner", usernames);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If dissolving, clear automation tags and follow_up_sequence. Both the read
  // and the write are scoped to the caller's own cards (`.in("card_owner", ...)`)
  // — an unscoped update returns error:null even on a zero-row match, so without
  // this filter a user could POST another user's lead id and wipe THEIR
  // automation. Ownership must be re-checked here, not assumed from the update above.
  if (body.status === "dissolved") {
    const { data: lead } = await admin
      .from("leads")
      .select("tags")
      .eq("id", id)
      .in("card_owner", usernames)
      .maybeSingle();
    if (lead?.tags) {
      const cleanTags = (lead.tags as string[]).filter(
        (t: string) => !t.startsWith("preset-") && t !== "flow-paused"
      );
      await admin
        .from("leads")
        .update({ tags: cleanTags, follow_up_sequence: [] })
        .eq("id", id)
        .in("card_owner", usernames);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const usernames = await getOwnerUsernames(user.id);
  const admin = getAdminSupabase();

  const { error } = await admin
    .from("leads")
    .delete()
    .eq("id", id)
    .in("card_owner", usernames);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
