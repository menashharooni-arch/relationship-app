import { getAdminSupabase } from "@/lib/supabase-admin";
import { SEEDED_VISITOR_PREFIX } from "@/lib/seeded-views";


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
// Swift Links views and reports the highest milestone the total has REACHED
// but never announced. Reached, not "lands exactly on": two views committing
// near-simultaneously can jump the count straight over a milestone (4 → 6), and
// an exact-match check skipped it forever.
//
// DETECTION ONLY — it no longer writes anything.
//
// It used to insert its own bell row, and that produced the double
// notification the owner reported twice. Real pair, from production
// 2026-09-09:
//
//   21:47:55  milestone_50  "50 views — on fire!"
//   21:47:56  card_viewed   "Someone viewed your Swift Links."
//
// One person, one view, two rows a second apart — because this file deduped
// only against itself while /api/card-events deduped against the visit. The
// caller now folds the milestone INTO that visit's single notification
// (visit-notify.ts), so the owner gets one row carrying both facts.
//
// The once-ever ledger moved with it, onto notifications.milestone: a column
// upgrade() sets and never clears, so a visit that crosses a milestone and then
// captures a lead cannot lose the record that the milestone was announced.
export type MilestoneNotice = {
  /** notifications.type AND the ledger value, e.g. "milestone_50". */
  type: string;
  title: string;
  /** The authored celebration line, without any card-scope suffix. */
  body: string;
  /** The number reached, so the caller can state it in its own sentence. */
  reached: number;
  /** The card slug this milestone belongs to (the "__links" suffix stripped). */
  slug: string;
};

/** The milestone this view crossed, for the caller to announce, else null. */
export async function checkViewMilestone(rawUsername: string): Promise<MilestoneNotice | null> {
  try {
    const base = rawUsername.replace(/__links$/, "");
    if (!base) return null;

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
    if (!reached) return null;
    const m = MILESTONES[reached];

    // Resolve the card owner: cards table first, legacy profile slug second.
    const { data: card } = await admin.from("cards").select("user_id").eq("username", base).maybeSingle();
    let ownerId = card?.user_id as string | undefined;
    if (!ownerId) {
      const { data: prof } = await admin.from("profiles").select("id").eq("username", base).maybeSingle();
      ownerId = prof?.id as string | undefined;
    }
    if (!ownerId) return null;

    // ── Has this milestone already been announced? ─────────────────────────
    // The ledger is notifications.milestone (supabase/milestone-one-bell.sql),
    // NOT the row's type: a visit that crosses a milestone and then captures a
    // lead has its type rewritten to new_lead, so a type-based check would
    // forget and announce the same milestone again on the next view.
    //
    // `type` is still accepted as a match so the milestones announced BEFORE
    // that column existed are not all re-announced once.
    const type = `milestone_${reached}`;
    const scoped = await admin
      .from("notifications")
      .select("id")
      .eq("card_owner", base)
      .or(`milestone.eq.${type},type.eq.${type}`)
      .limit(1);
    if (scoped.error) {
      // Column not migrated yet (or no card_owner column): fall back to the
      // pre-ledger question. Announcing twice is the failure mode here, so the
      // fallback deliberately errs toward staying quiet.
      const { data: byType } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", ownerId)
        .eq("type", type)
        .limit(1);
      if (byType?.length) return null;
    } else if (scoped.data?.length) {
      return null;
    }

    // NOTHING IS WRITTEN HERE. The check above is a read; the caller announces
    // it through notifyVisit, which folds it into the visit's one row and
    // writes the ledger atomically with it. The unique index on
    // (card_owner, milestone) is what actually closes the check-then-write
    // race — whoever loses it gets a 23505 and simply doesn't announce.
    //
    // NO PUSH, ever, on any path. A view count is a statistic — the product
    // cheering, not news to act on — and push-policy.ts deliberately has no
    // category that could carry one.
    return { type, title: m.title, body: m.body, reached, slug: base };
  } catch {
    /* achievements are best-effort — never block view tracking */
    return null;
  }
}
