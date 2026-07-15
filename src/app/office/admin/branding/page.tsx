import Link from "next/link";
import { redirect } from "next/navigation";
import OfficeBranding from "@/components/OfficeBranding";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getPrimaryCardId } from "@/lib/office-primary";
import { PageHead } from "@/components/office/OfficeUI";

export const metadata = { title: "Branding — Admin — SwiftCard" };

export default async function OfficeBrandingPage() {
  const { office, officeId, caps } = await requireOfficeAdmin();
  if (!office || !officeId) redirect("/office/admin");
  if (!caps.canBrand) redirect("/office/admin");

  const primaryCardId = await getPrimaryCardId(officeId).catch(() => null);

  return (
    <div>
      <PageHead
        title="Branding"
        desc="Set this once — every card on your team automatically uses it."
      />

      {/* The look and the company identity come from the primary card — say so
          here, or an admin will hunt for colour pickers that deliberately
          don't exist on this page. */}
      <div data-tour="admin-branding-note" className="bg-purple-500/5 border border-purple-500/20 rounded-2xl px-4 py-3 mb-5">
        <p className="text-sm text-purple-200 font-medium">Your own card sets the look</p>
        <p className="text-xs text-purple-200/70 mt-1 leading-relaxed">
          The colors, fonts and layout on every team card are copied from your own card —
          change your card once and everyone&apos;s updates with it.{" "}
          {primaryCardId ? (
            <Link href={`/office/admin/cards/${primaryCardId}`} className="underline hover:text-purple-100">
              Open your card →
            </Link>
          ) : (
            <span className="text-purple-200/50">Create your card first to set the look.</span>
          )}
        </p>
      </div>

      {/* Company-wide fields (logo, name, website, office phone/fax/address)
          live on the office itself — they aren't personal card fields. */}
      <div data-tour="admin-branding-form"><OfficeBranding office={office} /></div>
    </div>
  );
}
