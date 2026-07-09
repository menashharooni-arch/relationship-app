"use client";

import { useState, useEffect, useRef } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
  // Which card this notification belongs to (username slug). Null/absent for
  // account-level notifications (referrals etc.) and legacy rows.
  card_owner?: string | null;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell({
  initialNotifications,
  cardLabels,
}: {
  initialNotifications: Notification[];
  // username → display label, for the per-card tag on each notification.
  cardLabels?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const openRef = useRef(open);
  openRef.current = open;

  const unread = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  useEffect(() => {
    const poll = async () => {
      if (openRef.current) return;
      try {
        // The bell watches EVERY card (no ?card= scope) — activity on any card
        // shows here, tagged with that card's name.
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const fresh: Notification[] = await res.json();
        setNotifications((prev) => {
          const prevIds = new Set(prev.map((n) => n.id));
          const hasNew = fresh.some((n) => !prevIds.has(n.id) && !n.read);
          if (!hasNew && fresh.length === prev.length) return prev;
          return fresh;
        });
      } catch { /* ignore */ }
    };

    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  // Toggle ONE notification read/unread — the badge only drops when the user
  // explicitly marks items read (individually here, or in bulk above).
  async function setRead(id: string, read: boolean) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read }),
    }).catch(() => {});
  }

  // Remove a single notification for good (not just mark it read).
  async function dismiss(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  // Clear out everything already read in one tap.
  async function clearRead() {
    setNotifications((prev) => prev.filter((n) => !n.read));
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  }

  function handleOpen() {
    // Just open/close. Notifications stay UNREAD (and the badge stays) until the
    // user explicitly marks them read or dismisses them — opening no longer
    // silently clears everything.
    setOpen((v) => !v);
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-1.5 text-gray-400 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />

          {/* Right-side pop-up banner — fixed to the screen's right edge, same on
              mobile and web, slides in from the right. */}
          <div
            role="dialog"
            aria-label="Notifications"
            className="sc-notif-in fixed z-[61] top-16 right-3 w-[min(360px,calc(100vw-1.5rem))] max-h-[75vh] bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
              <p className="text-sm font-bold text-white">Notifications</p>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    Mark all read
                  </button>
                )}
                {readCount > 0 && (
                  <button onClick={clearRead} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                    Clear read
                  </button>
                )}
                <button onClick={() => setOpen(false)} aria-label="Close" className="text-gray-500 hover:text-white transition-colors text-lg leading-none -mr-0.5">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-gray-800">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-gray-400 text-sm">No notifications yet</p>
                  <p className="text-gray-600 text-xs mt-1">You&apos;ll see new leads here</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`group px-4 py-3 transition-colors ${n.read ? "" : "bg-blue-950"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-gray-700" : "bg-blue-500"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-white text-xs font-semibold truncate">{n.title}</p>
                          {n.card_owner && (
                            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400 max-w-[110px] truncate" title={`Card: ${cardLabels?.[n.card_owner] ?? n.card_owner}`}>
                              {cardLabels?.[n.card_owner] ?? n.card_owner}
                            </span>
                          )}
                        </div>
                        {n.body && <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{n.body}</p>}
                        <p className="text-gray-500 text-[11px] mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      <button
                        onClick={() => setRead(n.id, !n.read)}
                        title={n.read ? "Mark as unread" : "Mark as read"}
                        aria-label={n.read ? "Mark as unread" : "Mark as read"}
                        className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                          n.read
                            ? "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500"
                            : "border-blue-700 bg-blue-600/15 text-blue-300 hover:bg-blue-600/25"
                        }`}
                      >
                        {n.read ? "Unread" : "Read"}
                      </button>
                      <button
                        onClick={() => dismiss(n.id)}
                        aria-label="Dismiss notification"
                        title="Dismiss"
                        className="shrink-0 -mt-0.5 -mr-1 p-1 text-gray-600 hover:text-gray-200 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
