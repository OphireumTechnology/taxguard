# Block 80: engagement scope of five client-level staff paths

Status: **development checkpoint, branched from `main` at `c0568d8`.** The database changes are the review-only proposals
`20261019230000` and `20261019231000`. Nothing is applied to a hosted database. Synthetic data only.

## Purpose

Block 79's function access inventory recorded five functions whose staff path decided access per client (any active
assignment to the client). They are now brought under the owner decision of 2026-10-19, already applied by
`20261018060000` and `20261018100000`: a staff member assigned to one engagement and tax year reaches that client's
records for that engagement and year only, unless independently authorized (a client-wide assignment, a practice
manager or an administrator). No new owner decision is needed. Clients, managers and administrators are unchanged.

## Changes

| Function | Before (staff) | After |
|---|---|---|
| `taxguard_portal_case_stages` | stage, evidence counts and team flags of any engagement and year | out of scope reads `PORTAL_ENGAGEMENT_NOT_FOUND`, like a missing engagement |
| `taxguard_portal_engagements` | every engagement and year with its case status | only engagements and years in scope |
| `taxguard_practice_list_clients` | engagement count, whole team, open tasks and next deadline of every engagement and year | filtered the way the practice client detail is: the list now agrees with the detail for the same person |
| `taxguard_case_create` | creation was already limited to the engagement-year preparer, but the checks before that revealed whether a case existed and whether the engagement and year were active | out of scope is refused first with `CASE_CREATE_NOT_AUTHORIZED` |
| `taxguard_portal_signature_packages` | status-only packages of every engagement | only packages of engagements and years in scope (separate proposal `20261019231000`, so that the existing client-portal routes do not wait for the signature package proposal) |

Each function is identical to its current definition, confirmed as the last one in execution order, except for the
change listed above. The cutover entries for `practice`, `cases` and `client-portal` now require `20261019230000`, and
`client-signatures` requires `20261019231000`.

## Tests

- **`practiceClientDetailScope.db.test.ts`.** Three new cases, on the existing two-engagement, two-year practice:
  - the client list for engagement-year, client-wide, manager and administrator actors, compared with the client
    detail for each;
  - portal case stages and engagements;
  - case creation answering the same refusal whether or not the case exists.

  Re-applying the four old definitions makes all three fail. With the proposal, 11/11 pass.
- **`taxReturnSignaturePackage.db.test.ts`.** A staff member assigned to another tax year of the same engagement sees
  no packages; the case reviewer and the manager still do. The old definition fails this case. 4/4.
- **Function access inventory.** The five functions are now scoped and leave the reviewed list (117 entries). The
  temporary `STAFF_CLIENT_LEVEL_REVIEW` category is removed. The Block 79 note's statement about case creation is
  corrected.
