import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ── The things that make the app feel like a website in a wrapper ────────────
//
// None of these are errors. They are structural properties whose absence just
// makes every tap feel slow, which is the hardest class of bug to notice in
// review and the easiest for a future change to undo.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("navigating between tabs does not refetch from scratch", () => {
  it("configures a client router cache", () => {
    // Next 15+ defaults staleTimes.dynamic to 0, and every portal page is
    // dynamic (they all read the session). Without this, Home → Contacts → Home
    // re-renders the dashboard on the server BOTH ways, full skeleton each
    // time, so tab switching can never feel instant.
    const cfg = read("next.config.ts");
    expect(cfg).toMatch(/staleTimes/);
    expect(cfg).toMatch(/dynamic:\s*[1-9]\d*/);
  });
});

describe("every heavy portal route shows something the instant it is tapped", () => {
  // In the App Router a route with no loading.tsx has NO Suspense boundary, so
  // router.push BLOCKS on the server until the whole RSC payload is ready — the
  // previous screen stays up, looking interactive, for as long as the queries
  // take. It also means Next will not prefetch the route at all.
  //
  // These are the routes reached by a tap from inside the app whose pages run
  // real queries. Marketing pages and pure redirects are deliberately not here.
  const NEEDS_BOUNDARY = [
    "src/app/dashboard",
    "src/app/contacts",
    "src/app/share",
    "src/app/grow",
    "src/app/settings/flows",
    "src/app/cards/new",
    "src/app/cards/[id]/edit",
    "src/app/office/admin",
  ];

  for (const dir of NEEDS_BOUNDARY) {
    it(`${dir.replace("src/app", "")} has a loading boundary`, () => {
      expect(existsSync(join(root, dir, "loading.tsx")), `missing ${dir}/loading.tsx`).toBe(true);
    });
  }

  it("the card wizard and editor use the form-shaped skeleton", () => {
    // A skeleton of the WRONG shape trades a frozen screen for a reflow: the
    // ghost boxes rearrange into something else when real content lands.
    for (const d of ["src/app/cards/new", "src/app/cards/[id]/edit"]) {
      expect(read(join(d, "loading.tsx"))).toMatch(/variant="form"/);
    }
  });

  it("PortalSkeleton actually implements that variant", () => {
    const src = read("src/components/PortalSkeleton.tsx");
    expect(src).toMatch(/variant\?:\s*"cards"\s*\|\s*"form"/);
    // The form shell is narrower than the card grid, matching the real pages.
    expect(src).toMatch(/variant === "form" \? "max-w-4xl" : "max-w-5xl"/);
  });
});

describe("Contacts does not load itself twice", () => {
  it("resolves the active card on the SERVER", () => {
    // The page used to render with no card selected, then ContactsClient's
    // mount effect read the same value from localStorage and router.replace'd
    // to add ?card= — a second full navigation on every tap of the Contacts
    // tab. The user saw skeleton → contacts → skeleton → contacts.
    const src = read("src/app/contacts/page.tsx");
    expect(src).toMatch(/ACTIVE_CARD_COOKIE/);
    expect(src).toMatch(/cardParam \?\?/);
  });

  it("validates that cookie against the user's own cards", () => {
    // The cookie outlives the card it names. Filtering by a deleted card would
    // render an empty Contacts page, which reads as lost data — the client
    // effect guarded this, so moving the work to the server must carry it.
    const src = read("src/app/contacts/page.tsx");
    expect(src).toMatch(/cardList\.some\(\(c\) => c\.username === cookieCard\)/);
  });

  it("still lets an explicit ?card= win", () => {
    // A URL param is a deliberate act (a shared link, the dashboard's own
    // card-scoped links) and must not be overridden by the remembered card.
    const src = read("src/app/contacts/page.tsx");
    const i = src.indexOf("const selectedCardParam =");
    expect(i, "assignment not found").toBeGreaterThan(-1);
    // The statement wraps across lines; read to its terminator, not to EOL.
    const stmt = src.slice(i, src.indexOf(";", i));
    expect(stmt).toMatch(/cardParam \?\?/);
    expect(stmt.indexOf("cardParam"), "cardParam must be the first operand").toBeLessThan(
      stmt.indexOf("cookieCard"),
    );
  });
});

describe("the dashboard does not jump when the card renders", () => {
  it("reserves the card's space before its chunk loads", () => {
    // The card templates are dynamic(ssr:false), so the box had no content and
    // collapsed to 0 — everything below sat high and then dropped ~250-300px
    // when the card appeared, after the skeleton had already handed off.
    const src = read("src/components/CardPreviewDownload.tsx");
    expect(src).toMatch(/aspectRatio: height \? undefined : "1\.75"/);
  });

  it("uses the same aspect the measurement falls back to", () => {
    // If these two ever disagree, the reserved box is the wrong size and the
    // jump comes back — smaller, and harder to spot.
    const src = read("src/components/CardPreviewDownload.tsx");
    expect(src).toMatch(/NATURAL \/ 1\.75/);
  });
});

describe("no portal route regresses to a bare skeleton-less page", () => {
  it("every loading.tsx renders a real skeleton, not null", () => {
    // A loading.tsx that returns null unlocks prefetch but shows a blank
    // screen, which is worse than the frozen previous page it replaced.
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(dir, e.name), out);
        else if (e.name === "loading.tsx") out.push(join(dir, e.name));
      }
      return out;
    };
    const files = walk("src/app");
    expect(files.length).toBeGreaterThan(7);
    for (const f of files) {
      const src = read(f);
      expect(src, `${f} renders nothing`).not.toMatch(/return\s+null\s*;/);
    }
  });
});
