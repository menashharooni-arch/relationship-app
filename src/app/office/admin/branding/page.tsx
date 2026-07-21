import { redirect } from "next/navigation";
import OfficeBranding from "@/components/OfficeBranding";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { PageHead } from "@/components/office/OfficeUI";

export const metadata = { title: "Branding — Admin — SwiftCard" };

export default async function OfficeBrandingPage() {
  const { office, officeId, caps } = await requireOfficeAdmin();
  if (!office || !officeId) redirect("/office/admin");
  if (!caps.canBrand) redirect("/office/admin");

  return (
    <div>
      <PageHead
        title="Branding"
        desc="Set this once — every card on your team automatically uses it, including yours."
      />

      {/* This page IS the brand source — logo, company, website, template and
          the colors/fonts all live on the office row and push to every card. */}
      <div data-tour="admin-branding-note" className="bg-purple-500/5 border border-purple-500/20 rounded-2xl px-4 py-3 mb-5">
        <p className="text-sm text-purple-200 font-medium">This page sets the look for every card</p>
        <p className="text-xs text-purple-200/70 mt-1 leading-relaxed">
          Logo, company details, template, colors and fonts set here apply to the whole team&apos;s
          cards — yours included. Change them once, and everyone&apos;s card updates with them.
        </p>
      </div>

      <div data-tour="admin-branding-form"><OfficeBranding office={office} /></div>
    </div>
  );
}
