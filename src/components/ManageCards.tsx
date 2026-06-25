"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ACTIVE_KEY = "swiftcard_active_card";

type Card = {
  id: string;
  username: string;
  name: string | null;
  title: string | null;
};

export default function ManageCards({
  primary,
  cards,
}: {
  primary: { name: string | null; username: string };
  cards: Card[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [action, setAction] = useState<"delete" | "primary" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(card: Card) {
    const label = card.name || card.username;
    if (
      !confirm(
        `Delete the card "${label}" (/${card.username})? This can't be undone. Contacts already captured by this card are kept.`
      )
    )
      return;

    setBusyId(card.id);
    setAction("delete");
    setError(null);

    const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't delete the card. Try again.");
      setBusyId(null);
      setAction(null);
      return;
    }

    try {
      if (localStorage.getItem(ACTIVE_KEY) === card.username) {
        localStorage.removeItem(ACTIVE_KEY);
      }
    } catch {
      /* ignore */
    }

    setBusyId(null);
    setAction(null);
    router.refresh();
  }

  async function handleMakePrimary(card: Card) {
    const label = card.name || card.username;
    if (
      !confirm(
        `Make "${label}" (/${card.username}) your primary card? Your current primary card will become a regular card. Contacts and stats stay with each card.`
      )
    )
      return;

    setBusyId(card.id);
    setAction("primary");
    setError(null);

    const res = await fetch(`/api/cards/${card.id}/make-primary`, { method: "POST" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't set this card as primary. Try again.");
      setBusyId(null);
      setAction(null);
      return;
    }

    // The primary username changed — clear any stale active-card selection.
    try {
      localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }

    setBusyId(null);
    setAction(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Primary card — editable, reassign before deleting */}
      <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-600/30 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
          {(primary.name || primary.username)[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-medium truncate">{primary.name || primary.username}</p>
          <p className="text-gray-500 text-xs truncate">/{primary.username}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">Primary</span>
          <Link href="/profile/card" className="text-xs text-gray-500 hover:text-white transition-colors">
            Edit
          </Link>
        </div>
      </div>

      {/* Extra cards — set primary, edit, delete */}
      {cards.map((card) => {
        const busy = busyId === card.id;
        return (
          <div key={card.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-gray-700 text-gray-300 flex items-center justify-center text-xs font-bold shrink-0">
              {(card.name || card.username)[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-medium truncate">{card.name || card.username}</p>
              <p className="text-gray-500 text-xs truncate">
                /{card.username}
                {card.title ? ` · ${card.title}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleMakePrimary(card)}
                disabled={busy}
                className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {busy && action === "primary" ? "Setting…" : "Set primary"}
              </button>
              <Link href={`/cards/${card.id}/edit`} className="text-xs text-gray-500 hover:text-white transition-colors">
                Edit
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(card)}
                disabled={busy}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
              >
                {busy && action === "delete" ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        );
      })}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <p className="text-gray-600 text-[11px] leading-relaxed">
        Your primary card is your main account card. To delete it, set another card as primary first.
      </p>
    </div>
  );
}
