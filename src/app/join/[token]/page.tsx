import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import JoinButton from "@/components/JoinButton";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import Link from "next/link";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Look up invite using admin client (bypasses RLS — token is the secret)
  const admin = getAdminSupabase();
  const { data: invite } = await admin
    .from("office_members")
    .select("*, offices(name)")
    .eq("invite_token", token)
    .single();

  if (!invite) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <SwiftCardLogo size={32} onDark />
          <h1 className="text-2xl font-bold text-white mt-8 mb-3">Invite not found</h1>
          <p className="text-gray-500 text-sm mb-6">This invite link is invalid or has expired.</p>
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
          <h1 className="text-2xl font-bold text-white mt-8 mb-3">Already accepted</h1>
          <p className="text-gray-500 text-sm mb-6">This invite has already been used.</p>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            Go to dashboard →
          </Link>
        </div>
      </main>
    );
  }

  const officeName = (invite.offices as { name: string } | null)?.name ?? "a team";

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
            <SwiftCardLogo size={32} onDark />
          </div>
          <div className="inline-flex items-center gap-2 bg-blue-950/60 border border-blue-800/40 rounded-full px-4 py-1.5 mb-5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-blue-300 text-xs font-medium">Team Invitation</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Join {officeName}</h1>
          <p className="text-gray-400 text-sm">
            You&apos;ve been invited to join <strong className="text-white">{officeName}</strong>
            {" "}on SwiftCard. You&apos;ll get your own digital business card and access to the
            team dashboard.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">Invited email</span>
            <span className="text-gray-300 text-xs font-medium">{invite.invite_email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">Your account</span>
            <span className="text-gray-300 text-xs font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">Plan you&apos;ll receive</span>
            <span className="text-xs font-bold text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-full">Enterprise</span>
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
