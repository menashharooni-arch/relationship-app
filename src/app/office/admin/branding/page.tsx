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
      <PageHead title="Branding" desc="The company details every card on your team carries." />

      {/* The look and the company identity come from the primary card — say so
          here, or an admin will hunt for colour pickers that deliberately
          don't exist on this page. */}
      <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl px-4 py-3 mb-5">
        <p className="text-sm text-purple-200 font-medium">Your primary card is the brand</p>
        <p className="text-xs text-purple-200/70 mt-1 leading-relaxed">
          The company logo, name, website, template, colours and fonts on every employee card are copied from your
          own card — edit it once and the whole team updates.{" "}
          {primaryCardId ? (
            <Link href={`/office/admin/cards/${primaryCardId}`} className="underline hover:text-purple-100">
              Open the primary card →
            </Link>
          ) : (
            <span className="text-purple-200/50">Create your card to set the brand.</span>
          )}
        </p>
      </div>

      {/* Office contact fields (office number, fax, address) live on the office
          itself — they aren't personal card fields, so they're managed here. */}
      <OfficeBranding office={office} />
    </div>
  );
}
