import { redirect } from "next/navigation";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getOfficeLeads } from "@/lib/office-leads";
import { FOLLOW_UP_STATES, type FollowUpState } from "@/lib/lead-followup";
import { PageHead } from "@/components/office/OfficeUI";
import LeadsTable from "./LeadsTable";

export const metadata = { title: "Leads — Admin — SwiftCard" };

export default async function OfficeLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ followUp?: string }>;
}) {
  const { office, officeId } = await requireOfficeAdmin();
  // ?followUp=none — where the "team leads have no follow-up yet" notification
  // (bell row and push) opens, so the leads it counted are the ones on screen.
  const requested = (await searchParams).followUp;
  const initialFollowUp = FOLLOW_UP_STATES.includes(requested as FollowUpState) ? (requested as FollowUpState) : undefined;
  if (!office || !officeId) redirect("/office/admin");

  // Server-scoped to THIS office (current team + leads stamped at removal time
  // for people who've left) — includes the slug → person-name mapping so the
  // table never shows a raw card URL.
  const page = await getOfficeLeads(officeId).catch(() => ({ leads: [], total: 0, hasMore: false }));

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
      <div data-tour="admin-leads-table">
        <LeadsTable leads={page.leads} total={page.total} hasMore={page.hasMore} initialFollowUp={initialFollowUp} />
      </div>
    </div>
  );
}
