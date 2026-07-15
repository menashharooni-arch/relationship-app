# Cards / public rendering / mobile / accessibility findings

Status: **FIXED** (this session) · **DOC** (documented, not fixed).

## Fixed
| # | Sev | Finding | Fix (commit) |
|---|-----|---------|--------------|
| H1 | HIGH | `/api/profile` PATCH replaced the whole `customization` blob (kept only `_`-keys), silently wiping unmanaged keys like `testimonials` on a profile-card save. | Now merges incoming onto the current blob (like `/api/cards/[id]`). `d5bc047`. |
| H2 | HIGH | Same route dropped `logo_url` (and `label`) — a logo chosen in the profile-card editor vanished with a "Saved!" toast. | `logo_url` added to `ALLOWED`. `d5bc047`. |
| H3 | HIGH | `/links/[username]` called `auth.getUser()` bare; a public viewer with a stale cookie could 500 the page. | Wrapped in try/catch, default anonymous (matches the card page). Commit `44801c6`. |
| M1 | MED | Public card handed templates the RAW customization, so a downgraded Pro's Pro-only colors/fonts kept rendering on Free. | Uses the plan-sanitized customization. `44801c6`. |
| M2 | MED | OpenGraph share image served the stored capture even for offline/deleted/plan-deactivated cards (full card image leaked indefinitely). | Honors `isCardActive` before the stored-capture tier; inactive → brand fallback. `44801c6`. |
| M3 | MED | Card creation had no synchronous in-flight guard — a fast double-tap could POST twice and create two cards (even on Free). | A `useRef` guard blocks the second call; resets on error for retry. `44801c6`. |
| M4 | MED | A corrupted/crafted `customization` (non-array `links`/`testimonials`/`phones`, or `customLayout` without `elements`) threw on `.filter`/`.map` and 500'd the public card. | `Array.isArray` guards on the card page and in `CustomCard`. `44801c6`. |
| M5 | MED | API accepted an empty `name` (public card rendered "Save 's contact") and unbounded lengths. | Rejects empty/oversized name on create. `44801c6`. |
| L2 | LOW | vCard exported office numbers as CELL because the office overlay writes `label:"Office"` (capital O) and the check was `=== "office"`. | Case-insensitive label check. `44801c6`. |
| L3 | LOW | `tel:` hrefs contained formatting characters (`tel:(555) 123-4567`), which some dialers reject. | Stripped to `[\d+]`. `44801c6`. |

## Documented — not fixed (accessibility / polish; larger or lower-risk)
- **M6 MED — modals lack Escape / `role="dialog"` / focus trap** (QRCodeModal, SaveContactButton sheet, SocialLinkIntercept, **ManageAccount delete modal**, SentEmailsModal, AddContactModal). `GuestGateModal` already has the correct pattern — extract a shared `<Modal>` and adopt it. (Not swept overnight to avoid regressions across 6 components; recommended as a focused follow-up.)
- **M7 MED — form inputs use placeholder-only labels** (no `htmlFor`/`id`/`aria-label`) in the wizard, edit form, AddressInput, and public lead forms. Add label associations + `aria-label` on the public forms.
- **L1** — hidden phones (`showOnCard:false`) still ship in the downloaded vCard. Decide: filter them, or relabel the toggle.
- **L4/L5** — phone toggle lacks `aria-pressed`; remove-`×` and modal-close targets are &lt;44px and one lacks `aria-label`.
- **L6** — public card page has no `h1` (only the template's `h2`).
- **L7** — `CardScaler` starts at `scale:0`/`opacity:0`, so no-JS/bot visitors briefly see an empty box. SSR a CSS default.
- **L8** — inline sheet/modal animations don't honor `prefers-reduced-motion`.
- **L9** — public lead form fails silently on missing required fields (no `required`, no inline error).
- **L10** — social-intercept produces an ugly raw source slug (`social_intercept_x_/_twitter`).
- **L11** — emoji-leading names render a lone surrogate in the monogram (`str[0]`); use `[...name][0]`.
- **L12** — editor logo upload isn't deferred, so it persists before "Save" and Cancel doesn't revert. Add `defer`.

## Verified SAFE
`/api/cards/[id]` customization merge is correct (one field can't clear others);
slug normalization + dedupe + 23505 retry; guest-draft claim idempotent and
session-bound; card DELETE cleans username-keyed leads/views/events; lead capture
type-checks required fields, rate-limits, whitelists tags, returns no internal
ids; deleted/offline/plan kill-switches enforced on card page, links, metadata,
and wallet (OG gap now fixed); vCard RFC-escapes injection-safe; edit Save
disabled while saving; XSS-safe link handling; no `Math.random()`/`Date.now()`
in render; `CardScaler` prevents fixed-width overflow below 375px.
