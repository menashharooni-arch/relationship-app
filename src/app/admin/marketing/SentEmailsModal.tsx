"use client";

// "View sent emails" — the private admin's log of every campaign sent through
// "Send email to users". List → detail (full message + per-recipient outcomes,
// searchable and paginated). Read-only; data comes from admin_email_campaigns
// + email_logs via the admin-gated log APIs.

import { useCallback, useEffect, useState } from "react";

type Campaign = {
  id: string;
  sent_by: string;
  segment: string;
  subject: string;
  headline?: string | null;
  body?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  intended_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  status: string;
  created_at: string;
  completed_at?: string | null;
};

type Recipient = { email: string; status: string | null; error: string | null; resend_id: string | null };

const SEGMENT_LABEL: Record<string, string> = {
  all: "All users",
  free: "Free users",
  pro: "Pro + Office",
  office: "Office only",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sent: { label: "Sent", cls: "bg-emerald-900/50 text-emerald-300" },
    partial: { label: "Partially sent", cls: "bg-amber-900/50 text-amber-300" },
    failed: { label: "Failed", cls: "bg-red-900/50 text-red-300" },
    processing: { label: "Processing", cls: "bg-blue-900/50 text-blue-300" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-800 text-gray-400" };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function SentEmailsModal({ onClose }: { onClose: () => void }) {
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Detail view
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recTotal, setRecTotal] = useState(0);
  const [recPage, setRecPage] = useState(0);
  const [recQuery, setRecQuery] = useState("");
  const [recLoading, setRecLoading] = useState(false);
  const pageSize = 100;

  useEffect(() => {
    fetch("/api/admin/broadcast/logs")
      .then((r) => r.json())
      .then((d) => {
        setReady(d.ready !== false);
        setCampaigns(d.campaigns ?? []);
      })
      .catch(() => setError("Couldn't load the email history — please try again."))
      .finally(() => setLoading(false));
  }, []);

  const loadRecipients = useCallback(async (campaign: Campaign, page: number, q: string) => {
    setRecLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q) params.set("q", q);
      const res = await fetch(`/api/admin/broadcast/logs/${campaign.id}?${params}`);
      const d = await res.json();
      if (res.ok) {
        setDetail(d.campaign ?? campaign);
        setRecipients(d.recipients ?? []);
        setRecTotal(d.total ?? 0);
        setRecPage(page);
      } else {
        setError(d.error === "Not found" ? "That email log entry no longer exists." : "Couldn't load that email — please try again.");
      }
    } catch {
      setError("Couldn't load that email — please try again.");
    } finally {
      setRecLoading(false);
    }
  }, []);

  function openDetail(c: Campaign) {
    setError(null);
    setRecQuery("");
    setDetail(c);
    loadRecipients(c, 0, "");
  }

  const totalPages = Math.max(1, Math.ceil(recTotal / pageSize));

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center px-4 py-8" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {detail && (
              <button onClick={() => { setDetail(null); setError(null); }} className="text-gray-500 hover:text-white shrink-0" aria-label="Back to the list">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
              </button>
            )}
            <p className="text-white font-bold truncate">{detail ? detail.subject : "Sent emails"}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white shrink-0" aria-label="Close">✕</button>
        </div>

        <div className="overflow-y-auto p-6">
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          {/* ── List view ── */}
          {!detail && (
            <>
              {loading && <p className="text-gray-500 text-sm text-center py-8">Loading…</p>}
              {!loading && !ready && (
                <p className="text-amber-300 text-xs bg-amber-950/40 border border-amber-800/40 rounded-xl px-3 py-2.5">
                  The email log isn&apos;t set up yet — run <span className="font-mono">supabase/admin-email-log.sql</span> in the Supabase SQL editor. Emails sent after that will appear here.
                </p>
              )}
              {!loading && ready && campaigns.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-10">
                  No admin emails have been sent yet. Emails sent through &ldquo;Send email to users&rdquo; will appear here.
                </p>
              )}
              {!loading && campaigns.length > 0 && (
                <div className="divide-y divide-gray-800/60 -mx-2">
                  {campaigns.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openDetail(c)}
                      className="w-full text-left px-2 py-3 hover:bg-gray-800/40 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-white text-sm font-semibold truncate">{c.subject}</p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        {fmt(c.created_at)} · {SEGMENT_LABEL[c.segment] ?? c.segment} · by {c.sent_by}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {c.intended_count} intended · <span className="text-emerald-400">{c.sent_count} sent</span>
                        {c.failed_count > 0 && <> · <span className="text-red-400">{c.failed_count} failed</span></>}
                        {c.skipped_count > 0 && <> · {c.skipped_count} skipped</>}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Detail view ── */}
          {detail && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                <StatusBadge status={detail.status} />
                <span>{fmt(detail.created_at)}</span>
                <span>· {SEGMENT_LABEL[detail.segment] ?? detail.segment}</span>
                <span>· sent by {detail.sent_by}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { k: "Intended", v: detail.intended_count, cls: "text-white" },
                  { k: "Sent", v: detail.sent_count, cls: "text-emerald-400" },
                  { k: "Failed", v: detail.failed_count, cls: "text-red-400" },
                  { k: "Skipped", v: detail.skipped_count, cls: "text-gray-300" },
                ].map((s) => (
                  <div key={s.k} className="bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider">{s.k}</p>
                    <p className={`text-lg font-bold ${s.cls}`}>{s.v}</p>
                  </div>
                ))}
              </div>

              {/* Full message */}
              <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4 space-y-2">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider">Message</p>
                {detail.headline && <p className="text-white text-sm font-semibold">{detail.headline}</p>}
                <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{detail.body}</p>
                {detail.cta_label && (
                  <p className="text-gray-500 text-xs pt-1">
                    Button: <span className="text-blue-400">{detail.cta_label}</span>
                    {detail.cta_url ? <> → <span className="text-gray-400 break-all">{detail.cta_url}</span></> : null}
                  </p>
                )}
              </div>

              {/* Recipients */}
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Recipients ({recTotal})</p>
                  <input
                    type="search"
                    value={recQuery}
                    onChange={(e) => {
                      setRecQuery(e.target.value);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") loadRecipients(detail, 0, recQuery); }}
                    onBlur={() => loadRecipients(detail, 0, recQuery)}
                    placeholder="Search email…"
                    className="bg-gray-950 border border-gray-800 text-white placeholder-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 w-44"
                  />
                </div>
                {recLoading ? (
                  <p className="text-gray-500 text-sm text-center py-6">Loading recipients…</p>
                ) : recipients.length === 0 ? (
                  <p className="text-gray-500 text-xs text-center py-6">
                    {recQuery ? "No recipients match that search." : "No per-recipient records for this email."}
                  </p>
                ) : (
                  <div className="border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800/60">
                    {recipients.map((r, i) => (
                      <div key={`${r.email}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <span className="text-gray-300 truncate">{r.email}</span>
                        <span className="shrink-0">
                          {r.status === "failed" ? (
                            <span className="text-red-400" title={r.error ?? undefined}>Failed</span>
                          ) : r.status === "skipped" ? (
                            <span className="text-gray-500" title={r.error ?? undefined}>Skipped</span>
                          ) : (
                            <span className="text-emerald-400">Sent</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <button
                      disabled={recPage === 0 || recLoading}
                      onClick={() => loadRecipients(detail, recPage - 1, recQuery)}
                      className="text-blue-400 hover:text-blue-300 disabled:opacity-40"
                    >
                      ← Previous
                    </button>
                    <span className="text-gray-500">Page {recPage + 1} of {totalPages}</span>
                    <button
                      disabled={recPage + 1 >= totalPages || recLoading}
                      onClick={() => loadRecipients(detail, recPage + 1, recQuery)}
                      className="text-blue-400 hover:text-blue-300 disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
