import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── "Your SwiftCard is live" may not go out before the card is ───────────────
//
// Owner, 2026-09-11: "That email should only be sent once they create their
// first card, not when they create the account… it should be like this for
// every plan and account type."
//
// It was sent from onboarding, at signup. The subject says the card is live and
// the body links to it, so it promised something that did not exist yet and
// linked to a URL that 404'd until the builder was finished — and for anyone
// who abandoned the builder, forever.
//
// The rule is now one function, sendWelcomeWhenCardLive: it refuses when the
// account has no card, and the email_logs claim keeps it to one per account no
// matter how many creation paths reach it.

type Row = Record<string, unknown>;

let cardCount = 0;
let cards: Row[] = [];
let profile: Row | null = { name: "Dana Ellis", username: "dana-legacy" };
let alreadySent: Row | null = null;
const inserted: Row[] = [];
const sentEmails: Row[] = [];
let authEmail: string | null = "signup@example.com";

vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabase: () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: authEmail ? { email: authEmail } : null } }) } },
    from: (table: string) => {
      if (table === "cards") {
        const q = {
          select: (_c?: string, opts?: { head?: boolean }) =>
            opts?.head
              ? { eq: async () => ({ count: cardCount }) }
              : {
                  eq: () => ({
                    order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: cards[0] ?? null }) }) }),
                  }),
                },
        };
        return q;
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) };
      }
      if (table === "email_logs") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: alreadySent }) }) }) }),
          insert: async (row: Row) => { inserted.push(row); return { error: null }; },
          update: () => ({ eq: () => ({ eq: async () => ({}) }) }),
          delete: () => ({ eq: () => ({ eq: async () => ({}) }) }),
        };
      }
      if (table === "email_preferences") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { unsubscribe_token: "tok" } }) }) }) };
      }
      throw new Error("unexpected table " + table);
    },
  }),
}));

vi.mock("@/lib/email-prefs", () => ({ ensureEmailPreferences: async () => {} }));

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (msg: Row) => { sentEmails.push(msg); return { data: { id: "re_1" }, error: null }; },
    };
  },
}));

import { sendWelcomeWhenCardLive } from "@/lib/welcome-email";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

beforeEach(() => {
  cardCount = 0;
  cards = [];
  profile = { name: "Dana Ellis", username: "dana-legacy" };
  alreadySent = null;
  authEmail = "signup@example.com";
  inserted.length = 0;
  sentEmails.length = 0;
});

