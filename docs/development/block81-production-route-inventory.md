# Block 81: production route inventory

Status: **development checkpoint, branched from `main` at `7a20336`.** No server behaviour changes. One new test and
one new register. Nothing is applied to a hosted database. Synthetic data only.

## Purpose

Next priority 4 in the status document is "durable adapters for retained in-memory routes" (`CONTROL-DURABILITY`).
Before any adapter is built, there has to be a checked list of which production routes are still backed by
process-local state, and a guard that none of them can answer in production. Until now that list existed only as
comments in the route files.

## The inventory test

`src/tests/productionRouteInventory.test.ts` builds the real production app (`createProductionApp`) in production
mode. It walks the Express router stack, so it sees every `/api` route the app registers, including routes given as a
list of paths. It then calls every route as an anonymous caller and as an active, assigned, AAL2 session of each of
10 roles: client, prospective client, accountant, reviewer, senior reviewer, bookkeeper, operations, practice
manager, administrator and super administrator. The session store is a synthetic stand-in with no database
functions.

Every route must be listed in `docs/development/production-route-inventory.json`, in exactly one group. Each group has
a kind and a reviewed reason. The test fails when:
- a registered route is not listed (a new route reaches production unreviewed), or a listed route no longer exists;
- a route in a refused kind answers anything except 401, 403 or its group's exact refusal code, for any role. This
  rules out success, and it rules out validating input and acting on in-memory state before refusing;
- with `TAXGUARD_LEDGER_STORE=durable`, a durable-ledger route does not reach the ledger store, or a bookkeeping route
  without a durable implementation does not refuse with `DURABLE_FEATURE_NOT_AVAILABLE`;
- a group names a durable replacement that is not a route cutover key in `src/server/routeCutover.ts`.

Two routes validate their input before refusing: reviewer decisions and client-service search. The test sends a
complete reviewer decision and a valid search term, so these routes are checked at the point where they refuse.

Mutation checks:
- Removing the production refusal in `practice-operations.routes.ts` makes the in-memory task, deadline and
  assignment routes answer 200, and the test fails.
- Adding an unlisted `GET` route to the production app makes the test fail.

Both files were restored afterwards.

## Result on `main` (`7a20336`)

222 `/api` routes. **No route backed by process-local state answers in production.**

| Kind | Routes | Meaning |
|---|---|---|
| `VOLATILE_REFUSED` | 146 | In-memory state; production refuses with a provider-required code |
| `DURABLE_GATED` | 27 | Bookkeeping ledger: the durable adapter (`SqlLedgerStore`, proposal 024) is off until `TAXGUARD_LEDGER_STORE=durable` |
| `PROVIDER_REFUSED` | 1 | Payment webhook: no payment provider is commissioned |
| `RETIRED` | 9 | Local password and identity routes: 410 in favour of the Supabase session bridge |
| `DURABLE` | 25 | Durable session, collection, profile contact fields, AI governance, accountant dashboard, bookkeeper client list |
| `STATELESS` | 4 | Stage 02 and 03 gate evaluation over the request's own snapshot; the static tax forms catalog |
| `DIAGNOSTIC` | 10 | Liveness, readiness and administrator-only diagnostics |

### The durable-adapter work list

These are the 146 refused in-memory routes, by group. **Replacement** names a durable router already in the repository
that covers the same work. That router stays unmounted until its proposals are owner-approved
(`src/server/routeCutover.ts`).

| Group | Routes | Refusal code | Replacement |
|---|---|---|---|
| `case-authority-scoped` | 74 | `DURABLE_CASE_AUTHORITY_PROVIDER_REQUIRED` | none (next priority 1) |
| `operations-without-durable-adapter` | 19 | `DURABLE_OPERATIONS_STORE_REQUIRED` | none: jobs, client requests, notifications, search, analytics, command center, retention, legal hold, archive, rollover |
| `bookkeeping-without-durable-adapter` | 10 | `DURABLE_ACCOUNTING_PROVIDER_REQUIRED` | none for sync and document matching; book-to-tax has the `book-to-tax` router |
| `operations-tasks-deadlines-team` | 9 | `DURABLE_OPERATIONS_STORE_REQUIRED` | `practice` |
| `operations-billing` | 7 | `DURABLE_OPERATIONS_STORE_REQUIRED` | `billing` |
| `operations-communications` | 4 | `DURABLE_OPERATIONS_STORE_REQUIRED` | `communications` |
| `operations-client-service` | 4 | `DURABLE_CLIENT_SERVICE_PROVIDER_REQUIRED` | none |
| `profile-amendments` | 4 | `DURABLE_PROFILE_PROVIDER_REQUIRED` | none |
| `stage-two-document-review` | 4 | `DURABLE_DOCUMENT_REVIEW_PROVIDER_REQUIRED` | none (next priority 1) |
| `case-authority-onboarding` | 3 | `DURABLE_ONBOARDING_PROVIDER_REQUIRED` | `stage-one` |
| `case-authority-review-decisions` | 2 | `DURABLE_REVIEW_DECISION_PROVIDER_REQUIRED` | none |
| `stage-two-reconciliation` | 2 | `DURABLE_RECONCILIATION_REQUIRED` | none |
| `case-authority-review-workspace` | 1 | `DURABLE_REVIEW_WORKSPACE_PROVIDER_REQUIRED` | none |
| `case-authority-review-action` | 1 | `DURABLE_REVIEW_ACTION_PROVIDER_REQUIRED` | none |
| `case-authority-review-queue` | 1 | `DURABLE_REVIEW_QUEUE_PROVIDER_REQUIRED` | none |
| `operations-manager-dashboard` | 1 | `DURABLE_OPERATIONS_PROVIDER_REQUIRED` | none |

23 of the 146 routes have a durable router behind the cutover gate. For those, the remaining work is owner approval
of the router's proposals, then retiring the in-memory route. The other 123 need a durable adapter, or a decision to
retire the route.

## What this does not show

- **Durable routes.** The `DURABLE` routes are not exercised against a database here. With the synthetic store they
  report their provider unavailable, or answer from the synthetic session rows. Each is covered by its own tests.
- **Shared code.** A refused route is not proof that no in-memory service is reachable another way. The test covers
  only the `/api` routes the production app registers.
- **Request inputs.** Every route is called once per role, with synthetic parameters and one shared request body.
  This is not a fuzz of every input.
- **Cutover routers.** The test runs with no route cutover requested, which matches production today, so the cutover
  routers are not mounted and are not in the inventory.
