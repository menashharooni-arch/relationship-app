import { redirect } from "next/navigation";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getOfficeFollowUp, getOfficeLeads } from "@/lib/office-leads";
import TeamFollowUp from "./TeamFollowUp";
import { PageHead } from "@/components/office/OfficeUI";
import LeadsTable from "./LeadsTable";

export const metadata = { title: "Leads — Admin — SwiftCard" };

export default async function OfficeLeadsPage() {
  const { office, officeId } = await requireOfficeAdmin();
  if (!office || !officeId) redirect("/office/admin");

  // Server-scoped to THIS office (current team + leads stamped at removal time
  // for people who've left) — includes the slug → person-name mapping so the
  // table never shows a raw card URL.
  const [page, followUp] = await Promise.all([
    getOfficeLeads(officeId).catch(() => ({ leads: [], total: 0, hasMore: false })),
    // The team's Hot / Warm contacts (owner decision D6). Never blocks the table.
    getOfficeFollowUp(officeId).catch(() => []),
  ]);

  return (
    <div>
      <PageHead
        title="Leads"
        // The EXACT total, not the number loaded. This said "600 so far"
        // permanently once the office passed the old cap — and the Team tab's
        // per-person counts were uncapped, so the two tabs disagreed with no
        // way to reconcile them.
        desc={`Everyone who shared their info with your team${page.total ? ` — ${page.total.toLocaleString()} so far` : ""}.`}
      />
      <TeamFollowUp items={followUp} />
      <div data-tour="admin-leads-table">
        <LeadsTable leads={page.leads} total={page.total} hasMore={page.hasMore} />
      </div>
    </div>
  );
}
