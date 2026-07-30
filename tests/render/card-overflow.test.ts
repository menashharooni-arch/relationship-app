import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "playwright";
import { launchBrowser, measureCard, type Measurement } from "./harness";

import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import type { CardData } from "@/components/card-templates/types";

// Nothing on a card should ever be cut off. The card root sets aspectRatio and
// overflow-hidden, so content that doesn't fit is CLIPPED SILENTLY — no error, no
// warning, and it looks fine to whoever typed short values. These tests are the
// only thing in the repo that can see it.
//
// CustomCard is excluded on purpose: the user positions its elements by hand, so
// "outside the card" is their choice to make, not a defect for us to assert on.

const TEMPLATES: Array<[string, React.ComponentType<{ data: CardData }>]> = [
  ["classic-pro", ClassicPro],
  ["modern-bold", ModernBold],
  ["photo-first", PhotoFirst],
  ["local-business", LocalBusiness],
  ["luxury-minimal", LuxuryMinimal],
];

// The widths a card is ACTUALLY rendered at, derived from the pages rather than
// guessed: /card/[username] wraps the card in `max-w-sm` (384px) inside a `px-4`
// main (32px of padding), so the card is `viewport - 32`, capped at 384.
//
//   320px viewport (iPhone SE 1st gen) -> 288  <- the worst case on a phone
//   375px viewport (iPhone SE 2/3, 8)  -> 343  <- the most common small phone
//   >=416px viewport                   -> 384  <- the cap for that page
//
// Testing 480 would be comfortable and meaningless: no card is ever that wide.
//
// 190px is not a phone at all — it is the template PICKER in ProfileForm, a
// two-column grid of live cards that a phone squeezes to about that. Nothing
// wraps it in CardScaler, so it is the narrowest real render in the app and the
// one that proves cards fit their own box rather than a width we chose for them.
const WIDTHS = [190, 288, 343, 384];

/**
 * Card-level slack, in px.
 *
 * Element-level offenders are still asserted exactly (harness TOL = 1px) — this
 * only forgives sub-pixel accumulation in the card's own scrollHeight when NO
 * element actually escapes. photo-first reports 2px this way at 343px with an
 * empty offender list. Without the distinction we'd either chase phantom
 * failures or, worse, raise the element tolerance and stop seeing real clipping.
 */
const CARD_SLACK = 2;

const BASE: CardData = {
  name: "Alex Morgan",
  title: "Realtor",
  company: "Coastline Realty",
  phone: "(415) 555-0188",
  email: "alex@coastlinerealty.com",
  website: "coastlinehomes.com",
  initials: "AM",
  photoUrl: null,
  logoUrl: null,
  cardUrl: "swiftcard.me/card/alexmorgan",
};

// Long but entirely plausible — every one of these is something a real estate
// agent or consultant would type into the form. Not adversarial garbage: no
// 500-character strings, no emoji bombs. If we can't render a real job title we
// have a bug, not an edge case.
const LONG: CardData = {
  ...BASE,
  name: "Bartholomew Fitzgerald-Montgomery",
  title: "Senior Vice President of Business Development & Strategic Partnerships",
  company: "Northwind Commercial Real Estate Advisors International",
  phone: "+1 (512) 555-0147 ext. 8891",
  email: "bartholomew.fitzgerald-montgomery@northwind-commercial-advisors.com",
  website: "northwind-commercial-real-estate-advisors.com",
};

function describeFailure(name: string, width: number, m: Measurement): string {
  const lines = [
    `${name} @ ${width}px — card ${m.cardWidth}x${m.cardHeight}, content overflows by ${m.overflowY}px vertically / ${m.overflowX}px horizontally`,
  ];
  for (const o of m.offenders) {
    const how = [
      o.overBottom ? `${o.overBottom}px below the card` : "",
      o.overRight ? `${o.overRight}px past the right edge` : "",
      o.selfClipX ? `${o.selfClipX}px clipped inside itself` : "",
    ].filter(Boolean).join(", ");
    lines.push(`   "${o.text}" -> ${how}`);
  }
  return lines.join("\n");
}

describe("card templates never clip their content", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 120_000);
  afterAll(async () => { await browser?.close(); });

  for (const [name, Template] of TEMPLATES) {
    for (const width of WIDTHS) {
      it(`${name} fits ordinary details at ${width}px`, async () => {
        // Sanity floor. If this ever fails the template is broken for everyone,
        // and it also proves the harness itself measures a passing case as passing.
        const m = await measureCard(browser, Template, BASE, width);
        expect(m.offenders, describeFailure(name, width, m)).toEqual([]);
        expect(m.overflowY, describeFailure(name, width, m)).toBeLessThanOrEqual(CARD_SLACK);
      }, 60_000);

      it(`${name} fits a long name, title and company at ${width}px`, async () => {
        const m = await measureCard(browser, Template, LONG, width);
        expect(m.offenders, describeFailure(name, width, m)).toEqual([]);
        expect(m.overflowY, describeFailure(name, width, m)).toBeLessThanOrEqual(CARD_SLACK);
      }, 60_000);
    }
  }
});
