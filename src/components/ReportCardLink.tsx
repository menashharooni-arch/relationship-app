"use client";

import { useIsNativeApp } from "@/lib/platform";

// "Report this card" affordance for public cards and Swift Links pages —
// Apple's UGC rule (App Review 1.2) requires an in-app way to report
// objectionable public content. Rendered ONLY inside the native iOS shell:
// useIsNativeApp is false on the server and on every web client, so the
// public website's markup is byte-identical. Reports land on the /contact
// form (→ hello@swiftcard.me, answered within one business day) with the
// card pre-identified.
export default function ReportCardLink({ username }: { username: string }) {
  const native = useIsNativeApp();
  if (!native) return null;
  return (
    <div className="text-center py-3">
      <a
        href={`/contact?topic=report&card=${encodeURIComponent(username)}`}
        className="text-[11px] text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
      >
        Report this card
      </a>
    </div>
  );
}
