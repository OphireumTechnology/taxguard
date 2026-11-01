# Block 93: durable team workload and deadline escalation for managers and administrators

Status: **development checkpoint, branched from `main` at `14a7d39`.** User interface only; no server or database
change. The panels use the durable practice routes of Blocks 84 and 85, which stay development-only behind the route
cutover gate. Synthetic data only.

## Purpose

The practice manager's Workload, Team Capacity, Deadlines and SLA & Escalations modules showed tables built from the
in-memory manager projection (`/api/operations/manager-dashboard`), which production refuses. Their escalation levels
were stored values. The administrator's Caseload & Tasks tab only said "unavailable". Blocks 84 and 85 built durable
reads for both kinds of figure.

## What is built

**`TeamWorkloadPanel`.** It lists every staff member holding an active case in the practice summary, up to 25, with
their recorded workload: role, open tasks, overdue, ready for review, waiting on client, clients and assignments. A
lookup shows any staff identifier's workload, and the database's refusal is shown in words. No capacity target is
defined, so none is compared.

**`DeadlineEscalationsPanel`.** It shows the open deadlines in the actor's scope from a chosen level (default
Approaching), with counts per level. The thresholds are shown and labelled as defaults, not a reviewed policy.
Nothing is written and no sweep runs.

**Where they appear:**
- the manager's Workload and Team Capacity modules (team workload);
- the manager's Deadlines and SLA & Escalations modules (escalation);
- the administrator's Caseload & Tasks tab (`AdminWorkloadPanel`).

Each panel hides itself when the durable store answers 503 or 403, so the existing tables and notices stay where the
store is off. The administrator tab keeps its original unavailable notice in that case.

## Evidence

**Unit:** `src/tests/teamWorkloadEscalationPanels.test.tsx` runs 3 tests. They cover:
- loading states with no figures and no capacity target;
- the level choices, with Approaching as the default;
- the administrator tab heading.

**Browser:** `src/tests-e2e/06-role-dashboards.e2e.test.ts` has a new journey. The practice manager's Team Capacity
rows must equal `/api/practice/workload` for each staff member in `/api/practice/summary`: role, open tasks and
overdue. The SLA & Escalations counts must equal `/api/practice/deadline-escalations`. The administrator's Caseload &
Tasks tab must list the same staff.

The journey follows the server's staff list. When no staff member holds an active case it expects the empty message,
which is what suite 06 sees when run alone. Run after suites 02 and 03, which create staffed cases, the rows are
compared: suites 02, 03 and 06 pass together, 25 tests.

**Mutation:** showing one more open task than the server reports fails the journey in that combined run. The file was
restored afterwards.

## Not covered

- Removing the legacy in-memory tables. They remain for environments without the durable store.
- Capacity or SLA targets, which are owner policy.
- A screen-reader review.
