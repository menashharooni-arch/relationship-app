"use client";

import { useState } from "react";

type Props = {
  initialMarketing: boolean;
  initialReceipts: boolean;
};

export default function EmailPreferencesForm({ initialMarketing, initialReceipts }: Props) {
  const [marketing, setMarketing] = useState(initialMarketing);
  const [receipts, setReceipts] = useState(initialReceipts);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/settings/email-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketing_emails: marketing, receipt_emails: receipts }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "#fff", border: "1px solid #E4DDD4" }}
    >
      <Toggle
        label="Marketing emails"
        description="New features, tips, and occasional promotions"
        checked={marketing}
        onChange={setMarketing}
      />
      <Toggle
        label="Payment receipts"
        description="Confirmation emails when you're billed"
        checked={receipts}
        onChange={setReceipts}
      />

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
        style={{ background: "#1D4ED8", color: "#fff", opacity: saving ? 0.6 : 1 }}
      >
        {saved ? "Saved!" : saving ? "Saving…" : "Save preferences"}
      </button>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
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
        className="shrink-0 w-10 h-5 rounded-full transition-colors relative mt-0.5"
        style={{ background: checked ? "#1D4ED8" : "#E4DDD4" }}
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
