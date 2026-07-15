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
  {
    file: "src/components/LeadCard.tsx",
    web: ["Could not generate messages. Make sure an AI key (OpenAI or Gemini) is set."],
    native: [
      "Pro feature — You've used your 3 free AI drafts this month. Unlimited AI follow-ups are only available on the Pro plan.",
      "Pro feature — Automated follow-up sequences are only available on the Pro plan.",
    ],
  },
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

describe("Area 3 — AI-drafts cap bug fix in LeadCard", () => {
  const src = read("src/components/LeadCard.tsx");

  it("fetchAI branches on the server's upgrade error instead of blindly reading messages", () => {
    expect(src).toMatch(/data\.error === "upgrade"/);
    expect(src).toMatch(/setAiUpgradeMsg/);
  });

  it("the empty state surfaces the real cap message (not the generic AI-key text) when capped", () => {
    // When aiUpgradeMsg is set, the gated message renders; otherwise the old
    // generic empty state is preserved unchanged.
    expect(src).toMatch(/aiUpgradeMsg !== null \? \(/);
    expect(src).toContain("Could not generate messages. Make sure an AI key (OpenAI or Gemini) is set.");
  });
});
