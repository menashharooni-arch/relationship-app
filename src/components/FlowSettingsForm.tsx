"use client";

import { useState } from "react";

type FlowDay = { enabled: boolean; time: string };
type FlowSettings = { day1: FlowDay; day15: FlowDay; day30: FlowDay };

const DAYS: { key: keyof FlowSettings; label: string; desc: string }[] = [
  { key: "day1", label: "Day 1", desc: "Sent the day after someone scans your card" },
  { key: "day15", label: "Day 15", desc: "Mid-month reminder to follow up with new leads" },
  { key: "day30", label: "Day 30", desc: "End-of-month check-in for older leads" },
];

export default function FlowSettingsForm({
  initialSettings,
  isPro,
}: {
  initialSettings: FlowSettings;
  isPro: boolean;
}) {
  const [settings, setSettings] = useState<FlowSettings>(initialSettings);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function toggleDay(key: keyof FlowSettings) {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  }

  function setTime(key: keyof FlowSettings, time: string) {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], time },
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

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
        <p className="text-gray-400 text-sm leading-relaxed">
          When someone scans your card, Kontact automatically sends follow-up emails at day 1, 15, and 30.
          Toggle each one on or off and set the time they go out (your local time).
        </p>
      </div>

      {DAYS.map(({ key, label, desc }) => {
        const day = settings[key];
        return (
          <div
            key={key}
            className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4"
            style={{ opacity: isPro || key === "day1" ? 1 : 0.5 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-semibold text-sm">{label} Email</p>
                <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
              </div>

              {/* Toggle */}
              <button
                onClick={() => { if (isPro || key === "day1") toggleDay(key); }}
                disabled={!isPro && key !== "day1"}
                className="relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0"
                style={{ background: day.enabled ? "#2563eb" : "#374151" }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                  style={{ transform: day.enabled ? "translateX(22px)" : "translateX(2px)" }}
                />
              </button>
            </div>

            {/* Time picker */}
            {day.enabled && (
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500">Send at</label>
                <input
                  type="time"
                  value={day.time}
                  onChange={(e) => { if (isPro || key === "day1") setTime(key, e.target.value); }}
                  disabled={!isPro && key !== "day1"}
                  className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
                <span className="text-xs text-gray-600">local time</span>
              </div>
            )}

            {!isPro && key !== "day1" && (
              <p className="text-[11px] text-blue-400 mt-2">Pro plan required</p>
            )}
          </div>
        );
      })}

      {status === "error" && (
        <p className="text-red-400 text-xs text-center">Something went wrong. Try again.</p>
      )}

      <button
        onClick={save}
        disabled={status === "saving"}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
      >
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save Settings"}
      </button>
    </div>
  );
}
