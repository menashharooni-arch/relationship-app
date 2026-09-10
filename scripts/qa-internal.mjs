// ── Keep our own QA traffic out of the product funnel ───────────────────────
//
// qa-sweep and qa-flows drive the REAL site with REAL device user agents — an
// iPhone Safari string, a desktop Chrome string — precisely so they exercise
// the paths a customer takes. That is what makes them useful, and it is also
// what makes them invisible to the bot filter on /api/events: they look exactly
// like people, because they are pretending to be people.
//
// So a sweep against production wrote runs of "visits" into product_events —
// landed on the site, started building a card, opened pricing — seconds apart,
// each on a fresh session. On the admin funnel that is indistinguishable from
// demand, and it lands on the top step, which is the denominator for every
// conversion rate below it.
//
// The ingest route already honours a browser that says it is ours. This is how
// a QA context says so, before any page script runs.
export async function markInternal(ctx) {
  await ctx.addInitScript(() => {
    try { localStorage.setItem("sc_evt_internal", "1"); } catch { /* storage blocked */ }
  });
  return ctx;
}
