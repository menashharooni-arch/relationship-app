import { createClient } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";
import { redirect } from "next/navigation";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, email, phone, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-gray-950 px-5 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-gray-500 uppercase mb-1">
              Evercard
            </p>
            <h1 className="text-2xl font-bold text-white">Your Leads</h1>
          </div>
          <SignOutButton />
        </div>

        {/* Stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4 mb-6 flex items-center gap-3">
          <span className="text-3xl font-bold text-white">{leads?.length ?? 0}</span>
          <span className="text-gray-400 text-sm">
            {leads?.length === 1 ? "person has shared their info" : "people have shared their info"}
          </span>
        </div>

        {/* Leads list */}
        {!leads || leads.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-4xl mb-3">📭</p>
            <p>No leads yet. Share your card to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead: Lead) => (
              <div
                key={lead.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-white font-semibold">{lead.name}</p>
                  <p className="text-gray-400 text-sm">{lead.email}</p>
                  {lead.phone && (
                    <p className="text-gray-500 text-sm">{lead.phone}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-gray-600 text-xs">
                    {new Date(lead.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
