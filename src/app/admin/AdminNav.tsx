"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/website", label: "Website" },
  { href: "/admin/marketing", label: "Marketing" },
  { href: "/admin/referrals", label: "Referrals" },
  { href: "/admin/plans", label: "Sandbox" },
  { href: "/admin/agent-flow", label: "Agent Flow" },
];

export default function AdminNav() {
  const pathname = usePathname();
  // Pending review-queue count for the Agent Flow tab — visible without
  // opening it. Fails silent pre-schema (ready:false → no badge).
  const [pending, setPending] = useState(0);
  useEffect(() => {
    let dead = false;
    fetch("/api/admin/agents").then((r) => r.json()).then((d) => { if (!dead && d?.ready) setPending(d.pendingTotal ?? 0); }).catch(() => {});
    return () => { dead = true; };
  }, [pathname]);
  return (
    <nav className="flex gap-1 -mb-px overflow-x-auto no-scrollbar">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors ${
              active
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {l.label}
            {l.label === "Agent Flow" && pending > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold align-middle">{pending > 99 ? "99+" : pending}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
