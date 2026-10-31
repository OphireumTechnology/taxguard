# Block 83: durable coverage of the refused in-memory routes

Status: **development checkpoint, branched from `main` at `6ee344f`.** No server behaviour changes. The route inventory
register and its test are extended, and the cutover router factories are exported. Nothing is applied to a hosted
database. Synthetic data only.

## Why this block exists

The plan after Block 82 was a durable adapter for client requests (`/api/operations/requests`). That would have
duplicated existing work. Proposal `20261015030000` already stores clarification and amendment requests in
`taxguard_client_requests`, through the collection router, which is mounted in production. Proposal `20261012310000`
holds document requests in the vault. A second durable request system on the same table would conflict with the
first.

Block 81's register was too coarse to show this. It named only a cutover key for some groups, and listed 19
operations routes as having no durable adapter. Block 83 records, for every refused in-memory group, the durable
routes that cover its work and what is left. The test checks that every named route exists.

## The register (`production-route-inventory.json`)

Each `VOLATILE_REFUSED` and `PROVIDER_REFUSED` group now has a `coverage` value:

| Coverage | Meaning |
|---|---|
| `REPLACED` | Every route's work has a named durable route |
| `PARTIAL` | Named durable routes, plus a stated gap |
| `NONE` | A stated gap only |

A replacement route is a route of the production app or of a route cutover router, given with its full path. The
`durableReplacement` field from Block 81 is replaced by `replacementRoutes`. The 19-route group
`operations-without-durable-adapter` is split by area into five groups:
- jobs;
- requests;
- notifications;
- analytics and command center;
- rollover, plus the rest (search, retention, legal hold, archive verification).

`src/server/productionApp.ts` now exports `CUTOVER_ROUTER_FACTORIES`, the router behind each cutover key. Production
mounting is unchanged.

## The test

`src/tests/productionRouteInventory.test.ts` gains one test. It walks every route of every cutover router under its
catalog path (191 routes) and adds the production app's routes. For each refused group it requires:
- a known coverage value;
- at least one replacement route unless the coverage is `NONE`;
- a gap unless the coverage is `REPLACED`;
- every replacement route to exist;
- no replacement route to be itself a refused route.

Two mutation checks each made the test fail:
- a replacement path that does not exist;
- a replacement that is a refused in-memory route.

## Result

147 refused routes (146 in-memory, plus the payment webhook):

| Coverage | Routes |
|---|---|
| `REPLACED` | 19 |
| `PARTIAL` | 108 |
| `NONE` | 20 |

| Group | Routes | Coverage | Replacement routes | Gap |
|---|---|---|---|---|
| `operations-billing` | 7 | REPLACED | 6 | — |
| `operations-communications` | 4 | REPLACED | 4 | — |
| `operations-jobs` | 4 | REPLACED | 4 | — |
| `stage-two-document-review` | 4 | REPLACED | 4 | — |
| `case-authority-scoped` | 74 | PARTIAL | 7 | The cases router covers the case list, detail, stage moves, holds, notes and team. The other scoped operations were not reviewed route by route; durable case authority is next priority 1. |
| `bookkeeping-without-durable-adapter` | 10 | PARTIAL | 2 | Accounting-provider sync and document matching have no durable route. |
| `operations-tasks-deadlines-team` | 9 | PARTIAL | 8 | Task reassignment, the staff workload view and the deadline escalation sweep have no durable route. |
| `operations-requests` | 4 | PARTIAL | 6 | Durable requests are per engagement and tax year. Signature and payment requests have no request equivalent; signature packages and invoices carry that work. |
| `operations-notifications` | 4 | PARTIAL | 3 | Staff notifications and staff-triggered dispatch have no durable store. |
| `case-authority-onboarding` | 3 | PARTIAL | 5 | Equivalence with the legacy provisioning flow was not reviewed route by route. |
| `operations-analytics` | 2 | PARTIAL | 2 | The analytics figures and the command-center summary are not reproduced. |
| `operations-rollover` | 1 | PARTIAL | 1 | Nothing is carried forward automatically. The in-memory route records nothing either. |
| `operations-manager-dashboard` | 1 | PARTIAL | 1 | The dashboard figures are not reproduced. |
| `operations-search-retention` | 4 | NONE | 0 | No durable search or archive verification. Retention periods and legal holds are owner policy. |
| `operations-client-service` | 4 | NONE | 0 | No durable client service views. |
| `profile-amendments` | 4 | NONE | 0 | Only ordinary contact fields are durable. |
| `case-authority-review-decisions` | 2 | NONE | 0 | Durable case authority, next priority 1. |
| `stage-two-reconciliation` | 2 | NONE | 0 | No durable Stage 02 reconciliation snapshot. |
| `case-authority-review-workspace` | 1 | NONE | 0 | Durable case authority, next priority 1. |
| `case-authority-review-action` | 1 | NONE | 0 | Durable case authority, next priority 1. |
| `case-authority-review-queue` | 1 | NONE | 0 | Durable case authority, next priority 1. |
| `operations-payment-webhook` | 1 | NONE | 0 | No payment provider is commissioned. |

## What this does not show

- **Equivalence.** A replacement route covers the same work. Its rules are its own: scope, approvals, versions and
  idempotency differ from the in-memory routes, and those rules are not compared here.
- **Retirement.** Retiring an in-memory route is a separate change. Every in-memory route stays refused in production.
- **Mounting.** The replacement routes on cutover routers stay unmounted until their proposals are approved.

## Where the gaps are

These gaps need neither an owner decision nor an external provider:
- task reassignment and the workload view;
- the deadline escalation sweep;
- staff notifications;
- the Stage 02 reconciliation snapshot.

Retention and legal hold need owner policy. The payment webhook and accounting sync need providers. Case authority
needs owner-approved proposals.
