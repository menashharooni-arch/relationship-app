import type { SupabaseClient } from "@supabase/supabase-js";

// ── The first name billing mail greets someone by ───────────────────────────
//
// profiles.name is blank for every account made through normal signup: the
// name is typed into the card builder, not the signup form. Greeting from the
// profile made a new Pro customer's receipt read "Thank you, there." and their
// trial notice "Hi there". So the card comes first — the oldest card, the same
// rule the welcome email uses (lib/welcome-email) — and the profile is only
// the fallback for an account with no card.
//
// Returns "" when nothing is known, so each template decides how to greet
// nobody in particular rather than inheriting a fake name.
export async function greetingFirstName(
  admin: SupabaseClient,
  userId: string,
  profileName?: string | null,
): Promise<string> {
  let cardName = "";
  try {
    const { data: card } = await admin
      .from("cards")
      .select("name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    cardName = ((card?.name as string | null) ?? "").trim();
  } catch { /* fall back to the profile */ }
  const name = cardName || (profileName ?? "").trim();
  return name ? name.split(/\s+/)[0] : "";
}
