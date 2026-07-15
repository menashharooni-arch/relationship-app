"use client";

// ⚠️ ORPHANED — nothing imports this component, and it imports the only thing
// that imports LeadCard, so both files (~1,200 lines) are dead. The live contact
// list is ContactsClient (/contacts) plus QuickContactList (/dashboard).
//
// Worth knowing before you edit anything here: the `UpgradeButton variant="inline"`
// below is the richest upsell asset in the codebase and it renders for NOBODY.
// Its job — telling a Free user at the lead cap what they're missing and what it
// costs — is now done by the locked-contacts banner on /contacts.
//
// Left in place rather than deleted because that's a product decision, not a
// cleanup one. If it isn't coming back, delete both files.

import { useState } from "react";
import LeadCard from "@/components/LeadCard";
import SortSelect from "@/components/SortSelect";
import UpgradeButton from "@/components/UpgradeButton";
import { PLAN_LIMITS } from "@/lib/plan";
import type { FlowPresets } from "@/components/LeadCard";
import { PlanGate } from "@/components/PlanGate";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  location: string | null;
  notes: string | null;
  status: string | null;
  tags: string[] | null;
  follow_up_date: string | null;
  created_at: string;
};

const FREE_LIMIT = PLAN_LIMITS.FREE_LEADS_PER_MONTH;

export default function LeadListClient({
  leads,
  flowPresets,
  sortBy,
  totalCount,
  isPro = false,
}: {
  leads: Lead[];
  flowPresets?: FlowPresets;
  sortBy: string;
  totalCount: number;
  isPro?: boolean;
}) {
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = q
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          (l.phone ?? "").includes(q) ||
          (l.company ?? "").toLowerCase().includes(q) ||
          (l.notes ?? "").toLowerCase().includes(q)
      )
    : leads;

  return (
    <>
      {/* Search */}
      {totalCount > 3 && (
        <div className="mb-3 relative">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3.5 h-3.5 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 text-gray-200 placeholder-gray-600 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 text-base leading-none"
            >
              ×
            </button>
          )}
        </div>
      )}

      {totalCount > 1 && !search && <div className="mb-3"><SortSelect value={sortBy} /></div>}

      {filtered.length === 0 ? (
        <p className="text-center text-gray-600 text-sm py-10">
          {search ? "No contacts match your search." : "No contacts match this filter."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <LeadCard key={lead.id} lead={lead} flowPresets={flowPresets} />
          ))}
          {!isPro && totalCount >= FREE_LIMIT && !search && (
            <PlanGate
              feature="leads-cap"
              nativeCopy="Pro feature — You've used your 5 free leads this month. Unlimited leads are only available on the Pro plan."
            >
              <UpgradeButton variant="inline" />
            </PlanGate>
          )}
        </div>
      )}
    </>
  );
}
