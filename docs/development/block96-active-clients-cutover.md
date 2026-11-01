# Block 96: active clients in the practice summary, and a gap in the practice cutover entry

Status: **development checkpoint, stacked on Block 95 (`af92707`).** The database change is the review-only proposal
`20261019290000`. Nothing is applied to a hosted database. Synthetic data only.

## 1. Active clients in the practice summary

The in-memory practice analytics reported an active-client count that the durable practice summary did not. This was
one of the two analytics figures Block 89 recorded as not reproduced; the other is paid revenue, which is Codex's
billing.

Proposal `20261019290000` redefines `taxguard_dash_practice_summary` from its current definition (`20261012320000`).
The only changes are the new `activeClients` figure and its definition:
- with no tax year, the count is the clients with status active;
- for a requested tax year, it is those with an engagement covering that year.

The summary stays manager-only. The practice manager's summary panel shows an **Active clients** tile.

## 2. The practice cutover entry was missing two proposals

`/api/practice/my-work` and `/api/practice/summary` call `taxguard_dash_my_work` and `taxguard_dash_practice_summary`.
Those come from proposal `20261012320000`, and `20261018090000` redefines `my-work`. Neither proposal was in the
`practice` route cutover entry, although the route-parity document listed both. Had the entry been approved as
written, the practice router could have been mounted without the schema behind two of its routes.

The entry now requires both, plus `20261019290000`, and adds `taxguard_dash_my_work` as a sentinel. A new test in
`src/tests/routeCutover.test.ts` pins this. Leaving out `20261012320000` refuses the cutover with
`PROPOSAL_NOT_APPROVED`. The existing test confirms that every listed proposal is in the execution order and defines
the sentinels. The parity document now lists every proposal of the entry.

## Evidence

- **PostgreSQL:** `src/tests-db/practiceSummaryActiveClients.db.test.ts` runs 2 tests. It checks the count across
  active, archived and engagement-less clients and the 2025, 2024 and 2023 filters, excludes another tenant, keeps the
  summary manager-only, and confirms every earlier figure is still present. A mutation that drops the status filter
  fails it. The composition re-apply check and the function inventory pass.
- **Browser:** suite 06's manager summary journey compares the Active clients tile with `/api/practice/summary`.
- **Unit:** the cutover test and the role dashboard panel tests pass.

## Not covered

- Paid revenue, which is Codex's Phase 15 billing.
- A systematic check that every cutover entry lists every proposal its router's functions come from. The practice
  gap was found by reading the routes; other entries were not re-derived from their routers' function calls.
