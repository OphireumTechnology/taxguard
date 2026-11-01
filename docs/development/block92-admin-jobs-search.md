# Block 92: administrator job queue and practice search

Status: **development checkpoint, branched from `main` at `1f937e1`.** User interface and browser client only; no server
or database change. The panels use Block 82's durable jobs router and Block 88's practice search. Both stay
development-only behind the route cutover gate. Synthetic data only.

## Purpose

The administrator workspace had a **Durable Job Queue** tab and a **Global Practice Search** tab. Both showed only an
"unavailable in this workspace" notice. The traceability row for the administrator role listed a durable job view as
missing. Blocks 82 and 88 built the durable stores behind both tabs.

## What is built

**`jobService`.** A browser client for `/api/jobs`: list with status, client, limit and offset filters; re-queue; and
cancel. It words the database's refusals and has a `jobActions` helper. Re-queue is offered only for `DEAD_LETTER` and
`FAILED`, and cancel only for jobs that are not `COMPLETED` or `CANCELLED`, the same rules the database enforces.

**`AdminJobQueuePanel`** (the Durable Job Queue tab) shows:
- recorded jobs with type, client (or practice-wide), status, attempts, last error and creation time;
- a status filter and paging;
- Re-queue and Cancel buttons only where allowed;
- the statement that no worker is commissioned.

**`AdminPracticeSearchPanel`** (the Global Practice Search tab) shows clients, cases, tasks and document requests
across the practice, with the total and how many are shown. Administrators count as practice managers, so they see the
whole tenant. It states that invoices are not searched.

Both panels show the original unavailable notice when their durable store answers 503. `AdminOperationalPanel` is
unchanged and still holds that notice for the other tabs.

## Evidence

**Unit:** `src/tests/adminJobsSearchPanels.test.tsx` runs 3 tests. They cover:
- the request paths, caching and filters;
- the allowed actions per status and the refusal wording;
- the first render, which shows no sample records.

**Browser:** `src/tests-e2e/11-appointments-audit-legal.e2e.test.ts` has a new journey on the real server:
1. The administrator enqueues a practice-wide job and a client job through the API.
2. Opening the Durable Job Queue tab shows the server's total and a Cancel control for both jobs.
3. Cancelling the client job in the UI makes the server record `CANCELLED` by `e2e-admin`; the control disappears and
   no Re-queue control is offered.
4. The Global Practice Search tab shows every match the server returns for the synthetic client.
5. An accountant listing every job is refused with `JOB_SCOPE_REQUIRED`.

**Mutation:** offering Re-queue for every status fails the journey. The file was restored afterwards.

## Not covered

- Running jobs. No worker is commissioned.
- A client view of job status, which waits on an owner decision.
- The workload, billing and retention tabs, which still show their unavailable notices. Retention needs owner
  policy; billing is Codex's Phase 15 work.
