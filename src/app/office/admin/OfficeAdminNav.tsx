"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Exactly three tabs, in the order an owner uses them: who's on my team →
// who's contacted us → what do our cards look like. The old Overview/Cards/
// Invite tabs are folded in: Team IS the landing page, per-card management
// lives inside each person, and inviting is a button, not a destination.
const LINKS = [
  { href: "/office/admin", label: "Team", tour: "admin-nav-team" },
  { href: "/office/admin/analytics", label: "Analytics", tour: "admin-nav-analytics" },
  { href: "/office/admin/leads", label: "Leads", tour: "admin-nav-leads" },
  { href: "/office/admin/branding", label: "Branding", tour: "admin-nav-branding" },
];

export default function OfficeAdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 -mb-px overflow-x-auto rd-scrollbar-none">
      {LINKS.map((l) => {
        // Team owns the root plus the person/card detail subtrees, so drilling
        // into a teammate keeps the Team tab lit.
        const active =
          l.href === "/office/admin"
            ? pathname === "/office/admin" ||
              pathname.startsWith("/office/admin/team") ||
              pathname.startsWith("/office/admin/cards")
            : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            data-tour={l.tour}
            className={`px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors ${
              active
                ? "border-purple-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
