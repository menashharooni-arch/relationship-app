import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

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
  }

  redirect("/dashboard");
}
