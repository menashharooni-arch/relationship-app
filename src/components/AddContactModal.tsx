"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AddContactModal({
  cardOwner,
  onAdded,
}: {
  /** Username of the card the contact should be attached to (the selected card). */
  cardOwner?: string;
  /** Called with the new lead so a client list can insert it instantly (contacts page). */
  onAdded?: (lead: unknown) => void;
} = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", notes: "", where_met: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [atLimit, setAtLimit] = useState(false);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function reset() {
    setForm({ name: "", email: "", phone: "", company: "", notes: "", where_met: "" });
    setError("");
    setAtLimit(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    setAtLimit(false);
    try {
      const res = await fetch("/api/leads/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, card_owner: cardOwner }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Contact cap reached → show an upgrade prompt instead of a raw error.
        if (res.status === 402 || data.error === "limit") setAtLimit(true);
        setError(data.message || data.error || "Something went wrong.");
        setSaving(false);
        return;
      }
      setOpen(false);
      reset();
      // On the contacts page, insert into the client list instantly; on the
      // dashboard (no callback), refresh the server data.
      if (onAdded) onAdded(data.lead);
      else router.refresh();
    } catch {
      setError("Network error. Please try again.");
    }
    setSaving(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
        style={{ background: "#1D4ED8", color: "#fff" }}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M8 2a1 1 0 011 1v4h4a1 1 0 110 2H9v4a1 1 0 11-2 0V9H3a1 1 0 110-2h4V3a1 1 0 011-1z"/>
        </svg>
        Add contact
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setOpen(false); reset(); }} />

          {/* Modal */}
          <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <h2 className="text-white font-bold text-base">Add contact</h2>
                <p className="text-gray-500 text-xs mt-0.5">Manually add someone to your contacts</p>
              </div>
              <button
                onClick={() => { setOpen(false); reset(); }}
                className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3">
                  <path d="M1 1l10 10M11 1L1 11"/>
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 overflow-y-auto">
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Full name *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Sarah Williams"
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="sarah@example.com"
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="(555) 000-0000"
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Company</label>
                <input
                  value={form.company}
                  onChange={(e) => set("company", e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Where you met</label>
                <input
                  value={form.where_met}
                  onChange={(e) => set("where_met", e.target.value)}
                  placeholder="e.g. NAR Conference, booth #42"
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="What you discussed, next steps…"
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {error && !atLimit && <p className="text-red-400 text-xs">{error}</p>}
              {atLimit && (
                <div className="rounded-xl px-3 py-2.5 bg-blue-950/40 border border-blue-800/40">
                  <p className="text-blue-200 text-xs">{error}</p>
                  <Link href="/pricing" className="inline-block mt-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300">Upgrade to Pro · keep capturing every lead →</Link>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); reset(); }}
                  className="flex-1 text-sm font-semibold py-2.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 text-sm font-semibold py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : "Add contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
