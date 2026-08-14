---
description: Bring the support assistants' knowledge base up to date with what has shipped since it was last touched
---

Update `src/lib/knowledge/` so the in-app helper and the marketing sales chat
describe the product as it is right now.

Work in this order:

1. Run `npm run kb:check`. It prints every user-facing file changed since the
   knowledge base was last updated, and the commits that changed them.

2. For each of those changes, read the actual diff (`git show <sha> -- <path>`)
   and decide: **does this change what a user should be told?** A refactor,
   a styling tweak, or a server-side fix usually does not. A renamed button, a
   moved menu item, a new tab, a new page, a flow that gained a step, or a
   feature that changed plan always does.

3. For the ones that do, edit the matching doc in `src/lib/knowledge/docs/`.
   Grep the JSX for the literal button and tab labels — a support answer that
   says "click the button labelled X" is only useful if X is the real string.
   Do not paraphrase menu paths from memory.

4. Do **not** hardcode prices, plan limits, template names, or CRM providers.
   `src/lib/knowledge/derived.ts` reads those from the code at request time.
   `tests/knowledge-truth.test.ts` will fail you if you try.

5. Any doc that mentions price, upgrading, billing, or the website needs
   `commerce: true` **and** a `nativeAnswer` that mentions none of those — the
   iOS shell may never route a user toward paying.

6. Run `npx vitest run tests/knowledge-truth.test.ts tests/help-guardrail.test.ts`
   and `npx tsc --noEmit`. Both must be green.

7. Report what you changed and, explicitly, which shipped changes you decided
   did **not** need a knowledge update and why.

If a new page route has no reasonable customer-facing explanation (a staff-only
console, a redirect shim), add it to `UNDOCUMENTED_ROUTES` in
`src/lib/knowledge/index.ts` with a written reason rather than inventing a doc.
