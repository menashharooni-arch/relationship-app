import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AnalyticsClient from "./AnalyticsClient";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export const metadata = { title: "Company analytics — SwiftCard" };

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
    redirect("/dashboard");
  }
  return <AnalyticsClient />;
}
