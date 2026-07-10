"use client";

// Dark / light mode for the app (dashboard, contacts, settings, editors).
// Dark = the existing look; light = cream-white. The choice is stored in
// localStorage and applied as a data attribute on <html>; a tiny inline
// script in the root layout applies it before paint so there's no flash.
// Public pages (cards, Swift Links, landing) keep their own designs.

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read from localStorage
      setTheme(localStorage.getItem("sc_theme") === "light" ? "light" : "dark");
    } catch {
      setTheme("dark");
    }
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try { localStorage.setItem("sc_theme", next); } catch { /* ignore */ }
    if (next === "light") document.documentElement.setAttribute("data-sc-theme", "light");
    else document.documentElement.removeAttribute("data-sc-theme");
  }

  if (!theme) return <span className="w-8 h-8" aria-hidden />; // avoid icon flicker before hydration

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
    >
      {theme === "light" ? (
        // Moon — tap to go dark
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75 9.75 9.75 0 018.25 6c0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25 9.75 9.75 0 0012.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      ) : (
        // Sun — tap to go light
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )}
    </button>
  );
}
