import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Area 4 — server messages → machine codes. Purely ADDITIVE: every endpoint
// keeps its existing message/error/upgrade fields byte-for-byte (so web sees an
// identical response) and gains one new `code` field the native app can key on.
//
// These are source-contract assertions: each endpoint's exact human `message`
// must still be present verbatim, AND the expected `code` must appear in the
// same file. (Template-literal messages are asserted via their exact static
// fragments — the only parts that aren't computed.)

type Contract = {
  file: string;
  code: string;
  // Exact message fragments that must still be present, byte-for-byte.
  messageParts: string[];
};

const CONTRACTS: Contract[] = [
  {
    file: "src/app/api/leads/manual/route.ts",
    code: "LEAD_LIMIT_REACHED",
    messageParts: ["free leads this month. Upgrade to Pro to add unlimited contacts."],
  },
  {
    file: "src/app/api/cards/route.ts",
    code: "CARD_LIMIT_REACHED",
    messageParts: ["Ready for a second card? Go unlimited with Pro."],
  },
  {
    file: "src/app/api/cards/[id]/route.ts",
    code: "CARD_VIEW_ONLY",
    messageParts: ["This card is view-only on Free. Upgrade to Pro to edit all your cards."],
  },
  {
    file: "src/app/api/leads/export/route.ts",
    code: "EXPORT_PRO_ONLY",
    messageParts: ["CSV export is a Pro feature. Upgrade to export your contacts."],
  },
  {
    file: "src/app/api/leads/[id]/generate-sequence/route.ts",
    code: "SEQUENCES_PRO_ONLY",
    messageParts: ["Automated follow-up sequences are a Pro feature. Upgrade to unlock them."],
  },
  {
    file: "src/app/api/ai/suggest-messages/route.ts",
    code: "AI_DRAFTS_LIMIT_REACHED",
    messageParts: ["free AI drafts this month. Upgrade to Pro for unlimited AI follow-ups and automated sequences."],
  },
  {
    file: "src/app/api/scanner/route.ts",
    code: "SCANNER_PRO_ONLY",
    messageParts: ["Scanning business cards is a Pro feature. Upgrade to scan unlimited cards."],
  },
  {
    file: "src/app/api/settings/zapier/route.ts",
    code: "INTEGRATION_PRO_ONLY",
    messageParts: ["Zapier is a Pro feature."],
  },
  {
    file: "src/app/api/settings/crm/route.ts",
    code: "INTEGRATION_PRO_ONLY",
    messageParts: ["Forwarding events to your CRM is a Pro feature."],
  },
  {
    file: "src/app/api/integrations/hubspot/token/route.ts",
    code: "INTEGRATION_PRO_ONLY",
    messageParts: ["HubSpot is a Pro feature."],
  },
];

describe("Area 4 — additive error codes (message unchanged, code added)", () => {
  for (const c of CONTRACTS) {
    const src = read(c.file);

    it(`${c.file} keeps its exact message copy (web unaffected)`, () => {
      for (const part of c.messageParts) expect(src).toContain(part);
      // The original discriminator fields are all still present.
      expect(src).toMatch(/error:\s*"(limit|upgrade|view_only)"/);
      expect(src).toContain('upgrade: "/pricing"');
    });

    it(`${c.file} adds code: "${c.code}"`, () => {
      expect(src).toContain(`code: "${c.code}"`);
    });
  }
});

describe("Area 4 — code sits alongside message in the same response object", () => {
  it("every gated response object that has the code also still has a message", () => {
    for (const c of CONTRACTS) {
      const src = read(c.file);
      const idx = src.indexOf(`code: "${c.code}"`);
      expect(idx).toBeGreaterThan(-1);
      // Within a small window after the code, the message field is still present.
      const window = src.slice(idx, idx + 400);
      expect(window).toMatch(/message:/);
    }
  });
});
