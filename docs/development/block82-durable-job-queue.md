# Block 82: durable background job queue

Status: **development checkpoint, branched from `main` at `788eced`.** The database change is the review-only proposal
`20261019240000`. Nothing is applied to a hosted database. The new router is development-only and sits behind the
route cutover gate (key `jobs`), which mounts nothing until the owner approves its proposals. No worker process,
provider or AI agent is commissioned, so nothing runs a job. Synthetic data only.

## Purpose

Block 81's route inventory listed the background job queue (`/api/operations/jobs`, four routes) as in-memory, with no
durable adapter. Migration `20261001000000` had created the table `taxguard_durable_jobs`, but nothing used it. Block
82 adds the queue's rules to the database, a durable router and a worker adapter.

## What the database enforces (proposal `20261019240000`)

**Staff operations.** These take `p_actor` and accept active staff members only. Clients and recruiters are refused.

| Operation | Who | Rule |
|---|---|---|
| enqueue | any staff member in scope | A client job needs the actor's scope over the case, or over the whole client when no case is given (`taxguard_practice_item_scope`, owner decision 2026-10-19). The case must belong to the client. A job with no client is tenant-wide and needs an administrator. |
| list | any staff member | Only jobs in the actor's scope. Tenant-wide jobs are shown to administrators only. Listing without a client also needs an administrator. |
| retry | administrators in scope | A `DEAD_LETTER` or `FAILED` job goes back to `PENDING` with three more attempts. |
| cancel | administrators and accountants in scope | Any job that is not `COMPLETED`. Cancelling an already cancelled job returns it unchanged and records no new event. |

A job out of the actor's scope is reported as `JOB_NOT_FOUND`, the same as a missing job. These roles match the
in-memory routes: enqueue by any non-client, retry by `admin` and `super_admin`, cancel by those and `accountant`,
and tenant-wide work for administrators only.

**Worker operations.** These take no actor.

- **claim:** takes the tenant's next due job with `FOR UPDATE SKIP LOCKED`, ordered by priority, then due time. It
  issues a new lease token and expiry each time. A job whose lease expired is claimed again, unless it has used all
  its attempts. In that case it moves to `DEAD_LETTER` with `LEASE_EXPIRED`.
- **complete** and **fail:** need the same worker, the current lease token and an unexpired lease. This fences out a
  worker whose lease was taken over.
- **fail:** moves the job to `DEAD_LETTER` for a permanent error (`VALIDATION_*`, `AUTH_*`, `INVALID_PAYLOAD`, or
  flagged as permanent) or when no attempts are left. Otherwise it moves to `RETRY_SCHEDULED` after
  min(3600, 2^(attempt−1) × 30) seconds.

**Idempotency.** Each tenant and key holds one job, enforced by a unique index. A replay of the same request returns
the existing job, whatever its status. A different request with the same key is refused with
`JOB_IDEMPOTENCY_CONFLICT`.

**Event log.** Every change appends a row to `taxguard_durable_job_events`, which refuses `UPDATE` and `DELETE`.

**Limits and privileges.** Payloads are limited to 64 KiB. Only the seven entry points are executable by the server
role. The helpers and the event table are not reachable by any client-facing role.

## Differences from the in-memory service

- A key whose job was `CANCELLED` or `FAILED` no longer creates a new job. The in-memory service did.
- Priority outside 1–10 is refused, not clamped. The attempt limit is capped at 100.
- Retry backoff has no random jitter.
- An expired lease with no attempts left is dead-lettered, not claimed again.
- Clients cannot list jobs. The in-memory route let a client list their own client's jobs, including payloads. If
  clients should see job status, that is an owner decision.
- The router requires an `Idempotency-Key` header on enqueue, like the other durable routers.
- Practice managers are not in the practice-manager capability map for `/api/jobs`, so the app refuses them before
  the database is reached. The database would let a practice manager list and enqueue client jobs.

## Wiring

- **Router:** `src/server/routes/jobs-durable.routes.ts`, at `/api/jobs` in the development server, and in production
  only through the cutover gate.
- **Cutover entry:** `jobs`, requiring proposals `20261012250000`, `20261018100000` and `20261019240000`, with
  sentinel `taxguard_job_list`.
- **Worker adapter:** `src/server/taxguard/operations/durableJobWorker.ts`.
- **Route inventory:** the four `/api/operations/jobs` routes are now the group `operations-jobs`, with durable
  replacement `jobs`. They stay refused in production until they are retired.

## Evidence

`src/tests-db/durableJobQueue.db.test.ts` runs 13 tests on a disposable PostgreSQL with every proposal applied.
Staff operations go over HTTP through the router; worker operations go through the RPCs on separate connections. The
tests cover:
- scope by engagement and case;
- tenant-wide jobs refused to non-administrators;
- clients refused by the router and by the database;
- idempotent replay and conflict;
- input limits;
- retry and cancel authority;
- six concurrent claims over four jobs;
- skipping a row another transaction holds;
- priority order;
- lease fencing by worker, token and expiry;
- backoff and dead-lettering;
- lease expiry after the last attempt;
- the append-only log and function privileges.

The function access inventory (Block 79) classes the four new staff functions as scoped.

Four database mutations each made the test fail:

| Mutation | Effect |
|---|---|
| `SKIP LOCKED` removed | The claim blocks on the held row and times out |
| Lease token check removed | The fencing test fails |
| Scope check removed | The enqueue, list, retry and cancel tests fail |
| Administrator check on retry removed | The retry test fails |

The first `SKIP LOCKED` mutation survived the concurrent-claim test alone: without it, PostgreSQL still never
double-claims, because waiting claims re-check the row. The held-row test was added for that reason.

## Not covered

- A worker process, and what any job type does.
- Retiring the in-memory `/api/operations/jobs` routes.
- A user interface.
- Hosted application of the proposal.
