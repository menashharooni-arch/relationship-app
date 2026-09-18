"use client";

import { useState } from "react";

// Per-contact "tell me when they come back" switch (warm-lead plan §2.4).
// Off = their visits still show in the bell and in their history, but never
// on the lock screen. Saved on tap (POST /api/leads/[id]/alerts).
export default function ContactAlertsToggle({ leadId, initiallyMuted }: { leadId: string; initiallyMuted: boolean }) {
  const [muted, setMuted] = useState(initiallyMuted);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    const next = !muted;
    setMuted(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: next }),
      });
      if (!res.ok) setMuted(!next);
    } catch {
      setMuted(!next);
    }
    setSaving(false);
  };

  return (
    <div className="-mt-3 mb-6 flex items-center justify-between gap-3">
      <p className="min-w-0 text-xs text-gray-400 leading-snug">Alert me when they come back</p>
      <button
        type="button"
        role="switch"
        aria-checked={!muted}
        aria-label="Alert me when they come back"
        disabled={saving}
        onClick={toggle}
        // Same switch as Settings → Notifications (PushPreferencesForm), with
        // explicit colours: Tailwind's grays are remapped by the light theme.
        className="shrink-0 w-10 h-5 rounded-full transition-colors relative"
        style={{ background: muted ? "#E4DDD4" : "#1D4ED8", opacity: saving ? 0.5 : 1 }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
          style={{ left: muted ? "2px" : "calc(100% - 18px)" }}
        />
      </button>
    </div>
  );
}
