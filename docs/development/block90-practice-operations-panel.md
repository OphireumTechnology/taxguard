# Block 90: practice operations panel

Status: **development checkpoint, branched from `main` at `5927555`.** User interface and browser client only; no server
or database change. The panel calls the durable practice routes of Blocks 84–88, which stay development-only behind
the route cutover gate. Synthetic data only.

## Purpose

Blocks 84–88 added four durable practice reads and one write with no screen:
- the staff workload;
- deadline escalations;
- staff notifications and mark-read;
- practice search;
- task reassignment (the write).

This block puts them in front of staff.

## What is built

**Browser client (`practiceService`).** The new calls are `workload`, `deadlineEscalations`, `notifications`,
`markNotificationRead`, `search` and `reassignTask`, typed from the server responses. Every request is sent uncached,
with the session token and only the fields the route needs.

**`PracticeOperationsPanel`.** The panel is shown on the accountant and reviewer dashboards, under the durable work
queue. It has four sections:
- **My workload:** open tasks, overdue tasks, assigned clients and assigned engagements, each with the server's
  definition on hover.
- **Deadlines due soon or overdue:** the escalation view at level 2 and above, with the level, client, year and due
  time in words. The thresholds are shown and labelled as default thresholds, not a reviewed policy.
- **My notifications:** the unread count and each task-assignment notification, with a "Mark as read" button. A task
  the reader may no longer see is described only as unavailable.
- **Search:** clients, cases, tasks and document requests the actor may see, with the total and how many are shown.

Each section shows a loading state, then the server's figures, or an error saying nothing is shown in its place.
There are no placeholder figures. The whole panel is hidden when the durable store answers 503 or 403. A screen for
task reassignment is not part of this block.

## Evidence

**Unit:** `src/tests/practiceOperationsPanel.test.tsx` runs 3 tests. They cover:
- each call's route, method, caching and body;
- the due-time and notification wording, including an unavailable task;
- the first render showing loading states and no figures.

**Browser:** `src/tests-e2e/06-role-dashboards.e2e.test.ts` has a new journey. The accountant signs in to the real
server with the durable store. The test then checks:
- the workload tiles and the unread count equal what `/api/practice/workload` and `/api/practice/notifications`
  return for the same session;
- every escalated deadline the server returns is shown;
- a search for the synthetic client shows every match the server returns.

**Mutation:** making the panel show one more open task than the server reports fails the journey. The file was
restored afterwards.

## Not covered

- A task reassignment screen.
- The manager's view of another staff member's workload.
- A screen-reader pass. The panel uses labelled regions, live status messages and a search landmark, but no
  assistive-technology review was run.
