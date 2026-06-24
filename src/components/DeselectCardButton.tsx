"use client";

import { useRouter } from "next/navigation";

const KEY = "swiftcard_active_card";

export default function DeselectCardButton() {
  const router = useRouter();

  function deselect() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={deselect}
      className="text-xs text-gray-500 hover:text-white transition-colors"
    >
      Deselect
    </button>
  );
}
