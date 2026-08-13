import type { NextRequest } from "next/server";

// ── Coarse location for one request ──────────────────────────────────────────
//
// Single source of truth for how a view/lead event gets its location: the
// Vercel edge geo headers on THAT request. Never cached, never client-supplied,
// so one visitor's location can never be replayed onto another visitor's event.
//
// Honesty rules:
//   • Missing data stays missing — null, never a placeholder city.
//   • A city without a country is still a real signal and is kept (it used to
//     be discarded), and a bare country code is kept as-is; the UI labels it.
//   • VPNs/proxies/cellular IPs simply resolve to wherever the edge saw the
//     connection from — coarse by design, matching the privacy policy ("city/
//     country derived from IP by our hosting provider"). The raw IP is never
//     part of the returned value.
//
// x-vercel-ip-city is percent-encoded ("S%C3%A3o%20Paulo"). A malformed value
// must degrade to "header absent", not throw — an unguarded decodeURIComponent
// here once turned a bad geo header into a 500 that killed lead capture.
export function requestLocation(req: NextRequest): string | null {
  const city = safeDecode(req.headers.get("x-vercel-ip-city"));
  const countryRaw = req.headers.get("x-vercel-ip-country");
  // Country must be a bare ISO code — anything else is a spoofed/garbled header.
  const country = countryRaw && /^[A-Z]{2}$/.test(countryRaw) ? countryRaw : null;
  if (city && country) return `${city}, ${country}`;
  return city || country || null;
}

function safeDecode(value: string | null): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value).trim();
    // Cap length so a forged header can't grow rows unboundedly.
    return decoded ? decoded.slice(0, 80) : null;
  } catch {
    return null;
  }
}
