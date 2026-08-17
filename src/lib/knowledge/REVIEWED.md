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
