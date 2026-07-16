import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { applyReferralOnSignup, hashDevice } from "@/lib/referral-server";
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
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only honour a same-origin relative redirect (no open-redirect). Used to send
  // a brand-new signup back to the guest editor so their pending draft is claimed.
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).single();

  if (!profile) {
    const admin = getAdminSupabase();
    const { error: insertErr } = await admin.from("profiles").insert({
      id: user.id,
      username: accountHandle(user.email ?? undefined, user.id),
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
