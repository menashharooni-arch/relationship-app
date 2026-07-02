import { getAdminSupabase } from "@/lib/supabase-admin";
import { sendPushToUser } from "@/lib/push";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// View-count achievements — game-like nudges that pull owners back into the
// app as their card gains traction. Fired from the view-tracking API.
const MILESTONES: Record<number, { title: string; body: string }> = {
  5:     { title: "🎉 First 5 views!", body: "People are checking out your card. Share it once more to keep the momentum." },
  10:    { title: "🔟 10 views — you're getting noticed!", body: "Double digits! Add your card to your email signature to keep it climbing." },
  25:    { title: "🚀 25 views and climbing!", body: "Your card is doing the networking for you. Next stop: 50." },
  50:    { title: "🔥 50 views — on fire!", body: "Fifty people have seen your card. Keep sharing!" },
  100:   { title: "💯 100 views!", body: "Triple digits — your card is officially working the room." },
  250:   { title: "⭐ 250 views!", body: "You're building serious reach. 500 is in sight." },
  500:   { title: "🏆 500 views!", body: "Most cards never see this. Yours just did." },
  1000:  { title: "👑 1,000 views!", body: "Four digits. Your card is a networking machine." },
  2500:  { title: "🌟 2,500 views!", body: "Legendary reach — your network sees you everywhere." },
  5000:  { title: "🚀 5,000 views!", body: "Halfway to five figures. Unstoppable." },
  10000: { title: "🎇 10,000 views!", body: "Ten. Thousand. Views. Take a bow." },
};

// Called after each recorded view. Counts the card's combined SwiftCard +
// Swift Links views; when the total lands exactly on a milestone, notifies the
// owner (in-app + push). The notifications table doubles as the dedupe ledger
// so a burst of simultaneous views can't fire the same milestone twice.
export async function checkViewMilestone(rawUsername: string): Promise<void> {
  try {
    const base = rawUsername.replace(/__links$/, "");
    if (!base) return;

    const admin = getAdminSupabase();
    const { count } = await admin
      .from("card_views")
      .select("*", { count: "exact", head: true })
      .in("username", [base, `${base}__links`]);

    const m = MILESTONES[count ?? 0];
    if (!m) return;

    // Resolve the card owner: cards table first, legacy profile slug second.
    const { data: card } = await admin.from("cards").select("user_id").eq("username", base).maybeSingle();
    let ownerId = card?.user_id as string | undefined;
    if (!ownerId) {
      const { data: prof } = await admin.from("profiles").select("id").eq("username", base).maybeSingle();
      ownerId = prof?.id as string | undefined;
    }
    if (!ownerId) return;

    // Dedupe: one notification per milestone per card, ever.
    const type = `milestone_${count}`;
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("card_owner", base)
      .eq("type", type)
      .limit(1);
    if (existing?.length) return;

    await admin.from("notifications").insert({
      user_id: ownerId,
      card_owner: base,
      type,
      title: m.title,
      body: `${m.body} (/${base})`,
    });

    await sendPushToUser(ownerId, {
      title: m.title,
      body: m.body,
      url: `${APP_URL}/dashboard?card=${encodeURIComponent(base)}`,
      tag: `milestone-${base}-${count}`,
    }).catch(() => {});
  } catch {
    /* achievements are best-effort — never block view tracking */
  }
}
