import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import OfficeDashboard from "@/components/OfficeDashboard";
import OfficeBranding from "@/components/OfficeBranding";
import CreateOfficeForm from "@/components/CreateOfficeForm";
import DashboardLink from "@/components/DashboardLink";
import { resolveOfficeContext, roleHasCapability, type OfficeRole } from "@/lib/office-roles";
import { getOfficeAnalytics, type OfficeAnalytics } from "@/lib/office-analytics";
import TeamAnalytics from "@/components/TeamAnalytics";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

type Member = {
  id: string;
  invite_email: string;
  invite_token: string;
  status: string;
  role: string;
  joined_at: string | null;
  user_id: string | null;
  created_at?: string | null;
  expires_at?: string | null;
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

  // Server-side role resolution. The owner OR a management-role member (admin /
  // manager / billing_admin) may view the team dashboard; a plain employee is
  // sent to their own dashboard. Capabilities gate every control (the APIs
  // re-check server-side regardless — the UI gating is only cosmetic).
  const ctx = await resolveOfficeContext(user.id);
  const role: OfficeRole = ctx ? ctx.role : "owner"; // enterprise user w/o an office yet = owner-to-be
  if (ctx && !ctx.isOwner && !roleHasCapability(role, "view_org_analytics")) redirect("/dashboard");

  const caps = {
    canInvite: roleHasCapability(role, "invite_members"),
    canRemove: roleHasCapability(role, "remove_members"),
    canBrand: roleHasCapability(role, "manage_branding"),
    canManageRoles: roleHasCapability(role, "manage_roles"),
    canManageSeats: roleHasCapability(role, "manage_seats"),
  };

  // Owner (or owner-to-be) loads by ownership; a member-admin loads THEIR office.
  const officeQuery = getAdminSupabase().from("offices").select("*, office_members(*)");
  const { data: office } = ctx && !ctx.isOwner
    ? await officeQuery.eq("id", ctx.officeId).single()
    : await supabase.from("offices").select("*, office_members(*)").eq("owner_id", user.id).single();

  // Fetch unified team leads if office exists. Leads are keyed by CARD username,
  // which differs from a member's profile handle — so gather every card slug the
  // owner and active members own (profile slug covers legacy profile-cards),
  // otherwise member leads captured on their real cards would be missing.
  let teamLeads: TeamLead[] = [];
  let analytics: OfficeAnalytics | null = null;
  if (office) {
    // Organization + per-employee analytics (server-scoped to this office).
    try { analytics = await getOfficeAnalytics(office.id as string, office.owner_id as string); } catch { analytics = null; }
    const admin = getAdminSupabase();
    const members = (office.office_members ?? []) as Member[];
    const candidateIds = members.filter((m) => m.status === "active" && m.user_id).map((m) => m.user_id!);

    // Cross-check profiles.office_id, not just office_members.status='active' —
    // a member who switched teams or lost their seat (subscription cancelled,
    // seats reduced) must not have their current leads pulled into this office's
    // Team Leads just because a stale office_members row lingered.
    const [{ data: teamProfiles }, { data: teamCards }] = candidateIds.length
      ? await Promise.all([
          admin.from("profiles").select("id, username").in("id", candidateIds).eq("office_id", office.id),
          admin.from("cards").select("username, user_id").in("user_id", candidateIds),
        ])
      : [{ data: [] }, { data: [] }];

    const verifiedIds = new Set((teamProfiles ?? []).map((p) => p.id as string));
    const verifiedCards = (teamCards ?? []).filter((c) => verifiedIds.has(c.user_id as string));

    // Include the OFFICE OWNER's cards regardless of who is viewing (a member-
    // admin viewer's own username is already covered via teamProfiles).
    const [{ data: ownerProfile }, { data: ownerCards }] = await Promise.all([
      admin.from("profiles").select("username").eq("id", office.owner_id).maybeSingle(),
      admin.from("cards").select("username").eq("user_id", office.owner_id),
    ]);

    const memberUsernames = Array.from(new Set([
      ownerProfile?.username as string,
      ...(ownerCards ?? []).map((c) => c.username as string),
      ...(teamProfiles ?? []).map((p) => p.username as string),
      ...verifiedCards.map((c) => c.username as string),
    ].filter(Boolean))) as string[];

    const { data: leads } = await admin
      .from("leads")
      .select("id, name, email, phone, status, created_at, card_owner, location, tags")
      .in("card_owner", memberUsernames)
      .order("created_at", { ascending: false })
      .limit(100);

    teamLeads = (leads ?? []) as TeamLead[];
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-10">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-brand uppercase mb-1">SwiftCard</p>
            <h1 className="text-2xl font-bold text-slate-900">Team Dashboard</h1>
          </div>
          <DashboardLink className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            ← My card
          </DashboardLink>
        </div>

        {!office ? (
          <CreateOfficeForm />
        ) : (
          <div className="space-y-8">
            <OfficeDashboard
              office={office}
              members={(office.office_members ?? []) as Member[]}
              appUrl={APP_URL}
              viewerRole={role}
              caps={caps}
            />

            {analytics && <TeamAnalytics data={analytics} />}

            {caps.canBrand && <OfficeBranding office={office} />}

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
