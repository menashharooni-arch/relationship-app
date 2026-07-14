import Link from "next/link";
import CreateOfficeForm from "@/components/CreateOfficeForm";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getTeamOverview, computeSetupProgress } from "@/lib/office-team";
import { getOfficeBrand } from "@/lib/office-brand";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isInviteExpired } from "@/lib/office-invite";
import { relativeTime, shortDate, isWithin } from "@/lib/relative-time";
import { PageHead } from "@/components/office/OfficeUI";
import { AddMemberButton, InviteRowActions } from "@/components/office/TeamActions";

export const metadata = { title: "Team — Admin — SwiftCard" };

const ACTIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // "not using it yet" after 14 quiet days

type InviteRow = {
  id: string;
  invite_email: string;
  status: string;
  created_at?: string | null;
  expires_at?: string | null;
};

function Arrow({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct == null || deltaPct === 0) return null;
  const up = deltaPct > 0;
  return (
    <span className={`text-[11px] font-bold ${up ? "text-green-400" : "text-red-400"}`}>
      {up ? "▲" : "▼"} {Math.abs(deltaPct)}% vs last month
    </span>
  );
}

function BigStat({ label, value, explainer, deltaPct }: {
  label: string;
  value: number;
  explainer: string;
  deltaPct: number | null;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="flex items-baseline gap-2.5 mt-1 flex-wrap">
        <p className="text-3xl font-bold text-white tabular-nums">{value.toLocaleString("en-US")}</p>
        <Arrow deltaPct={deltaPct} />
      </div>
      <p className="text-[11px] text-gray-600 mt-1.5">{explainer}</p>
    </div>
  );
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 bg-gray-800" />;
  }
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <span className="w-9 h-9 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-300 text-xs font-bold flex items-center justify-center shrink-0">
      {initials}
    </span>
  );
}

