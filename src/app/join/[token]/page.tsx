import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOfficeBrand } from "@/lib/office-brand";
import { isInviteExpired } from "@/lib/office-invite";
import JoinButton from "@/components/JoinButton";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import Link from "next/link";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Look up invite using admin client (bypasses RLS — token is the secret)
  const admin = getAdminSupabase();
  const { data: invite } = await admin
    .from("office_members")
    .select("*, offices(id, name)")
    .eq("invite_token", token)
    .single();

  if (!invite) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <SwiftCardLogo size={32} onDark />
          <h1 className="text-2xl font-bold text-white mt-8 mb-3">This link doesn&apos;t work anymore</h1>
          <p className="text-gray-500 text-sm mb-6">
            The invite may have expired or been canceled. Ask whoever invited you to send a fresh one.
          </p>
          <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            Go to sign in →
          </Link>
        </div>
      </main>
    );
  }

  if (invite.status === "active") {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <SwiftCardLogo size={32} onDark />
          <h1 className="text-2xl font-bold text-white mt-8 mb-3">You&apos;re already on the team</h1>
          <p className="text-gray-500 text-sm mb-6">This invite has already been used.</p>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            Go to my dashboard →
          </Link>
        </div>
      </main>
    );
  }

  // Revoked/declined/expired invites must not show an enabled "Accept" CTA
  // that's guaranteed to fail against the API — mirrors the API's own
  // rejection logic (isInviteExpired) so the page and API agree (auth audit).
  if (invite.status === "revoked" || invite.status === "declined" || isInviteExpired(invite as { status?: string; expires_at?: string | null; created_at?: string | null })) {
    const message =
      invite.status === "revoked"
        ? "This invitation was canceled by the team admin."
        : invite.status === "declined"
        ? "This invitation was already declined."
        : "This invite has expired.";
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <SwiftCardLogo size={32} onDark />
          <h1 className="text-2xl font-bold text-white mt-8 mb-3">This link doesn&apos;t work anymore</h1>
          <p className="text-gray-500 text-sm mb-6">{message} Ask whoever invited you to send a fresh one.</p>
          <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            Go to sign in →
          </Link>
        </div>
      </main>
    );
  }

  const officeRef = invite.offices as { id?: string; name?: string } | null;
  const officeName = officeRef?.name ?? "your team";
  const brand = await getOfficeBrand(officeRef?.id ?? (invite.office_id as string)).catch(() => null);

  // Check if user is logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/join/${token}`);
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            {brand?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="w-14 h-14 rounded-2xl object-cover bg-gray-900" />
            ) : (
              <SwiftCardLogo size={32} onDark />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Create your {officeName} card</h1>
          <p className="text-gray-400 text-sm">
            Your company logo and design are already set up. You just add your
            name, photo and contact info — it takes about 2 minutes.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">Invite sent to</span>
            <span className="text-gray-300 text-xs font-medium">{invite.invite_email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">You&apos;re signed in as</span>
            <span className="text-gray-300 text-xs font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">Cost to you</span>
            <span className="text-xs font-bold text-green-400">Free — {officeName} covers it</span>
          </div>
        </div>

        <JoinButton token={token} />

        <p className="text-center text-gray-600 text-xs mt-4">
          Signed in as {user.email} ·{" "}
          <Link href="/login" className="hover:text-gray-400 transition-colors">Switch account</Link>
        </p>
      </div>
    </main>
  );
}
