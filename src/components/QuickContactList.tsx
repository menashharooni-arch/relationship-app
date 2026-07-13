"use client";

// Quick Contacts list (dashboard): one simple row per contact — name plus
// Call / Text / Email buttons that hand off to the phone's native apps via
// tel: / sms: / mailto:. No dropdowns or inline editing here; tapping the
// name opens that contact on the full Contacts page.

import Link from "next/link";
import { useState } from "react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  created_at: string;
};

const PAGE = 12;

function ActionButton({
  href,
  label,
  color,
  children,
}: {
  href: string;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center justify-center w-9 h-9 rounded-full border transition-colors shrink-0"
      style={{ borderColor: `${color}40`, background: `${color}14`, color }}
    >
      {children}
    </a>
  );
}

export default function QuickContactList({ leads, card }: { leads: Lead[]; card?: string }) {
  const [shown, setShown] = useState(PAGE);
  const visible = leads.slice(0, shown);
  const contactHref = (id: string) =>
    `/contacts?${card ? `card=${encodeURIComponent(card)}&` : ""}lead=${id}`;

  return (
    <div className="space-y-2">
      {visible.map((l) => {
        const phone = (l.phone ?? "").trim();
        const email = (l.email ?? "").trim();
        return (
          <div
            key={l.id}
            className="flex items-center gap-3 bg-gray-900 border border-gray-800/80 rounded-2xl px-4 py-3"
          >
            {/* Name (+ company) — opens this contact on the Contacts page */}
            <Link href={contactHref(l.id)} className="flex items-center gap-3 flex-1 min-w-0 group">
              <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700/60 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
                {(l.name || "?")[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate group-hover:text-blue-300 transition-colors">{l.name}</p>
                {l.company && <p className="text-gray-500 text-[11px] truncate">{l.company}</p>}
              </div>
            </Link>

            {/* Native actions — the phone opens its dialer / SMS / mail composer */}
            <div className="flex items-center gap-1.5 shrink-0">
              {phone && (
                <ActionButton href={`tel:${phone}`} label={`Call ${l.name}`} color="#22c55e">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </ActionButton>
              )}
              {phone && (
                <ActionButton href={`sms:${phone}`} label={`Text ${l.name}`} color="#3b82f6">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </ActionButton>
              )}
              {email && (
                <ActionButton href={`mailto:${email}`} label={`Email ${l.name}`} color="#a78bfa">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
                  </svg>
                </ActionButton>
              )}
            </div>
          </div>
        );
      })}

      {leads.length > shown && (
        <button
          type="button"
          onClick={() => setShown((s) => s + PAGE)}
          className="w-full text-xs font-semibold text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-full py-2.5 transition-colors"
        >
          Show more ({leads.length - shown} more)
        </button>
      )}
    </div>
  );
}
