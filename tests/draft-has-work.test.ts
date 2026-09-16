import { describe, it, expect } from "vitest";
import { draftHasWork, type GuestDraft } from "@/lib/guest-draft";

// ── When does the builder ask "Continue your card / Start a new card"? ───────
//
// Owner rule 2026-09-16: every "Get started free"-style button runs the same
// flow, and a fresh entry into the builder asks before resuming or discarding
// an unfinished card. The builder autosaves the moment it opens, so a visitor
// who only LOOKED leaves a draft of empty strings — asking them about that
// "card" would be a pointless extra screen in front of step 1.

const draft = (payload: Record<string, unknown>, extra: Partial<GuestDraft> = {}): GuestDraft => ({
  id: "d1",
  kind: "card",
  payload,
  images: {},
  step: 1,
  updatedAt: 0,
  ...extra,
});

// Exactly what the wizard's autosave writes for an untouched form.
const untouched = {
  username: "", label: "", name: "", company: "", title: "", phone: "", email: "", website: "",
  linkedin: "", instagram: "", tiktok: "", twitter: "", template: "classic-pro", logo_url: null,
  customization: {
    bio: "", facebook: "", snapchat: "", youtube: "", links: [], fax: "",
    address: { street: "", unit: "", city: "", state: "", zip: "" },
    phones: [], photoUrl: null,
  },
};

describe("draftHasWork", () => {
  it("no draft, or an untouched autosave, is not work — no question", () => {
    expect(draftHasWork(null)).toBe(false);
    expect(draftHasWork(draft({}))).toBe(false);
    expect(draftHasWork(draft(untouched))).toBe(false);
  });

  it("a default template alone is not work", () => {
    expect(draftHasWork(draft({ ...untouched, template: "photo-first" }))).toBe(false);
  });

  it("anything the visitor typed is work", () => {
    expect(draftHasWork(draft({ ...untouched, name: "Dana" }))).toBe(true);
    expect(draftHasWork(draft({ ...untouched, instagram: "dana" }))).toBe(true);
    expect(draftHasWork(draft({ ...untouched, customization: { ...untouched.customization, bio: "Hi" } }))).toBe(true);
    expect(draftHasWork(draft({ ...untouched, customization: { ...untouched.customization, links: [{ label: "Shop", url: "" }] } }))).toBe(true);
    expect(draftHasWork(draft({ ...untouched, customization: { ...untouched.customization, phones: [{ number: "555" }] } }))).toBe(true);
    expect(draftHasWork(draft({ ...untouched, customization: { ...untouched.customization, address: { city: "Austin" } } }))).toBe(true);
  });

  it("a photo or logo is work", () => {
    expect(draftHasWork(draft(untouched, { images: { photo: "data:image/png;base64,AAA" } }))).toBe(true);
  });

  it("getting past step 1 is work, even with blank fields", () => {
    expect(draftHasWork(draft(untouched, { step: 3 }))).toBe(true);
  });

  it("whitespace is not work", () => {
    expect(draftHasWork(draft({ ...untouched, name: "   " }))).toBe(false);
  });
});
