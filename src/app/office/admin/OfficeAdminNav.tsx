"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/office/admin", label: "Overview" },
  { href: "/office/admin/team", label: "Team" },
  { href: "/office/admin/cards", label: "Cards" },
  { href: "/office/admin/leads", label: "Leads" },
  { href: "/office/admin/invite", label: "Invite" },
  { href: "/office/admin/branding", label: "Branding" },
];

export default function OfficeAdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 -mb-px overflow-x-auto no-scrollbar">
      {LINKS.map((l) => {
        // Overview is the index, so it must match exactly — every other tab owns
        // its subtree (a card detail page keeps "Cards" highlighted).
        const active = l.href === "/office/admin" ? pathname === "/office/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
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
