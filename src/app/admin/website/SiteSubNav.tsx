"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Sub-nav for the Website ("Site") section: Analytics | Agent Flow.
// The Agent Flow chip carries a live pending-items badge so a queue that needs
// review is visible without opening the tab.
export default function SiteSubNav() {
  const pathname = usePathname();
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    let dead = false;
    fetch("/api/admin/agents").then((r) => r.json()).then((d) => { if (!dead && d?.ready) setPending(d.pendingTotal ?? 0); }).catch(() => {});
    return () => { dead = true; };
  }, [pathname]);
  const tabs = [
    { href: "/admin/website", label: "Analytics", exact: true },
    { href: "/admin/website/agent-flow", label: "Agent Flow", exact: false },
  ];
  return (
    <div className="flex items-center gap-2 mb-5">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? "bg-blue-600/20 border-blue-500/40 text-blue-300" : "bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200"}`}>
            {t.label}
            {t.label === "Agent Flow" && pending !== null && pending > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{pending > 99 ? "99+" : pending}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
