import { describe, it, expect } from "vitest";
import { fitName } from "@/components/card-templates/shared";

// The card name (hero text) must never run off the side of the card. fitName
// shrinks it two ways: by the whole string (a long full name) AND — the reason
// this exists — by the LONGEST single WORD, because a 10+ letter first name
// can't wrap at a space and would poke past the edge at full size.
describe("fitName — hero name auto-fit", () => {
  const BASE = 24;

  it("leaves a normal name untouched (all words ≤ 9 letters)", () => {
    expect(fitName(BASE, "John Smith", 16)).toBe(BASE);
    expect(fitName(BASE, "Alex Morgan", 16)).toBe(BASE);
    // Exactly 9 letters is still the comfy limit — no shrink.
    expect(fitName(BASE, "Alexander Lee", 16)).toBe(BASE); // longest word "Alexander" = 9
  });

  it("shrinks once a single word passes 9 letters, and more per extra letter", () => {
    const ten = fitName(BASE, "Alexandra Lee", 16);   // "Alexandra" = 9? no, 9 -> check
    // "Alexandra" is 9 letters -> no shrink; use a real 10-letter word:
    const w10 = fitName(BASE, "Alexandria Lee", 16);  // "Alexandria" = 10
    const w13 = fitName(BASE, "Maximilliann Lee", 16); // 12-letter first name
    expect(ten).toBe(BASE);
    expect(w10).toBeLessThan(BASE);
    expect(w13).toBeLessThan(w10); // every extra letter shrinks a bit more
    // Inverse-length curve: a 10-letter word renders at base*9/10.
    expect(w10).toBeCloseTo((BASE * 9) / 10, 5);
  });

  it("catches a long first name even when the TOTAL length looks comfy", () => {
    // "Christopher Lee" = 15 chars (≤ comfyTotal 16 → no total shrink), but
    // "Christopher" = 11 letters must still shrink so it fits on one line.
    const s = fitName(BASE, "Christopher Lee", 16);
    expect(s).toBeCloseTo((BASE * 9) / 11, 5);
    expect(s).toBeLessThan(BASE);
  });

  it("never shrinks below the legible floor, however pathological the word", () => {
    // A 34-letter word is also a 34-char total, so the total-length fit
    // (floor 0.45×base) legitimately wins over the word floor (0.5×base) — the
    // combined result never drops below 0.45×base, which stays readable.
    const s = fitName(BASE, "Supercalifragilisticexpialidocious", 16);
    expect(s).toBeGreaterThanOrEqual(BASE * 0.45);
  });

  it("returns the base for an empty/missing name", () => {
    expect(fitName(BASE, "", 16)).toBe(BASE);
    expect(fitName(BASE, null, 16)).toBe(BASE);
    expect(fitName(BASE, undefined, 16)).toBe(BASE);
  });

  it("takes the SMALLER of the total-length fit and the word fit", () => {
    // A very long full name with all short words shrinks by total length.
    const longFull = fitName(BASE, "Jo An Bo Ka Li Mo Ne Pa Ro Su Ti", 16);
    expect(longFull).toBeLessThan(BASE); // total length drives it, no word > 9
  });
});
