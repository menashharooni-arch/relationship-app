import { LINK_STYLE_KEYS, LINK_STRUCTURAL_KEYS } from "@/lib/plan";

// ── The Swift Links vocabulary an office can own ────────────────────────────
//
// Exactly the keys the member's own "Social design" step writes: the page's
// Look, its background, its text colour and font, plus the per-surface pieces
// (header style, social icons, Connect button, link-button style). One list, so
// the admin UI, the brand API's allow-list and the overlay cannot drift into
// disagreeing about what "the office's design" means.
//
// Deliberately the union of LINK_STYLE_KEYS and LINK_STRUCTURAL_KEYS. On a
// personal card those split by PLAN — structural keys are every-plan — but an
// Office is paid by definition, so for branding they are one set.
//
// IN ITS OWN MODULE because the admin's Branding page is a client component and
// needs it. Living in lib/office-brand put that module — and the service-role
// database client it imports — on a path the browser bundle follows, which the
// import-graph guard caught immediately. Pure data, no imports beyond a sibling
// constant list.
export const OFFICE_LINK_DESIGN_KEYS = [...LINK_STYLE_KEYS, ...LINK_STRUCTURAL_KEYS] as const;
