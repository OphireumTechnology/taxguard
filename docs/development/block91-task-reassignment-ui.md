# Block 91: task reassignment in the client detail

Status: **development checkpoint, branched from `main` at `9b8a65b`.** User interface only; no server or database change.
It uses Block 84's durable reassignment route, which stays development-only behind the route cutover gate. Synthetic
data only.

## Purpose

Block 84's task reassignment (`POST /api/practice/clients/:clientId/tasks/:taskId/reassign`) was the last piece of
Blocks 84–88 with no screen.

## What is built

In the client detail (`PracticeClientsPanel`, on the practice manager's Clients & Engagements module), each open task
gains a **Reassign** button. It opens a small labelled form with:
- **New assignee:** the client's team members, plus the current assignee, plus "Unassigned".
- **Reason (optional):** up to 500 characters, recorded in the audit row.
- **Save assignee:** disabled until the assignee differs from the current one.
- **Cancel.**

The form sends the task's loaded version, so a task changed in the meantime is refused with the existing "record
changed" message. On success the detail reloads and the panel says who the task went to.

Completed and cancelled tasks have no Reassign button. The server's refusals have their own messages:

| Code | Message |
|---|---|
| `TASK_NOT_FOUND` | not in your scope |
| `TASK_ACTION_NOT_AUTHORIZED` | only a manager, the creator or the current assignee |
| `TASK_ASSIGNEE_NOT_AUTHORIZED` | not a staff member who can see this client |
| `TASK_STATUS_TRANSITION_INVALID` | completed and cancelled tasks cannot be changed |

## Evidence

**Unit:** `src/tests/practiceClientsPanel.test.tsx` covers the four new messages.

**Browser:** `src/tests-e2e/02-practice-documents-billing.e2e.test.ts` has a new journey. After staffing the engagement,
the manager:
1. creates a task for the accountant in the UI;
2. opens Reassign, where Save is disabled until the assignee changes;
3. picks the reviewer and enters a reason;
4. saves.

The test then checks:
- the confirmation and the task line in the UI;
- the server's task: assignee `e2e-rev`, version 2;
- the reviewer's own notification list, which includes a `TASK_ASSIGNED` notice from the manager with the task's
  title.

Suites 02 and 06 pass together (15 tests).

**Mutation:** making the form always send `null`, which would clear the assignee, fails the journey. The file was
restored afterwards.

## Not covered

- Reassigning from the staff dashboards; only the manager's client detail has the control.
- Choosing an assignee outside the client's team. The server would accept anyone who can see the client.
- A screen-reader review.
