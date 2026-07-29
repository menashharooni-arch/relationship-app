import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Area 3 wiring regression guards. Two jobs:
//   1. WEB UNCHANGED — the exact web copy still lives at each wired call site.
//   2. NATIVE EXACT — the precise PlanGate native copy string is present,
//      character-for-character (including the em dash "—").
// Both are asserted against the real source so a future refactor can't silently
// change either platform's copy.

type Site = {
  file: string;
  web: string[]; // web strings that must survive verbatim
  native: string[]; // exact native PlanGate copy strings that must be present
};

const SITES: Site[] = [
  {
    file: "src/components/CustomDesignCard.tsx",
    web: ["Make it unmistakably yours — unlock the custom designer with Pro →"],
    native: ["Pro feature — The custom card designer is only available on the Pro plan."],
  },
  {
    file: "src/components/ZapierSettings.tsx",
    web: ["Upgrade · Pro", "Upgrade to Pro to connect Zapier and automate your lead workflow."],
    native: ["Pro feature — Zapier, Google Contacts, and HubSpot are only available on the Pro plan."],
  },
  {
    file: "src/components/CrmEventSettings.tsx",
    web: [">Pro</a>"],
    native: ["Pro feature — Zapier, Google Contacts, and HubSpot are only available on the Pro plan."],
  },
  {
    file: "src/components/IntegrationsSettings.tsx",
    web: ["Upgrade · Pro"],
    native: ["Pro feature — Zapier, Google Contacts, and HubSpot are only available on the Pro plan."],
  },
  // LeadCard's entry was removed with the component (no importers left —
  // ContactsClient replaced it). Its AI-drafts cap copy was a hardcoded
  // duplicate that even said "3" where the server interpolates
  // PLAN_LIMITS.FREE_AI_DRAFTS_PER_MONTH, so it would have gone stale the
  // moment that limit changed. The authoritative copy lives in
  // api/ai/suggest-messages and is covered by server-error-codes.test.ts.
  {
    file: "src/components/ContactsClient.tsx",
    web: ["Upgrade to Pro →"],
    native: ["Pro feature — Automated follow-up sequences are only available on the Pro plan."],
  },
  {
    file: "src/app/dashboard/page.tsx",
    web: [
      "Ready for a second card? Go unlimited with Pro.",
      "Upgrade to Pro →",
      "LINK OFF — PRO ONLY",
      "This card's public link, QR and Swift Links are off on the Free plan — upgrade to Pro to reactivate them.",
    ],
    native: [
      "Pro feature — Multiple cards are only available on the Pro plan.",
      "Pro feature — You've used your 5 free leads this month. Unlimited leads are only available on the Pro plan.",
      "Pro feature — Detailed analytics are only available on the Pro plan.",
      "Pro feature — Exporting contacts is only available on the Pro plan.",
      "These links are only active on the Pro plan.",
    ],
  },
  {
    file: "src/app/contacts/page.tsx",
    web: ["Export CSV", "more contacts are waiting for you"],
    native: [
      "Pro feature — Exporting contacts is only available on the Pro plan.",
      "new leads are locked this month. Unlimited leads are only available on the Pro plan.",
    ],
  },
  {
    file: "src/app/cards/[id]/edit/CardEditForm.tsx",
    web: ["Unlock custom colors &amp; fonts with Pro →", "Upgrade to Pro"],
    native: [
      "Pro feature — Custom colors and fonts are only available on the Pro plan.",
      "Pro feature — Free includes 2 links. More links are only available on the Pro plan.",
      "This card is view-only. Editing multiple cards is only available on the Pro plan.",
    ],
  },
  {
    file: "src/app/cards/new/NewCardWizard.tsx",
    web: ["Unlock custom colors &amp; fonts with Pro →"],
    native: [
      "Pro feature — Custom colors and fonts are only available on the Pro plan.",
      "Pro feature — Free includes 2 links. More links are only available on the Pro plan.",
      "Pro feature — Multiple cards are only available on the Pro plan.",
    ],
  },
  {
    file: "src/components/ProfileForm.tsx",
    web: ["Make it unmistakably yours — unlock the custom designer with Pro.", "Upgrade to Pro →"],
    native: [
      "Pro feature — Customization is only available on the Pro plan.",
      "Pro feature — Free includes 2 links. More links are only available on the Pro plan.",
    ],
  },
  {
    file: "src/components/AddContactModal.tsx",
    web: ["Upgrade to Pro · keep capturing every lead →"],
    native: [
      "Pro feature — The card scanner is only available on the Pro plan.",
      "Pro feature — You've used your 5 free leads this month. Unlimited leads are only available on the Pro plan.",
    ],
  },
  {
    file: "src/components/NotificationsPanel.tsx",
    web: [],
    native: [
      "Your automated follow-up sequences are paused. Sequences are only available on the Pro plan — nothing was deleted.",
    ],
  },
];

describe("Area 3 — web copy preserved verbatim at every wired call site", () => {
  for (const site of SITES) {
    const src = read(site.file);
    for (const w of site.web) {
      it(`${site.file} still contains web copy: ${JSON.stringify(w).slice(0, 60)}`, () => {
        expect(src).toContain(w);
      });
    }
  }
});

describe("Area 3 — exact native PlanGate copy present (char-for-char incl. em dash)", () => {
  for (const site of SITES) {
    const src = read(site.file);
    for (const n of site.native) {
      it(`${site.file} contains native copy: ${JSON.stringify(n).slice(0, 60)}`, () => {
        expect(src).toContain(n);
        // Guard the real em dash where the string uses one.
        if (n.includes("Pro feature —")) expect(n).toMatch(/—/);
      });
    }
  }
});

describe("Area 3 — every wired file routes through <PlanGate>", () => {
  for (const site of SITES) {
    const src = read(site.file);
    it(`${site.file} imports and uses PlanGate/PlanNotice/PlanBadge`, () => {
      expect(src).toMatch(/from "@\/components\/PlanGate"|from "@\/lib\/platform"/);
      expect(src).toMatch(/PlanGate|PlanNotice|PlanBadge|useIsNativeApp|isNativeApp|NATIVE_BODY_REMAP/);
    });
  }
});

// Moved here from LeadCard when that component was deleted. The bug being
// pinned is real and still reachable: hitting the free AI-drafts cap must not
// look like "the AI is broken". The server answers the cap with 402 +
// {error:"upgrade", message}, and the UI has to branch on that instead of
// blindly reading data.sequence — otherwise the user sees the generic
// "couldn't generate" text and thinks the feature is failing, not capped.
describe("Area 3 — AI-drafts cap is surfaced as an upgrade, not a failure", () => {
  const src = read("src/components/ContactsClient.tsx");

  it("branches on the server's cap response instead of blindly reading the sequence", () => {
    // Checks the STATUS too, not just the error string: a 402 whose body failed
    // to parse would otherwise fall through and be reported as a hard failure.
    expect(src).toMatch(/res\.status === 402 \|\| data\.error === "upgrade"/);
  });

  it("shows the server's own cap message rather than hardcoding the number", () => {
    // data.message carries the interpolated limit from PLAN_LIMITS, so changing
    // the free cap can never leave a stale "3 free AI drafts" in the UI — the
    // exact trap the deleted LeadCard copy had fallen into.
    expect(src).toMatch(/setAiUpgrade\(data\.message/);
  });

  it("still distinguishes a genuine generation failure from the cap", () => {
    expect(src).toContain("Couldn't write the messages just now");
  });
});
