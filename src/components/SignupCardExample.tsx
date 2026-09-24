"use client";

import CardScaler from "@/components/CardScaler";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import type { CardData } from "@/components/card-templates/types";

// ── The example card on the "create your free card" invite ──────────────────
//
// Owner, 2026-09-23: "make the design example card on that pop-up much nicer
// and more realistic." It was a hand-drawn stand-in — a "YOU" circle, "Your
// Name", grey bars. Now it IS a SwiftCard: the real Portrait Pro template
// (PhotoFirst), rendered by the same code a customer's card uses, with the
// same designed persona the marketing hero shows (components/site/
// HeroShowcase — "Royal Violet" panel with a sheen). A visitor who taps "See
// how yours looks" is looking at exactly what they will get.
//
// Its own module so SignupNudgeHost can load it lazily: a Swift Links page
// never shows the card invite (it shows the Swift Links sheet), so it never
// pays for the template code.

const EXAMPLE: CardData = {
  name: "Maya Castillo",
  title: "Realtor®",
  company: "Harbor & Vine Realty",
  phone: "(415) 555-0132",
  email: "maya@harborvine.com",
  website: "harborvine.com",
  cardUrl: "swiftcard.me/mayacastillo",
  photoUrl: "/showcase/maya.jpg",
  logoUrl: null,
  initials: "MC",
  customization: {
    accentColor: "#6D28D9",
    bgColor: "linear-gradient(145deg, #4f46e5 0%, #7c3aed 60%, #6d28d9 100%)",
    textColor: "#ffffff",
    finish: "sheen",
  },
};

export default function SignupCardExample() {
  // `inert`: the template is a real card, so its phone, email and website are
  // real links. In a picture of a card they must not be tappable, reachable
  // with Tab, or read out — the invite's own button is the only action here.
  return (
    <div inert className="pointer-events-none select-none">
      <CardScaler>
        <PhotoFirst data={EXAMPLE} />
      </CardScaler>
    </div>
  );
}
