import { getAdminSupabase } from "@/lib/supabase-admin";
import { sendPushToUser } from "@/lib/push";
import { SEEDED_VISITOR_PREFIX } from "@/lib/seeded-views";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// View-count achievements — game-like nudges that pull owners back into the
// app as their card gains traction. Fired from the view-tracking API.
const MILESTONES: Record<number, { title: string; body: string }> = {
  5:     { title: "First 5 views!", body: "People are checking out your card. Share it once more to keep the momentum." },
  10:    { title: "10 views — you're getting noticed!", body: "Double digits! Add your card to your email signature to keep it climbing." },
  25:    { title: "25 views and climbing!", body: "Your card is doing the networking for you. Next stop: 50." },
  50:    { title: "50 views — on fire!", body: "Fifty people have seen your card. Keep sharing!" },
  100:   { title: "100 views!", body: "Triple digits — your card is officially working the room." },
  250:   { title: "250 views!", body: "You're building serious reach. 500 is in sight." },
  500:   { title: "500 views!", body: "Most cards never see this. Yours just did." },
  1000:  { title: "1,000 views!", body: "Four digits. Your card is a networking machine." },
  2500:  { title: "2,500 views!", body: "Legendary reach — your network sees you everywhere." },
  5000:  { title: "5,000 views!", body: "Halfway to five figures. Unstoppable." },
  10000: { title: "10,000 views!", body: "Ten. Thousand. Views. Take a bow." },
};

// Milestones from largest to smallest — the reached-but-unannounced scan
// below wants the highest one first.
const MILESTONE_COUNTS = Object.keys(MILESTONES).map(Number).sort((a, b) => b - a);

// Called after each recorded view. Counts the card's combined SwiftCard +
// Swift Links views; when the total has REACHED a milestone that was never
// announced, notifies the owner (in-app + push). Reached, not "lands exactly
// on": two views committing near-simultaneously can jump the count straight
// over a milestone (4 → 6), and an exact-match check skipped it forever.
// The notifications table doubles as the dedupe ledger so a burst of
// simultaneous views can't fire the same milestone twice.
export async function checkViewMilestone(rawUsername: string): Promise<void> {
  try {
    const base = rawUsername.replace(/__links$/, "");
    if (!base) return;

    const admin = getAdminSupabase();
    // Seeded demo rows (App Review account) are not real traffic and must not
    // gamify anything. The or() keeps NULL visitor_id rows counted — a bare
    // not-like filter would silently drop them (NULL LIKE is NULL).
    const { count } = await admin
      .from("card_views")
      .select("*", { count: "exact", head: true })
      .in("username", [base, `${base}__links`])
      .or(`visitor_id.is.null,visitor_id.not.like.${SEEDED_VISITOR_PREFIX}%`);

    const reached = MILESTONE_COUNTS.find((c) => (count ?? 0) >= c);
    if (!reached) return;
    const m = MILESTONES[reached];

    // Resolve the card owner: cards table first, legacy profile slug second.
    const { data: card } = await admin.from("cards").select("user_id").eq("username", base).maybeSingle();
    let ownerId = card?.user_id as string | undefined;
    if (!ownerId) {
      const { data: prof } = await admin.from("profiles").select("id").eq("username", base).maybeSingle();
      ownerId = prof?.id as string | undefined;
    }
    if (!ownerId) return;

    // Dedupe: one notification per milestone per card, ever. If the card_owner
    // column isn't migrated yet (42703), dedupe per-user instead.
    const type = `milestone_${reached}`;
    const scoped = await admin.from("notifications").select("id").eq("card_owner", base).eq("type", type).limit(1);
    if (scoped.error) {
      const { data: byUser } = await admin.from("notifications").select("id").eq("user_id", ownerId).eq("type", type).limit(1);
      if (byUser?.length) return;
    } else if (scoped.data?.length) {
      return;
    }

    const { insertNotification } = await import("@/lib/notify");
    // The SELECT above is a check-then-insert: two views straddling a milestone
    // can both pass it. The notifications_milestone_once_idx unique index is the
    // real ledger — whoever loses that race gets no row back here and must NOT
    // go on to send a push for a notification it didn't create.
    const created = await insertNotification({
      user_id: ownerId,
      card_owner: base,
      type,
      title: m.title,
      body: `${m.body} (/${base})`,
    });
    if (!created) return;

    await sendPushToUser(ownerId, {
      title: m.title,
      body: m.body,
      url: `${APP_URL}/dashboard?card=${encodeURIComponent(base)}`,
      tag: `milestone-${base}-${reached}`,
    }).catch(() => {});
  } catch {
    /* achievements are best-effort — never block view tracking */
  }
}
