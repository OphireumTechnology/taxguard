# Block 79: function access inventory and the calculation-run liveness regression

Status: **development checkpoint, branched from `main` at `d0b7099`.** The database change is the review-only proposal
`20261019220000`. Nothing is applied to a hosted database. Synthetic data only.

## Purpose

Next priority 3 in the status document is "a re-run of the function inventory for any remaining client-level reads".
The earlier inventory (Phase 14 dossier: 215 actor functions) was never committed as a script, so it could not be
re-run. Block 79 makes it a test that runs with the PostgreSQL suite.

## The inventory test

`src/tests-db/functionAccessInventory.db.test.ts` runs on a disposable PostgreSQL with every migration and proposal
applied in execution order. It reads `pg_proc`, so it sees the current definitions as PostgreSQL resolved them, not a
parse of the files. For every function the server role can execute that takes `p_actor`, it follows the calls into
other public functions. A function counts as **scoped** if it, or anything it calls, reaches an engagement, tax-year,
case or return-version check (`taxguard_staff_scope`, `taxguard_staff_record_scope`, `taxguard_case_actor`,
`taxguard_case_slot_live`, the ledger year scope and guard, and the item, event, collection, conclusion, research, QC
and final-authorization scopes).

Every other function must be listed in `docs/development/function-access-inventory.json`, with a category and a
reviewed reason. The test fails when:
- an unscoped function is not listed (a new client-level read or write, caught failing first);
- a listed function is no longer present, or has become scoped;
- a category is unknown, or a reason is shorter than 20 characters.

A mutation check that removes one entry from the list makes the test fail.

**Result on `main` plus this block:** 233 server-callable actor functions. 111 are scoped; 122 are listed:

| Category | Count | Meaning |
|---|---|---|
| `TENANT_TAX_CONTENT` | 26 | Sources, rule sets, form rules, templates, categories and the service catalog: not client data |
| `STAFF_ADMIN_SECURITY` | 22 | Staff identity, sessions, MFA recovery, membership, audit centre, security events |
| `OWNER_DECISION_PENDING` | 21 | Messaging, appointments, rooms and legal matters, waiting for the owner's general-records decision |
| `CLIENT_LEVEL_BY_DESIGN` | 14 | Onboarding identity, chart of accounts, bank feeds, notifications, consultations, reassignment requests |
| `MANAGER_ONLY` | 13 | Refused unless the actor is a practice manager or administrator |
| `CODEX_HANDOFF` | 11 | Billing, redefined by Codex's Phase 15 work |
| `CLIENT_SELF` | 6 | The client's own intake and onboarding |
| `STAFF_CLIENT_LEVEL_REVIEW` | 5 | Findings, below |
| `OWN_RECORDS` | 4 | The actor's own assignments, tasks or uploads |

## Finding 1 (fixed): calculation runs ignored the live assignment

- **Before.** `20261018090000` made `taxguard_tax_run_record` require the live preparer or reviewer assignment
  (`taxguard_case_slot_live`). `20261018190000` (evidence lineage), which runs later, rebuilt the function from the
  older `033` definition, and so trusted the name recorded on the case again. Its new `taxguard_tax_run_lineage` did
  the same.
- **Effect.** A preparer or reviewer whose assignment had been revoked or had expired, but who was still named on the
  case, could record a calculation run and read a run's evidence lineage: input values and the documents they cite.
- **Fix.** Proposal `20261019220000` restores the check in both functions. Each is identical to its current definition
  apart from that check, and keeps its existing not-found codes. Practice managers keep lineage access.
- **Test, failing first.** `caseAssignmentRevocation.db.test.ts` now covers both functions for a revoked reviewer.
  Without the fix the reviewer passes the access check (`TAX_RULE_SET_NOT_FOUND`). With it, the result is
  `TAX_CALC_CASE_NOT_FOUND` / `TAX_CALC_RUN_NOT_FOUND`, nothing is inserted, and the manager and administrator still
  read lineage. 6/6.

## Finding 2 (recorded, not changed): client-level staff paths

These five functions are listed under `STAFF_CLIENT_LEVEL_REVIEW`. For staff, each needs only client-level access (any
active assignment to the client):

- `taxguard_portal_case_stages`, `taxguard_portal_engagements` and `taxguard_portal_signature_packages` return statuses
  and counts for every engagement and year of the client.
- `taxguard_practice_list_clients` shows each client's whole team and open-task count.
- `taxguard_case_create` lets any assignee open a case for another engagement or year of the client.

Clients see only their own records. The proposed follow-up is to scope the staff paths the way `20261018100000` scoped
the practice client detail. Whether a client-wide team list is acceptable is an owner question.

## Not in scope

Changing the categories that wait for an owner decision or Codex's work.
