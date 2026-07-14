"use client";

// ── Guided tour engine ──────────────────────────────────────────────────────
// Mounted once, globally (in the root layout). Dormant until a tour starts.
// While running it:
//   • dims the whole screen and cuts a spotlight hole around the current element
//   • shows a positioned tooltip with Back / Next / Skip / Finish
//   • auto-scrolls the element into view and keeps the spotlight glued to it
//   • navigates between pages when the next step lives elsewhere, then resumes
//   • skips steps whose element isn't on the page (e.g. a Pro-only control)
//
// Positioning is done imperatively in a requestAnimationFrame loop (refs, not
// React state) so scrolling and layout shifts stay perfectly in sync without a
// re-render every frame. React only re-renders when the step index changes.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOUR_STEPS, resolveTourPath, type TourStep } from "@/lib/tour-steps";
import {
  TOUR_RUNNING, TOUR_INDEX, TOUR_CARD, TOUR_START_EVENT, endTour,
} from "@/lib/tour";

const PAD = 8;        // spotlight padding around the element
const GAP = 14;       // gap between spotlight and tooltip
const TIP_W = 340;    // tooltip width (also used for clamping)
const FIND_TRIES = 24; // ~2.9s of polling before giving up on a missing element

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// First on-screen element matching the anchor (there can be mobile + desktop
// copies of the same thing; we want whichever is actually visible).
function findAnchor(anchor: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`));
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none") return el;
  }
  return null;
}

export default function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();

  const [running, setRunning] = useState(false);
  const [idx, setIdx] = useState(0);
  // Bumped whenever the spotlight target is (re)resolved, so the render reads
  // fresh clickToAdvance state. Positions themselves are handled by the rAF loop.
  const [, forceTick] = useState(0);

  const step: TourStep | null = running ? TOUR_STEPS[idx] ?? null : null;

  // The resolve effect and its polling run inside a closure that must NOT read a
  // stale `idx` — otherwise a skip computes the wrong next step. Mirror idx into
  // a ref that's always current and use that ref for all index math.
  const idxRef = useRef(0);
  idxRef.current = idx;

  // Direction of travel, so a missing element skips the RIGHT way (fwd/back).
  const dirRef = useRef(1);
  const targetRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Overlay node refs — mutated directly in the rAF loop.
  const maskT = useRef<HTMLDivElement>(null);
  const maskB = useRef<HTMLDivElement>(null);
  const maskL = useRef<HTMLDivElement>(null);
  const maskR = useRef<HTMLDivElement>(null);
  const full = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const holeCover = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  // ── Persist index so a page navigation can resume the tour ────────────────
  const persist = useCallback((i: number) => {
    try {
      sessionStorage.setItem(TOUR_RUNNING, "1");
      sessionStorage.setItem(TOUR_INDEX, String(i));
    } catch { /* ignore */ }
  }, []);

  const finish = useCallback((completed: boolean) => {
    setRunning(false);
    targetRef.current = null;
    endTour(completed);
    // When the tour ends, land the user on their dashboard.
    router.push("/dashboard");
  }, [router]);

  const go = useCallback((next: number) => {
    if (next < 0) return;
    if (next >= TOUR_STEPS.length) { finish(true); return; }
    dirRef.current = next >= idxRef.current ? 1 : -1;
    persist(next);
    setIdx(next);
  }, [persist, finish]);

  // ── Start / resume: read sessionStorage on mount and on the start event ───
  useEffect(() => {
    function boot() {
      let active = false, i = 0;
      try {
        active = sessionStorage.getItem(TOUR_RUNNING) === "1";
        i = parseInt(sessionStorage.getItem(TOUR_INDEX) || "0", 10) || 0;
      } catch { /* ignore */ }
      if (active) { setIdx(Math.min(Math.max(i, 0), TOUR_STEPS.length - 1)); setRunning(true); }
    }
    boot();
    window.addEventListener(TOUR_START_EVENT, boot);
    return () => window.removeEventListener(TOUR_START_EVENT, boot);
  }, []);

  // ── Resolve the current step: navigate if needed, else find + scroll to it ─
  // Keyed on the PRIMITIVE idx (not the step object) so the effect only re-runs
  // when the step genuinely changes — never from an unrelated re-render, which
  // would otherwise reset the find-polling and could strand a skip.
  useEffect(() => {
    if (!running) return;
    const cur = TOUR_STEPS[idx];
    if (!cur) return;

    // Wrong page for this step → go there; this effect re-runs after the route
    // changes (pathname is a dependency) and we resume on arrival.
    if (cur.path !== pathname) {
      let card: string | null = null;
      try { card = sessionStorage.getItem(TOUR_CARD); } catch { /* ignore */ }
      router.push(resolveTourPath(cur, card));
      return;
    }

    // Centered message (no anchor) — nothing to find.
    if (!cur.anchor) {
      targetRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- forces a re-render to re-resolve the anchorless step
      forceTick((n) => n + 1);
      startLoop();
      return () => stopLoop();
    }

    let tries = 0;
    let cancelled = false;
    let cleanupClick: (() => void) | undefined;

    const tryFind = () => {
      if (cancelled) return;
      const el = findAnchor(cur.anchor!);
      if (el) {
        targetRef.current = el;
        el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center", inline: "nearest" });
        forceTick((n) => n + 1);
        startLoop();
        if (cur.clickToAdvance) {
          const onClick = (e: Event) => { e.preventDefault(); e.stopPropagation(); go(idxRef.current + 1); };
          el.addEventListener("click", onClick, { capture: true });
          cleanupClick = () => el.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
        }
        return;
      }
      if (++tries >= FIND_TRIES) {
        // Element genuinely isn't here — skip in the direction we're moving.
        const nextIdx = idxRef.current + dirRef.current;
        if (nextIdx < 0 || nextIdx >= TOUR_STEPS.length) { finish(true); return; }
        go(nextIdx);
        return;
      }
      window.setTimeout(tryFind, 120);
    };
    tryFind();

    return () => { cancelled = true; cleanupClick?.(); stopLoop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, running, pathname]);

  // ── Keep the spotlight glued to the element ───────────────────────────────
  // rAF gives buttery tracking while the tab is visible. We ALSO position once
  // synchronously (so the first paint is correct, no flash) and on scroll/resize
  // (so it still tracks if rAF is throttled, e.g. a backgrounded tab).
  //
  // PERF: the naive version of this loop wrote styles to 7 overlay nodes and
  // called getComputedStyle/offsetWidth every frame. Each write dirties layout,
  // so the NEXT frame's getBoundingClientRect forces a synchronous reflow —
  // 60fps layout thrash that made the whole tour feel laggy on a busy
  // dashboard. Now everything expensive is cached (tooltip size per step,
  // border-radius per target) and the frame bails out before ANY write when
  // the target hasn't moved — a steady-state frame is a single cheap rect read.
  const measureRef = useRef<{
    el: HTMLElement | null;   // target the radius cache belongs to
    radius: string;           // cached computed border-radius for the ring
    tipStep: number;          // step the tooltip size was measured for
    tipW: number;
    tipH: number;
    sig: string;              // last-applied layout signature (bail when equal)
  }>({ el: null, radius: "12px", tipStep: -1, tipW: TIP_W, tipH: 160, sig: "" });

  function startLoop() {
    stopLoop();
    measureRef.current.sig = ""; // new target/step → force one full layout pass
    layout(); // immediate — don't wait for the first animation frame
    const frame = () => {
      layout();
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    window.addEventListener("scroll", layout, true);
    window.addEventListener("resize", onResize);
  }
  function stopLoop() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    window.removeEventListener("scroll", layout, true);
    window.removeEventListener("resize", onResize);
  }
  function onResize() {
    // Viewport changed → cached tooltip size may be stale (width clamp) and the
    // bail signature no longer matches reality. Remeasure + relayout.
    measureRef.current.tipStep = -1;
    measureRef.current.sig = "";
    layout();
  }

  function layout() {
    const W = window.innerWidth, H = window.innerHeight;
    const el = targetRef.current;
    const tipEl = tip.current;
    const m = measureRef.current;

    // Tooltip size: fixed width + step-dependent content → only remeasure when
    // the step changes (or after a resize), never per frame.
    if (tipEl && m.tipStep !== idxRef.current) {
      m.tipW = tipEl.offsetWidth || TIP_W;
      m.tipH = tipEl.offsetHeight || 160;
      m.tipStep = idxRef.current;
    }

    // No target → full-screen dim + centered tooltip.
    if (!el) {
      const sig = `c|${W}|${H}|${m.tipW}|${m.tipH}`;
      if (sig === m.sig) return;
      m.sig = sig;
      if (full.current) full.current.style.opacity = "1";
      [maskT, maskB, maskL, maskR].forEach((mm) => mm.current && (mm.current.style.opacity = "0"));
      if (ring.current) ring.current.style.opacity = "0";
      if (holeCover.current) holeCover.current.style.opacity = "0";
      if (tipEl) {
        tipEl.style.left = `${Math.round((W - m.tipW) / 2)}px`;
        tipEl.style.top = `${Math.round((H - m.tipH) / 2)}px`;
        tipEl.style.visibility = "visible";
      }
      return;
    }

    const r = el.getBoundingClientRect();
    const x0 = Math.max(0, r.left - PAD), y0 = Math.max(0, r.top - PAD);
    const x1 = Math.min(W, r.right + PAD), y1 = Math.min(H, r.bottom + PAD);
    const hw = Math.max(0, x1 - x0), hh = Math.max(0, y1 - y0);

    // Bail before ANY write when nothing moved — keeps layout clean so the rect
    // read above stays cheap (no forced reflow) on every idle frame.
    const clickable = !!(step?.clickToAdvance || step?.interactive);
    const sig = `${x0}|${y0}|${x1}|${y1}|${W}|${H}|${m.tipW}|${m.tipH}|${clickable ? 1 : 0}`;
    if (sig === m.sig) return;
    m.sig = sig;

    if (full.current) full.current.style.opacity = "0";

    // Four dim rectangles framing the hole.
    setBox(maskT.current, 0, 0, W, y0);
    setBox(maskB.current, 0, y1, W, H - y1);
    setBox(maskL.current, 0, y0, x0, hh);
    setBox(maskR.current, x1, y0, W - x1, hh);
    [maskT, maskB, maskL, maskR].forEach((mm) => mm.current && (mm.current.style.opacity = "1"));

    // Spotlight ring (visual only). Computed border-radius is cached per target.
    if (ring.current) {
      if (m.el !== el) {
        const cs = getComputedStyle(el);
        m.radius = cs.borderRadius && cs.borderRadius !== "0px" ? cs.borderRadius : "12px";
        m.el = el;
      }
      setBox(ring.current, x0, y0, hw, hh);
      ring.current.style.borderRadius = m.radius;
      ring.current.style.opacity = "1";
    }
    // Click blocker over the hole — present unless this step invites a click
    // (clickToAdvance) or lets the visitor genuinely use the control (interactive).
    if (holeCover.current) {
      setBox(holeCover.current, x0, y0, hw, hh);
      holeCover.current.style.opacity = clickable ? "0" : "1";
      holeCover.current.style.pointerEvents = clickable ? "none" : "auto";
    }

    // Tooltip: try the preferred side, fall back to whatever fits.
    if (tipEl) {
      const tw = m.tipW, th = m.tipH;
      const place = step?.placement ?? "bottom";
      let top: number, left: number;
      const fitsBelow = y1 + GAP + th <= H, fitsAbove = y0 - GAP - th >= 0;
      const fitsRight = x1 + GAP + tw <= W, fitsLeft = x0 - GAP - tw >= 0;

      const below = () => { top = y1 + GAP; left = clamp(r.left + r.width / 2 - tw / 2, W - tw); };
      const above = () => { top = y0 - GAP - th; left = clamp(r.left + r.width / 2 - tw / 2, W - tw); };
      const right = () => { left = x1 + GAP; top = clamp(r.top + r.height / 2 - th / 2, H - th); };
      const left_ = () => { left = x0 - GAP - tw; top = clamp(r.top + r.height / 2 - th / 2, H - th); };

      if (place === "bottom" && fitsBelow) below();
      else if (place === "top" && fitsAbove) above();
      else if (place === "right" && fitsRight) right();
      else if (place === "left" && fitsLeft) left_();
      else if (fitsBelow) below();
      else if (fitsAbove) above();
      else if (fitsRight) right();
      else if (fitsLeft) left_();
      else { top = clamp(y1 + GAP, H - th); left = clamp(r.left + r.width / 2 - tw / 2, W - tw); }

      tipEl.style.left = `${Math.round(left!)}px`;
      tipEl.style.top = `${Math.round(top!)}px`;
      tipEl.style.visibility = "visible";
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish(true); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(idx + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, idx, go, finish]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- stopLoop is redefined each render but only its cleanup-on-unmount behavior matters here
  useEffect(() => () => stopLoop(), []);

  if (!step) return null;

  // While navigating to another page, keep the screen dimmed (instead of
  // unmounting everything) so the step change reads as one continuous motion
  // rather than a bright flash of the raw page mid-tour.
  if (step.path !== pathname) {
    return (
      <div className="sc-tour" aria-hidden="true">
        <div className="fixed inset-0 z-[9998]" style={{ background: "rgba(3,7,18,0.80)", pointerEvents: "auto" }} />
      </div>
    );
  }

  const isLast = idx === TOUR_STEPS.length - 1;
  const isFirst = idx === 0;

  return (
    <div className="sc-tour" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Centered-step full dim */}
      <div ref={full} className="fixed inset-0 z-[9998] transition-opacity duration-200" style={{ background: "rgba(3,7,18,0.80)", opacity: 0, pointerEvents: "auto" }} />
      {/* Four dim rectangles for the spotlight */}
      {[maskT, maskB, maskL, maskR].map((m, i) => (
        <div key={i} ref={m} className="fixed z-[9998]" style={{ background: "rgba(3,7,18,0.74)", opacity: 0, pointerEvents: "auto" }} />
      ))}
      {/* Click blocker over the highlighted element (removed on click-to-advance steps) */}
      <div ref={holeCover} className="fixed z-[9998]" style={{ opacity: 0, background: "transparent" }} />
      {/* Spotlight ring */}
      <div
        ref={ring}
        className={`fixed z-[9999] ${step.clickToAdvance || step.interactive ? "sc-tour-pulse" : ""}`}
        style={{ opacity: 0, pointerEvents: "none", boxShadow: "0 0 0 3px rgba(96,165,250,0.95), 0 8px 40px rgba(37,99,235,0.35)" }}
      />

      {/* Tooltip — keyed on the step so each step gets a light fade/slide-in.
          Mounts hidden; layout() reveals it once it's actually positioned, so a
          fresh node never flashes at the viewport origin while the next anchor
          is still being located. */}
      <div
        key={idx}
        ref={tip}
        className="fixed z-[10000] rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-5 sc-tour-tip-in"
        style={{ width: TIP_W, maxWidth: "calc(100vw - 24px)", visibility: "hidden" }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold tracking-wide text-blue-400 uppercase">Step {idx + 1} of {TOUR_STEPS.length}</span>
          <button onClick={() => finish(true)} className="text-gray-500 hover:text-gray-300 text-xs font-medium transition-colors">Skip tour</button>
        </div>
        <p className="text-white font-bold text-[15px] leading-snug mb-1.5">{step.title}</p>
        <p className="text-gray-300 text-[13px] leading-relaxed">{step.body}</p>
        {step.clickToAdvance && (
          <p className="text-blue-300 text-[12px] font-medium mt-2">Tap the highlighted card, or press Next.</p>
        )}
        {step.interactive && (
          <p className="text-blue-300 text-[12px] font-medium mt-2">Go ahead — try it. Then press Next to continue.</p>
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-1 mt-4 mb-3 flex-wrap">
          {TOUR_STEPS.map((_, i) => (
            <span key={i} className={`h-1 rounded-full transition-all ${i === idx ? "w-4 bg-blue-500" : i < idx ? "w-1.5 bg-blue-800" : "w-1.5 bg-gray-700"}`} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => go(idx - 1)}
            disabled={isFirst}
            className="text-sm font-semibold px-3 py-2 rounded-full transition-colors text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400"
          >
            ← Back
          </button>
          <button
            onClick={() => (isLast ? finish(true) : go(idx + 1))}
            className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-full transition-colors shadow-lg shadow-blue-900/40"
          >
            {isLast ? "Finish" : "Next →"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes sc-tour-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(96,165,250,0.95), 0 8px 40px rgba(37,99,235,0.35); }
          50% { box-shadow: 0 0 0 6px rgba(96,165,250,0.55), 0 8px 46px rgba(37,99,235,0.5); }
        }
        .sc-tour-pulse { animation: sc-tour-pulse 1.4s ease-in-out infinite; }
        @keyframes sc-tour-tip-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sc-tour-tip-in { animation: sc-tour-tip-in .18s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .sc-tour-pulse { animation: none; }
          .sc-tour-tip-in { animation: none; }
        }
      `}</style>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────
function setBox(el: HTMLElement | null, x: number, y: number, w: number, h: number) {
  if (!el) return;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${Math.max(0, w)}px`;
  el.style.height = `${Math.max(0, h)}px`;
}
function clamp(v: number, max: number): number {
  return Math.max(12, Math.min(v, max - 12));
}
