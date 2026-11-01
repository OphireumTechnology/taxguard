# Block 98: cutover entries require the proposals behind their helpers too

Status: **development checkpoint, stacked on Block 97 (`9ce4e00`).** Route cutover catalog and one test; no server
behaviour, database or user interface change. Nothing is mounted: no proposal is owner-approved.

## Purpose

Block 97 made each cutover entry require the proposals holding the current definitions of the database functions its
router calls. It left one gap open: those functions call helper functions, which may be defined in other proposals.
Approving and applying an entry without them would leave functions the router depends on missing at run time.

## The test

`src/tests/routeCutoverDependencies.test.ts` gains one test. It starts from the functions each router can call, the
same set as Block 97. It then follows the calls in each function's current definition (its body between `$$` quotes)
to every `taxguard_` function reached, transitively. Every proposal holding the current definition of a reached
function must be in the entry. Baseline migration functions need no proposal.

Because the closure starts from the router's own calls and not from the listed proposals, adding proposals to an entry
cannot create new findings. One pass closes the gaps.

## What it found

87 helper dependencies across 14 entries were not required. The commonest were the practice actor and visibility
helpers (`20261012250000`) and the document actor (`20261012270000`). Two examples:
- `consultations` converts a request into an appointment, so it needs the appointments proposal `20261014400000`;
- `client-signatures` reads signature packages, whose readiness check reaches the whole return chain
  (`20261018190000` to `20261019170000`).

Entries changed (proposals before → after):

| Entry | Proposals |
|---|---|
| `billing` | 9 → 12 |
| `book-to-tax` | 3 → 5 |
| `cases` | 4 → 8 |
| `client-portal` | 3 → 8 |
| `client-signatures` | 4 → 12 |
| `communications` | 1 → 3 |
| `consultations` | 1 → 4 |
| `legal-matters` | 1 → 4 |
| `practice` | 10 → 12 |
| `reassignment` | 1 → 3 |
| `scheduling` | 2 → 4 |
| `stage-one` | 2 → 3 |
| `tax-engine` | 22 → 25 |
| `vault` | 9 → 10 |

`audit-center` and `jobs` needed nothing more.

**Mutation:** removing `20261012250000` from the communications entry fails the test and names the inbox's practice
helpers. The file was restored afterwards.

## Not covered

- **Dynamic SQL.** Calls built inside `EXECUTE` strings are not followed. None were found among the reached functions'
  calls, but the scan reads text, not a parse tree.
- **Tables and triggers.** The test follows functions only. Tables, triggers and grants are ordered by the migration
  manifest's dependencies, which the composition test applies in full.
