# Block 85: deadline escalation, derived when read

Status: **development checkpoint, branched from `main` at `fce9f2d`.** The database change is the review-only proposal
`20261019260000`. Nothing is applied to a hosted database. The new route is on the durable practice router, which is
development-only and sits behind the route cutover gate (key `practice`). Synthetic data only.

## Purpose

After Block 84, the deadline escalation sweep (`POST /api/operations/deadlines/sweep`) was the last gap in the practice
task, deadline and team group. The in-memory sweep wrote an escalation level and an `OVERDUE` status onto each
deadline.

## Design: no sweep

The durable deadlines are not swept, for two reasons:

- The durable functions treat status `PENDING` as an open deadline. The client list's next deadline and the client
  detail both use it. A sweep that wrote `OVERDUE` would make overdue deadlines disappear from them.
- A sweep needs a scheduler, and none is commissioned.

`taxguard_practice_deadline_escalations` derives the level when it is read, from the due date and the current time,
and writes nothing. A derived level cannot go stale.

The route is `GET /api/practice/deadline-escalations?clientId=&minLevel=`. It returns:
- open deadlines in the actor's scope at or above the requested level, most urgent first;
- counts by level over everything in scope, whatever level was requested;
- the thresholds used, and definitions.

`MET` and `WAIVED` deadlines are not returned. `OVERDUE` rows written before this proposal are returned as open.

## Thresholds (owner review point)

These are the in-memory service's defaults (`DeadlineEscalationService.evaluateSingleDeadline`), carried over unchanged
and returned with every result. They are operational defaults, not a reviewed policy.

| Level | Name | Rule |
|---|---|---|
| 0 | NORMAL | due in more than 168 hours |
| 1 | APPROACHING | due within 168 hours |
| 2 | DUE_SOON | due within 48 hours |
| 3 | OVERDUE | past due |
| 4 | CRITICAL | past due by more than 168 hours, or past due with authority `STATUTORY` |

## Scope

Each deadline is scoped by the actor's scope over its case or tax year (`taxguard_practice_item_scope`, owner decision
2026-10-19). Practice managers and administrators see the whole tenant. Clients are refused. The practice-manager
capability map allows the route while the durable routers are configured.

## Evidence

`src/tests-db/deadlineEscalation.db.test.ts` runs 5 tests over HTTP through the durable practice router, on a
disposable PostgreSQL with every proposal applied. They cover:
- the ordering and the counts;
- that `MET` and `WAIVED` deadlines are left out, and a legacy `OVERDUE` row is kept;
- staff seeing only their own tax year;
- the level filter;
- refusal of bad input and of clients;
- that reading writes nothing;
- every threshold at its exact boundary.

Four database mutations each made the test fail:

| Mutation | Effect |
|---|---|
| Scope check removed | The tax-year test fails |
| `MET` and `WAIVED` included | Three tests fail |
| Statutory rule removed | Four tests fail |
| 48-hour boundary made exclusive | The boundary test fails |

The first run found that a non-numeric `minLevel` reached the database and answered 503. The router now refuses it
with 400 `PRACTICE_INPUT_INVALID`.

## Register

In the route inventory, the group `operations-tasks-deadlines-team` is now `REPLACED`: every one of its nine in-memory
routes has a named durable route.

## Not covered

- Notifications or reminders when a level changes, since nothing is written.
- A user interface.
- An owner-reviewed threshold policy.
- Hosted application of the proposal.
