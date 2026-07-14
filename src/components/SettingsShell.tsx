"use client";

import { useEffect, useState, type ReactNode } from "react";

// Settings layout: a section rail + one panel at a time, rather than one long
// scroll of everything. Same pattern as Stripe/Linear/Vercel — you pick the area
// you came for and see only that, so nothing competes for attention and
// destructive actions aren't sitting next to routine ones.
//
// Sections are rendered on the SERVER and passed in as content, so this file
// stays presentational: what's visible per plan/role is decided in the page.

export type SettingsSection = {
  id: string;
  label: string;
  desc: string;
  icon: ReactNode;
  content: ReactNode;
  /** Rendered in a muted, set-apart style at the bottom of the rail. */
  quiet?: boolean;
};

export default function SettingsShell({
  sections,
  initialSection,
}: {
  sections: SettingsSection[];
  initialSection?: string;
}) {
  const first = sections[0]?.id ?? "";
  const valid = (id: string | undefined) => (id && sections.some((s) => s.id === id) ? id : null);

  const [active, setActive] = useState<string>(valid(initialSection) ?? first);

  // Deep links keep working: /settings/flows?billing=1#billing and any #section
  // hash open that panel directly (receipt emails and the Office dashboard both
  // link straight to billing).
  useEffect(() => {
    const fromHash = valid(window.location.hash.replace("#", ""));
    if (fromHash) setActive(fromHash);
    const onHash = () => {
      const next = valid(window.location.hash.replace("#", ""));
      if (next) setActive(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.length]);

  function go(id: string) {
    setActive(id);
    // Replace rather than push so Back leaves Settings instead of walking the tabs.
    window.history.replaceState(null, "", `#${id}`);
  }

  const current = sections.find((s) => s.id === active) ?? sections[0];
  const main = sections.filter((s) => !s.quiet);
  const quiet = sections.filter((s) => s.quiet);

  return (
    <div className="flex flex-col md:flex-row md:gap-10">
      {/* Rail — a sidebar on desktop, a scrollable strip on mobile. */}
      <nav aria-label="Settings sections" className="md:w-56 md:shrink-0 mb-6 md:mb-0">
        <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-5 px-5 md:mx-0 md:px-0 pb-2 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {main.map((s) => (
            <RailItem key={s.id} section={s} active={active === s.id} onClick={() => go(s.id)} />
          ))}
          {quiet.length > 0 && (
            <>
              <div className="hidden md:block h-px bg-gray-800/80 my-2" />
              {quiet.map((s) => (
                <RailItem key={s.id} section={s} active={active === s.id} onClick={() => go(s.id)} quiet />
              ))}
            </>
          )}
        </div>
      </nav>

      {/* Panel */}
      <section className="flex-1 min-w-0" aria-live="polite">
        {current && (
          <div key={current.id}>
            <div className="mb-5">
              <h2 className="text-white text-lg font-bold tracking-tight">{current.label}</h2>
              <p className="text-gray-500 text-xs mt-0.5">{current.desc}</p>
            </div>
            <div className="space-y-3">{current.content}</div>
          </div>
        )}
      </section>
    </div>
  );
}

function RailItem({
  section,
  active,
  onClick,
  quiet = false,
}: {
  section: SettingsSection;
  active: boolean;
  onClick: () => void;
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 md:w-full flex items-center gap-2.5 text-sm rounded-xl px-3 py-2 transition-colors whitespace-nowrap ${
        active
          ? "bg-gray-800 text-white font-medium"
          : quiet
            ? "text-gray-600 hover:text-gray-300 hover:bg-gray-800/50"
            : "text-gray-400 hover:text-white hover:bg-gray-800/60"
      }`}
    >
      <span className={`shrink-0 ${active ? "text-blue-400" : "text-gray-600"}`}>{section.icon}</span>
      {section.label}
    </button>
  );
}
