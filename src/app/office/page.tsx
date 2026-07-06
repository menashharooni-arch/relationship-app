import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import OfficeDashboard from "@/components/OfficeDashboard";
import OfficeBranding from "@/components/OfficeBranding";
import CreateOfficeForm from "@/components/CreateOfficeForm";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

type Member = {
  id: string;
  invite_email: string;
  invite_token: string;
  status: string;
  role: string;
  joined_at: string | null;
  user_id: string | null;
};

type TeamLead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string | null;
  created_at: string;
  card_owner: string;
  location: string | null;
  tags: string[] | null;
};

export default async function OfficePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, name, username")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");
  if (profile.plan !== "enterprise") redirect("/pricing");

  const { data: office } = await supabase
    .from("offices")
    .select("*, office_members(*)")
    .eq("owner_id", user.id)
    .single();

  // Fetch unified team leads if office exists
  let teamLeads: TeamLead[] = [];
  if (office) {
    const admin = getAdminSupabase();
    const members = (office.office_members ?? []) as Member[];
    const activeMembers = members.filter((m) => m.status === "active" && m.user_id);
    const memberUserIds = activeMembers.map((m) => m.user_id!);

    if (memberUserIds.length > 0) {
      // Get usernames of all active members
      const { data: memberProfiles } = await admin
        .from("profiles")
        .select("username")
        .in("id", memberUserIds);

      const memberUsernames = [
        profile.username,
        ...(memberProfiles ?? []).map((p) => p.username),
      ];

      const { data: leads } = await admin
        .from("leads")
        .select("id, name, email, phone, status, created_at, card_owner, location, tags")
        .in("card_owner", memberUsernames)
        .order("created_at", { ascending: false })
        .limit(100);

      teamLeads = (leads ?? []) as TeamLead[];
    } else {
      // Just owner's leads
      const { data: leads } = await admin
        .from("leads")
        .select("id, name, email, phone, status, created_at, card_owner, location, tags")
        .eq("card_owner", profile.username)
        .order("created_at", { ascending: false })
        .limit(100);
      teamLeads = (leads ?? []) as TeamLead[];
    }
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-10">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-brand uppercase mb-1">SwiftCard</p>
            <h1 className="text-2xl font-bold text-slate-900">Team Dashboard</h1>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            ← My card
          </Link>
        </div>

        {!office ? (
          <CreateOfficeForm />
        ) : (
          <div className="space-y-8">
            <OfficeDashboard
              office={office}
              members={(office.office_members ?? []) as Member[]}
              appUrl={APP_URL}
            />

            <OfficeBranding office={office} />

            {/* Unified team leads */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Team Leads ({teamLeads.length})
                </p>
              </div>

              {teamLeads.length === 0 ? (
                <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-slate-400 text-sm">No leads yet across your team.</p>
                </div>
              ) : (
                <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F0EBE1] border-b border-[#D4C8B8]">
                        <tr>
                          {["Contact", "Card Owner", "Status", "Location", "Date"].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D4C8B8]">
                        {teamLeads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-[#E8DECE] transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-900 truncate max-w-[160px]">{lead.name}</p>
                              <p className="text-slate-400 text-xs truncate max-w-[160px]">{lead.email}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-[#E0E8F0] text-[#1D4ED8] font-medium px-2 py-0.5 rounded-full">
                                @{lead.card_owner}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                                lead.status === "hot" ? "bg-red-50 text-red-600"
                                : lead.status === "warm" ? "bg-orange-50 text-orange-600"
                                : lead.status === "cold" ? "bg-slate-100 text-slate-500"
                                : lead.status === "closed" ? "bg-green-50 text-green-600"
                                : "bg-slate-100 text-slate-500"
                              }`}>
                                {lead.status || "new"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">{lead.location || "—"}</td>
                            <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                              {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
