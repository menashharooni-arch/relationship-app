import { describe, expect, it } from "vitest";
import { transferPrompt, transferChecklist } from "@/lib/design-transfer";
import { normalizeCustomLayout } from "@/lib/custom-layout";
import type { CustomLayout } from "@/components/card-templates/types";

// Design transfer = "rebuild the uploaded design EXACTLY, with my details".
// Two things are load-bearing and easy to lose in an innocent edit:
//
//  1. The prompt must list ONLY the owner's details and must order the removal
//     of everything else — the single worst failure is the template's original
//     owner surviving onto the card.
//  2. faceImage is a URL that lands in an <img src> on the public card, so
//     normalizeCustomLayout must drop anything that isn't ours.

describe("transferPrompt", () => {
  const id = { name: "Menash Harooni", title: "Founder", phone: "(516) 829-0348", email: "m@swiftcard.me" };

  it("lists exactly the owner's details and demands removal of the rest", () => {
    const p = transferPrompt(id);
    expect(p).toContain("Menash Harooni");
    expect(p).toContain("(516) 829-0348");
    // No company given → the word must not appear as a fact line.
    expect(p).not.toMatch(/^- Company:/m);
    // The removal order — the defence against the template owner's details.
    expect(p).toMatch(/REMOVED/);
    // The exactness order — misspelling a phone number is worse than failing.
    expect(p).toMatch(/character for character/i);
  });

  it("numbers reference images by what was actually attached", () => {
    expect(transferPrompt({ ...id, hasHeadshot: true, hasLogo: true })).toMatch(/FIRST extra image.*headshot/s);
    expect(transferPrompt({ ...id, hasHeadshot: true, hasLogo: true })).toMatch(/SECOND extra image.*logo/s);
    // Logo alone is the FIRST extra image, not the second.
    expect(transferPrompt({ ...id, hasLogo: true })).toMatch(/FIRST extra image.*logo/s);
  });

  it("checklist covers the fields that were actually sent", () => {
    const items = transferChecklist(id).join(" | ");
    expect(items).toMatch(/name is spelled/i);
    expect(items).toMatch(/phone/i);
    expect(items).toMatch(/original card/i);
  });
});

describe("normalizeCustomLayout: faceImage is a guarded sink", () => {
  const base: Partial<CustomLayout> = { background: "#fff", textColor: "#111", fontFamily: "sans-serif", elements: [] };
  const ours = `${process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me"}/x/face.png`;

  it("keeps an https URL on our own host", () => {
    expect(normalizeCustomLayout({ ...base, faceImage: ours }).faceImage).toBe(ours);
  });

  it("drops other hosts, http, javascript:, and junk", () => {
    for (const bad of [
      "https://evil.example.com/face.png",
      "http://swiftcard.me/face.png",
      "javascript:alert(1)",
      "//swiftcard.me/x.png",
      42,
      "",
    ]) {
      expect(normalizeCustomLayout({ ...base, faceImage: bad as never }).faceImage, String(bad)).toBeUndefined();
    }
  });
});
