"use client";

import { useState } from "react";
import type { OfficeCard } from "@/lib/office-cards";

// Team card manager (/office/admin). The admin sees every card in the office and
// can edit an employee's PERSONAL details or take a card offline. The company
// look and contact fields aren't editable per-card on purpose — they come from
// the primary card, so changing them there updates the whole team at once.

type Props = { cards: OfficeCard[]; appUrl: string };

type Draft = { name: string; title: string; email: string; phone: string };

export default function OfficeCards({ cards: initial, appUrl }: Props) {
  const [cards, setCards] = useState<OfficeCard[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", title: "", email: "", phone: "" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEdit(card: OfficeCard) {
    setError(null);
    setEditingId(card.id);
    setDraft({
      name: card.name ?? "",
      title: card.title ?? "",
      email: card.email ?? "",
      phone: card.phone ?? "",
    });
  }

  async function save(cardId: string) {
    setBusyId(cardId);
    setError(null);
    try {
      const res = await fetch(`/api/office/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't save that card.");
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...draft } : c)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that card.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleOffline(card: OfficeCard) {
    const next = !card.is_offline;
    if (next && !confirm(`Take ${card.name || card.username}'s card offline?\n\nIts public page, QR code and links stop working. Nothing is deleted — their contacts and history are kept, and you can bring it back online any time.`)) {
      return;
    }
    setBusyId(card.id);
    setError(null);
    try {
      const res = await fetch(`/api/office/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_offline: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't update that card.");
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, is_offline: next } : c)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update that card.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Team Cards ({cards.length})
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      {cards.length === 0 ? (
        <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl p-8 text-center shadow-sm">
          <p className="text-slate-400 text-sm">No cards yet. Invite an employee to get started.</p>
        </div>
      ) : (
        <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl shadow-sm divide-y divide-[#D4C8B8] overflow-hidden">
          {cards.map((card) => (
            <div key={card.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 truncate">{card.name || "Untitled card"}</p>
                    {card.isPrimary && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand text-white">
                        PRIMARY
                      </span>
                    )}
                    {card.is_offline && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                        OFFLINE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {card.title || "—"} · {card.ownerEmail ?? "unknown"}
                  </p>
                  <p className="text-xs text-slate-400 truncate">/card/{card.username}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`${appUrl}/card/${card.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-[#E8DECE] transition-colors"
                  >
                    View
                  </a>
                  <button
                    onClick={() => (editingId === card.id ? setEditingId(null) : startEdit(card))}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-[#E8DECE] transition-colors"
                  >
                    {editingId === card.id ? "Cancel" : "Edit"}
                  </button>
                  <button
                    onClick={() => toggleOffline(card)}
                    disabled={busyId === card.id}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                      card.is_offline
                        ? "text-green-700 hover:bg-green-50"
                        : "text-red-600 hover:bg-red-50"
                    }`}
                  >
                    {card.is_offline ? "Bring online" : "Take offline"}
                  </button>
                </div>
              </div>

              {editingId === card.id && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    ["name", "Name"],
                    ["title", "Title"],
                    ["email", "Email"],
                    ["phone", "Phone"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="block">
                      <span className="text-xs font-medium text-slate-500">{label}</span>
                      <input
                        value={draft[key]}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                        className="mt-1 w-full bg-white border border-[#D4C8B8] rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
                      />
                    </label>
                  ))}
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <button
                      onClick={() => save(card.id)}
                      disabled={busyId === card.id}
                      className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {busyId === card.id ? "Saving…" : "Save changes"}
                    </button>
                    <p className="text-xs text-slate-400">
                      Company logo, office number, fax, website and the card design come from the primary card.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
