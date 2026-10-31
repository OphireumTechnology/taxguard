# Block 84: task reassignment and staff workload

Status: **development checkpoint, branched from `main` at `a12444c`.** The database change is the review-only proposal
`20261019250000`. Nothing is applied to a hosted database. The two new routes are on the durable practice router,
which is development-only and sits behind the route cutover gate (key `practice`). Synthetic data only.

## Purpose

Block 83's coverage map showed that two practice operations had no durable route: reassigning a task, and the staff
workload view. Both existed only on the in-memory `/api/operations` routes, which production refuses.

## Reassigning a task

The new route is `POST /api/practice/clients/:clientId/tasks/:taskId/reassign`, with the body
`{ assignedUserId, version, reason? }`. It calls `taxguard_practice_reassign_task`.

- **Who:** a practice manager or administrator, the task's creator, or its current assignee. This is the same
  authority as for a task status change (`taxguard_practice_set_task_status`). Other staff in scope get
  `TASK_ACTION_NOT_AUTHORIZED`.
- **Scope:** the actor must be in scope of the task's case, engagement and year (owner decision 2026-10-19). A task
  out of scope answers `TASK_NOT_FOUND`, like a missing one.
- **New assignee:** must pass the same check as at task creation: an active staff member who can see the client
  (`taxguard_practice_can_see`). Clients, unknown users and staff of other clients get
  `TASK_ASSIGNEE_NOT_AUTHORIZED`.
- **Clearing:** `assignedUserId: null` removes the assignee. A request without `assignedUserId` is refused, so a
  missing field never clears an assignee.
- **Rules:**
  - the version must match, otherwise `PRACTICE_VERSION_CONFLICT`;
  - `COMPLETED` and `CANCELLED` tasks are not reassigned;
  - an unchanged assignee changes nothing and writes no audit row;
  - the reason is optional and at most 500 characters.
- **Audit:** every change writes `PRACTICE_TASK_REASSIGNED`, with the previous assignee, the new one and the reason.

## The staff workload view

The new route is `GET /api/practice/workload?userId=`. It calls `taxguard_dash_workload`.

It returns counts:
- current assignments: clients, engagements, and client-wide assignments;
- the staff member's open tasks, by status;
- how many open tasks are overdue.

The counts are computed only from recorded rows and returned with their definitions. Nothing is scored or ranked.

**Access:** an actor reads their own workload. Reading another staff member's needs a practice manager or
administrator, otherwise `WORKLOAD_NOT_AUTHORIZED`. A target who is not an active staff member of the tenant answers
`WORKLOAD_USER_NOT_FOUND`. The in-memory route let any accountant read anyone's workload.

## Wiring

- **Practice store:** `reassignTask` and `workload`. `WORKLOAD_NOT_AUTHORIZED` maps to 403.
- **Practice router:** the two routes.
- **Cutover:** the `practice` entry now also requires proposal `20261019250000`.
- **Practice-manager capability map:** `GET practice/workload` and `POST …/tasks/:taskId/reassign`, so a practice
  manager reaches them while the durable routers are configured. The database re-checks the manager's authority.
- **Function access inventory:** `taxguard_dash_workload` is listed as `OWN_RECORDS`. The reassign function reaches
  the item scope check, so it counts as scoped.
- **Route inventory:** the group `operations-tasks-deadlines-team` now names both routes. Its gap is reduced to the
  deadline escalation sweep.

## Evidence

`src/tests-db/taskReassignmentWorkload.db.test.ts` runs 7 tests over HTTP through the durable practice router, on a
disposable PostgreSQL with every proposal applied. They cover:
- a hand-off by the assignee, with its audit row;
- out-of-scope and unauthorized actors;
- version, assignee and status checks;
- the missing-field refusal and the reason limit;
- an unchanged assignee, and clearing the assignee;
- own and others' workload, managers, unknown targets, a foreign tenant and a client;
- a revoked assignment leaving the workload at once.

Four database mutations each made the test fail:

| Mutation | Effect |
|---|---|
| Scope check removed | The out-of-scope test fails |
| Authority check removed | Three tests fail |
| New-assignee check removed | Two tests fail |
| Manager check on another's workload removed | The workload test fails |

## Not covered

- A user interface for either route.
- Retiring the in-memory routes.
- The deadline escalation sweep.
- Hosted application of the proposal.
