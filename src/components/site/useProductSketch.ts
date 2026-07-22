"use client";

import { useCallback, useEffect, useState } from "react";
import type { TemplateStyle } from "@/components/card-templates/shared";
import type { SwiftLinkStyle } from "@/components/SwiftLinkDesign";
import { stashSketch, consumePrefill, writePrefill, type CardPrefill } from "@/lib/prefill";
import { resetGuestFlow } from "@/lib/guest-reset";
import { clearDraft } from "@/lib/guest-draft";

// ── One sketch, three products ──────────────────────────────────────────────
// The homepage builders ("see how your card / SwiftLink / signature would
// look") all describe the SAME underlying record: a SwiftCard card row already
// carries its SwiftLink and email signature. So they share one state shape
// here, and each builder only ASKS for the subset its own product renders.
//
// Two things fall out of sharing it:
//   • a visitor who sketches a card and then opens the signature builder
//     doesn't retype their name, title, company, photo or colours; and
//   • whatever they end up with hands off to the real wizard intact, colours
//     and fonts included (see CardPrefill / PREFILL_STYLE_KEYS).
//
// Abandoning still wipes everything — closing a builder calls reset(), which
// clears the shared localStorage sketch via resetGuestFlow, so reopening any
// builder starts blank.

export type SketchSocials = {
  linkedin: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  twitter: string;
  youtube: string;
};

export type SketchLink = { label: string; url: string };

export type Sketch = {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  bio: string;
  street: string;
  city: string;
  stateRegion: string;
  zip: string;
  headshot: string | null;
  logo: string | null;
  template: string;
  style: TemplateStyle;
  /** Swift Links PAGE design — separate surface, separate keys (see lib/plan). */
  linkStyle: SwiftLinkStyle;
  socials: SketchSocials;
  links: SketchLink[];
};

export const EMPTY_SOCIALS: SketchSocials = {
  linkedin: "", instagram: "", tiktok: "", facebook: "", twitter: "", youtube: "",
};

export const EMPTY_SKETCH: Sketch = {
  name: "", title: "", company: "", phone: "", email: "", website: "", bio: "",
  street: "", city: "", stateRegion: "", zip: "",
  headshot: null, logo: null,
  template: "classic-pro",
  style: {},
  linkStyle: {},
  socials: { ...EMPTY_SOCIALS },
  links: [],
};

// Sketch → the prefill shape the real wizard reads on hand-off.
export function toPrefill(s: Sketch, product: CardPrefill["product"]): CardPrefill {
  return {
    name: s.name.trim(),
    title: s.title.trim(),
    company: s.company.trim(),
    phone: s.phone.trim(),
    email: s.email.trim(),
    website: s.website.trim(),
    bio: s.bio.trim(),
    address: { street: s.street.trim(), city: s.city.trim(), state: s.stateRegion.trim(), zip: s.zip.trim() },
    template: s.template,
    ...s.style,
    ...s.linkStyle,
    socials: Object.fromEntries(
      Object.entries(s.socials).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]),
    ),
    links: s.links,
    headshotUrl: s.headshot,
    logoUrl: s.logo,
    product,
  };
}

// Anything a previous builder already captured this session, back into state —
// so moving card → signature → SwiftLink never re-asks for the same details.
function fromPrefill(p: CardPrefill): Sketch {
  return {
    ...EMPTY_SKETCH,
    name: p.name ?? "",
    title: p.title ?? "",
    company: p.company ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    website: p.website ?? "",
    bio: p.bio ?? "",
    street: p.address?.street ?? "",
    city: p.address?.city ?? "",
    stateRegion: p.address?.state ?? "",
    zip: p.address?.zip ?? "",
    headshot: p.headshotUrl ?? null,
    logo: p.logoUrl ?? null,
    template: p.template ?? "classic-pro",
    style: {
      accentColor: p.accentColor,
      bgColor: p.bgColor,
      textColor: p.textColor,
      infoColor: p.infoColor,
      fontFamily: p.fontFamily,
    },
    linkStyle: {
      linkBgColor: p.linkBgColor,
      linkTextColor: p.linkTextColor,
      linkFontFamily: p.linkFontFamily,
    },
    socials: { ...EMPTY_SOCIALS, ...(p.socials ?? {}) } as SketchSocials,
    links: p.links ?? [],
  };
}

export function useProductSketch(product: CardPrefill["product"], open: boolean) {
  const [sketch, setSketch] = useState<Sketch>(EMPTY_SKETCH);

  const patch = useCallback((p: Partial<Sketch>) => setSketch((prev) => ({ ...prev, ...p })), []);
  const patchStyle = useCallback(
    (p: Partial<TemplateStyle>) => setSketch((prev) => ({ ...prev, style: { ...prev.style, ...p } })),
    [],
  );
  const patchLinkStyle = useCallback(
    (p: Partial<SwiftLinkStyle>) => setSketch((prev) => ({ ...prev, linkStyle: { ...prev.linkStyle, ...p } })),
    [],
  );
  const patchSocial = useCallback(
    (k: keyof SketchSocials, v: string) => setSketch((prev) => ({ ...prev, socials: { ...prev.socials, [k]: v } })),
    [],
  );

  // On open, pick up whatever another builder captured earlier this session.
  // consumePrefill() read-and-removes; the autosave below immediately re-stashes
  // the merged result, so nothing is lost and there's never a stale duplicate.
  useEffect(() => {
    if (!open) return;
    const carried = consumePrefill();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from the session sketch when the builder opens
    if (carried) setSketch((prev) => (prev === EMPTY_SKETCH ? fromPrefill(carried) : prev));
  }, [open]);

  // Keep the shared sketch current as they type, so ANY other entry point
  // (another builder, or a generic "Get started" button) carries it too.
  useEffect(() => {
    if (open) stashSketch(toPrefill(sketch, product));
  }, [open, sketch, product]);

  // Hand off to the real wizard, landing on its FIRST step with everything set.
  //
  // clearDraft() first: the wizard reads its step from a leftover guest draft,
  // so a draft from an earlier /cards/new visit (where they'd reached step 3)
  // would drop them on "Photos & design" and skip the beginning — even though
  // this is a fresh "Make it live". Dropping the stale draft lets the wizard
  // start at step 1; the `step: 1` marker below tells it to auto-apply this
  // sketch and begin there, so they still walk through every step (socials
  // included) to create the real card.
  const handOff = useCallback(() => {
    clearDraft();
    writePrefill({ ...toPrefill(sketch, product), step: 1 });
  }, [sketch, product]);

  // Abandoned → drop the shared sketch AND this builder's fields, so every
  // builder reopens genuinely blank (see resetGuestFlow).
  const reset = useCallback(() => {
    setSketch(EMPTY_SKETCH);
    resetGuestFlow();
  }, []);

  return { sketch, patch, patchStyle, patchLinkStyle, patchSocial, handOff, reset };
}
