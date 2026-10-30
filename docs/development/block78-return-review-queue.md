# Block 78: Stage 09 draft return review queue (read-only)

Status: **development checkpoint, stacked on Block 77.** The database change is the review-only proposal
`20261019210000`. Nothing is applied to a hosted database. Synthetic data only.

## Purpose

Until now a reviewer found a submitted draft return only by opening each case in Case Workflow. Block 71 also left out
"escalation into a reviewer queue (no queue exists yet)". Block 78 gives the reviewer that queue. It decides nothing.

## As built

- **Function** `taxguard_tax_return_review_queue(p_tenant, p_actor)` lists the `SUBMITTED` return versions of cases
  where the actor holds the **live** reviewer assignment (`taxguard_case_slot_live`). A practice manager sees every
  submitted version of the tenant. The list is ordered by submission time, oldest first; no priority is computed,
  since prioritisation is a practice decision. Each item has:
  - whether the version is stale (it cannot be approved);
  - the latest calculation verification;
  - the latest risk assessment, with its outcome and reason codes. A `BLOCKED` outcome is shown, never acted on.

  `returnUse` is `BLOCKED`. Only the function is granted to `service_role`.
- **Route:** `GET /api/tax-engine/review/queue`. Practice managers may read it. Production cutover refuses it until the
  proposal is approved (it is in the tax-engine entry, with sentinel `taxguard_tax_return_review_queue`).
- **Interface:** "Draft returns awaiting my review" on the reviewer dashboard. A live region gives the count and how
  many are BLOCKED; each item states its condition in words. The decision stays in Case Workflow → Draft return.
- **Tests:**
  - PostgreSQL acceptance 3/3 (in `taxReturnComparison.db.test.ts`, on Block 75's two-year practice). Covered:
    - only submitted versions, for the live reviewer;
    - not the preparer, the other year's reviewer, an outsider or another tenant;
    - the manager's view;
    - verification and risk shown;
    - a stale version with a BLOCKED assessment;
    - leaving the queue when the assignment ends, and when the version is returned;
    - privileges.
  - Three mutation checks are each caught: skipping the live-assignment check, listing versions that are not submitted,
    and listing other reviewers' cases.
  - Unit and cutover tests. Browser suite 07: the reviewer sees the submitted version in the queue before reviewing it.

## Not in scope

Assigning reviewers, priority or service levels, notifications, and any decision from the queue.
