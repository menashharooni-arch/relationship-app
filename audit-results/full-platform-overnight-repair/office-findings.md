# Office / invitations / branding / permissions findings

Status: **FIXED** (this session) · **DOC** (documented, not fixed).

## Fixed
| # | Sev | Finding | Fix (commit) |
|---|-----|---------|--------------|
| H1 | HIGH | **Regression from this session's sub-user work.** `findManagedFieldViolations` rejected ANY save on a card whose managed values had lagged the brand (e.g. after the admin re-enabled the design lock, whose design keys were never propagated) — locking the employee out of saving even personal fields, unrecoverable by refresh. | Now flags only values differing from BOTH the brand AND the card's current stored value (a real change); the brand save propagates the locked look to member cards; cleared phone/fax/address come off member cards. `+` regression tests. Commit `d5bc047`. |
| H2 | HIGH | Accepting an invite deleted the user's OLD office membership BEFORE the seat recount; a race rollback then left them with no membership but stale `plan='enterprise'` + `office_id` — permanent unpaid enterprise no cascade could clean up. | Old-membership deletion moved to after the activation sticks; old office's brand stripped from the user's cards on switch (also fixes M3 residue). `d5bc047`. |
| H3 | HIGH | The legacy `/profile` card editor and `/api/profile` bypassed all office branding — a sub-user could publish an off-brand public card at `/card/<username>`. | `/api/profile` now applies the managed-field rejection + overlays for sub-users, merges customization (also fixes a data-loss bug where unmanaged keys were wiped), and honors `logo_url`. `d5bc047`. |
| M1 | MED | Clearing office phone/fax/address never removed them from member cards (additive overlay only sets). | Cleared contact fields now stripped from member cards where they still match the old brand. `d5bc047`. |

## Documented — not fixed (lower risk / needs a judgment call)
- **M2 MED** — An office OWNER accepting another office's invite cross-contaminates brands (`applyBrandToUserCards` rewrites their own primary card, which then re-syncs the wrong brand to their whole team). **Fix:** reject invite acceptance when `getOwnedOfficeId(user.id)` is non-null, or exclude the owned primary card. (H2's fix reduces the residue but not the owner-accept case.)
- **M4 MED-LOW** — `propagateBrandToMembers` (primary-card edit path) loops raw active rows without the `profiles.office_id` intersection the brand route insists on; a stale active row could rebrand an ex-member's card. **Fix:** reuse `resolveBrandTargetIds` there too.
- **L1** — `requireOfficeCapability` never checks the owner's plan; a lapsed office's owner could still edit member cards / change roles (invite + brand routes check it, others don't). Fold the enterprise check into the one helper.
- **L2** — Join page renders the "Create your card" form for expired/revoked/declined invites (fails only on click). Reuse `isInviteExpired` + status checks in the page.
- **L3** — Managed-field rejection doesn't cover `label` (nickname) or the injected office phone entry — those are silently overwritten instead of 403'd (enforcement is correct; only the "explicit 403" contract is inconsistent).
- **L4** — Office admin's member-card route allows `label` off-company (drifts until next propagation). Force to `brand.company` or drop from `ALLOWED`.
- **L5** — Invite route: no email-format validation (a typo reserves a seat for 14 days); `.maybeSingle()` duplicate check errors if duplicate rows exist. Add validation + confirm a unique index on `(office_id, invite_email)`.
- **L6** — Revoke→resend reuses the same `invite_token` (a "dead" link revives). Rotate the token on resend.
- **L7** — `stripOfficeContact` compares addresses via `JSON.stringify` (key-order-sensitive). Use per-key comparison.

## Verified CORRECT (this session's sub-user work, re-audited)
Managed-field rejection is wired before the DB update, sub-user-only, owner
excluded; overlays applied on create AND edit; primary-card exemption correct on
both member and admin paths; design-tab lock enforced server + client with `org`
resolved server-side; roles/capabilities matrix correct, `manage_roles`
owner-only, plain employees redirected from every `/office/admin` page and
capability-checked on every `/api/office/*` route; invite lifecycle (expiry,
already-accepted, revoked, declined, email mismatch, lapsed owner plan, seat cap
+ recount) all enforced at accept; removal/cascade reverts plan + strips brand.
All 51 office-related unit tests pass.
