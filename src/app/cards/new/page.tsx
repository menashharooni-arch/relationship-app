import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import NewCardWizard from "./NewCardWizard";

export default async function NewCardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const isPro = profile?.plan === "pro" || profile?.plan === "enterprise";

  return <NewCardWizard isPro={isPro} />;
}
