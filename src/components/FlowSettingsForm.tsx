"use client";

import { useState } from "react";

type FlowDay = { enabled: boolean; time: string };
// day1/day15/day30 are NOT edited here — they're spread straight back out on
// save because /api/settings/flows validates their presence on every PATCH.
// The only setting on this form that any send path actually reads is customNote
// (appended to every automated follow-up by the reminders cron).
type FlowSettings = {
  day1: FlowDay;
  day15: FlowDay;
  day30: FlowDay;
  customNote?: string;
};

export default function FlowSettingsForm({
  initialSettings,
}: {
  initialSettings: FlowSettings;
}) {
  const [settings, setSettings] = useState<FlowSettings>({
    ...initialSettings,
    customNote: initialSettings.customNote ?? "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/settings/flows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">

      {/* How automations work — nothing sends automatically unless YOU set up a
          follow-up sequence on a contact. SwiftCard never sends you reminder
          emails, and never messages your contacts on its own. */}
      <div className="bg-[#F0EBE1] border border-[#E4DDD4] rounded-2xl px-4 py-3.5">
        <p className="text-slate-700 text-sm font-semibold mb-1">You&apos;re in full control</p>
        <p className="text-slate-600 text-[13px] leading-relaxed">
          SwiftCard never emails you follow-up reminders, and never messages a contact on its own.
          A message only goes out when <strong>you</strong> turn on an email or text follow-up for a
          specific contact — you pick the cadence there, on the contact itself, in Contacts.
        </p>
      </div>

      {/* Personal note appended to AI follow-ups */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Personal Note</p>
        <div className="bg-[#F0EBE1] border border-[#E4DDD4] rounded-2xl px-4 py-3 mb-3">
          <p className="text-slate-600 text-sm leading-relaxed">
            Optional: add a personal closing line appended to every automated follow-up sent to your leads. Great for a calendar link, a signature, or a quick offer.
          </p>
        </div>
        <textarea
          value={settings.customNote ?? ""}
          onChange={(e) => setSettings((prev) => ({ ...prev, customNote: e.target.value }))}
          placeholder="e.g. Book a call with me: calendly.com/yourname"
          rows={3}
          maxLength={300}
          className="w-full bg-[#FAF7F2] border border-[#D4C8B8] text-slate-900 placeholder-slate-400 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors resize-none"
        />
        <p className="text-xs text-slate-400 mt-1 text-right">{(settings.customNote ?? "").length}/300</p>
      </div>

      {status === "error" && (
        <p className="text-red-400 text-xs text-center">Something went wrong. Try again.</p>
      )}

      <button
        onClick={save}
        disabled={status === "saving"}
        className="w-full bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
      >
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save Settings"}
      </button>
    </div>
  );
}
