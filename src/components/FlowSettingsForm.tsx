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

const GLOBAL_DAYS: { key: keyof Omit<FlowSettings, "presets" | "customNote">; label: string; desc: string }[] = [
  { key: "day1",  label: "Day 1 Email",  desc: "Sent the day after someone scans your card" },
  { key: "day15", label: "Day 15 Email", desc: "Mid-month reminder to follow up with new leads" },
  { key: "day30", label: "Day 30 Email", desc: "End-of-month check-in for older leads" },
];

export default function FlowSettingsForm({
  initialSettings,
  isPro,
}: {
  initialSettings: FlowSettings;
  isPro: boolean;
}) {
  const [settings, setSettings] = useState<FlowSettings>({
    ...initialSettings,
    presets: initialSettings.presets ?? DEFAULT_PRESETS,
    customNote: initialSettings.customNote ?? "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function toggleDay(key: keyof Omit<FlowSettings, "presets" | "customNote">) {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as FlowDay), enabled: !(prev[key] as FlowDay).enabled },
    }));
  }

  function setTime(key: keyof Omit<FlowSettings, "presets" | "customNote">, time: string) {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as FlowDay), time },
    }));
  }

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

      {/* Global reminder emails */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Global Reminder Emails</p>
        <div className="bg-[#F0EBE1] border border-[#E4DDD4] rounded-2xl px-4 py-3 mb-3">
          <p className="text-slate-600 text-sm leading-relaxed">
            These emails go to <strong>you</strong> reminding you to follow up with new leads.
          </p>
        </div>
        <div className="space-y-3">
          {GLOBAL_DAYS.map(({ key, label, desc }) => {
            const day = settings[key] as FlowDay;
            const locked = !isPro && key !== "day1";
            return (
              <div key={key} className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl px-4 py-4" style={{ opacity: locked ? 0.5 : 1 }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-slate-900 font-semibold text-sm">{label}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => { if (!locked) toggleDay(key); }}
                    disabled={locked}
                    className="relative w-10 h-5.5 rounded-full transition-colors duration-200 shrink-0"
                    style={{ background: day.enabled ? "#1D4ED8" : "#D1C9BC", width: "42px", height: "22px" }}
                  >
                    <div
                      className="absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform duration-200"
                      style={{ width: "18px", height: "18px", transform: day.enabled ? "translateX(21px)" : "translateX(2px)" }}
                    />
                  </button>
                </div>
                {day.enabled && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Send at</label>
                    <input
                      type="time"
                      value={day.time}
                      onChange={(e) => { if (!locked) setTime(key, e.target.value); }}
                      disabled={locked}
                      className="bg-[#F0EBE1] border border-[#E4DDD4] text-slate-900 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
                    />
                    <span className="text-xs text-slate-400">UTC</span>
                  </div>
                )}
                {locked && <p className="text-[11px] text-[#1D4ED8] mt-1.5">Pro plan required</p>}
              </div>
            );
          })}
        </div>
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
