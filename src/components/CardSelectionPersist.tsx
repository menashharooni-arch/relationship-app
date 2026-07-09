"use client";
import { useEffect } from "react";

const KEY = "swiftcard_active_card";

// Persists the currently-selected card so other pages (e.g. Contacts) can default to
// it. It does NOT auto-select a card — after login you start with no card selected.
export default function CardSelectionPersist({ selectedCard }: { selectedCard: string | null }) {
  useEffect(() => {
    if (selectedCard) {
      try {
        localStorage.setItem(KEY, selectedCard);
      } catch {
        /* ignore */
      }
    }
  }, [selectedCard]);

  return null;
}
