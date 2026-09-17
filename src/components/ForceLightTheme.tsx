"use client";

import { useEffect } from "react";

// ── A screen that is always light, whatever the saved theme ─────────────────
//
// The card builder (/cards/new) is white on every device (owner, 2026-09-16:
// "I told you to make it white"). The white canvas rule hangs off
// [data-sc-theme="light"], so a visitor who once switched to dark mode — stored
// as sc_theme=dark on that device — got a BLACK builder. That is exactly what
// the owner saw: white on the computer, black on the phone, same site.
//
// While this is mounted <html> carries data-sc-theme="light". On unmount the
// saved preference is re-applied, so the dashboard and everything else keep the
// theme the person chose. A counter, not a snapshot: the builder's loading
// skeleton and the builder itself both mount this and can overlap during a
// navigation, and restoring a stale snapshot there would flash dark.
//
// First paint on a direct load is handled by the boot script in layout.tsx,
// which forces light for /cards/new before anything renders. This component
// covers client-side navigation into and out of the builder.

let holders = 0;

function applySaved() {
  let dark = false;
  try { dark = localStorage.getItem("sc_theme") === "dark"; } catch { /* storage blocked: light */ }
  if (dark) document.documentElement.removeAttribute("data-sc-theme");
  else document.documentElement.setAttribute("data-sc-theme", "light");
}

export default function ForceLightTheme() {
  useEffect(() => {
    holders += 1;
    document.documentElement.setAttribute("data-sc-theme", "light");
    return () => {
      holders -= 1;
      // Deferred a tick so a skeleton → builder hand-off (unmount then mount)
      // never shows a frame of the saved dark theme in between.
      setTimeout(() => { if (holders === 0) applySaved(); }, 0);
    };
  }, []);
  return null;
}
