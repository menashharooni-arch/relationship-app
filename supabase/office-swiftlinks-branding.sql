-- ── Office branding for the Swift Links page ────────────────────────────────
--
-- The Branding page had one half of the product: an office could set the look
-- and the company details of every teammate's CARD, and say whether teammates
-- could restyle it. The Swift Links page — the link-in-bio side that a QR code
-- or an email signature actually opens — had none of that. Every member styled
-- their own, so a company that had carefully set one look shipped fifteen
-- different ones.
--
-- These columns are the Swift Links mirror of what brand_* already does for the
-- card, and they are deliberately SEPARATE columns rather than more keys inside
-- brand_design: the two surfaces have different vocabularies (a card has a
-- template and a panel finish; a links page has a Look, a hero style and page
-- background media), and merging them is how one would start overwriting the
-- other.
--
-- Every column is nullable and defaults to nothing set, so an existing office
-- is completely unaffected until an admin opens the new tab and saves.

alter table offices
  -- The page's look: the same SwiftLinkStyle keys the member's own "Social
  -- design" step writes (linkLook, linkBgColor, linkTextColor, linkFontFamily,
  -- linkIconShape, linkIconFill, linkButtonStyle, linkButtonColor,
  -- linkBgMedia, linkBgMediaType, linkBgDim, linkGlass, linkAccentColor,
  -- linkHeroStyle, linkHeroContent, linkHeroImage). Applied to members only
  -- while brand_locks.linkDesign is on — the exact rule brand_design follows
  -- for the card via brand_locks.template.
  add column if not exists brand_link_design jsonb,

  -- CONTENT the office owns on every member's links page. These follow the
  -- COMPANY-INFORMATION rule, not the appearance rule: whatever the admin
  -- fills in is applied and is read-only for members regardless of the design
  -- lock — the same way brand_company and brand_logo_url are. A field the
  -- admin leaves blank stays the member's own.
  add column if not exists brand_link_bio text,
  add column if not exists brand_link_instagram text,

  -- Link buttons the office wants on everyone's page, as a JSON array of
  -- {label, url} (the same shape customization.links uses).
  --
  -- ADDITIVE, not exclusive. A member can always add their own links on top;
  -- these sit at the front and cannot be edited or removed by them. That is the
  -- owner's explicit rule and it is why this is not a lock over the whole list:
  -- an office wants its booking link on every page, not to stop a salesperson
  -- linking their own calendar.
  add column if not exists brand_links jsonb;

-- brand_locks gains "linkDesign" (keep every Swift Links page matching). It is
-- a jsonb blob, so no migration is needed for the key itself — recorded here so
-- the vocabulary lives in one place:
--
--   brand_locks = {
--     "template":   bool,  -- keep every CARD matching        (default true)
--     "linkDesign": bool   -- keep every LINKS PAGE matching  (default false)
--   }
--
-- linkDesign defaults FALSE, unlike template: an office that has never seen
-- this tab must not silently start overwriting the pages its members already
-- built. template defaults true because a uniform card is the reason an office
-- exists; this one takes something away from people who have it today.
--
-- The short-lived "links" key (an all-or-nothing freeze on a member's link
-- buttons) is retired by this change — brand_links + the additive rule above
-- replace it. Any office still carrying it is unaffected: nothing reads it.

comment on column offices.brand_link_design is
  'Swift Links page look pushed to members while brand_locks.linkDesign is on.';
comment on column offices.brand_links is
  'Link buttons pinned to every member page. Additive — members may add their own.';
