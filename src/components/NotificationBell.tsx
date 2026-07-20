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
  activeCard,
}: {
  initialNotifications: Notification[];
  // username → display label, for the per-card tag on each notification.
  cardLabels?: Record<string, string>;
  // The currently selected card's username. Without it, "View all
  // notifications" lands a multi-card account on the card PICKER (the
  // dashboard only auto-selects when there's exactly one card).
  activeCard?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  // Per-item in-flight ids (Read/Unread + dismiss) and a bulk-action flag
  // (Mark all read / Clear read) — disables the triggering control while its
  // request is outstanding (prevents a double-tap firing duplicate requests)
  // and reverts the optimistic update if the request actually fails, instead
  // of silently leaving a stale "read"/dismissed state on a dropped request.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState<"markAll" | "clearRead" | null>(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

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
    if (bulkPending) return;
    setBulkPending("markAll");
    // Revert only the ids THIS action actually flipped (the ones unread at
    // the moment it started) — not a snapshot/restore of the whole list,
    // which would also undo a different notification's dismiss/read-toggle
    // that independently succeeded while this request was in flight (code
    // review — same reasoning as the setRead/dismiss fix above).
    const idsToRevert = notifications.filter((n) => !n.read).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (!res.ok) throw new Error("failed");
    } catch {
      const revertSet = new Set(idsToRevert);
      setNotifications((prev) => prev.map((n) => (revertSet.has(n.id) ? { ...n, read: false } : n)));
    } finally {
      setBulkPending(null);
    }
  }

  // Toggle ONE notification read/unread — the badge only drops when the user
  // explicitly marks items read (individually here, or in bulk above).
  // Reverts only THIS notification's own prior state on failure — snapshotting
  // and restoring the whole list would clobber a DIFFERENT notification's
  // change that succeeded while this one was still in flight (code review).
  async function setRead(id: string, read: boolean) {
    if (pendingIds.has(id)) return;
    setPendingIds((s) => new Set(s).add(id));
    const previousRead = notifications.find((n) => n.id === id)?.read;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)));
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      if (previousRead !== undefined) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: previousRead } : n)));
      }
    } finally {
      setPendingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  // Remove a single notification for good (not just mark it read). Reverts by
  // re-inserting only THIS notification (in its original time order) on
  // failure — same reasoning as setRead above.
  async function dismiss(id: string) {
    if (pendingIds.has(id)) return;
    setPendingIds((s) => new Set(s).add(id));
    const removed = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      if (removed) {
        setNotifications((prev) =>
          [...prev, removed].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        );
      }
    } finally {
      setPendingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  // Clear out everything already read in one tap.
  async function clearRead() {
    if (bulkPending) return;
    setBulkPending("clearRead");
    // Revert by re-inserting only the specific notifications THIS action
    // removed, not a snapshot/restore of the whole list — same reasoning as
    // markAllRead above.
    const removed = notifications.filter((n) => n.read);
    setNotifications((prev) => prev.filter((n) => !n.read));
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setNotifications((prev) =>
        [...prev, ...removed].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      );
    } finally {
      setBulkPending(null);
    }
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
          {/* Backdrop — click anywhere outside to close. */}
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />

          {/* Dropdown menu — pinned to the VIEWPORT (below the nav bar, inset
              from the right edge) rather than anchored to the bell. Anchoring
              right-0 to the bell pushed the panel's left side off-screen on
              phones, since the bell isn't at the screen edge. */}
          <div
            role="dialog"
            aria-label="Notifications"
            className="sc-drop-in fixed z-[61] right-3 top-16 w-[min(360px,calc(100vw-1.5rem))] max-h-[70vh] bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
          >

            <div className="relative flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
              <p className="text-sm font-bold text-white">Notifications</p>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={bulkPending !== null}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bulkPending === "markAll" ? "Marking…" : "Mark all read"}
                  </button>
                )}
                {readCount > 0 && (
                  <button
                    onClick={clearRead}
                    disabled={bulkPending !== null}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bulkPending === "clearRead" ? "Clearing…" : "Clear read"}
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
                        <p className="text-white text-xs font-semibold truncate">{n.title}</p>
                        {n.body && <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{n.body}</p>}
                        {/* Meta line: card tag + time — chip lives here so the
                            title keeps full width on narrow phones. */}
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                          {n.card_owner && (
                            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400 max-w-[130px] truncate" title={`Card: ${cardLabels?.[n.card_owner] ?? n.card_owner}`}>
                              {cardLabels?.[n.card_owner] ?? n.card_owner}
                            </span>
                          )}
                          <p className="text-gray-500 text-[11px] truncate">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setRead(n.id, !n.read)}
                        disabled={pendingIds.has(n.id)}
                        title={n.read ? "Mark as unread" : "Mark as read"}
                        aria-label={n.read ? "Mark as unread" : "Mark as read"}
                        className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          n.read
                            ? "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500"
                            : "border-blue-700 bg-blue-600/15 text-blue-300 hover:bg-blue-600/25"
                        }`}
                      >
                        {n.read ? "Unread" : "Read"}
                      </button>
                      <button
                        onClick={() => dismiss(n.id)}
                        disabled={pendingIds.has(n.id)}
                        aria-label="Dismiss notification"
                        title="Dismiss"
                        className="shrink-0 -mt-0.5 -mr-1 p-1 text-gray-600 hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Footer — jump to the full notifications list on the dashboard. */}
            <a
              href={activeCard ? `/dashboard?card=${encodeURIComponent(activeCard)}&view=notifications` : "/dashboard?view=notifications"}
              onClick={() => setOpen(false)}
              className="shrink-0 border-t border-gray-800 px-4 py-2.5 text-center text-xs font-semibold text-blue-400 hover:text-blue-300 hover:bg-gray-800/50 transition-colors"
            >
              View all notifications
            </a>
          </div>
        </>
      )}
    </div>
  );
}
