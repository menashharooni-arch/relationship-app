import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import OnboardingForm from "@/components/OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already has a profile — go to dashboard
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  if (profile) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-xs font-bold tracking-[0.25em] text-gray-400 uppercase mb-4">Evercard</p>
          <h1 className="text-2xl font-bold text-gray-900">Set up your card</h1>
          <p className="text-gray-500 text-sm mt-2">
            This takes 60 seconds. Your card will be live instantly.
          </p>
        </div>
        <OnboardingForm userId={user.id} />
      </div>
    </main>
  );
}
