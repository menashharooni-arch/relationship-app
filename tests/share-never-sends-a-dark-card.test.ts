import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Never hand someone a link to a card that is switched off ─────────────────
//
// REPORTED 2026-09-08: "I pressed Share, then Share by Text. It opened the
// contact's thread with the message prefilled. When I pressed Send, the preview
// is missing my headshot and my logo."
//
// Diagnosed against production. Nothing is wrong with the preview pipeline.
// The card being shared — @menashharooni-malvecapital — has is_offline = true,
// so:
//
//   • https://swiftcard.me/menashharooni-malvecapital  →  404,
//     "Couldn't find that card"
//   • its page therefore serves the GENERIC SwiftCard metadata (og:title
//     "SwiftCard: The digital business card…", og:url https://swiftcard.me)
//   • and /…/opengraph-image falls through to the brand fallback: the blue "S"
//     on navy, with no name, no title, no company, no headshot, no logo.
//
// That is exactly the reported picture, and it is the kill-switch working as
// designed (an offline card must go dark everywhere, previews included).
//
// The DEFECT is upstream: the contact's Share menu offered every option on a
// dead card and pre-filled a text with its link, with nothing anywhere saying
// the card was off. The contact was captured on that card back when it was
// live, and ShareMyInfoButton is handed `cardOwner={selected.card_owner}` — the
// card the contact belongs to — with no idea whether it is still live.
//
// So: carry the card's live/dark state to the Share menu and refuse to send a
// link to a dark one, telling the owner how to bring it back.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("a share can never hand out a link to a dark card", () => {
  it("the contacts page reads each card's live/dark state", () => {
    const src = code(read("src/app/contacts/page.tsx"));
    const query = src.match(/admin\s*\.from\("cards"\)\s*\.select\(([^)]*)\)/)?.[1] ?? "";
    expect(
      /is_offline/.test(query),
      "contacts/page.tsx must select is_offline — without it the Share menu " +
        "cannot know the card it is about to send is switched off.",
    ).toBe(true);
  });

  it("the state reaches the Share menu", () => {
    const src = code(read("src/app/contacts/page.tsx"));
    expect(
      /offline:\s*c\.is_offline/.test(src),
      "The per-card signer handed to ShareMyInfoButton must carry `offline`.",
    ).toBe(true);
  });

  it("ShareMyInfoButton refuses every send path when the card is dark", () => {
    const src = code(read("src/components/ShareMyInfoButton.tsx"));
    expect(/offline/i.test(src), "ShareMyInfoButton must know about the offline state").toBe(true);
    // Each of the four ways out has to be blocked, not just the menu label.
    for (const fn of ["function openText()", "function openEmail()", "async function sharePhone()"]) {
      const body = src.slice(src.indexOf(fn), src.indexOf(fn) + 420);
      expect(
        /isDark|offline/i.test(body),
        `${fn} must bail out when the card is offline — otherwise the link still goes.`,
      ).toBe(true);
    }
  });

  it("the owner is told what happened and how to undo it", () => {
    const src = read("src/components/ShareMyInfoButton.tsx");
    expect(
      /turned off|switched off|is off/i.test(src),
      "Say the card is off in plain words.",
    ).toBe(true);
    expect(
      /Bring online|bring it back online|My Cards|Settings/i.test(src),
      "Point at the control that fixes it — ManageCards' \"Bring online\".",
    ).toBe(true);
  });

  it("the copy button is blocked too — a copied dead link is the same failure", () => {
    const src = code(read("src/components/ShareMyInfoButton.tsx"));
    const copy = src.match(/function copy[A-Za-z]*\(\)[\s\S]{0,400}/)?.[0] ?? "";
    if (!copy) return;
    expect(/isDark|offline/i.test(copy)).toBe(true);
  });
});
