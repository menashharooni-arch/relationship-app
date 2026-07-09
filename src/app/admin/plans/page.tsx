import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import PlansClient from "./PlansClient";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export const metadata = { title: "Plan tester — SwiftCard" };

export default async function AdminPlansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
    redirect("/dashboard");
  }
  const admin = getAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  return <PlansClient userId={user.id} email={user.email ?? ""} initialPlan={(profile?.plan as string) ?? "free"} />;
}
