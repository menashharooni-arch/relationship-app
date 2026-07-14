"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ── Team-tab actions: add a member, manage an invite, remove a member ───────
// Written for an owner who has never used a dashboard: one action per button,
// plain words, the price stated before anything is charged, and a clear
// "what will happen" before anything destructive.

type SeatInfo = {
  seats: number;
  interval: "monthly" | "annual" | null;
  perSeatCents: number | null;
  billable: boolean;
  usage: { purchased: number; used: number; available: number };
};

function usd(cents: number): string {
  return `$${(Math.round(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function perWord(interval: SeatInfo["interval"]): string {
  return interval === "annual" ? "year" : "month";
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-base">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-white text-xl leading-none px-1">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Add team member ──────────────────────────────────────────────────────────
// One smooth action: email in → invite out. When seats are full, the SAME modal
// offers to buy the seat (price stated) and sends the invite in the same click.

export function AddMemberButton({ canManageSeats, label, variant = "button" }: {
  canManageSeats: boolean;
  label?: string;
  variant?: "button" | "link"; // "link" renders as an inline text action (setup checklist)
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<null | "invite" | "seat">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Set when the invite bounced off a full office: we show the one-click
  // "add a seat & send" path instead of a dead end.
  const [needsSeat, setNeedsSeat] = useState(false);
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    // Pre-fetch seat pricing so the upsell can state the real price instantly.
    fetch("/api/stripe/subscription/seats")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live) setSeatInfo(j); })
      .catch(() => { if (live) setSeatInfo(null); });
    return () => { live = false; };
  }, [open]);

  function reset() {
    setOpen(false); setEmail(""); setName(""); setBusy(null);
    setError(null); setDone(null); setNeedsSeat(false);
  }

  async function sendInvite(): Promise<"ok" | "no_seats" | "error"> {
    const res = await fetch("/api/office/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return "ok";
    if (res.status === 409 && json.error === "no_seats") return "no_seats";
    setError(json.message ?? json.error ?? "Couldn't send the invite. Please try again.");
    return "error";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy("invite"); setError(null);
    try {
      const r = await sendInvite();
      if (r === "ok") {
        setDone(`Invite sent to ${email.trim()} ✓`);
        router.refresh();
      } else if (r === "no_seats") {
        setNeedsSeat(true);
      }
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function addSeatAndInvite() {
    if (!seatInfo) return;
    setBusy("seat"); setError(null);
    try {
      const res = await fetch("/api/stripe/subscription/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats: seatInfo.seats + 1 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message ?? json.error ?? "Couldn't add the seat. Your card was not charged — please try again.");
        return;
      }
      const r = await sendInvite();
      if (r === "ok") {
        setDone(`Seat added and invite sent to ${email.trim()} ✓`);
        setNeedsSeat(false);
        router.refresh();
      } else {
        // The seat purchase went through but the invite didn't — say exactly
        // that, so they know to just retry the (free) invite, not the payment.
        setError("Your new seat was added, but the invite didn't send. Press \"Send invite\" to try again — you won't be charged twice.");
        setNeedsSeat(false);
      }
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const firstName = name.trim() ? name.trim().split(/\s+/)[0] : email.split("@")[0] || "them";
  const seatPrice = seatInfo?.perSeatCents != null ? `${usd(seatInfo.perSeatCents)}/${perWord(seatInfo.interval)}` : null;

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className={
          variant === "link"
            ? "text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            : "bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors shrink-0"
        }
      >
        {label ?? "+ Add team member"}
      </button>

      {open && (
        <Modal title="Add a team member" onClose={reset}>
          {done ? (
            <div>
              <p className="text-green-400 text-sm font-semibold mb-1">{done}</p>
              <p className="text-gray-500 text-xs mb-4">
                They&apos;ll get an email with a link to create their card. It takes them about 2 minutes.
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setDone(null); setEmail(""); setName(""); }}
                  className="text-xs font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-full transition-colors">
                  Add another person
                </button>
                <button onClick={reset}
                  className="text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-full transition-colors">
                  Done
                </button>
              </div>
            </div>
          ) : needsSeat ? (
            <div>
              <p className="text-gray-300 text-sm mb-1.5">
                All {seatInfo?.usage?.purchased ?? seatInfo?.seats ?? "your"} of your seats are in use.
              </p>
              {canManageSeats && seatInfo?.billable && seatPrice ? (
                <>
                  <p className="text-gray-500 text-xs mb-4">
                    Add one more seat for <strong className="text-gray-300">{seatPrice}</strong> to
                    invite {firstName}? You&apos;ll be charged a smaller, partial amount today for the
                    rest of this billing period.
                  </p>
                  {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
                  <button
                    onClick={addSeatAndInvite}
                    disabled={busy !== null}
                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-full transition-colors"
                  >
                    {busy === "seat" ? "Adding seat…" : `Add seat & send invite (${seatPrice})`}
                  </button>
                  <button onClick={() => setNeedsSeat(false)} disabled={busy !== null}
                    className="w-full text-gray-500 hover:text-gray-300 text-xs py-2 mt-1 transition-colors">
                    Go back
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-500 text-xs mb-4">
                    {canManageSeats
                      ? "Your plan doesn't support adding seats from here — manage seats from Settings → Billing."
                      : "Ask the account owner to add a seat, then send this invite again."}
                  </p>
                  <button onClick={() => setNeedsSeat(false)}
                    className="w-full text-gray-300 bg-gray-800 hover:bg-gray-700 text-sm font-semibold py-2.5 rounded-full transition-colors">
                    Go back
                  </button>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={submit}>
              <p className="text-gray-500 text-xs mb-4">
                We&apos;ll email them a link to create their own {""}
                company card. You only need their email.
              </p>
              <label className="block mb-3">
                <span className="text-xs font-medium text-gray-400">Their email</span>
                <input
                  type="email" required autoFocus value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dana@company.com"
                  className="mt-1 w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </label>
              <label className="block mb-4">
                <span className="text-xs font-medium text-gray-400">Their name <span className="text-gray-600 font-normal">(optional)</span></span>
                <input
                  type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dana Lee"
                  className="mt-1 w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </label>
              {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
              <button
                type="submit"
                disabled={busy !== null || !email.trim()}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-full transition-colors"
              >
                {busy === "invite" ? "Sending…" : "Send invite"}
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

// ── Pending-invite row actions ────────────────────────────────────────────────

export function InviteRowActions({ memberId, email }: { memberId: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "resend" | "cancel">(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function resend() {
    setBusy("resend"); setNote(null);
    try {
      const res = await fetch("/api/office/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) { setNote("Invite re-sent ✓"); router.refresh(); }
      else {
        const j = await res.json().catch(() => ({}));
        setNote(j.message ?? j.error ?? "Couldn't resend — try again.");
      }
    } catch {
      setNote("Couldn't reach the server — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel"); setNote(null);
    try {
      const res = await fetch(`/api/office/members?id=${memberId}`, { method: "DELETE" });
      if (res.ok) { setNote("Invite canceled ✓"); router.refresh(); }
      else setNote("Couldn't cancel — try again.");
    } catch {
      setNote("Couldn't reach the server — try again.");
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <button onClick={resend} disabled={busy !== null}
        className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/15 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50">
        {busy === "resend" ? "Sending…" : "Resend"}
      </button>
      {confirming ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400">Cancel this invite?</span>
          <button onClick={cancel} disabled={busy !== null}
            className="text-[11px] font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/15 px-2 py-1 rounded-full disabled:opacity-50">
            {busy === "cancel" ? "…" : "Yes, cancel"}
          </button>
          <button onClick={() => setConfirming(false)} className="text-[11px] text-gray-500 hover:text-gray-300 px-1">
            Keep
          </button>
        </span>
      ) : (
        <button onClick={() => setConfirming(true)} disabled={busy !== null}
          className="text-[11px] font-semibold text-gray-500 hover:text-gray-300 px-1.5 py-1 transition-colors disabled:opacity-50">
          Cancel
        </button>
      )}
      {note && <span className="text-[11px] text-gray-500">{note}</span>}
    </span>
  );
}

// ── Remove from team ─────────────────────────────────────────────────────────
// Two-step: a plain-language confirmation of exactly what happens, then (for
// someone who can manage seats) a follow-up choice about the now-empty seat.

export function RemoveMemberButton({ memberId, personName, canManageSeats }: {
  memberId: string;
  personName: string;
  canManageSeats: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "seat" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [seatNote, setSeatNote] = useState<string | null>(null);
  const first = personName.split(/\s+/)[0] || "They";

  async function remove() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/office/members?id=${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Couldn't remove them — please try again.");
        return;
      }
      if (canManageSeats) {
        // Offer the seat decision with the real numbers.
        const info = await fetch("/api/stripe/subscription/seats")
          .then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (info?.billable && info.perSeatCents != null && info.seats > (info.usage?.used ?? 1)) {
          setSeatInfo(info);
          setStep("seat");
          router.refresh();
          return;
        }
      }
      setStep("done");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function dropSeat() {
    if (!seatInfo) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/stripe/subscription/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats: seatInfo.seats - 1 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Couldn't remove the seat — you can also do this later from Settings → Billing.");
        return;
      }
      setSeatNote(
        j.mode === "scheduled" || j.scheduledSeats != null
          ? "Done ✓ Your bill goes down at your next renewal — you keep the seat until then."
          : "Seat removed ✓",
      );
      setStep("done");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setStep("confirm"); setError(null); }}
        className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 px-3.5 py-2 rounded-full transition-colors"
      >
        Remove from team
      </button>

      {step === "confirm" && (
        <Modal title={`Remove ${first} from your team?`} onClose={() => setStep("idle")}>
          <p className="text-gray-300 text-sm mb-1.5">Here&apos;s what will happen:</p>
          <ul className="text-gray-500 text-xs space-y-1 mb-4 list-disc pl-4">
            <li>{first}&apos;s card will be turned off — people can no longer open it.</li>
            <li>The leads {first} captured <strong className="text-gray-300">stay with your company</strong> in your Leads tab.</li>
            <li>Their seat frees up for your next hire.</li>
          </ul>
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <button onClick={remove} disabled={busy}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-full transition-colors">
            {busy ? "Removing…" : `Remove ${first}`}
          </button>
          <button onClick={() => setStep("idle")} disabled={busy}
            className="w-full text-gray-500 hover:text-gray-300 text-xs py-2 mt-1 transition-colors">
            Never mind
          </button>
        </Modal>
      )}

      {step === "seat" && seatInfo && (
        <Modal title={`${first} was removed ✓`} onClose={() => setStep("idle")}>
          <p className="text-gray-300 text-sm mb-1.5">You now have an empty seat.</p>
          <p className="text-gray-500 text-xs mb-4">
            You&apos;re paying {seatInfo.perSeatCents != null ? usd(seatInfo.perSeatCents) : ""}/{perWord(seatInfo.interval)} for it.
            Remove it to lower your bill, or keep it if you&apos;re hiring soon.
          </p>
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <button onClick={dropSeat} disabled={busy}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-full transition-colors">
            {busy ? "Updating…" : "Remove the empty seat & lower my bill"}
          </button>
          <button onClick={() => setStep("idle")} disabled={busy}
            className="w-full text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 text-sm font-semibold py-2.5 rounded-full mt-2 transition-colors">
            Keep the seat for my next hire
          </button>
        </Modal>
      )}

      {step === "done" && (
        <Modal title="All set ✓" onClose={() => setStep("idle")}>
          <p className="text-gray-400 text-sm mb-4">{seatNote ?? `${first} was removed from your team.`}</p>
          <button onClick={() => { setStep("idle"); window.location.href = "/office/admin"; }}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-full transition-colors">
            Back to my team
          </button>
        </Modal>
      )}
    </>
  );
}
