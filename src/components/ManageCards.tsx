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
  label?: string | null;
};

export default function ManageCards({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(card: Card) {
    const label = card.label || card.name || card.username;
    if (
      !confirm(
        `Delete the card "${label}" (/${card.username})? This can't be undone. Contacts already captured by this card are kept.`
      )
    )
      return;

    setDeletingId(card.id);
    setError(null);

    let res: Response;
    try {
      res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
      setDeletingId(null);
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't delete the card. Try again.");
      setDeletingId(null);
      return;
    }

    try {
      if (localStorage.getItem(ACTIVE_KEY) === card.username) localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }

    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {cards.length === 0 && (
        <p className="text-gray-600 text-xs">You don&apos;t have any cards yet.</p>
      )}

      {cards.map((card) => (
        <div key={card.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-gray-700 text-gray-300 flex items-center justify-center text-xs font-bold shrink-0">
            {(card.label || card.name || card.username)[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">{card.label || card.name || card.username}</p>
            <p className="text-gray-500 text-xs truncate">
              /{card.username}
              {card.name ? ` · ${card.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href={`/cards/${card.id}/edit`} className="text-xs text-gray-500 hover:text-white transition-colors">
              Edit
            </Link>
            <button
              type="button"
              onClick={() => handleDelete(card)}
              disabled={deletingId === card.id}
              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
            >
              {deletingId === card.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ))}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
