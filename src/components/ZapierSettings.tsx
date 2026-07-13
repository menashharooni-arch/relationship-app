"use client";

import { useState } from "react";

export default function ZapierSettings({
  initialUrl,
  isPro,
}: {
  initialUrl: string | null;
  isPro: boolean;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");

  async function save() {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/settings/zapier", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zapier_webhook_url: url }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }

  async function test() {
    if (!url) return;
    setTestStatus("testing");
    try {
      const res = await fetch("/api/settings/zapier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: url }),
      });
      setTestStatus(res.ok ? "ok" : "error");
      setTimeout(() => setTestStatus("idle"), 3000);
    } catch {
      setTestStatus("error");
      setTimeout(() => setTestStatus("idle"), 3000);
    }
  }

  return (
    <div className={`bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl px-5 py-5 shadow-sm space-y-4 ${!isPro ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p className="text-slate-900 font-semibold text-sm">Zapier Webhook</p>
          <p className="text-slate-400 text-xs">Send new leads to 6,000+ apps automatically</p>
        </div>
        {!isPro && (
          <a href="/pricing" title="Upgrade to Pro to use Zapier" className="ml-auto text-xs bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold px-2.5 py-0.5 rounded-full transition-colors">Upgrade · Pro</a>
        )}
      </div>

      {isPro ? (
        <>
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">Webhook URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              className="w-full bg-[#FAF7F2] border border-[#D4C8B8] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
            />
          </div>

          {/* How to get the URL */}
          <div className="bg-[#F0EBE1] rounded-xl px-4 py-3 text-xs text-slate-500 leading-relaxed">
            <p className="font-medium text-slate-700 mb-1">How to set up:</p>
            <p>1. Go to zapier.com → Create Zap</p>
            <p>2. Trigger: <strong>Webhooks by Zapier → Catch Hook</strong></p>
            <p>3. Copy the webhook URL and paste it above</p>
            <p>4. Click <strong>Test</strong> to verify, then save</p>
          </div>

          {/* Payload preview */}
          <details className="group">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 transition-colors list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              Sample payload sent on each new lead
            </summary>
            <pre className="mt-2 bg-slate-900 text-slate-300 rounded-xl p-3 text-xs overflow-x-auto leading-relaxed">{`{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "555-0100",
  "message": "Loved meeting you!",
  "location": "New York, US",
  "card_owner": "your-username",
  "tags": [],
  "created_at": "2026-06-23T..."
}`}</pre>
          </details>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={test}
              disabled={!url || testStatus === "testing"}
              className="flex-1 border border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-40 font-medium py-2.5 rounded-full text-sm transition-colors"
            >
              {testStatus === "testing" ? "Sending..." : testStatus === "ok" ? "Sent ✓" : testStatus === "error" ? "Failed ✗" : "Test"}
            </button>
            <button
              onClick={save}
              disabled={saveStatus === "saving"}
              className="flex-1 bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
            >
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save"}
            </button>
          </div>

          {saveStatus === "error" && <p className="text-red-500 text-xs text-center">Failed to save. Try again.</p>}
        </>
      ) : (
        <p className="text-xs text-slate-400">Upgrade to Pro to connect Zapier and automate your lead workflow.</p>
      )}
    </div>
  );
}
