# Knowledge review log

`npm run kb:check` reports every user-facing change since the last commit that
touched `src/lib/knowledge/`. That works while docs need editing — but a review
that concludes "nothing to change here" would leave the report stale forever,
and the next person would re-read the same diffs.

So a no-change review is recorded here. Adding a line touches the knowledge base,
which is exactly what `kb:check` measures from, and it leaves a reason behind for
whoever reads the same commits next.

One line per review, newest last.

---

- **2026-08-15 · up to `3a4c611`** — Homepage hero replaced (recipient's phone in
  a browser instead of the two-iPhones photo), hero subhead rewritten, template
  gallery phone relabelled "What they see — in their browser", and the "no app"
  claims across `/products/*` and `/testimonials` reworded to name the subject.
  **No doc change needed:** `no-app-needed` in `docs/product.ts` already states
  the fact correctly and the assistants never described the hero image. Nothing
  moved, was renamed, or changed plan.

- **2026-08-17 · up to the revert of `3a4c611`** — The change above was reverted
  in full at the owner's request: it pushed the "they install nothing" point
  harder than intended. The hero photo, hero subhead, the four-bullet list, the
  "01 Share in one tap" copy, the wallet-section line, the `/products/*` and
  `/testimonials` wording, and the template gallery's "Scroll on phone to view"
  label are all back to their pre-`3a4c611` text. **Still no doc change needed,**
  for the same reason as above — and the docs never described either version of
  the hero, so they were correct before, during, and after.

- **2026-08-19 · up to `7207811`** — Marketing mockups caught up to the shipped
  card page (numbered badges removed, ambient accent wash, real lead form, QR
  button dropped) and to Swift Links (Nebula-pinned phone with section headers
  and styled icon chips); pricing/plan bullets rewritten to what actually ships
  (Looks in "Social design", "No SwiftCard promos" instead of "no branding
  anywhere"); legacy `/card/` URLs replaced with root everywhere they were
  still emitted (.vcf download, iOS widget, /preview iframes, share button).
  **Doc changes made in the same pass:** `marketing-site.ts` gained the
  homepage claim-box entry point, the fuller footer description, and dropped
  the hardcoded template count. Everything else the mockup work touched is
  visual-only and already documented correctly (`product.ts` was current on
  Looks, headers, icon styling, and root URLs).

- **2026-09-02 · up to `e7a2f30`** — Swift Links hero-blend passes (`db8ffcd`,
  `e7a2f30`) are visual-only: the photo/logo header now washes into the sheet
  with no visible seam; no behavior, plan line, or user-facing wording
  changed. Signup-nudge commit `5dfb9b9` restyled the popup and changed its
  frequency to once ever per moment per browser — a marketing popup the KB
  deliberately doesn't document (support never needs to explain its cadence;
  the existing "signed-in users are never shown join-free invites" behavior
  is unchanged). Agent Flow (`de0769c`) is the owner-only /admin console —
  never customer-facing, nothing for the assistants to know. Earlier same-day
  user-facing changes (bolt badge + promo sheet, Free-only footer, Upload
  photo header option, tour-banner timing, Link buttons note) all landed with
  their KB updates in their own commits.

- **2026-09-03 · up to `eb1f7d4`** — Nothing customer-facing. `c6653a9` (push
  "notifications are off" copy naming the iPhone path) landed with its own KB
  update. Everything else this day is the owner-only /admin Agent Flow console
  and its plumbing: the always-on watchdog loop (Finn/Bo/Vera/Dash lose their
  schedules), catch-up dispatch, Atlas's two daily reports, the durable
  `error_events` sink, the shared `media_assets` creative pool, Jake gaining a
  page-writing step, and the new paid-ads agent (Addy) — all draft-only and
  never customer-facing. The one thing that WILL become user-visible is the
  pages Jake drafts, but those publish as ordinary /blog content through the
  existing owner-approval gate; the assistants already know how to talk about
  the blog, and no feature, price, plan, label or flow changed.

- **2026-09-04 · up to `638d584`** — `ContactsClient.tsx` changed, but nothing a
  user should be TOLD changed. The automation panel still shows "Sends <date>"
  and "Sent <date>" in exactly those words; the fix is that the scheduled date
  is now derived from the daily run (18:00 UTC) instead of the raw due instant,
  so an automation set up late in the evening no longer displays every step a
  day early. `automations.ts › when-follow-ups-send` already says sends are
  processed once a day and that the times beside each cadence describe the
  shape of the schedule rather than the minute a message leaves — both still
  true, and both now match what the screen shows. No page, button, label, plan
  line or step count moved.
