import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCardData } from "@/lib/card-data";

// NOTHING FROM ONE CARD MAY APPEAR ON ANOTHER.
//
// This suite exists because it already happened: a second card showed the first
// card's headshot, and the Swift Signature showed fields the card did not. Both
// had the same shape — something reached for an ACCOUNT-level value, or a second
// copy of the card-building code drifted from the first.
//
// So rather than checking known cases, this builds two cards whose every field
// is a distinct sentinel and asserts that NONE of card B's values can be found
// anywhere in what card A renders. A future bleed of a field nobody has thought
// of yet fails here without anyone having to predict it.

/** Every field a card owns, filled with values unique to that card. */
function card(tag: string) {
  return {
    name: `NAME_${tag}`,
    title: `TITLE_${tag}`,
    company: `COMPANY_${tag}`,
    phone: `PHONE_${tag}`,
    email: `EMAIL_${tag}@x.com`,
    website: `WEBSITE_${tag}.com`,
    instagram: `IG_${tag}`,
    twitter: `TW_${tag}`,
    tiktok: `TT_${tag}`,
    linkedin: `LI_${tag}`,
    username: `USERNAME_${tag}`,
    logo_url: `https://cdn/LOGO_${tag}.png`,
    template: "logo-first",
    customization: {
      snapchat: `SNAP_${tag}`,
      fax: `FAX_${tag}`,
      bio: `BIO_${tag}`,
      photoUrl: `https://cdn/PHOTO_${tag}.jpg`,
      address: {
        street: `STREET_${tag}`, unit: `UNIT_${tag}`, city: `CITY_${tag}`,
        state: `STATE_${tag}`, zip: `ZIP_${tag}`,
      },
      links: [{ emoji: "🔗", label: `LINK_${tag}`, url: `https://LINKURL_${tag}.com` }],
      testimonials: [{ name: `TESTI_${tag}`, text: `QUOTE_${tag}` }],
      phones: [{ number: `PHONE2_${tag}`, label: "office" as const, showOnCard: true }],
    },
  };
}

/** Every sentinel a card contributed, so we can look for them in the other. */
function sentinels(tag: string): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string" && v.includes(tag)) out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(card(tag));
  return out;
}

const OPTS = { appUrl: "https://swiftcard.me", isPro: true, accountPhotoUrl: null };
const A = card("AAA");
const B = card("BBB");

describe("no card can see another card's information", () => {
  for (const isPro of [true, false]) {
    it(`built card A contains nothing of card B (${isPro ? "Pro" : "Free"})`, () => {
      const rendered = JSON.stringify(buildCardData(A, { ...OPTS, isPro }));
      for (const s of sentinels("BBB")) {
        expect(rendered, `card B's ${s} leaked into card A`).not.toContain(s);
      }
    });

    it(`built card B contains nothing of card A (${isPro ? "Pro" : "Free"})`, () => {
      const rendered = JSON.stringify(buildCardData(B, { ...OPTS, isPro }));
      for (const s of sentinels("AAA")) {
        expect(rendered, `card A's ${s} leaked into card B`).not.toContain(s);
      }
    });
  }

  it("building one card cannot mutate another's row", () => {
    // A builder that mutated its input would make the SECOND card render the
    // first one's values — a bleed that only appears once two cards are built
    // in the same request, which is exactly what the dashboard does.
    const before = JSON.stringify(A);
    buildCardData(A, OPTS);
    buildCardData(B, OPTS);
    expect(JSON.stringify(A)).toBe(before);
  });

  it("building the same card twice is identical, and order cannot change it", () => {
    const first = JSON.stringify(buildCardData(A, OPTS));
    buildCardData(B, OPTS);
    buildCardData(B, OPTS);
    expect(JSON.stringify(buildCardData(A, OPTS))).toBe(first);
  });

  it("an EMPTY card stays empty — it does not borrow from a populated one", () => {
    // The bleed people actually hit: create a second card, leave fields blank,
    // and find the first card's details on it.
    const blank = { username: "USERNAME_EMPTY", template: "classic-pro", customization: {} };
    const { data } = buildCardData(blank, OPTS);
    const rendered = JSON.stringify(data);
    for (const s of [...sentinels("AAA"), ...sentinels("BBB")]) {
      expect(rendered, `${s} appeared on a blank card`).not.toContain(s);
    }
    expect(data.name).toBe("");
    expect(data.phone).toBe("");
    expect(data.email).toBe("");
  });
});

