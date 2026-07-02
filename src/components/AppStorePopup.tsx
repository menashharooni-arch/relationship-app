"use client";

// Shown once, right after someone creates their account, inviting them to
// download the iOS app. Dismissable ("Continue on the web"). Only ever appears
// once per browser (localStorage guard) so it never nags on later visits.

import { useEffect, useState } from "react";
import { APP_STORE_URL } from "@/lib/app-store";

export default function AppStorePopup({ trigger }: { trigger: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    let seen = false;
    try { seen = localStorage.getItem("sc_appstore_seen") === "1"; } catch { /* ignore */ }
    if (!seen) setOpen(true);
  }, [trigger]);

  function close() {
    setOpen(false);
    try { localStorage.setItem("sc_appstore_seen", "1"); } catch { /* ignore */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="w-full max-w-sm rounded-3xl bg-gray-900 border border-gray-800 shadow-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="#60a5fa" className="w-7 h-7">
            <path d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.98-.75.84-1.98 1.49-3.02 1.4-.13-1.09.42-2.24 1.09-2.98.76-.85 2.07-1.47 3.04-1.4zM20.5 17.02c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.52-4.12 3.53-1.54.01-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.06-1.78-4.05-3.35-2.77-4.38-3.06-9.52-1.35-12.25 1.21-1.94 3.13-3.08 4.94-3.08 1.84 0 3 1.01 4.52 1.01 1.48 0 2.38-1.01 4.51-1.01 1.61 0 3.32.88 4.54 2.39-3.99 2.19-3.34 7.88.1 9.25z" />
          </svg>
        </div>
        <h2 className="text-white font-bold text-lg mb-1.5">Your account is ready! 🎉</h2>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          Get the SwiftCard app to build cards, capture leads, and send follow-ups on the go — with instant notifications the moment someone connects.
        </p>

        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
          className="flex items-center justify-center gap-2.5 w-full bg-white hover:bg-gray-100 text-black font-semibold py-3 rounded-full transition-colors mb-2.5"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.98-.75.84-1.98 1.49-3.02 1.4-.13-1.09.42-2.24 1.09-2.98.76-.85 2.07-1.47 3.04-1.4zM20.5 17.02c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.52-4.12 3.53-1.54.01-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.06-1.78-4.05-3.35-2.77-4.38-3.06-9.52-1.35-12.25 1.21-1.94 3.13-3.08 4.94-3.08 1.84 0 3 1.01 4.52 1.01 1.48 0 2.38-1.01 4.51-1.01 1.61 0 3.32.88 4.54 2.39-3.99 2.19-3.34 7.88.1 9.25z" />
          </svg>
          Download on the App Store
        </a>
        <button onClick={close} className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors">
          Continue on the web
        </button>
      </div>
    </div>
  );
}
