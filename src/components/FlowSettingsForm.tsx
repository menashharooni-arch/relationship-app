"use client";

import { useState } from "react";

type FlowDay = { enabled: boolean; time: string };
type FlowPreset = { name: string; days: number[] };
type FlowSettings = {
  day1: FlowDay;
  day15: FlowDay;
  day30: FlowDay;
  customNote?: string;
  presets?: {
    "1": FlowPreset;
    "2": FlowPreset;
    "3": FlowPreset;
  };
};

const DEFAULT_PRESETS = {
  "1": { name: "Warm Touch", days: [1, 2, 4, 7] },
  "2": { name: "Standard", days: [1, 4, 10, 21, 45] },
  "3": { name: "Long-term", days: [1, 30, 90, 180, 365] },
};

export default function FlowSettingsForm({
  initialSettings,
}: {
  initialSettings: FlowSettings;
}) {
  const [settings, setSettings] = useState<FlowSettings>({
    ...initialSettings,
    presets: initialSettings.presets ?? DEFAULT_PRESETS,
    customNote: initialSettings.customNote ?? "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function setPresetName(preset: "1" | "2" | "3", name: string) {
    setSettings((prev) => ({
      ...prev,
      presets: {
        ...prev.presets!,
        [preset]: { ...prev.presets![preset], name },
      },
    }));
  }

  function setPresetDays(preset: "1" | "2" | "3", raw: string) {
    const days = raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0 && n <= 365);
    setSettings((prev) => ({
      ...prev,
      presets: {
        ...prev.presets!,
        [preset]: { ...prev.presets![preset], days },
      },
    }));
  }

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

  const presets = settings.presets ?? DEFAULT_PRESETS;

  return (
    <div className="space-y-6">

      {/* How automations work — nothing sends automatically unless YOU set up a
          follow-up sequence on a contact. SwiftCard never sends you reminder
          emails, and never messages your contacts on its own. */}
      <div className="bg-[#F0EBE1] border border-[#E4DDD4] rounded-2xl px-4 py-3.5">
        <p className="text-slate-700 text-sm font-semibold mb-1">You&apos;re in full control</p>
        <p className="text-slate-600 text-[13px] leading-relaxed">
          SwiftCard never emails you follow-up reminders, and never messages a contact on its own.
          A message only goes out when <strong>you</strong> add a follow-up sequence to a contact —
          using one of the presets below.
        </p>
      </div>

      {/* Follow-up presets */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Follow-up Presets</p>
        <div className="bg-[#F0EBE1] border border-[#E4DDD4] rounded-2xl px-4 py-3 mb-3">
          <p className="text-slate-600 text-sm leading-relaxed">
            Define 3 preset schedules. On each contact, pick which preset to use — it shows the exact dates when messages will go out.
          </p>
        </div>
        <div className="space-y-3">
          {(["1", "2", "3"] as const).map((p) => {
            const preset = presets[p];
            return (
              <div key={p} className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white text-xs font-black shrink-0">
                    {p}
                  </div>
                  <input
                    value={preset.name}
                    onChange={(e) => setPresetName(p, e.target.value)}
                    placeholder={`Preset ${p} name`}
                    className="flex-1 bg-[#FAF7F2] border border-[#D4C8B8] text-slate-900 rounded-xl px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-[#1D4ED8] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Send on days (comma-separated)</label>
                  <input
                    defaultValue={preset.days.join(", ")}
                    onBlur={(e) => setPresetDays(p, e.target.value)}
                    placeholder="e.g. 1, 15, 30"
                    className="w-full bg-[#FAF7F2] border border-[#D4C8B8] text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Will send on: {preset.days.map((d) => `Day ${d}`).join(" → ")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
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
