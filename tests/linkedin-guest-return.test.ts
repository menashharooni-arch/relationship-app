import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readGuestLinkedInReturn } from "@/components/site/useProductSketch";

// ── Guest LinkedIn photo → back into the homepage builder ────────────────────
//
// Owner, 2026-09-22: "whenever I create a card on 'See how your SwiftLink would
// look', LinkedIn profile pictures do not connect properly."
//
// The callback always did its job: it copied the consented photo into our
// storage and sent the visitor back to `returnTo` with ?li_photo=. The hole was
// on the receiving end. The three homepage builders returned to "/" — and only
// /cards/new ever read ?li_photo=. So the visitor landed on the top of the
// homepage, builder closed, and GuestFlowReset (which treats every signed-out
// homepage load as a fresh start) wiped the sketch on top of that.
//
// Now each builder returns to /?builder=<product>: the matching builder
// re-opens on step 1 with its stashed sketch, the photo goes on top, and the
// homepage reset stands aside for that one load.

const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const STORAGE = "https://example.supabase.co";
const PHOTO = `${STORAGE}/storage/v1/object/public/card-uploads/guest-linkedin/abc.jpg`;

describe("readGuestLinkedInReturn", () => {
  it("hands the matching builder its photo and tells it to re-open", () => {
    expect(readGuestLinkedInReturn(`?builder=swiftlink&integration=linkedin&status=photo&li_photo=${encodeURIComponent(PHOTO)}`, "swiftlink", STORAGE))
      .toEqual({ returned: true, photo: PHOTO });
  });

  it("ignores a return meant for another builder", () => {
    expect(readGuestLinkedInReturn(`?builder=card&li_photo=${encodeURIComponent(PHOTO)}`, "swiftlink", STORAGE))
      .toEqual({ returned: false, photo: null });
    expect(readGuestLinkedInReturn("", "swiftlink", STORAGE)).toEqual({ returned: false, photo: null });
  });

  it("still re-opens when LinkedIn had no photo, so the visitor is not dumped on the homepage", () => {
    expect(readGuestLinkedInReturn("?builder=signature&integration=linkedin&status=nophoto", "signature", STORAGE))
      .toEqual({ returned: true, photo: null });
  });

  it("never trusts a photo URL off our own storage host", () => {
    for (const bad of ["https://evil.example/x.jpg", `${STORAGE}/other/x.jpg`, "javascript:alert(1)"]) {
      expect(readGuestLinkedInReturn(`?builder=card&li_photo=${encodeURIComponent(bad)}`, "card", STORAGE).photo).toBeNull();
    }
    expect(readGuestLinkedInReturn(`?builder=card&li_photo=${encodeURIComponent(PHOTO)}`, "card", undefined).photo).toBeNull();
  });
});

describe("every homepage builder is wired the same way", () => {
  const BUILDERS: [string, string][] = [
    ["src/components/site/SwiftLinkMiniBuilder.tsx", "swiftlink"],
    ["src/components/site/CardMiniBuilder.tsx", "card"],
    ["src/components/site/SignatureMiniBuilder.tsx", "signature"],
  ];

  it.each(BUILDERS)("%s returns LinkedIn to its own builder and re-opens without reset", (file, product) => {
    const src = read(file);
    expect(src).toContain(`useProductSketch("${product}", open)`);
    expect(src).toContain(`returnTo="/?builder=${product}"`);
    expect(src).toContain("linkedInReturn");
    // Re-open keeps the stashed sketch: no reset() on this path.
    expect(src).toMatch(/if \(linkedInReturn\) \{ setStep\(0\); setOpen\(true\); \}/);
  });

  it("the homepage reset stands aside for a LinkedIn return", () => {
    expect(read("src/components/GuestFlowReset.tsx")).toContain('has("builder")');
  });

  it("a guest inside the iOS shell gets the photo back in the APP, not in the browser sheet", () => {
    // Sign up → the card builder, signed out, in the shell: the hop runs in
    // the in-app sheet, so the guest branch must finish at swiftcard:// like
    // DONE does, with li_photo carried in `next` for the wizard's reader.
    const cb = read("src/app/api/integrations/linkedin/callback/route.ts");
    const guestBranch = cb.slice(cb.indexOf("if (userId === GUEST_STATE)"));
    expect(guestBranch).toContain("swiftcard://linkedin-callback?status=photo&next=");
    expect(guestBranch).toMatch(/const res = isNative\s*\?/);
    expect(guestBranch).toContain('url.searchParams.set("li_photo", publicUrl)');
    // Both cookies cleared on this exit too, like every other.
    expect(guestBranch).toContain('res.cookies.set("li_native", "", { maxAge: 0, path: "/" })');
  });

  it("the wizard's own ?li_photo= reader is untouched", () => {
    const wizard = read("src/app/cards/new/NewCardWizard.tsx");
    expect(wizard).toContain('url.searchParams.get("li_photo")');
    expect(wizard).toContain("/storage/v1/object/public/");
  });
});