function StatusChip({ tone, children }: { tone: "green" | "amber" | "gray" | "red"; children: React.ReactNode }) {
  const tones = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    gray: "bg-gray-800 text-gray-400 border-gray-700",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
  } as const;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default async function OfficeTeamPage() {
  const { office, officeId, ownerId, caps } = await requireOfficeAdmin();

  // On Office but no office row yet → the one thing to do is name the team.
  if (!office || !officeId || !ownerId) {
    return (
      <div className="max-w-md mx-auto pt-6">
        <CreateOfficeForm />
      </div>
    );
  }

  const memberRows = (office.office_members ?? []) as InviteRow[];
  const pendingInvites = memberRows.filter((m) => m.status === "pending");

  const [overview, brand] = await Promise.all([
    getTeamOverview(officeId, ownerId).catch(() => null),
    getOfficeBrand(officeId).catch(() => null),
  ]);

  // Headshots for the table (profiles.photo_url; one query for the whole team).
  const photoByUser = new Map<string, string | null>();
  if (overview?.people.length) {
    const { data } = await getAdminSupabase()
      .from("profiles").select("id, photo_url")
      .in("id", overview.people.map((p) => p.userId));
    for (const p of data ?? []) photoByUser.set(p.id as string, (p.photo_url as string | null) ?? null);
  }

  const setup = computeSetupProgress({
    hasBrand: !!brand,
    memberRowCount: memberRows.length,
    leadCount: overview?.totals.leads ?? 0,
  });

  const people = overview?.people ?? [];
  const hasRows = people.length > 0 || pendingInvites.length > 0;

  return (
    <div>
      <PageHead
        title="Your team"
        desc="Everyone with a company card, and what those cards are bringing in."
        action={caps.canInvite ? <AddMemberButton canManageSeats={caps.canManageSeats} /> : undefined}
      />

      {/* First-time setup — derived from durable facts, so once all three are
          done it never renders again. */}
      {!setup.allDone && (
        <div className="bg-gray-900 border border-purple-500/20 rounded-2xl p-5 mb-6">
          <p className="text-sm font-bold text-white mb-0.5">Let&apos;s get your team set up</p>
          <p className="text-xs text-gray-500 mb-4">Three steps and you&apos;re running.</p>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-px ${setup.brandingDone ? "bg-green-500/15 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                {setup.brandingDone ? "✓" : "1"}
              </span>
              <span className="min-w-0">
                {setup.brandingDone ? (
                  <span className="text-sm text-gray-500 line-through">Set up your company branding</span>
                ) : (
                  <>
                    <Link href="/office/admin/branding" className="text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors">
                      Set up your company branding →
                    </Link>
                    <span className="block text-[11px] text-gray-600 mt-0.5">Your logo, company name and card design — every card uses it.</span>
                  </>
                )}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-px ${setup.invitedDone ? "bg-green-500/15 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                {setup.invitedDone ? "✓" : "2"}
              </span>
              <span className="min-w-0">
                {setup.invitedDone ? (
                  <span className="text-sm text-gray-500 line-through">Invite your team</span>
                ) : caps.canInvite ? (
                  <>
                    <AddMemberButton canManageSeats={caps.canManageSeats} label="Invite your team →" variant="link" />
                    <span className="block text-[11px] text-gray-600 mt-0.5">Each person gets an email and builds their card in 2 minutes.</span>
                  </>
                ) : (
                  <span className="text-sm text-gray-400">Invite your team</span>
                )}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-px ${setup.firstLeadDone ? "bg-green-500/15 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                {setup.firstLeadDone ? "✓" : "3"}
              </span>
              <span className="min-w-0">
                <span className={`text-sm ${setup.firstLeadDone ? "text-gray-500 line-through" : "text-gray-400"}`}>
                  Share your cards and watch leads come in
                </span>
                {!setup.firstLeadDone && (
                  <span className="block text-[11px] text-gray-600 mt-0.5">This checks off by itself the first time someone shares their info with your team.</span>
                )}
              </span>
            </li>
          </ol>
        </div>
      )}

      {/* The three numbers that matter, in plain English. */}
      {overview && hasRows && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <BigStat
            label="Leads captured this month"
            value={overview.stats.leadsThisMonth.current}
            deltaPct={overview.stats.leadsThisMonth.deltaPct}
            explainer="People who shared their info with your team"
          />
          <BigStat
            label="Card views this month"
            value={overview.stats.viewsThisMonth.current}
            deltaPct={overview.stats.viewsThisMonth.deltaPct}
            explainer="Times someone opened one of your team's cards"
          />
          <BigStat
            label="Team members active"
            value={overview.stats.activeMembers.current}
            deltaPct={null}
            explainer="Teammates whose cards had views or leads this month"
          />
        </div>
      )}

      {/* One table: real members and pending invites together. */}
      {hasRows ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-gray-800 bg-gray-900/60 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            <p className="col-span-4">Person</p>
            <p className="col-span-2">Views</p>
            <p className="col-span-2">Leads</p>
            <p className="col-span-2">Last active</p>
            <p className="col-span-2">Status</p>
          </div>
          <div className="divide-y divide-gray-800">
            {people.map((p) => {
              const activeRecently = isWithin(p.lastActiveAt, ACTIVE_WINDOW_MS);
              return (
                <Link
                  key={p.userId}
                  href={`/office/admin/team/${p.userId}`}
                  className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-gray-800/50 transition-colors"
                >
                  <div className="col-span-12 md:col-span-4 min-w-0 flex items-center gap-3">
                    <Avatar name={p.name} photoUrl={photoByUser.get(p.userId) ?? null} />
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{p.name}</p>
                      {p.isOwner && <p className="text-[11px] text-purple-400">Owner (you)</p>}
                    </div>
                  </div>
                  <p className="col-span-4 md:col-span-2 text-sm text-gray-300 tabular-nums">
                    <span className="md:hidden text-gray-600 text-xs">Views </span>{p.views.toLocaleString("en-US")}
                  </p>
                  <p className="col-span-4 md:col-span-2 text-sm text-gray-300 tabular-nums">
                    <span className="md:hidden text-gray-600 text-xs">Leads </span>{p.leads.toLocaleString("en-US")}
                  </p>
                  <p className="col-span-4 md:col-span-2 text-xs text-gray-500">
                    {p.lastActiveAt ? relativeTime(p.lastActiveAt) : "No activity yet"}
                  </p>
                  <div className="col-span-12 md:col-span-2">
                    {activeRecently
                      ? <StatusChip tone="green">Active</StatusChip>
                      : <StatusChip tone="amber">Not using it yet</StatusChip>}
                  </div>
                </Link>
              );
            })}

            {pendingInvites.map((inv) => {
              const expired = isInviteExpired(inv);
              return (
                <div key={inv.id} className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center">
                  <div className="col-span-12 md:col-span-4 min-w-0 flex items-center gap-3">
                    <Avatar name={inv.invite_email} photoUrl={null} />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-300 truncate">{inv.invite_email}</p>
                      <p className="text-[11px] text-gray-600">
                        {expired ? "Invite expired" : `Invite sent ${shortDate(inv.created_at)}`}
                      </p>
                    </div>
                  </div>
                  <p className="col-span-4 md:col-span-2 text-sm text-gray-600">—</p>
                  <p className="col-span-4 md:col-span-2 text-sm text-gray-600">—</p>
                  <p className="col-span-4 md:col-span-2 text-xs text-gray-600">—</p>
                  <div className="col-span-12 md:col-span-2 flex items-center gap-2 flex-wrap">
                    {expired
                      ? <StatusChip tone="red">Expired — resend?</StatusChip>
                      : <StatusChip tone="gray">Invite sent</StatusChip>}
                    {caps.canInvite && <InviteRowActions memberId={inv.id} email={inv.invite_email} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        setup.allDone && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
            <p className="text-gray-400 text-sm mb-1">Your team is empty right now.</p>
            <p className="text-gray-600 text-xs mb-4">Invite someone and their card shows up here.</p>
            {caps.canInvite && <AddMemberButton canManageSeats={caps.canManageSeats} />}
          </div>
        )
      )}
    </div>
  );
}
