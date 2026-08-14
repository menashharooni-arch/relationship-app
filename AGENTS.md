<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Ship a user-facing change → update the knowledge base

`src/lib/knowledge/` is what the support assistants know. Both the in-app helper
and the marketing sales chat answer **only** from it, so a feature that isn't in
there is a feature the product cannot explain to the person using it.

**Whenever you change what a user sees or does, update `src/lib/knowledge/docs/`
in the same commit.** That means: a new page or tab, a renamed button, a moved
menu item, a flow that gains or loses a step, a feature that changes plan, a
capability added or removed.

You do **not** need to touch it for prices, plan limits, card templates, or CRM
providers — `src/lib/knowledge/derived.ts` reads those from `plan.ts`,
`plan-content.ts`, `template-style-presets.ts` and `crm-connection.ts` at
request time, so they update themselves.

Guardrails that will catch you:

- `tests/knowledge-truth.test.ts` fails if a new page route has no coverage, if a
  doc points at a page that doesn't exist, or if a doc hardcodes a price or limit
  that belongs in `plan.ts`.
- `npm run kb:check` lists every user-facing file changed since the knowledge
  base was last touched — run it when the assistant starts sounding out of date.
- Anything marked `commerce: true` must carry a `nativeAnswer` with no pricing,
  upgrade, billing, or website language. The iOS shell is forbidden from selling,
  and the type system enforces the pairing.

Write docs the way a support agent talks: the exact label on the button, the real
path through the menus, and the thing users get wrong.
