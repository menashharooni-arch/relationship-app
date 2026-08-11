import type { TourStep } from "./tour-steps";

// ── Office Admin guided tour: the walkthrough itself ────────────────────────
// A separate, shorter tour scoped to the Office admin console — Team, Leads,
// and Branding. Runs independently of the main dashboard tour (own storage
// keys in tour.ts) so an admin can replay just this one without restarting
// the whole-app tour.

const TEAM = "/office/admin";
const LEADS = "/office/admin/leads";
const BRANDING = "/office/admin/branding";

export const ADMIN_TOUR_STEPS: TourStep[] = [
  {
    id: "admin-welcome",
    path: TEAM,
    title: "Welcome to your Admin console",
    body: "A quick lap around Team, Leads, and Branding — the three things you manage for your whole office. Use Next and Back, or Skip anytime.",
  },
  {
    id: "admin-nav-team",
    path: TEAM,
    anchor: "admin-nav-team",
    title: "Team",
    body: "Your landing page — everyone with a company card, and how their cards are doing. You're on it now.",
    placement: "bottom",
  },
  {
    id: "admin-stats",
    path: TEAM,
    anchor: "admin-stats",
    title: "The four numbers that matter",
    body: "Leads captured, card views, how many invited teammates actually finished their card, and how many seats you're paying for vs. using.",
    placement: "bottom",
  },
  {
    id: "admin-add-member",
    path: TEAM,
    anchor: "admin-add-member",
    title: "Add a team member",
    body: "Invite someone by email — their card is ready before your meeting ends. Seats are unlimited; add or remove people here anytime.",
    placement: "left",
  },
  {
    id: "admin-team-list",
    path: TEAM,
    anchor: "admin-team-list",
    title: "Your roster",
    body: "Everyone with a company card, plus anyone you've invited who hasn't finished yet. Tap Manage on anyone to see their card, resend an invite, or remove them.",
    placement: "top",
  },
  {
    id: "admin-team-bell",
    path: TEAM,
    anchor: "admin-team-bell",
    title: "Team notifications",
    body: "Activity from across the whole office lands here — new leads, cards going live, invites accepted — each tagged with the teammate it came from.",
    placement: "bottom",
  },
  // Analytics is one of the console's four tabs. The tour used to walk past it
  // to Leads, so an office admin finished a "tour of the console" without ever
  // being told a whole section existed — and the closing step then claimed the
  // console was Team, Leads and Branding.
  //
  // A nav-tab step rather than a page step: nothing on the analytics page
  // carries a data-tour anchor, and a step that navigates there would need one
  // to point at. Naming what the tab holds is honest and needs no new markup.
  {
    id: "admin-nav-analytics",
    path: TEAM,
    anchor: "admin-nav-analytics",
    title: "Analytics",
    body: "Views, saves, and leads per teammate — who's actually sharing their card, and which cards are landing. Tap any teammate for their own breakdown.",
    placement: "bottom",
  },
  {
    id: "admin-nav-leads",
    path: TEAM,
    anchor: "admin-nav-leads",
    title: "Leads",
    body: "Tap here to see everyone across your whole team who's shared their info.",
    placement: "bottom",
  },
  {
    id: "admin-leads-table",
    path: LEADS,
    anchor: "admin-leads-table",
    title: "Every lead, whoever captured it",
    body: "One combined list for the whole office — who they are, which teammate's card they came from, and when. No lead gets lost when someone leaves.",
    placement: "top",
  },
  {
    id: "admin-nav-branding",
    path: LEADS,
    anchor: "admin-nav-branding",
    title: "Branding",
    body: "Tap here to set the look every card on your team shares.",
    placement: "bottom",
  },
  {
    id: "admin-branding-note",
    path: BRANDING,
    anchor: "admin-branding-note",
    title: "One look, set once",
    body: "Your own card's colors, fonts, and layout are the template — change your card and every teammate's card updates with it automatically.",
    placement: "bottom",
  },
  {
    id: "admin-branding-form",
    path: BRANDING,
    anchor: "admin-branding-form",
    title: "Company-wide details",
    body: "Your logo, company name, website, and office contact info — these live on the office itself and appear on every card on your team.",
    placement: "top",
  },
  {
    id: "admin-finish",
    path: BRANDING,
    title: "You're all set",
    body: "That's Team, Analytics, Leads, and Branding. Replay this anytime from the Tour button on the Team page.",
  },
];
