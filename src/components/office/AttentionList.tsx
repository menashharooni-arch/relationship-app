"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AttentionItem } from "@/lib/office-attention";
import { AddMemberButton } from "@/components/office/TeamActions";

// Renders the (already computed, already real) action items. The only logic here
// is turning the two href-less kinds into working in-page actions.

function ResendInvite({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setNote(null);
    try {
      // The row id is all we have here; the invite route keys off the email, so
      // ask the office endpoint for it rather than trusting anything client-side.
      const office = await fetch("/api/office").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const row = (office?.office_members ?? []).find((m: { id: string }) => m.id === memberId);
      if (!row?.invite_email) { setNote("Couldn't find that invite — refresh and try again."); return; }
      const res = await fetch("/api/office/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: row.invite_email }),
      });
      if (res.ok) { setNote("Invite re-sent ✓"); router.refresh(); }
      else {
        const j = await res.json().catch(() => ({}));
        setNote(j.message ?? j.error ?? "Couldn't resend — try again.");
      }
    } catch {
      setNote("Couldn't reach the server — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (note) return <span className="text-[11px] text-gray-500 shrink-0">{note}</span>;
  return (
    <button
      onClick={resend}
      disabled={busy}
      className="text-[11px] font-semibold text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-3 py-1.5 rounded-full transition-colors shrink-0"
    >
      {busy ? "Sending…" : "Resend invite"}
    </button>
  );
}

export default function AttentionList({ items, canManageSeats }: { items: AttentionItem[]; canManageSeats: boolean }) {
  if (!items.length) return null;

  return (
    <section aria-labelledby="needs-attention" className="mb-6">
      <div className="bg-gray-900 border border-amber-500/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />
          <h2 id="needs-attention" className="text-sm font-bold text-white">Needs your attention</h2>
          <span className="text-[11px] text-gray-600 tabular-nums">{items.length}</span>
        </div>
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li
              key={`${it.kind}-${it.targetId ?? i}`}
              className="flex items-start justify-between gap-3 flex-wrap rounded-xl bg-gray-950/40 border border-gray-800 px-3.5 py-3"
            >
              <div className="min-w-0 flex items-start gap-2.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${it.severity === "high" ? "bg-amber-400" : "bg-gray-600"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[13px] text-white font-medium">{it.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{it.detail}</p>
                </div>
              </div>

              {it.href ? (
                <Link
                  href={it.href}
                  className="text-[11px] font-semibold text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-full transition-colors shrink-0"
                >
                  {it.actionLabel}
                </Link>
              ) : it.kind === "invite_expired" && it.targetId ? (
                <ResendInvite memberId={it.targetId} />
              ) : (
                // empty_seat / seats_full → the same modal the header button opens.
                <AddMemberButton canManageSeats={canManageSeats} label={it.actionLabel} variant="small" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
