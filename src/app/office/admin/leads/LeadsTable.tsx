"use client";

import { useMemo, useState } from "react";
import { relativeTime } from "@/lib/relative-time";
import { leadStatusView, type OfficeLead } from "@/lib/office-leads";

// Client-side filter + search over the (already server-authorized) team leads.
// The volume is capped server-side, so filtering in the browser keeps this
// instant with zero extra round-trips.

export default function LeadsTable({ leads }: { leads: OfficeLead[] }) {
  const [person, setPerson] = useState<string>("all");
  const [query, setQuery] = useState("");

  const people = useMemo(
    () => Array.from(new Set(leads.map((l) => l.capturedBy))).sort(),
    [leads],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (person !== "all" && l.capturedBy !== person) return false;
      if (q && !l.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, person, query]);

  return (
    <div>
      {/* Filter + search — plain controls, no jargon. */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by contact name…"
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
        />
        <select
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 sm:w-56"
        >
          <option value="all">Everyone on the team</option>
          {people.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
          <p className="text-gray-400 text-sm">
            {leads.length === 0
              ? "No leads yet — leads appear here automatically when someone shares their info with any of your team's cards."
              : "Nothing matches that search."}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-gray-800 bg-gray-900/60 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            <p className="col-span-4">Contact</p>
            <p className="col-span-3">Captured by</p>
            <p className="col-span-2">Status</p>
            <p className="col-span-3">When</p>
          </div>
          <div className="divide-y divide-gray-800">
            {visible.map((l) => {
              const s = leadStatusView(l.status);
              return (
                <div key={l.id} className="grid grid-cols-12 gap-3 px-5 py-3 items-center">
                  <div className="col-span-12 md:col-span-4 min-w-0">
                    <p className="text-sm text-white truncate">{l.name}</p>
                    <p className="text-xs text-gray-500 truncate">{l.email || l.phone || "No contact info left"}</p>
                  </div>
                  <p className="col-span-5 md:col-span-3 text-xs text-gray-400 truncate">{l.capturedBy}</p>
                  <div className="col-span-4 md:col-span-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        s.worked
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${s.worked ? "bg-green-400" : "bg-amber-400"}`} />
                      {s.label}
                    </span>
                  </div>
                  <p className="col-span-3 md:col-span-3 text-xs text-gray-600 whitespace-nowrap">
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
          <span className="text-green-400 font-semibold">Contacted</span> / <span className="text-green-400 font-semibold">Closed</span> = someone on your team has handled it.
        </p>
      )}
    </div>
  );
}
