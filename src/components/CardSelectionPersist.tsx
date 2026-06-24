"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const KEY = "swiftcard_active_card";

export default function CardSelectionPersist({ selectedCard }: { selectedCard: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (selectedCard) {
      localStorage.setItem(KEY, selectedCard);
    }
  }, [selectedCard]);

  useEffect(() => {
    if (!searchParams.get("card")) {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("card", saved);
        router.replace(`/dashboard?${params.toString()}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
