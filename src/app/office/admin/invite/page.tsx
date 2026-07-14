import { redirect } from "next/navigation";
import OfficeDashboard from "@/components/OfficeDashboard";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getOfficeSeatUsage } from "@/lib/office-seats";
import { listOfficeCards } from "@/lib/office-cards";
import { PLAN_LIMITS } from "@/lib/plan";
import { StatTile, PageHead } from "@/components/office/OfficeUI";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export const metadata = { title: "Invite — Admin — SwiftCard" };

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

export default async function OfficeInvitePage() {
  const { office, officeId, role, caps } = await requireOfficeAdmin();
  if (!office || !officeId) redirect("/office/admin");

  const seatCap = (office.seats as number | null) ?? PLAN_LIMITS.OFFICE_MIN_SEATS;
  const [seats, cards] = await Promise.all([
    getOfficeSeatUsage(officeId, seatCap).catch(() => null),
    listOfficeCards(officeId).catch(() => []),
  ]);

  const members = (office.office_members ?? []) as Member[];
  const pendingInvites = members.filter((m) => m.status === "pending").length;
  const liveCards = cards.filter((c) => !c.is_offline).length;

  return (
    <div>
      <PageHead
        title="Invite"
        desc="Send an employee a link to build their card. Their company details are filled in from your primary card automatically."
      />

      {/* Seats + cards at a glance — the numbers you need before inviting. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatTile label="Seats used" value={seats ? `${seats.used} / ${seats.purchased}` : "—"} hint="Includes you" />
        <StatTile label="Seats available" value={seats?.available ?? "—"} hint={seats && seats.available === 0 ? "Add a seat to invite" : undefined} />
        <StatTile label="Pending invites" value={pendingInvites} hint="Each reserves a seat" />
        <StatTile label="Active cards" value={liveCards} hint={cards.length - liveCards > 0 ? `${cards.length - liveCards} offline` : undefined} />
      </div>

      {/* The existing invite + member management surface (invite, resend, revoke,
          remove, seat purchase) — unchanged, just on its own page now. The guard
          returns the office row loosely typed, so narrow it to what this
          component actually needs. */}
      <OfficeDashboard
        office={{
          id: office.id as string,
          name: office.name as string,
          seats: seatCap,
        }}
        members={members}
        appUrl={APP_URL}
        viewerRole={role}
        caps={{ ...caps, canManageRoles: false }}
      />
    </div>
  );
}
