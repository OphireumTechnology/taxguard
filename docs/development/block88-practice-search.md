# Block 88: durable practice search

Status: **development checkpoint, stacked on Block 87 (`33a3613`).** The database change is the review-only proposal
`20261019280000`. Nothing is applied to a hosted database. The new route is on the durable practice router, which is
development-only and sits behind the route cutover gate (key `practice`). Synthetic data only.

## Purpose

Block 87 left operational search partly replaced: only clients could be searched durably, by name, through the
practice client list. The in-memory `/api/operations/search` also searched cases, requests, tasks and invoices.

## What is built

The route is `GET /api/practice/search?q=&limit=`, which calls `taxguard_practice_search`. It searches four record
types. Each is matched under the rule that already decides whether the actor may see that record (owner decision
2026-10-19):

| Type | Matched on | Visible when |
|---|---|---|
| `client` | name or id | the actor can see the client (`taxguard_practice_can_see`, as in the client list) |
| `case` | case id or the client's name | the actor's scope covers the case's engagement and year |
| `task` | title | the actor is the task's assignee or creator, or in scope of its case, engagement and year |
| `document_request` | title | the actor's scope covers the request's engagement and year |

**Query rules.**
- The query is 2 to 100 characters, matched case-insensitively as a literal substring. `%` and `_` in the query match
  only themselves.
- At most `limit` matches are returned (1 to 50, default 25), ordered by type and label, with the total count.
- Staff only, read only. Clients are refused.

Invoices are not searched, because the billing functions are redefined by Codex's Phase 15 work (`CODEX_HANDOFF`).

## Wiring

- **Practice store:** `search`.
- **Practice router:** the route. A missing `q` or a non-numeric `limit` is refused with 400.
- **Practice-manager capability map:** `practice/search`.
- **Cutover:** the `practice` entry now also requires `20261019280000`.
- **Function access inventory:** the function reaches the scope checks, so it counts as scoped.
- **Route inventory:** the group `operations-search` names the new route. It stays `PARTIAL`; the gap is invoices.

## Evidence

`src/tests-db/practiceSearch.db.test.ts` runs 4 tests over HTTP through the durable practice router, on a disposable
PostgreSQL with every proposal applied. They cover:
- a manager finding all nine matches;
- engagement assignees finding only what is in their scope, plus a task handed to them on another engagement;
- an assignee of another client finding nothing of this one;
- literal matching of `_` and `%`;
- the limit with its total;
- bad queries and clients refused.

Four database mutations each made the test fail:

| Mutation | Effect |
|---|---|
| Case scope removed | The assignee test fails |
| Task access removed | The assignee test fails |
| Wildcard escaping removed | The literal-match test fails |
| Client visibility check removed | The assignee test fails |

## Not covered

- Invoice search.
- Full-text ranking.
- A user interface.
- Hosted application of the proposal.
