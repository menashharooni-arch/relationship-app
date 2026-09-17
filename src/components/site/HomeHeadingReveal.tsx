"use client";

import { useEffect } from "react";

// Homepage section headings drop onto the page one line at a time — kicker,
// headline, then the line under it — and the headline's gradient sweeps in
// after (owner, 2026-09-17: "the header would nicely type onto the page").
//
// Why this is not the site-wide ScrollReveal: that one fires the moment an
// element's edge crosses the bottom ~8% of the screen. For a heading that meant
// the whole animation played in the last strip of the viewport and was over
// before anyone was looking at it — measured at 91–94% down the screen for
// every heading on the page. This observer waits until the heading block is
// properly on screen (above the bottom ~30%), so the drop happens where the eye
// is. Styles: [data-hp-head] in app/home.css.
export default function HomeHeadingReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-hp-head]"));
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0, rootMargin: "0px 0px -30% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
