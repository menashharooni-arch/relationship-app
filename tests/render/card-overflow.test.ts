import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "playwright";
import { launchBrowser, measureCard, type Measurement } from "./harness";

import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import LogoFirst from "@/components/card-templates/LogoFirst";
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
  ["logo-first", LogoFirst],
];

// The widths a card is actually LAID OUT at.
//
// This was previously wrong, and the correction matters more than the numbers.
// The old comment reasoned from the page's visible box — `max-w-sm` inside a
// `px-4` main — and concluded the card is `viewport - 32`, capped at 384. That is
// the width of the CONTAINER. Every renderer wraps the template in CardScaler
// (src/components/CardScaler.tsx), which lays the card out at a fixed 460px and
// then applies `transform: scale(min(1, w / 460))`. The transform is visual only:
// layout width is ALWAYS 460, whatever the phone. CardPreviewDownload,
// EmailSignatureBox and ShareCardCapture each hard-code the same 460.
//
// So 343 and 384 were measuring a layout that never happens. They passed, which
// is why the error survived — a stricter-than-reality width is quietly harmless.
//
// 390 is the one genuine exception: HeroPhone renders PhotoFirst at 390 with its
// own scale(0.69), so that layout width is real and worth holding.
const WIDTHS = [460, 390];

// A 288px case used to live here, skipped, described as a known gap where "type
// does not scale with card width". Deleted rather than fixed: it followed from
// the same mistake. No renderer lays a card out at 288 — CardScaler caps layout
// at 460 and only scales the pixels — so it was asserting against a layout the
// product never produces, and "fixing" it would have meant redesigning card
// typography to satisfy a test rather than a user.
//
// Do not restore it as missing coverage. If a narrow-screen card ever does look
// wrong, the thing to check is the CONTAINER around CardScaler, not the card.
// Measured at 460 with the LONG fixture, all five templates are clean; the 20px
// modern-bold reports horizontally is its decorative corner glow bleeding on
// purpose and being clipped, which is why only overflowY and offenders are
// asserted below.

/**
 * Card-level slack, in px.
 *
 * Element-level offenders are still asserted exactly (harness TOL = 1px) — this
 * only forgives sub-pixel accumulation in the card's own scrollHeight when NO
 * element actually escapes. Without the distinction we'd either chase phantom
 * failures or, worse, raise the element tolerance and stop seeing real clipping.
 *
 * It earned its keep at 343px, where the fractional scale produced ~2px of drift
 * in photo-first. At the real layout widths (460, 390) nothing needs it: the
 * suite passes with this set to 0. Left at 2 rather than tightened, because
 * narrowing a tolerance is a behaviour change and this commit is only meant to
 * correct which widths get measured. Tightening it to 0 would make a genuine 2px
 * regression at 460 fail instead of passing quietly — worth doing deliberately.
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
