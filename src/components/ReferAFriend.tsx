"use client";

// Refer a friend (Settings): invite 3 friends who successfully sign up → claim
// 1 month of Pro free, repeatable up to 3 months (9 signups). The claim is an
// explicit tap — nothing auto-activates. Share = native share sheet (texts the
// bare link so messaging apps unfurl it) with copy-link as the manual path.

import { useState } from "react";
import { useRouter } from "next/navigation";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

type Progress = {
  code: string | null;
  validSignups: number;
  progressInBatch: number;
  claimable: number;
  monthsClaimed: number;
  capReached: boolean;
};

export default function ReferAFriend({ progress }: { progress: Progress | null }) {
  const router = useRouter();
  const [p, setP] = useState<Progress | null>(progress);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const link = p?.code ? `${APP_URL}/r/${p.code}` : null;

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  async function share() {
    if (!link) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      // Bare URL → iMessage/WhatsApp show a rich preview of the invite.
      try { await navigator.share({ url: link }); } catch { /* user cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(link); setClaimMsg({ ok: true, text: "Link copied — paste it into a text!" }); } catch { /* ignore */ }
    }
  }

  async function claim() {
    setClaiming(true);
    setClaimMsg(null);
    try {
      const res = await fetch("/api/referrals/claim", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setClaimMsg({ ok: true, text: "🎉 Pro is active for the next month — enjoy!" });
        // Refresh local progress + the page (plan badge etc.).
        const fresh = await fetch("/api/referrals/claim").then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (fresh) setP(fresh);
        router.refresh();
      } else {
        setClaimMsg({ ok: false, text: d.error || "Couldn't claim — try again." });
      }
    } catch {
      setClaimMsg({ ok: false, text: "Couldn't claim — try again." });
    }
    setClaiming(false);
  }

  const per = 3;
  const cap = 3;

  return (
    <div id="refer" className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5 scroll-mt-24">
      <p className="text-gray-200 text-sm font-medium mb-1">Refer a friend</p>
      <p className="text-gray-500 text-xs mb-4 leading-relaxed">
        Invite <strong className="text-gray-300">3 friends</strong> who sign up and you get{" "}
        <strong className="text-gray-300">1 month of Pro free</strong> — up to 3 months total. Your friends get a free month of Pro too.
      </p>

      {p?.code && link ? (
        <>
          {/* Claim banner — the explicit tap */}
          {p.claimable > 0 && (
            <button
              type="button"
              onClick={claim}
              disabled={claiming}
              className="w-full mb-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold py-3 transition-colors"
            >
              {claiming ? "Activating…" : `🎉 Claim your free month of Pro${p.claimable > 1 ? ` (${p.claimable} ready)` : ""}`}
            </button>
          )}
          {claimMsg && (
            <p className={`text-xs mb-3 ${claimMsg.ok ? "text-emerald-400" : "text-amber-400"}`}>{claimMsg.text}</p>
          )}

          {/* Progress — dots for the current batch + months earned */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                {Array.from({ length: per }, (_, i) => {
                  const filled = p.capReached ? true : i < p.progressInBatch || p.claimable > 0;
                  return <span key={i} className={`w-6 h-1.5 rounded-full ${filled ? "bg-blue-500" : "bg-gray-700"}`} />;
                })}
              </div>
              <p className="text-[11px] text-gray-500">
                {p.capReached
                  ? "You've earned all 3 referral months — thanks for spreading the word! 🙌"
                  : p.claimable > 0
                  ? "3 of 3 complete — claim your month above!"
                  : `${p.progressInBatch} of ${per} signups toward your next free month`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white font-bold text-sm tabular-nums">{p.monthsClaimed}/{cap}</p>
              <p className="text-[10px] text-gray-600">months earned</p>
            </div>
          </div>

          {/* The link + share/copy */}
          <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 mb-2">
            <p className="text-blue-400 text-[12px] font-mono break-all">{link.replace(/^https?:\/\//, "")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={share}
              className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-full transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              Share / text it
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs font-semibold py-2.5 rounded-full transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
        </>
      ) : (
        <p className="text-gray-600 text-xs">Your referral link will appear here once setup finishes.</p>
      )}
    </div>
  );
}
