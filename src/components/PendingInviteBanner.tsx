import Link from "next/link";

// Shown on the dashboard when the signed-in email has an unaccepted team
// invite: the person got here without tapping the invite link (installed the
// app first, or signed in on the web), so this IS their way into the hub.
// `primary` is the empty-account version — no personal card yet, so joining is
// the whole screen and building a personal card is the footnote.
export default function PendingInviteBanner({ officeName, token, primary = false }: {
  officeName: string;
  token: string;
  primary?: boolean;
}) {
  const href = `/join/${encodeURIComponent(token)}`;
  if (primary) {
    return (
      <div data-testid="pending-invite" className="w-full max-w-sm bg-gray-900 border border-purple-500/30 rounded-2xl p-6 text-center">
        <p className="text-[0.625rem] font-bold tracking-[0.2em] uppercase text-purple-300 mb-2">Team invitation</p>
        <h1 className="text-2xl font-bold text-white mb-2">You&apos;re invited to {officeName}</h1>
        <p className="text-gray-400 text-sm mb-6">Join to create your company card — it arrives already branded with the team look.</p>
        <Link href={href} className="block w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3.5 rounded-full text-sm transition-colors">
          Join {officeName} →
        </Link>
      </div>
    );
  }
  return (
    <div data-testid="pending-invite" className="bg-gray-900 border border-purple-500/30 rounded-2xl px-5 py-4 mb-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">You&apos;re invited to {officeName}</p>
        <p className="text-xs text-gray-400 mt-0.5">Join to get your company card and a seat in the team hub.</p>
      </div>
      <Link href={href} className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-full text-xs transition-colors">
        Join →
      </Link>
    </div>
  );
}
