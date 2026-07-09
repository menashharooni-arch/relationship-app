import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// Card-content columns that exist on BOTH the profiles row (the primary card) and
// the cards table. Account-level columns (plan, flow_settings, billing, etc.) are
// intentionally excluded so they never move. The username travels with the content,
// which keeps captured leads and analytics (keyed on username) correctly associated.
const SWAP_FIELDS = [
  "username", "name", "title", "company", "phone", "email", "website",
  "linkedin", "instagram", "twitter", "tiktok", "template", "customization", "logo_url",
];

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const cols = SWAP_FIELDS.join(", ");

  const [{ data: profileRow }, { data: cardRow }] = await Promise.all([
    admin.from("profiles").select(cols).eq("id", user.id).single(),
    admin.from("cards").select(cols).eq("id", id).eq("user_id", user.id).single(),
  ]);

  if (!profileRow || !cardRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profile = profileRow as unknown as Record<string, unknown>;
  const card = cardRow as unknown as Record<string, unknown>;

  const profileUpdate: Record<string, unknown> = {};
  const cardUpdate: Record<string, unknown> = {};
  for (const f of SWAP_FIELDS) {
    profileUpdate[f] = card[f];
    cardUpdate[f] = profile[f];
  }

  // Free the card's username first so the profile can take it without colliding.
  const tempUsername = `__swap_${id}`;
  const { error: e1 } = await admin.from("cards").update({ username: tempUsername }).eq("id", id).eq("user_id", user.id);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // Profile takes the chosen card's content (including its username) → becomes primary.
  const { error: e2 } = await admin.from("profiles").update(profileUpdate).eq("id", user.id);
  if (e2) {
    // Best-effort restore of the original username so we don't leave the card stranded.
    await admin.from("cards").update({ username: card.username }).eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  // Card takes the old primary content (including the old primary username).
  const { error: e3 } = await admin.from("cards").update(cardUpdate).eq("id", id).eq("user_id", user.id);
  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

  return NextResponse.json({ ok: true, username: profileUpdate.username });
}
