import { redirect } from "next/navigation";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOfficeUserIds } from "@/lib/office-cards";
import { PageHead, Empty } from "@/components/office/OfficeUI";

export const metadata = { title: "Leads — Admin — SwiftCard" };

type TeamLead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string | null;
  created_at: string;
  card_owner: string;
  location: string | null;
};

export default async function OfficeLeadsPage() {
  const { office, officeId } = await requireOfficeAdmin();
  if (!office || !officeId) redirect("/office/admin");

  // Leads are keyed by CARD username, which differs from a member's profile
  // handle — so gather every slug the team owns (profile handles included, for
  // legacy profile-cards), or member leads captured on their real cards go missing.
  const admin = getAdminSupabase();
  const teamIds = await getOfficeUserIds(officeId);

  let leads: TeamLead[] = [];
  if (teamIds.length) {
    const [{ data: profiles }, { data: cards }] = await Promise.all([
      admin.from("profiles").select("username").in("id", teamIds),
      admin.from("cards").select("username").in("user_id", teamIds),
    ]);
    const usernames = Array.from(new Set([
      ...(profiles ?? []).map((p) => p.username as string),
      ...(cards ?? []).map((c) => c.username as string),
    ].filter(Boolean)));

    if (usernames.length) {
      const { data } = await admin
        .from("leads")
        .select("id, name, email, phone, status, created_at, card_owner, location")
        .in("card_owner", usernames)
        .order("created_at", { ascending: false })
        .limit(200);
      leads = (data ?? []) as TeamLead[];
    }
  }

  const tone = (s: string | null) =>
    s === "hot" ? "text-red-400" : s === "warm" ? "text-orange-400" : s === "closed" ? "text-green-400" : "text-gray-500";

  return (
    <div>
      <PageHead title="Leads" desc={`Every contact captured across your team${leads.length ? ` — ${leads.length} total` : ""}.`} />

      {leads.length === 0 ? (
        <Empty>No leads captured across your team yet.</Empty>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-gray-800 bg-gray-900/60 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            <p className="col-span-4">Contact</p>
            <p className="col-span-3">Captured by</p>
            <p className="col-span-2">Status</p>
            <p className="col-span-3">Date</p>
          </div>
          <div className="divide-y divide-gray-800">
            {leads.map((l) => (
              <div key={l.id} className="grid grid-cols-12 gap-3 px-5 py-3 items-center">
                <div className="col-span-12 md:col-span-4 min-w-0">
                  <p className="text-sm text-white truncate">{l.name}</p>
                  <p className="text-xs text-gray-500 truncate">{l.email}</p>
                </div>
                <p className="col-span-6 md:col-span-3 text-xs text-gray-400 truncate">@{l.card_owner}</p>
                <p className={`col-span-3 md:col-span-2 text-xs font-medium capitalize ${tone(l.status)}`}>{l.status || "new"}</p>
                <p className="col-span-3 md:col-span-3 text-xs text-gray-600 whitespace-nowrap">
                  {new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
