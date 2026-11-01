# Block 97: every cutover entry requires the proposals its router depends on

Status: **development checkpoint, stacked on Block 96 (`2eef61f`).** Route cutover catalog and one test; no server
behaviour, database or user interface change. Nothing is mounted: no proposal is owner-approved.

## Purpose

Block 96 found that the `practice` cutover entry did not require two proposals holding functions its routes call. If
the entry had been approved as written, the router could have been mounted without part of its schema. Block 96 noted
that the other entries had not been checked the same way. Block 97 checks all of them, and keeps them checked.

## The test

`src/tests/routeCutoverDependencies.test.ts` reads the source of each cutover router offline. For each one it collects
the database functions the router can call:
- calls in the router factory's own code; when a file defines several routers, only that factory's body;
- calls in the store modules it imports under `src/server/taxguard`, followed transitively.

It then finds the proposal holding each function's current definition: the last `CREATE` in execution order. Functions
defined in the baseline migrations need no proposal. The test fails when an entry does not require that proposal.

**What the scan ignores:**
- type-only imports;
- imports of error classes only;
- helpers imported from a store module without its store class, such as `derivedId` or `toCents`.

None of these make a database call. Without these rules, the scan reported dozens of false gaps: every practice
function for `cases`, and each portal router's functions for the other router in the same file.

## What it found

The test failed first on eight entries. Each gap is a function the router's own store calls:

| Entry | Proposals added | Functions behind them |
|---|---|---|
| `stage-one` | `20261019090000` | onboarding save, submit and decide |
| `vault` | `20261012310000`, `20261014500000`, `20261015050000`, `20261016040000`, `20261018180000` | document requests and templates, scan request and completion, client notifications and preferences, review queue |
| `billing` | `20261015010000`, `20261018040000`, `20261019000000`, `20261019020000`, `20261019030000`, `20261019050000`, `20261019060000` | invoice pages, transitions, creation, keyed refunds, lines and credits, catalog upsert (Codex's Phase 15 work) |
| `book-to-tax` | `20261019080000` | prepare adjustment |
| `tax-engine` | `20261012360000`, `20261012380000` | rule-set transitions and tests, coverage |
| `scheduling` | `20261016030000` | appointment rooms |
| `audit-center` | `20261014480000` | security event summary |
| `client-portal` | `20261016010000` | client consultations |

Most of these were already listed against the same routes in `production-route-parity.md`, so the catalog had drifted
from the document. The catalog in `src/server/routeCutover.ts` is now authoritative and checked; the parity document
points to it.

**Mutation:** removing `20261012310000` from the vault entry fails the test and names the document-request functions.
The file was restored afterwards.

## Not covered

- **Helper dependencies.** The test checks the proposal holding each called function's current definition. It does
  not check the proposals that define helpers those functions call. The migration manifest's dependency order covers
  that when proposals are applied.
- **Approval.** No entry is approved. The catalog states what an approval must include.
