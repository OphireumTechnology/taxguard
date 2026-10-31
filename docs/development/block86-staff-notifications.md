# Block 86: staff in-app notifications for task assignment

Status: **development checkpoint, stacked on Block 85 (`313b05c`).** The database change is the review-only proposal
`20261019270000`. Nothing is applied to a hosted database. The new routes are on the durable practice router, which
is development-only and sits behind the route cutover gate (key `practice`). Synthetic data only.

## Purpose

Block 83's coverage map showed that staff notifications had no durable store. The in-memory
`/api/operations/notifications` kept them in a process list. Client notifications already exist (proposals 031 and
`20261016040000`); this block leaves them unchanged.

## What is built

- **Producer.** One notification kind, `TASK_ASSIGNED`. The database writes it when a task is created with an
  assignee or reassigned to one. It goes to that assignee, unless the assignee is the actor.
  `taxguard_practice_create_task` (current definition `20261018100000`) and `taxguard_practice_reassign_task`
  (`20261019250000`) are redefined with one added line each.
- **Read-time access.** A notification stores identifiers only: the client and the task. Its title and status are read
  from the task when it is listed, and only while the recipient may still see the task: as its assignee, its creator,
  or in scope of its case, engagement and year (owner decision 2026-10-19). Otherwise the item answers
  `available: false` with no task details, so a later revocation hides what the notification points to.
- **Routes.**
  - `GET /api/practice/notifications?unreadOnly=&limit=` lists the actor's own notifications and unread count.
  - `POST /api/practice/notifications/:notificationId/read` marks one read. Only the recipient can mark it; marking
    it again changes nothing.
- **Channel.** In-app only, with delivery status `NOT_CONFIGURED`, as for client notifications. No e-mail or SMS
  provider is commissioned.

## What is deliberately not built

- **Free-text dispatch between staff.** The in-memory `POST /notifications/dispatch` let staff send free-text
  notifications to anyone. That is staff messaging, which waits on the owner's general-record policy
  (`phase14-remaining-domain-access-policy.md`).
- **Staff notification preferences.** These have no durable store.

## Wiring

- **Practice store:** `staffNotifications` and `markStaffNotificationRead`.
- **Practice router:** the two routes. A non-numeric `limit` is refused with 400.
- **Practice-manager capability map:** both routes.
- **Cutover:** the `practice` entry now also requires `20261019270000`.
- **Function access inventory:** `taxguard_staff_notification_mark_read` is listed as `OWN_RECORDS`. The list function
  reaches the item scope check, so it counts as scoped.
- **Route inventory:** the group `operations-notifications` names the two routes. It stays `PARTIAL`; the gap is
  free-text dispatch, staff preferences, and e-mail and SMS.

## Evidence

`src/tests-db/staffNotifications.db.test.ts` runs 5 tests over HTTP through the durable practice router, on a
disposable PostgreSQL with every proposal applied. They cover:
- the assignee notified and the actor not;
- a reassignment notifying the new assignee;
- an assignee of another engagement losing the task details once the task is reassigned away;
- marking read: only one's own, once, and a malformed id;
- clients and bad limits refused;
- table and helper privileges.

Block 84's reassignment test, the practice client detail scope test, the function inventory and the composition
re-apply check all pass with the redefinitions.

Four database mutations each made the test fail:

| Mutation | Effect |
|---|---|
| Actor notified too | Three tests fail |
| Access check on the task removed | The revocation test fails |
| Anyone can mark read | The mark-read test fails |
| No notification on reassignment | Two tests fail |

## Not covered

- Other notification kinds, such as case staffing or review requests.
- A user interface.
- Hosted application of the proposal.
