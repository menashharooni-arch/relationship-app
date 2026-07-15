"use client";

// ── Desktop product mocks on a phone ────────────────────────────────────────
// DashboardDemo and TeamsDashboard are faithful replicas of the real product:
// browser chrome, two-column boards, twelve-column tables. That's the point —
// they show what you actually get. But a ~350px phone column crushed them into
// unreadable slivers: 10px text, tables at a third of their design width, panels
// stacked into a long grey smear. Legible on a laptop, uncomfortable on a phone,
// which is where most SwiftCard traffic starts.
//
// So don't shrink them — pan them. On a phone the mock renders at the width it
// was designed for and scrolls sideways inside its own container, the way a real
// screenshot would. It bleeds to the screen edges (-mx-5 cancels the section's
// px-5) so the cut-off edge reads as "there's more this way" rather than as a
// broken layout, and a hint line says so outright.
//
// From `sm:` up nothing changes at all — same markup, no wrapper behaviour.
export default function WideDemo({
  children,
  minWidth = 720,
  hint = "Swipe to explore →",
}: {
  children: React.ReactNode;
  /** The width the mock actually needs to stay readable. */
  minWidth?: number;
  hint?: string;
}) {
  return (
    <div>
      <div className="-mx-5 sm:mx-0 overflow-x-auto sm:overflow-visible rd-scrollbar-none [scrollbar-width:none]">
        <div className="px-5 sm:px-0">
          {/* min-w only below sm; from sm up the mock fits and flows normally. */}
          <div className="min-w-[var(--demo-min)] sm:min-w-0" style={{ ["--demo-min" as string]: `${minWidth}px` }}>
            {children}
          </div>
        </div>
      </div>
      <p className="sm:hidden text-center text-[11px] text-white/35 mt-2.5" aria-hidden="true">
        {hint}
      </p>
    </div>
  );
}
