"use client";

import { useMemo, useState } from "react";
import { relativeTime } from "@/lib/relative-time";
// The status vocabulary comes from lib/lead-status, NOT lib/office-leads:
// office-leads reaches for the service-role database client, and importing a
// value from it here would put that module on this client bundle's path.
// OfficeLead stays a TYPE import, which the compiler erases entirely.
import { leadStatusView, LEAD_STATUS_OPTIONS, type LeadStatusValue } from "@/lib/lead-status";
import type { OfficeLead } from "@/lib/office-leads";
import DownloadLink from "@/components/DownloadLink";

// Client-side filter + search over the (already server-authorized) team leads.
// Filtering in the browser keeps it instant with zero round-trips, and the
// filters operate on what is LOADED — so the header states the exact total and
// how much of it is on screen, and "Load more" brings the rest in. Anything
// bigger than someone wants to scroll has Export, which takes every lead
// regardless of what is loaded. Status changes go to the server.

type Row = OfficeLead & { pending?: boolean; failed?: boolean };

export default function LeadsTable({
  leads,
  total,
  hasMore: initialHasMore,
}: {
  leads: OfficeLead[];
  /** EXACT number of leads the office has, which may exceed what is loaded. */
  total: number;
  hasMore: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(leads);
  const [person, setPerson] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Built from the LOADED rows, so a teammate whose leads are all further down
  // appears in the filter as soon as their first one loads.
  const people = useMemo(
    () => Array.from(new Set(rows.map((l) => l.capturedBy))).sort(),
    [rows],
  );

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/office/leads/list?offset=${rows.length}`);
      if (!res.ok) throw new Error("failed");
      const page = (await res.json()) as { leads: OfficeLead[]; hasMore: boolean };
      // De-duplicated on id: a lead captured between page loads shifts every
      // later row down by one, which would otherwise show a row twice.
      setRows((rs) => {
        const seen = new Set(rs.map((r) => r.id));
        return [...rs, ...page.leads.filter((l) => !seen.has(l.id))];
      });
      setHasMore(page.hasMore);
    } catch {
      // Keep what is already on screen and offer a retry — never wipe the
      // list because one page failed.
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((l) => {
      if (person !== "all" && l.capturedBy !== person) return false;
      if (status !== "all" && leadStatusView(l.status).label !== status) return false;
      if (q && !l.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, person, status, query]);

  async function setLeadStatus(id: string, next: LeadStatusValue) {
    const before = rows.find((r) => r.id === id)?.status ?? null;
    // Optimistic — the row flips instantly and rolls back if the server says no.
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: next, pending: true, failed: false } : r)));
    try {
      const res = await fetch(`/api/office/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("failed");
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, pending: false } : r)));
    } catch {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: before, pending: false, failed: true } : r)));
    }
  }

  return (
    <div>
      {/* How much of the whole is on screen, and the way to get all of it.
          The page used to print "600 so far" forever once the office passed the
          old cap, while the Team tab's per-person counts were uncapped — so the
          two tabs disagreed and neither said why. */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <p className="text-[0.6875rem] text-gray-500">
            {rows.length >= total
              ? `All ${total.toLocaleString()} lead${total === 1 ? "" : "s"}`
              : `Showing ${rows.length.toLocaleString()} of ${total.toLocaleString()} leads`}
            {visible.length !== rows.length && ` · ${visible.length.toLocaleString()} match your filters`}
          </p>
          {/* DownloadLink, not fetch() and not next/link: the browser handles
              the download and the Content-Disposition filename, and inside the
              iOS shell WKWebView cannot save an attachment — DownloadLink
              opens it in the system browser sheet there instead of leaving a
              dead tap. Same component the personal contacts export uses. */}
          <DownloadLink
            href="/api/office/leads/export"
            title="Download every lead your team has captured"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
              <path fillRule="evenodd" d="M8 1a.75.75 0 01.75.75v6.19l1.22-1.22a.75.75 0 111.06 1.06l-2.5 2.5a.75.75 0 01-1.06 0l-2.5-2.5a.75.75 0 111.06-1.06l1.22 1.22V1.75A.75.75 0 018 1zM1.5 10.5a.75.75 0 01.75.75v1.5c0 .138.112.25.25.25h11a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 0113.5 14.5h-11A1.75 1.75 0 01.75 12.75v-1.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
            </svg>
            Export all as CSV
          </DownloadLink>
        </div>
      )}

      {/* Search + filters — plain controls, no jargon. */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by contact name…"
          aria-label="Search leads by contact name"
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
        />
        <select
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          aria-label="Filter by team member"
          className="bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 sm:w-48"
        >
          <option value="all">Everyone on the team</option>
          {people.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 sm:w-40"
        >
          <option value="all">Any status</option>
          {LEAD_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.label}>{s.label}</option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
          <p className="text-gray-400 text-sm">
            {total === 0
              ? "No leads yet — leads appear here automatically when someone shares their info with any of your team's cards."
              : hasMore
              // Filters only see what is loaded, so "nothing matches" would be
              // a lie while there are still pages to fetch.
              ? "Nothing on this page matches those filters. Load more below, or export everything."
              : "Nothing matches those filters."}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-gray-800 bg-gray-900/60 text-[0.6875rem] font-semibold text-gray-500 uppercase tracking-wider">
            <p className="col-span-3">Contact</p>
            <p className="col-span-3">Email &amp; phone</p>
            <p className="col-span-2">Captured by</p>
            <p className="col-span-2">Status</p>
            <p className="col-span-2">When</p>
          </div>
          <div className="divide-y divide-gray-800">
            {visible.map((l) => {
              const s = leadStatusView(l.status);
              return (
                <div key={l.id} className="grid grid-cols-12 gap-3 px-5 py-3 items-center">
                  <div className="col-span-12 lg:col-span-3 min-w-0">
                    <p className="text-sm text-white truncate">{l.name}</p>
                  </div>
                  <div className="col-span-12 lg:col-span-3 min-w-0">
                    <p className="text-xs text-gray-400 truncate">{l.email || "No email"}</p>
                    <p className="text-xs text-gray-600 truncate">{l.phone || "No phone"}</p>
                  </div>
                  {/* The person's NAME — never a card URL slug. */}
                  <p className="col-span-6 lg:col-span-2 text-xs text-gray-400 truncate">{l.capturedBy}</p>
                  <div className="col-span-6 lg:col-span-2 flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full border ${
                        s.worked
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      } ${l.pending ? "opacity-50" : ""}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${s.worked ? "bg-green-400" : "bg-amber-400"}`} aria-hidden="true" />
                      {s.label}
                    </span>
                    {!s.worked && (
                      <button
                        onClick={() => setLeadStatus(l.id, "touch")}
                        disabled={l.pending}
                        className="text-[0.625rem] font-semibold text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/15 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
                      >
                        {l.pending ? "…" : "Mark contacted"}
                      </button>
                    )}
                    {l.failed && <span className="text-[0.625rem] text-red-400">Didn&apos;t save — try again</span>}
                  </div>
                  <p className="col-span-6 lg:col-span-2 text-xs text-gray-600 whitespace-nowrap">
                    {relativeTime(l.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Load more. Sits under the table because that is where someone
          scrolling to the bottom looks for it. Disabled rather than hidden
          while a page is in flight, so the button never jumps away from the
          cursor mid-click. */}
      {hasMore && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-semibold border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            {loadingMore
              ? "Loading…"
              : `Load more — ${Math.max(0, total - rows.length).toLocaleString()} to go`}
          </button>
          {loadError && (
            <p className="text-[0.6875rem] text-red-400">
              Couldn&apos;t load more just now. Your list is still here — try again.
            </p>
          )}
        </div>
      )}

      {total > 0 && (
        <p className="text-[0.6875rem] text-gray-600 mt-3">
          <span className="text-amber-400 font-semibold">New</span> = nobody has followed up yet.{" "}
          <span className="text-green-400 font-semibold">Contacted</span>, <span className="text-green-400 font-semibold">Closed</span> and{" "}
          <span className="text-green-400 font-semibold">Not interested</span> = someone on your team has handled it.
        </p>
      )}
    </div>
  );
}
