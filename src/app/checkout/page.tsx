import { Suspense } from "react";
import CheckoutClient from "./CheckoutClient";

// The single confirmation step between picking a plan and Stripe. It preserves
// the exact selection (plan, interval, seats) in the URL so it survives login,
// signup, OAuth, email verification, refresh, back/forward, and a canceled or
// failed checkout — the user never has to re-choose (spec §1). It shows the
// required pre-payment order summary, then continues to Stripe. A logged-out
// visitor is sent through account creation and auto-resumed here afterward.
export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-5 py-12">
      <Suspense fallback={<div className="text-gray-500 text-sm">Loading…</div>}>
        <CheckoutClient />
      </Suspense>
    </main>
  );
}
