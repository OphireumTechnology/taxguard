# Block 99: automated accessibility and phone-width checks for the Block 90–93 panels

Status: **development checkpoint, stacked on Block 98 (`cdb8cde`).** Browser tests only; no product change.

## Purpose

The staff accessibility suite (`src/tests-e2e/16-staff-accessibility.e2e.test.ts`) predates Blocks 90–93. It audited
the accountant and reviewer home pages, which now include the practice operations panel. But it ran before the panel
loaded, and it never opened the new modules, tabs, search results or reassignment form.

## What is added

**Module audit.** The audit covers these new screens:
- the practice manager's Workload, Team Capacity and SLA & Escalations modules;
- the administrator's Durable Job Queue, Global Practice Search and Caseload & Tasks tabs.

It looks for unnamed controls, unlabelled fields, duplicate IDs, unlabelled images and positive tabindex.

**Expanded views:**
- the accountant's practice operations panel, after its workload has loaded and a search has returned results;
- the manager's client detail with a task reassignment form open.

**Phone width (375 px).** No horizontal page scroll on:
- the accountant's practice operations panel;
- the manager's Team Capacity and SLA & Escalations modules;
- the administrator's three new tabs.

## Evidence

Run with suites 02 and 03 first, so the client detail has an open task to reassign, suites 02, 03 and 16 pass: 33
tests. No defect was found on the new screens.

**Mutation:** pointing the practice search label at a missing field fails three tests: the accountant and reviewer
home audits and the expanded-view test. The file was restored afterwards.

## What this does not show

These are automated checks of what automation can see. They do not establish WCAG conformance, which needs a manual
assistive-technology review. No screen-reader pass is claimed.
