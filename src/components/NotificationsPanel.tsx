"use client";

import { useState } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
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

export default function NotificationsPanel({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState<Notification[]>(initial);
  const unread = items.filter((n) => !n.read).length;
  const readCount = items.filter((n) => n.read).length;

  async function setRead(id: string, read: boolean) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read }),
    }).catch(() => {});
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
  }

  async function dismiss(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  async function clearRead() {
    setItems((prev) => prev.filter((n) => !n.read));
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  }

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-gray-800 rounded-2xl p-8 text-center">
        <div className="w-10 h-10 bg-gray-800/60 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-gray-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
        <p className="font-semibold text-gray-300 text-sm mb-1">No notifications yet</p>
        <p className="text-gray-600 text-xs">New contacts, card saves, and activity show up here.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900/40">
        <p className="text-xs text-gray-500">{unread} unread</p>
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
        </div>
      </div>
      <div className="divide-y divide-gray-800">
        {items.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 px-4 py-3 transition-colors ${n.read ? "" : "bg-blue-950/40"}`}>
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-gray-700" : "bg-blue-500"}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${n.read ? "text-gray-300 font-medium" : "text-white font-semibold"}`}>{n.title}</p>
              {n.body && <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{n.body}</p>}
              <p className="text-gray-600 text-[11px] mt-1">{timeAgo(n.created_at)}</p>
            </div>
            <button
              onClick={() => setRead(n.id, !n.read)}
              title={n.read ? "Mark as unread" : "Mark as read"}
              aria-label={n.read ? "Mark as unread" : "Mark as read"}
              className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                n.read
                  ? "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500"
                  : "border-blue-700 bg-blue-600/15 text-blue-300 hover:bg-blue-600/25"
              }`}
            >
              {n.read ? "Unread" : "Read"}
            </button>
            <button
              onClick={() => dismiss(n.id)}
              title="Dismiss"
              aria-label="Dismiss notification"
              className="shrink-0 p-1 text-gray-600 hover:text-gray-300 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
