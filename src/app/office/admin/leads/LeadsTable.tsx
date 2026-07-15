"use client";

import { useMemo, useState } from "react";
import { relativeTime } from "@/lib/relative-time";
import {
  leadStatusView,
  LEAD_STATUS_OPTIONS,
  type OfficeLead,
  type LeadStatusValue,
} from "@/lib/office-leads";

// Client-side filter + search over the (already server-authorized) team leads.
// The volume is capped server-side, so filtering in the browser keeps this
// instant with zero extra round-trips. Status changes go to the server.

type Row = OfficeLead & { pending?: boolean; failed?: boolean };

export default function LeadsTable({ leads }: { leads: OfficeLead[] }) {
  const [rows, setRows] = useState<Row[]>(leads);
  const [person, setPerson] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [query, setQuery] = useState("");

  const people = useMemo(
    () => Array.from(new Set(leads.map((l) => l.capturedBy))).sort(),
    [leads],
  );

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
            {leads.length === 0
              ? "No leads yet — leads appear here automatically when someone shares their info with any of your team's cards."
              : "Nothing matches those filters."}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-gray-800 bg-gray-900/60 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
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
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
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
                        className="text-[10px] font-semibold text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/15 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
                      >
                        {l.pending ? "…" : "Mark contacted"}
                      </button>
                    )}
                    {l.failed && <span className="text-[10px] text-red-400">Didn&apos;t save — try again</span>}
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

      {leads.length > 0 && (
        <p className="text-[11px] text-gray-600 mt-3">
          <span className="text-amber-400 font-semibold">New</span> = nobody has followed up yet.{" "}
          <span className="text-green-400 font-semibold">Contacted</span>, <span className="text-green-400 font-semibold">Closed</span> and{" "}
          <span className="text-green-400 font-semibold">Not interested</span> = someone on your team has handled it.
        </p>
      )}
    </div>
  );
}
