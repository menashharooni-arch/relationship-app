"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DateRangePreset } from "@/lib/office-analytics-dates";

const OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export default function AnalyticsDateRangePicker({ current }: { current: DateRangePreset }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-full p-1" role="group" aria-label="Date range">
      {OPTIONS.map((o) => (
        <Link
          key={o.value}
          href={`${pathname}?range=${o.value}`}
          aria-current={current === o.value ? "true" : undefined}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
            current === o.value ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
