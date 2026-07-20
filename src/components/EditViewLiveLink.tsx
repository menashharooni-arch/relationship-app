"use client";

import { useEffect, useState } from "react";

// The "View live" link in the card-editor header. Hidden while the Design tab
// is active (owner request) — it listens for the tab-change event the editor
// broadcasts. Everywhere else the link behaves normally.
export default function EditViewLiveLink({ href }: { href: string }) {
  const [tab, setTab] = useState("content");

  useEffect(() => {
    const onTab = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string") setTab(detail);
    };
    window.addEventListener("sc:card-edit-tab", onTab);
    return () => window.removeEventListener("sc:card-edit-tab", onTab);
  }, []);

  if (tab === "design") return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
    >
      View live →
    </a>
  );
}
