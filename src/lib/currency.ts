// ── Money math + formatting — ONE source of truth ────────────────────────────
// All currency is computed in INTEGER CENTS and only converted to a display
// string at the very end. Never multiply float dollars: 20 * 3.99 in JS is
// 79.80000000000001, which is what produced "$79.80000000000001/mo" on the
// Office CTA. Cents are integers, so 399 * 20 = 7980 is exact, and formatting
// always renders exactly two decimals.
//
// Use these everywhere Office (and any) pricing appears — pricing cards, CTA
// buttons, checkout summaries, billing, account settings, seat changes — so the
// number shown is always the number sent to Stripe (unit_amount * quantity).

// Format integer cents as a fixed 2-decimal amount (no "$"): 7980 → "79.80".
export function formatCents(cents: number): string {
  const dollars = Math.round(cents) / 100;
  return dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "$X.XX" convenience: 7980 → "$79.80".
export function formatUsd(cents: number): string {
  return `$${formatCents(cents)}`;
}

// Per-seat subtotal in integer cents = per-seat cents × seats. This is exactly
// what Stripe charges (line-item unit_amount × quantity), so the displayed
// subtotal always matches the charge.
export function seatSubtotalCents(perSeatCents: number, seats: number): number {
  return Math.round(perSeatCents) * Math.max(0, Math.floor(seats));
}

// Per-month equivalent of an annual price, in cents (display only — Stripe still
// charges the full annual amount once a year): 4309 → 359 ("$3.59/mo").
export function perMonthCents(annualCents: number): number {
  return Math.round(annualCents / 12);
}
