import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import OnboardingForm from "@/components/OnboardingForm";
import SwiftCardLogo from "@/components/SwiftCardLogo";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  if (profile) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <SwiftCardLogo size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set up your card</h1>
          <p className="text-gray-500 text-sm mt-2">60 seconds. Live instantly.</p>
        </div>
        <OnboardingForm userId={user.id} />
      </div>
    </main>
  );
}
