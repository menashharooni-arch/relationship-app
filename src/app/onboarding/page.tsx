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
export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).single();

  if (!profile) {
    const admin = getAdminSupabase();
    await admin.from("profiles").insert({
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

    // First-time signup: apply any referral/promo (free month, attribution,
    // fraud checks, referral row, own referral code). Runs once — only on
    // profile creation — so it can't be replayed.
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

    // Brand-new account → land on the dashboard with the App Store prompt.
    redirect("/dashboard?welcome=1");
  }

  redirect("/dashboard");
}
