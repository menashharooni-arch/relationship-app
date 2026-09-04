"use client";

import { useState } from "react";
import { useIsNativeApp } from "@/lib/platform";
import { createBrowserClient } from "@supabase/ssr";
import DownloadLink from "@/components/DownloadLink";
import {
  reasonsFor,
  reasonById,
  offerStep,
  keepStep,
  lossLines,
  stepsFor,
  progressLabel,
  type AccountFacts,
  type Eligibility,
  type PlanSource,
  type RetentionPlan,
  type StepId,
} from "@/lib/retention";

// Advanced account settings → Account ownership and deletion.
//
// Deletion is a SEQUENCE, not a switch (owner order 2026-09-04): ask why, ask
// what would have fixed it, then make the two best offers this particular
// account can actually be given, then show what deleting destroys in their own
// numbers, and only then take the typed DELETE. Free and Pro get different
// questions and different offers — see lib/retention.ts, which owns every word
// of it so the copy is testable and the two plans can't drift into each other.
//
// Apple 5.1.1(v): deletion stays reachable and completable. Every step carries
// a button that continues toward deletion, offers are declined by pressing it,
// and no step can trap someone. Apple 3.1.1: inside the shell there are no
// prices, no checkout and no links out — the copy for that comes from
// retention.ts, which is handed `native`.
export default function ManageAccount({ isPro, plan = "free", email = "", isOfficeOwner = false }: { isPro: boolean; plan?: string; email?: string; isOfficeOwner?: boolean }) {
  const native = useIsNativeApp();
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState<StepId>("why");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  // null = still checking; false = OAuth-only account (no password to re-check).
  const [needsPassword, setNeedsPassword] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // What the server says this account is and may be offered. Until it answers,
  // the sequence runs on the conservative default: no offers.
  const [facts, setFacts] = useState<AccountFacts | null>(null);
  const [elig, setElig] = useState<Eligibility>({ grant: false, discount: false, downgrade: false });
  const [source, setSource] = useState<PlanSource>(null);
  // Set when an offer is accepted — the modal turns into a confirmation and
  // deletion is off the table for this visit.
  const [saved, setSaved] = useState<string | null>(null);

  const retPlan: RetentionPlan = isPro || plan !== "free" ? "pro" : "free";
  const steps = stepsFor(retPlan, elig, native);
  const offer = offerStep(retPlan, elig, native);
  const keep = keepStep(retPlan, elig, source);
  const picked = reasonById(retPlan, reason);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function openModal() {
    setStep("why");
    setReason("");
    setComment("");
    setConfirmText("");
    setPassword("");
    setError("");
    setSaved(null);
    setModal(true);
    // Reauthentication is only possible when the account has a password
    // identity — a Google-only account has nothing to re-enter.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const hasPassword = !!user?.identities?.some((i) => i.provider === "email");
      setNeedsPassword(hasPassword);
    } catch {
      setNeedsPassword(false);
    }
    // Offers and numbers. A failure here is silent on purpose: the sequence
    // still runs, just without offers it can't prove the account qualifies for.
    try {
      const res = await fetch("/api/account/retention");
      if (res.ok) {
        const d = await res.json();
        setElig(d.eligibility);
        setSource(d.source ?? null);
        setFacts({ ...d.facts, isOfficeOwner });
      }
    } catch { /* offers stay off */ }
  }

  function goNext(from: StepId) {
    const i = steps.indexOf(from);
    const next = steps[i + 1];
    if (next) setStep(next);
  }

  // Step 1 → 2. The reason is the one thing we insist on, and it is recorded
  // immediately: someone who takes an offer at step 3 and stays has still told
  // us why they nearly left, which is the most valuable answer in here.
  function continueFromWhy() {
    if (!reason) {
      setError("Please pick a reason so we can improve.");
      return;
    }
    setError("");
    goNext("why");
  }

  function continueFromDetail() {
    setError("");
    void fetch("/api/account/retention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "survey", reason: picked?.label ?? reason, comment }),
    }).catch(() => {});
    goNext("detail");
  }

  async function acceptOffer(action: string) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: picked?.label ?? reason, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't do that right now. Please try again.");
        setLoading(false);
        return;
      }
      setSaved(action);
      setLoading(false);
    } catch {
      setError("Couldn't do that right now. Please try again.");
      setLoading(false);
    }
  }

  async function finalizeDelete() {
    if (confirmText.trim().toUpperCase() !== "DELETE" || loading) return;
    setLoading(true);
    setError("");
    try {
      // Reauthenticate first when the account supports it, so a borrowed
      // unlocked session can't delete the account.
      if (needsPassword) {
        if (!password) {
          setError("Enter your password to confirm it's you.");
          setLoading(false);
          return;
        }
        const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        if (authErr) {
          setError("That password doesn't match. Please try again.");
          setLoading(false);
          return;
        }
      }
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: picked?.label ?? reason, comment }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't delete the account. Try again.");
        setLoading(false);
        return;
      }
      // assign(), not `location.href =` — the same navigation, but a method
      // call rather than a write to a value the component does not own.
      window.location.assign("/account-deleted");
    } catch {
      setError("Couldn't delete the account. Try again.");
      setLoading(false);
    }
  }

  const primaryBtn = "flex-1 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-full py-2.5 transition-colors";
  const ghostBtn = "flex-1 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-full py-2.5 transition-colors";
  const stepLabel = progressLabel(steps, step);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-300 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl px-5 py-4 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-gray-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
          </svg>
          Account ownership and deletion
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 bg-gray-900 border border-red-900/40 rounded-2xl p-5">
          <p className="text-white text-sm font-semibold">Delete account</p>
          <p className="text-gray-500 text-xs mt-0.5 mb-3 leading-relaxed">
            Permanently deletes your cards and contacts and cancels any subscription. Your email can&apos;t be used to sign up again.
          </p>
          {/* Native (App Store 5.1.1 + 3.1.1): the Plan-and-billing section is
              hidden inside the Capacitor shell, so this pointer would be a dead
              anchor referencing subscription management — web only. */}
          {isPro && !native && (
            <p className="text-gray-500 text-[11px] mb-3 leading-relaxed">
              Just want to stop paying? You can <a href="#billing" className="text-blue-400 hover:text-blue-300 underline">cancel or switch to Free in Plan and billing</a> and keep your account.
            </p>
          )}
          <button
            type="button"
            onClick={openModal}
            className="text-xs font-semibold text-red-400 hover:text-red-300 border border-red-900/60 hover:border-red-700 rounded-full px-4 py-2 transition-colors"
          >
            Delete account
          </button>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={(e) => e.target === e.currentTarget && !loading && setModal(false)}>
          <div className="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl p-5 max-h-[88vh] overflow-y-auto">
            {/* An accepted offer ends the sequence — nothing left to delete today. */}
            {saved ? (
              <>
                <p className="text-white font-bold text-base mb-2">
                  {saved === "grant" && "Pro is on — enjoy it"}
                  {saved === "discount" && "Discount applied"}
                  {saved === "downgrade" && "You're on Free — nothing was deleted"}
                  {saved === "quiet" && "We'll stop emailing you"}
                </p>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                  {saved === "grant" && "Your account is on Pro now, free, and it ends on its own — there's nothing to cancel. Your card, your link and your contacts are exactly where you left them."}
                  {saved === "discount" && "It comes off your next invoices automatically. Nothing else changes — same account, same card, same everything."}
                  {saved === "downgrade" && "Billing has stopped. Your card is still live, your link still works, and every contact you've collected is still here."}
                  {saved === "quiet" && "Every SwiftCard email to you is off. Your card, your link and your contacts are untouched — come back whenever you want."}
                </p>
                <button type="button" onClick={() => setModal(false)} className="w-full text-sm font-semibold text-white bg-gray-800 hover:bg-gray-700 rounded-full py-2.5 transition-colors">
                  Done
                </button>
              </>
            ) : (
              <>
                {stepLabel && <p className="text-gray-600 text-[11px] font-semibold tracking-wide uppercase mb-2">{stepLabel}</p>}

                {/* 1 — why */}
                {step === "why" && (
                  <>
                    <p className="text-white font-bold text-base mb-1">Before you go</p>
                    <p className="text-gray-500 text-xs mb-4">
                      {retPlan === "pro"
                        ? "You've been paying for this, so we'd genuinely like to know — what went wrong?"
                        : "Help us improve — why are you deleting your account?"}
                    </p>
                    <div className="space-y-1.5 mb-3">
                      {reasonsFor(retPlan).map((r) => (
                        <label key={r.id} className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer">
                          <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} className="accent-blue-600" />
                          {r.label}
                        </label>
                      ))}
                    </div>
                    {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                    <div className="flex gap-2 mt-4">
                      <button type="button" onClick={() => setModal(false)} className={ghostBtn}>Cancel</button>
                      <button type="button" onClick={continueFromWhy} className={primaryBtn}>Continue</button>
                    </div>
                  </>
                )}

                {/* 2 — the follow-up that changes with the answer */}
                {step === "detail" && (
                  <>
                    <p className="text-white font-bold text-base mb-1">{picked?.followUp ?? "Anything else we should know?"}</p>
                    <p className="text-gray-500 text-xs mb-3">Optional, but it&apos;s the part we actually read.</p>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      placeholder={picked?.placeholder ?? "Optional"}
                      className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-2 mt-4">
                      <button type="button" onClick={() => setStep("why")} className={ghostBtn}>Back</button>
                      <button type="button" onClick={continueFromDetail} className={primaryBtn}>Continue</button>
                    </div>
                  </>
                )}

                {/* 3 — the plan/money save */}
                {step === "offer" && offer && (
                  <>
                    <p className="text-white font-bold text-base mb-2">{offer.title}</p>
                    <p className="text-gray-400 text-sm mb-4 leading-relaxed">{offer.body}</p>
                    {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
                    {offer.accept && offer.action && (
                      <button
                        type="button"
                        onClick={() => acceptOffer(offer.action!)}
                        disabled={loading}
                        className="w-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-full py-2.5 transition-colors mb-2"
                      >
                        {loading ? "One moment…" : offer.accept}
                      </button>
                    )}
                    <button type="button" onClick={() => goNext("offer")} className="w-full text-xs text-gray-500 hover:text-gray-300 py-1.5 transition-colors">
                      {offer.decline}
                    </button>
                  </>
                )}

                {/* 4 — the save that costs nothing */}
                {step === "keep" && (
                  <>
                    <p className="text-white font-bold text-base mb-2">{keep.title}</p>
                    <p className="text-gray-400 text-sm mb-4 leading-relaxed">{keep.body}</p>
                    {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
                    {keep.accept && keep.action && (
                      <button
                        type="button"
                        onClick={() => acceptOffer(keep.action!)}
                        disabled={loading}
                        className="w-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-full py-2.5 transition-colors mb-2"
                      >
                        {loading ? "One moment…" : keep.accept}
                      </button>
                    )}
                    <button type="button" onClick={() => goNext("keep")} className="w-full text-xs text-gray-500 hover:text-gray-300 py-1.5 transition-colors">
                      {keep.decline}
                    </button>
                  </>
                )}

                {/* 5 — what deleting actually destroys, in their numbers */}
                {step === "loss" && (
                  <>
                    <p className="text-white font-bold text-base mb-2">Here&apos;s what goes</p>
                    <ul className="text-gray-400 text-sm mb-3 leading-relaxed space-y-2 list-disc pl-4">
                      {lossLines(retPlan, facts ?? { contacts: 0, views: 0, cards: 0, cardUrl: null, since: null, isOfficeOwner }).map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                    <p className="text-gray-500 text-xs mb-4 leading-relaxed">
                      Everything is held for 30 days first, so you can reopen the account in that window. After that it&apos;s gone for good.
                    </p>
                    {/* Only offered where it actually works: CSV export is a
                        Pro feature, so dangling it in front of a Free account
                        would be a promise that 403s. DownloadLink is what makes
                        it save properly inside the iOS shell too. */}
                    {retPlan === "pro" && facts && facts.contacts > 0 && (
                      <DownloadLink
                        href="/api/leads/export"
                        className="block w-full text-center text-sm font-semibold text-white bg-gray-800 hover:bg-gray-700 rounded-full py-2.5 transition-colors mb-2"
                      >
                        Download my {facts.contacts} contact{facts.contacts === 1 ? "" : "s"} first
                      </DownloadLink>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setModal(false)} className={ghostBtn}>Keep my account</button>
                      <button type="button" onClick={() => goNext("loss")} className="flex-1 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-full py-2.5 transition-colors">
                        Continue
                      </button>
                    </div>
                  </>
                )}

                {/* 6 — the typed confirmation */}
                {step === "confirm" && (
                  <>
                    <p className="text-white font-bold text-base mb-2">Delete account?</p>
                    <div className="text-gray-400 text-sm mb-4 leading-relaxed space-y-2">
                      <p>
                        <span className="text-white font-semibold">Deleted:</span> your account, your cards and their public links, and{" "}
                        <span className="text-white font-semibold">all of your contacts</span>. Any subscription is canceled so you won&apos;t be billed again.
                      </p>
                      <p>
                        <span className="text-white font-semibold">Kept for one month:</span> everything above is held for 30 days so you can reopen your account — after that it&apos;s gone for good and can&apos;t be recovered. Your email can&apos;t be used to sign up again while the account is held.
                      </p>
                      {isOfficeOwner && (
                        <p className="text-amber-300/90">
                          <span className="text-amber-200 font-semibold">You own a team:</span> deleting your account cancels your team&apos;s subscription immediately, and every teammate&apos;s card loses its Office features once your account is gone. Consider removing your team members first, or transferring ownership by contacting support.
                        </p>
                      )}
                    </div>
                    {needsPassword && (
                      <>
                        <label className="block text-xs text-gray-500 mb-1.5">Confirm it&apos;s you — enter your password</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Your password"
                          autoComplete="current-password"
                          className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 mb-3"
                        />
                      </>
                    )}
                    <label className="block text-xs text-gray-500 mb-1.5">Type DELETE to confirm</label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 mb-3"
                    />
                    {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setModal(false)} disabled={loading} className={ghostBtn}>
                        Keep my account
                      </button>
                      <button
                        type="button"
                        onClick={finalizeDelete}
                        disabled={loading || confirmText.trim().toUpperCase() !== "DELETE" || (needsPassword === true && !password)}
                        className="flex-1 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded-full py-2.5 transition-colors"
                      >
                        {loading ? "Deleting…" : "Delete account"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
