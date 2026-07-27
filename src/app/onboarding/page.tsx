import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { applyReferralOnSignup, hashDevice } from "@/lib/referral-server";
import { ensureUniqueUsername } from "@/lib/username";
import { REF_COOKIE, SRC_COOKIE } from "@/lib/referral";

function accountHandle(email: string | undefined, userId: string): string {
  const base = (email?.split("@")[0] ?? "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "user";
  return `${base}-${userId.slice(0, 6)}`;
}

// Account provisioning: create an account-only profile (no card). Cards are created
// from the dashboard, where a "Create your card" empty state guides new users.
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; intent?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only honour a same-origin relative redirect (no open-redirect). Used to send
  // a brand-new signup back to the guest editor so their pending draft is claimed.
  const { next, intent } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).single();

  if (!profile) {
    // Task 4: they tried to SIGN IN (intent=signin, set by the Google button on
    // the Sign-in tab) but have no SwiftCard account yet. Don't silently create
    // one — sign them out and bounce to Create-account with a clear message. Any
    // other path (create-account, a claimed guest draft, an office-team invite,
    // an email-confirmation link) has no signin intent and provisions normally.
    if (intent === "signin") {
      try { await supabase.auth.signOut(); } catch { /* best-effort */ }
      // Preserve a same-origin continuation (e.g. a guest's card-draft claim) so
      // it survives the bounce and resumes once they create the account.
      redirect(`/login?error=no_account${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""}`);
    }

    const admin = getAdminSupabase();

    // SwiftCard is open to everyone — anyone who authenticates (email/password
    // OR Google/Apple) and has no profile yet gets one provisioned here. There is
    // NO signup invite code / invite-only gate. (The Task-4 "you don't have an
    // account" check runs earlier, in the auth callback, only for a SIGN-IN
    // attempt — a genuine Create-account flow always provisions.)
    // Card slugs and profile handles share ONE public namespace (/card/<slug>
    // resolves against both), and getOwnerUsernames treats a profile's handle as
    // an owned slug. Minting this handle without checking the cards table meant a
    // collision would silently hand the new account read/write access to another
    // user's leads for that slug. ensureUniqueUsername checks BOTH tables (and
    // suffixes on collision) — the same guard every other slug writer uses.
    const { error: insertErr } = await admin.from("profiles").insert({
      id: user.id,
      username: await ensureUniqueUsername(accountHandle(user.email ?? undefined, user.id), admin),
      name: "",
      title: "",
      company: "",
      email: user.email ?? "",
      phone: "",
      website: "",
      linkedin: "",
      instagram: "",
      twitter: "",
      tiktok: "",
      template: "classic-pro",
    });

    // A unique-violation (23505) usually means a concurrent request for this
    // SAME user already won the insert race — but profiles.username is ALSO
    // unique, so a 23505 could instead mean a (vanishingly rare, given
    // accountHandle() suffixes a slice of the user's own uuid) username
    // collision against a DIFFERENT user, in which case THIS user's row was
    // never created. Don't guess from the error code alone — re-check that
    // this user's own row actually exists before treating it as a safe,
    // already-provisioned duplicate (code review).
    const gotUniqueViolation = (insertErr as { code?: string } | null)?.code === "23505";
    let isDuplicate = false;
    if (gotUniqueViolation) {
      const { data: nowExists } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
      isDuplicate = !!nowExists;
    }
    if (insertErr && !isDuplicate) {
      console.error("[onboarding] profile insert failed:", insertErr.message);
      throw new Error("We couldn't finish setting up your account. Please refresh and try again, or contact support if this continues.");
    }

    // NOTE: the 14-day reverse trial is DISCONTINUED (owner decision, Jul 2026) —
    // new signups start on Free. startProTrial() is kept in referral-server for
    // the users already mid-trial; the cron still winds those down normally.

    // First-time signup: apply any referral/promo (free month, attribution,
    // fraud checks, referral row, own referral code). Only the request that
    // actually WON the insert race runs this — a concurrent duplicate must
    // never re-apply it (this used to double-grant a free month/credit).
    if (!isDuplicate) {
      try {
        const c = await cookies();
        const h = await headers();
        const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        await applyReferralOnSignup(user.id, {
          code: c.get(REF_COOKIE)?.value ?? null,
          source: c.get(SRC_COOKIE)?.value ?? null,
          ip,
          email: user.email ?? null,
          device: hashDevice(h.get("user-agent"), h.get("accept-language")),
        });
      } catch (e) {
        console.error("[onboarding] referral apply failed:", e);
      }
    }

    // Brand-new account → return to a pending guest editor (to claim the draft)
    // if we have one, otherwise the dashboard with the App Store prompt.
    redirect(safeNext ?? "/dashboard?welcome=1");
  }

  redirect(safeNext ?? "/dashboard");
}
