import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLE_DATA, SAMPLE_DATA_WITH_PHOTO, DEMO_HEADSHOT, withoutSocials } from "@/components/card-templates/types";

// STRUCTURAL + VALUE GUARD.
//
// The website shows the same person's SwiftCard in two places: the template
// gallery on the homepage, and inside the email in the Swift Signature demo.
// They are supposed to be the same card. They weren't — SignatureDemo restated
// the identity by hand and dropped `address` on the way, so the gallery card
// showed "1200 Ocean Ave, San Francisco, CA 94122" and the signature card
// showed nothing there. Retyping the fields is what allowed the two to drift,
// so the fix was to derive both from SAMPLE_DATA and the guard is that they
// stay derived.

const root = process.cwd();

// Prose ABOUT a field is not a field. Both files carry comments naming
// `address`, `company` and PHOTO_FIRST_DATA to explain this very bug, and
// without stripping them every assertion below would pass on the comment alone.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const signature = stripComments(readFileSync(join(root, "src/components/site/SignatureDemo.tsx"), "utf8"));
const gallery = stripComments(readFileSync(join(root, "src/components/site/TemplateGallery.tsx"), "utf8"));

describe("the marketing demos show one identity", () => {
  it("the shared sample still carries the fields the cards render", () => {
    // If the sample itself lost these, both cards would go quietly blank and
    // every assertion below would still pass.
    expect(SAMPLE_DATA.name).toBe("Alex Morgan");
    expect(SAMPLE_DATA.address, "the sample lost its address").toBeTruthy();
    expect(SAMPLE_DATA_WITH_PHOTO.photoUrl).toBe(DEMO_HEADSHOT);
  });

  it("the signature's card is the same object the gallery's Photo First card is", () => {
    // Value-level: this is what the two components each build.
    const fromSignature = withoutSocials(SAMPLE_DATA_WITH_PHOTO);
    const fromGallery = { ...withoutSocials(SAMPLE_DATA), photoUrl: DEMO_HEADSHOT };
    expect(fromSignature).toEqual(fromGallery);
    // The field that actually went missing.
    expect(fromSignature.address, "the signature card would render no address").toBeTruthy();
  });

  it("SignatureDemo derives its card instead of retyping the identity", () => {
    expect(signature, "SignatureDemo no longer builds its card from the shared sample").toContain(
      "withoutSocials(SAMPLE_DATA_WITH_PHOTO)",
    );
    // The drift pattern itself: a hand-written identity literal. `company:` and
    // `phone:` keys with string values are how the old copy diverged.
    expect(signature, "SignatureDemo is hand-declaring identity fields again").not.toMatch(
      /\b(company|phone|email|website):\s*"/,
    );
  });

  it("the gallery still feeds Photo First the headshot build", () => {
    // The other half of the pair — if the gallery stopped using its own
    // PHOTO_FIRST_DATA the two would diverge from the other direction.
    expect(gallery).toMatch(/PHOTO_FIRST_DATA[^\n]*=\s*\{\s*\.\.\.CARD,\s*photoUrl:/);
    expect(gallery).toMatch(/data:\s*PHOTO_FIRST_DATA/);
  });
});
