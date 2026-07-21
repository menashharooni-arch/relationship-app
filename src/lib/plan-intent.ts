// The plan a guest picks BEFORE creating their account (card → plan → signup).
// Stored in localStorage while they sign up, then read once on the /welcome step
// after their card is claimed: Free → dashboard, Pro/Office → Stripe checkout.

export type PlanIntent = {
  /** Promo CODE (never a Stripe coupon id — see api/stripe/checkout). Carried
   *  through the guest signup detour so an offer shown on /pricing survives
   *  account creation instead of silently evaporating at checkout. */
  promo?: string;
  plan: "free" | "pro" | "office";
  annual?: boolean;
  seats?: number;
};

const KEY = "swiftcard_plan_intent";

export function writePlanIntent(intent: PlanIntent): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    /* storage blocked — /welcome falls back to showing the plan chooser */
  }
}

// Read and clear, so the choice is honored exactly once.
export function consumePlanIntent(): PlanIntent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    return JSON.parse(raw) as PlanIntent;
  } catch {
    return null;
  }
}

// Drop a stashed choice outright — used when the visitor abandons the guest
// card flow (heads Home), so a stale plan pick can't resurface later.
export function clearPlanIntent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — nothing was stashed to begin with */
  }
}

// Read WITHOUT clearing — used by the claim POST, which needs to know the
// picked plan before /welcome does its own one-time consumePlanIntent().
export function peekPlanIntent(): PlanIntent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PlanIntent) : null;
  } catch {
    return null;
  }
}