describe("the account can never supply card content", () => {
  const ACCOUNT = "ACCOUNT_VALUE";

  it("only the headshot may come from the account, and only as a fallback", () => {
    // cardHeadshot is the ONE sanctioned account read. Everything else must be
    // blank on a blank card even when the account has values.
    const blank = { username: "u", template: "classic-pro", customization: {} };
    const { data } = buildCardData(blank, { ...OPTS, accountPhotoUrl: ACCOUNT });
    expect(data.photoUrl).toBe(ACCOUNT);
    const withoutPhoto = { ...data, photoUrl: null };
    expect(JSON.stringify(withoutPhoto)).not.toContain(ACCOUNT);
  });

  it("a card that owns its headshot never falls back", () => {
    const owned = { ...A };
    expect(buildCardData(owned, { ...OPTS, accountPhotoUrl: ACCOUNT }).data.photoUrl)
      .toBe("https://cdn/PHOTO_AAA.jpg");
  });

  it("a card that cleared its headshot shows nothing, not the account's", () => {
    const cleared = { ...A, customization: { ...A.customization, photoUrl: null } };
    expect(buildCardData(cleared, { ...OPTS, accountPhotoUrl: ACCOUNT }).data.photoUrl).toBeNull();
  });
});

describe("every card-rendering surface goes through the one builder", () => {
  // The bleeds all came from a surface building its own card object. A source
  // scan is the only thing that catches the SEVENTH copy being added.
  const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const SURFACES = [
    "src/app/card/[username]/page.tsx",
    "src/app/share/page.tsx",
    "src/app/dashboard/page.tsx",
    "src/app/cards/[id]/edit/page.tsx",
  ];

  for (const f of SURFACES) {
    it(`${f} uses buildCardData`, () => {
      expect(src(f)).toMatch(/buildCardData\(/);
    });
    it(`${f} hand-rolls no card object`, () => {
      expect(src(f), "a hand-written CardData is back — it will drift").not.toMatch(/^\s*initials:/m);
    });
  }

  it("public surfaces can only read plan + the headshot from the owner's profile", () => {
    // The strongest form of this guarantee is STRUCTURAL: when a card row
    // exists, the profiles query is narrowed to three columns, so the owner's
    // account physically cannot supply a name, company, phone or address to
    // someone else's card. A widened select is the first step of every bleed
    // this codebase has had, so the column list is the thing under test.
    const ALLOWED = new Set(["photo_url", "customization", "plan"]);
    for (const f of [
      "src/lib/resolve-card.ts",
      "src/app/links/[username]/page.tsx",
      "src/app/card/[username]/page.tsx",
    ]) {
      const code = src(f);
      // Every `from("profiles").select("...")` that runs alongside a card row.
      const selects = [...code.matchAll(/from\("profiles"\)\s*\.select\("([^"]+)"\)/g)];
      expect(selects.length, `${f} stopped querying profiles — check this test`).toBeGreaterThan(0);
      for (const [, cols] of selects) {
        if (cols.trim() === "*") continue; // the LEGACY no-card-row path only
        for (const col of cols.split(",").map((c) => c.trim())) {
          expect(ALLOWED, `${f} selects "${col}" from profiles — card content must come from the CARD`)
            .toContain(col);
        }
      }
    }
  });

  it("the OG/meta resolver reads the CARD row, not the owner's profile", () => {
    // resolveCardMeta joins to profiles for the plan and the headshot fallback.
    // Every CONTENT field must come from `src`, which is the card row.
    const lib = src("src/lib/resolve-card.ts");
    const body = lib.slice(lib.indexOf("return {"), lib.lastIndexOf("}"));
    for (const field of ["name", "title", "company", "phone", "email", "website"]) {
      expect(body, `${field} is not read from the card row`).toMatch(
        new RegExp(`${field}:\\s*str\\(src\\.`),
      );
    }
    // The one sanctioned account read, and it goes through the shared helper.
    expect(body).toMatch(/photoUrl:\s*cardRow \? cardHeadshot\(/);
  });
});
