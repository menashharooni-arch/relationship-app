"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// The "Select a card" rows. These were plain <Link>s, and opening a card is a
// same-route (searchParams-only) navigation — App Router keeps the OLD screen
// on show, no loading boundary, until the server finishes rendering the card's
// dashboard (~1s+). To the user the tap simply did nothing, then everything
// appeared at once — the single biggest "the app is slow" moment (owner report
// 2026-08-26). This client list gives the tap an INSTANT response: the chosen
// row lights up with a spinner, the rest dim and lock, and the navigation runs
// in a transition behind it.
export type PickerCard = {
  id: string;
  username: string;
  title: string;
  /** The pretty slug when it matches, else the raw stored slug. */
  slugDisplay: string;
  name: string | null;
};

export default function CardPickerList({ cards, children }: { cards: PickerCard[]; children?: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);

  function open(username: string) {
    if (pending) return;
    setChosen(username);
    startTransition(() => router.push(`/dashboard?card=${encodeURIComponent(username)}`));
  }

  return (
    <div className="space-y-2">
      {cards.map((card) => {
        const isChosen = pending && chosen === card.username;
        const isOther = pending && chosen !== card.username;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => open(card.username)}
            disabled={pending}
            className={`w-full text-left flex items-center gap-3 rounded-xl px-4 py-3.5 border transition-colors ${
              isChosen
                ? "border-blue-600/70 bg-gray-900/80"
                : "border-gray-800 bg-gray-900 hover:border-blue-600/50 hover:bg-gray-900/60"
            } ${isOther ? "opacity-40" : ""}`}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 bg-gray-700 text-gray-300">
              {card.title[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-medium truncate">{card.title}</p>
              <p className="text-gray-500 text-xs truncate">/{card.slugDisplay}{card.name ? ` · ${card.name}` : ""}</p>
            </div>
            {isChosen ? (
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 shrink-0 animate-spin text-blue-400" aria-label="Opening card">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
                <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-600 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        );
      })}
      {children}
    </div>
  );
}
