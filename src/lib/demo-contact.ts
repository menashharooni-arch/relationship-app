import { getAdminSupabase } from "@/lib/supabase-admin";

// A realistic sample contact seeded onto a brand-new account's FIRST card, so the
// dashboard/contacts page is never empty and the guided tour has a real contact
// to walk through (info, notes, and the follow-up automations). Tagged "demo" so
// the tour can find it and the user can tell it's a sample they can delete.
export async function seedDemoContact(cardOwner: string): Promise<void> {
  try {
    const admin = getAdminSupabase();
    await admin.from("leads").insert({
      name: "Jordan Rivera",
      phone: "(415) 555-0148",
      email: "jordan.rivera@example.com",
      company: "Rivera Design Co.",
      location: "Austin, TX",
      where_met: "Austin Founders Mixer",
      notes:
        "👋 Sample contact — feel free to delete anytime. Interested in a Q3 rebrand and comparing a couple of vendors. Prefers email; best reached weekday mornings.",
      message: "Great meeting you — would love to see some of your recent work!",
      status: "new_contact",
      source: "qr_code",
      tags: ["demo", "unread"],
      card_owner: cardOwner,
    });
  } catch {
    // Best-effort — a seeding failure must never block card creation.
  }
}
