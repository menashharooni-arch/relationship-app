"use client";

import { useEffect, useState } from "react";
import {
  LIVE_CATEGORIES, PUSH_CATEGORY_COPY, DEFAULT_PUSH_PREFS,
  type PushCategory,
} from "@/lib/push-policy";

// Per-category push switches.
//
// A short closed list of things is allowed to buzz a phone, and this panel is
// that list — which doubles as the honest disclosure of what turning push on
// actually signs someone up for. Only categories something can actually FIRE
// are shown (LIVE_CATEGORIES); a switch that can never change anything implies
// a feature that does not exist. Saves on toggle, because a "Save" button on a
// panel of switches is a step people skip and then wonder why nothing changed.

type Prefs = Record<PushCategory, boolean> & { quietHours?: boolean };

export default function PushPreferencesForm() {
  const [prefs, setPrefs] = useState<Prefs>({ ...DEFAULT_PUSH_PREFS, quietHours: true });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/push/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.prefs) setPrefs(j.prefs); })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  async function set(key: keyof Prefs, value: boolean) {
    const before = prefs;
    setPrefs({ ...prefs, [key]: value });   // optimistic: a switch must feel instant
    setError(null);
    try {
      const res = await fetch("/api/push/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // The browser reports the zone on every save, so quiet hours stay
        // correct after someone moves or travels.
        body: JSON.stringify({ [key]: value, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setPrefs(before);   // never leave a switch showing a state we didn't store
      setError("Couldn't save that — please try again.");
    }
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>What we notify you about</p>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
          These are the only things SwiftCard will ever send to your phone. No tips, no promotions, no weekly stats.
        </p>
      </div>

      {LIVE_CATEGORIES.map((cat) => (
        <Toggle
          key={cat}
          label={PUSH_CATEGORY_COPY[cat].label}
          description={PUSH_CATEGORY_COPY[cat].hint}
          checked={prefs[cat] !== false}
          disabled={!loaded}
          onChange={(v) => set(cat, v)}
        />
      ))}

      <div className="pt-1" style={{ borderTop: "1px solid #F1EBE3" }} />

      <Toggle
        label="Quiet hours"
        description="Nothing between 10pm and 8am your time — except a billing problem"
        checked={prefs.quietHours !== false}
        disabled={!loaded}
        onChange={(v) => set("quietHours", v)}
      />

      {error && (
        <p role="alert" className="text-xs text-center" style={{ color: "#B91C1C" }}>{error}</p>
      )}
    </div>
  );
}

function Toggle({
  label, description, checked, disabled, onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className="shrink-0 w-10 h-5 rounded-full transition-colors relative mt-0.5"
        style={{ background: checked ? "#1D4ED8" : "#E4DDD4", opacity: disabled ? 0.5 : 1 }}
        aria-label={label}
        aria-checked={checked}
        role="switch"
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
          style={{ left: checked ? "calc(100% - 18px)" : "2px" }}
        />
      </button>
    </div>
  );
}