describe("an account with no card", () => {
  it("is not welcomed, and nothing is written", async () => {
    expect(await sendWelcomeWhenCardLive("u1", "signup@example.com")).toBe("skipped");
    expect(sentEmails).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it("stays un-welcomed however many times the path is reached", async () => {
    for (let i = 0; i < 3; i++) expect(await sendWelcomeWhenCardLive("u1")).toBe("skipped");
    expect(sentEmails).toHaveLength(0);
  });
});

describe("the moment the first card exists", () => {
  beforeEach(() => {
    cardCount = 1;
    cards = [{ username: "dana-ellis-northbeam", name: "Dana Ellis" }];
  });

  it("sends, once", async () => {
    expect(await sendWelcomeWhenCardLive("u1", "signup@example.com")).toBe("sent");
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].subject).toMatch(/Your SwiftCard is live/);
  });

  it("greets with the name on the CARD, not the empty profile name", async () => {
    // profiles.name is blank for every account created through normal signup —
    // the name is typed into the card builder. Greeting from the profile made
    // this read "Your SwiftCard is live, there!" for exactly its recipients.
    profile = { name: "", username: "dana-legacy" };
    cards = [{ username: "dana-ellis-northbeam", name: "Dana Ellis" }];
    await sendWelcomeWhenCardLive("u1", "signup@example.com");
    expect(sentEmails[0].subject).toBe("Your SwiftCard is live, Dana!");
  });

  it("still falls back to the profile name, then to a neutral greeting", async () => {
    profile = { name: "Priya Nair", username: "p" };
    cards = [{ username: "p-card", name: "" }];
    await sendWelcomeWhenCardLive("u1", "signup@example.com");
    expect(sentEmails[0].subject).toBe("Your SwiftCard is live, Priya!");

    sentEmails.length = 0;
    alreadySent = null;
    profile = { name: "", username: "p" };
    cards = [{ username: "p-card", name: "" }];
    await sendWelcomeWhenCardLive("u1", "signup@example.com");
    expect(sentEmails[0].subject).toBe("Your SwiftCard is live, there!");
  });

  it("links to the CARD's slug, not the legacy profile handle", async () => {
    await sendWelcomeWhenCardLive("u1", "signup@example.com");
    const html = String((sentEmails[0] as { html?: string }).html ?? "");
    expect(html).toContain("dana-ellis-northbeam");
    expect(html).not.toContain("dana-legacy");
  });

  it("goes to the ACCOUNT email, never to whatever the card shows publicly", async () => {
    // profiles.email drifts to the card's public contact address the moment one
    // is set (lib/account-email.ts) — owner mail must not follow it.
    authEmail = "login@example.com";
    await sendWelcomeWhenCardLive("u1", "something-else@example.com");
    expect(sentEmails[0].to).toBe("login@example.com");
  });

  it("falls back to the caller's address if auth cannot be read", async () => {
    authEmail = null;
    await sendWelcomeWhenCardLive("u1", "fallback@example.com");
    expect(sentEmails[0].to).toBe("fallback@example.com");
  });

  it("does not send a second time for the same account", async () => {
    alreadySent = { id: "log-1" };
    expect(await sendWelcomeWhenCardLive("u1", "signup@example.com")).toBe("already_sent");
    expect(sentEmails).toHaveLength(0);
  });

  it("never throws, whatever goes wrong", async () => {
    profile = null;
    await expect(sendWelcomeWhenCardLive("u1", "signup@example.com")).resolves.toBe("skipped");
  });
});

describe("every path that can create a card sends it, and signup does not", () => {
  it("signup no longer sends anything", () => {
    // Comments stripped: the file explains, at the old call site, why it moved.
    const onboarding = read("src/app/onboarding/page.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(onboarding).not.toMatch(/sendWelcomeEmail|sendWelcomeWhenCardLive/);
  });

  for (const [label, file] of [
    ["the card builder / Add card", "src/app/api/cards/route.ts"],
    ["a claimed guest draft", "src/app/api/drafts/claim/route.ts"],
    ["the legacy profile→card migration", "src/lib/ensure-cards.ts"],
    ["the manual resend endpoint", "src/app/api/welcome/route.ts"],
  ] as const) {
    it(`${label} goes through the card-gated sender`, () => {
      expect(read(file)).toMatch(/sendWelcomeWhenCardLive\(/);
    });
  }

  it("nothing anywhere calls the ungated sender", () => {
    // One rule, one entry point: no back door can promise a card that is not
    // there. (The gated function is the only caller of the inner one.)
    const callers = ["src/app/api/cards/route.ts", "src/app/api/drafts/claim/route.ts",
      "src/lib/ensure-cards.ts", "src/app/api/welcome/route.ts", "src/app/onboarding/page.tsx"];
    for (const f of callers) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code, `${f} calls the ungated sendWelcomeEmail`).not.toMatch(/sendWelcomeEmail\b/);
    }
  });

  it("card creation is never blocked by the email", () => {
    // after() on the request paths, and a swallowed failure everywhere.
    for (const f of ["src/app/api/cards/route.ts", "src/app/api/drafts/claim/route.ts"]) {
      expect(read(f)).toMatch(/after\(\(\) => sendWelcomeWhenCardLive\(/);
    }
    expect(read("src/lib/welcome-email.ts")).toMatch(/\} catch \{[\s\S]{0,120}return "failed";/);
  });
});
