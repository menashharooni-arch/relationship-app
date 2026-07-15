import { redirect } from "next/navigation";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getOfficeLeads } from "@/lib/office-leads";
import { PageHead } from "@/components/office/OfficeUI";
import LeadsTable from "./LeadsTable";

export const metadata = { title: "Leads — Admin — SwiftCard" };

export default async function OfficeLeadsPage() {
  const { office, officeId } = await requireOfficeAdmin();
  if (!office || !officeId) redirect("/office/admin");

  // Server-scoped to THIS office (current team + leads stamped at removal time
  // for people who've left) — includes the slug → person-name mapping so the
  // table never shows a raw card URL.
  const leads = await getOfficeLeads(officeId).catch(() => []);

  return (
    <div>
      <PageHead
        title="Leads"
        desc={`Everyone who shared their info with your team${leads.length ? ` — ${leads.length} so far` : ""}.`}
      />
      <div data-tour="admin-leads-table"><LeadsTable leads={leads} /></div>
    </div>
  );
}
