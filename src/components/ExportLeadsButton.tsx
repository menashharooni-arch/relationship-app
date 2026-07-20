"use client";

import { useState } from "react";

// CSV export as a fetch-then-download button. The old plain <a> worked on the
// happy path (Content-Disposition: attachment), but any JSON error response —
// e.g. the 429 rate limit — NAVIGATED the whole dashboard to a page of raw
// JSON. Now errors surface inline and the page stays put.
export default function ExportLeadsButton({ username }: { username: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function exportCsv() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/leads/export?username=${encodeURIComponent(username)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.message || data.error || "Export failed — please try again.");
        return;
      }
      const blob = await res.blob();
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ??
        `contacts-${username}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErr("Export failed — please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        onClick={exportCsv}
        disabled={busy}
        className="text-xs text-gray-500 hover:text-white transition-colors border border-gray-800 hover:border-gray-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
      >
        {busy ? "Exporting…" : "Export"}
      </button>
      {err && (
        <span className="absolute top-full right-0 mt-1.5 z-20 w-56 rounded-lg border border-red-900/60 bg-gray-900 px-3 py-2 text-[11px] text-red-300 shadow-xl">
          {err}
          <button onClick={() => setErr(null)} className="ml-2 text-gray-500 hover:text-gray-300">✕</button>
        </span>
      )}
    </span>
  );
}
