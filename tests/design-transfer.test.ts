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

describe("faceLayoutFromScan: the free path's validator", () => {
  it("clamps hostile geometry and drops unknown kinds", async () => {
    const { faceLayoutFromScan } = await import("@/lib/design-transfer");
    const out = faceLayoutFromScan({
      background: "url(javascript:alert(1))",
      panels: [{ x: -50, y: 900, w: 1e9, h: 0, color: "red" }],
      elements: [
        { kind: "name", x: 120, y: -5, w: 400, h: 2, align: "diagonal", color: "#ZZZZZZ", weight: "heavy", size: "massive" },
        { kind: "script", x: 0, y: 0, w: 10, h: 10 },
        { kind: "name", x: 1, y: 1, w: 10, h: 10 }, // duplicate — dropped
      ],
    });
    expect(out).not.toBeNull();
    expect(out!.background).toBe("#ffffff"); // junk → fallback, never a CSS sink
    expect(out!.panels[0]).toMatchObject({ x: 0, y: 100, color: "#e5e7eb" });
    expect(out!.elements).toHaveLength(1);
    expect(out!.elements[0]).toMatchObject({ kind: "name", x: 96, y: 0, align: "left", size: "md", weight: "bold" });
  });

  it("synthesizes a name slot when the reading lacks one — never rejects for it", async () => {
    // Rejecting killed real readings in production (2026-08-12): the model
    // sometimes mislabels the big text or truncates the list. The name is the
    // one element we can always place ourselves.
    const { faceLayoutFromScan } = await import("@/lib/design-transfer");
    const out = faceLayoutFromScan({
      background: "#0b1020",
      panels: [{ x: 0, y: 0, w: 35, h: 100, color: "#1a233a" }],
      elements: [{ kind: "phone", x: 40, y: 60, w: 40, h: 6 }],
    });
    expect(out).not.toBeNull();
    const name = out!.elements.find((e) => e.kind === "name")!;
    expect(name.x).toBe(40);           // clears the 35%-wide side panel
    expect(name.color).toBe("#ffffff"); // dark card → light name
    expect(name.size).toBe("xl");
  });
});
