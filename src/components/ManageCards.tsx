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
  is_offline?: boolean | null;
};

export default function ManageCards({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // An offline card is invisible everywhere the owner would look for it — the
  // public page 404s, and so do its QR, NFC tag and wallet pass — while the
  // dashboard still lists it as though it were fine. Being removed from a team
  // turns cards off, so this is the state an ex-employee lands in, and until
  // now nothing in the product told them or offered them a way out.
  async function handleRestore(card: Card) {
    setRestoringId(card.id);
    setError(null);
    let res: Response;
    try {
      res = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_offline: false }),
      });
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
      setRestoringId(null);
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't bring the card back online. Try again.");
      setRestoringId(null);
      return;
    }
    setRestoringId(null);
    router.refresh();
  }

  async function handleDelete(card: Card) {
    const label = card.label || card.name || card.username;
    // This dialog used to promise "Contacts already captured by this card are
    // kept." It was the opposite of what DELETE /api/cards/[id] does: that
    // route deliberately purges the card's leads (and their message and
    // reminder history) because everything is keyed by USERNAME, and leaving
    // the rows behind would hand them to whoever registers the freed slug next.
    // The purge is right; the sentence was the bug, and it was the sentence
    // people were deciding on. Say what actually happens, and point at the
    // export while it can still be taken.
    if (
      !confirm(
        `Delete the card "${label}" (/${card.username})?\n\n` +
          `This also permanently deletes every contact this card captured, along with their message and reminder history. It can't be undone.\n\n` +
          `If you want to keep them, cancel and export them from Contacts first.`
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
            <p className="text-white text-sm font-medium truncate">
              {card.label || card.name || card.username}
              {card.is_offline === true && (
                <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                  Offline
                </span>
              )}
            </p>
            <p className="text-gray-500 text-xs truncate">
              {card.is_offline === true
                ? "Hidden from visitors — your QR and NFC tag won't open it"
                : `/${card.username}${card.name ? ` · ${card.name}` : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {card.is_offline === true && (
              <button
                type="button"
                onClick={() => handleRestore(card)}
                disabled={restoringId === card.id}
                className="text-xs font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-50 transition-colors"
              >
                {restoringId === card.id ? "Turning on…" : "Bring online"}
              </button>
            )}
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
