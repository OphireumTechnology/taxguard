# Block 95: case-authority routes mapped one by one

Status: **development checkpoint, stacked on Block 94 (`51957bf`).** Register and one test rule; no server, database
or user interface change.

## Purpose

The register's largest vague entry was `case-authority-scoped`: 74 process-local case-authority routes marked
`PARTIAL`. Its gap said only that the cases router covers part, and that the rest "were not reviewed route by route".
Block 95 does that review. Each route is assigned to the area it serves, and each area names the durable routes that
cover it, or states that none exist and what is needed.

## Result

| Area | Routes | Coverage | Durable replacement, or what is needed |
|---|---|---|---|
| Case and stages | 14 | PARTIAL | Cases router (list, detail, advance, return, hold, notes, team). No durable stage evaluation, invalidation, activation or free-form update. |
| Documents and OCR | 8 | PARTIAL | Vault documents, independent review, download and extraction verification. No scanner is commissioned; release happens by review. |
| Evidence | 2 | PARTIAL | Tax-engine evidence and conclusion traces. Evidence is held as documents and cited calculation inputs. |
| Returns, review, approvals | 6 | PARTIAL | Tax-engine returns, review and final authorization. Final authorization fails closed until the owner's policies are set. |
| Signatures | 3 | PARTIAL | Tax-engine signature package, without signing. Needs an e-signature provider and policy. |
| Reconciliations | 4 | PARTIAL | Durable ledger reconciliation, waiting for the ledger switch (proposal 024). |
| Exceptions and resolutions | 5 | PARTIAL | Tax-engine diagnostics with acknowledgement. No free-form exceptions or Stage 14 resolutions. |
| Workpapers | 3 | PARTIAL | Book-to-tax workpapers with independent review. |
| Records | 4 | NONE | Stage 04 record operation and duplicate resolution: needs the reviewed-fact adapter. |
| Filing and feedback | 6 | NONE | Needs an authorized transmitter and providers; filing is not activated. |
| Monitoring | 3 | NONE | Needs status, deadline and SLA providers and an SLA policy. |
| Planning | 3 | NONE | Needs reviewed facts, authoritative rules and an advisory policy. |
| Renewal and repeat | 5 | NONE | Needs engagement and consent renewal and a rollover contract. |
| Archive, artifacts, reports | 7 | NONE | Archiving needs the retention policy; no durable reports or artifacts. |
| AI review | 1 | NONE | No AI agent is commissioned. |

All refused routes together:

| Coverage | Before Block 95 | After |
|---|---|---|
| `REPLACED` | 28 | 28 |
| `PARTIAL` | 102 | 73 |
| `NONE` | 17 | 46 |

The rise in `NONE` is the review at work: 29 case-authority routes that the coarse entry counted as partly covered have
no durable route at all. Every one of them waits on a provider, a policy or commissioning, not on development alone.

## Test rule

`src/tests/productionRouteInventory.test.ts` refused any refused route as a replacement. Durable ledger
reconciliation is `DURABLE_GATED`: a durable adapter that is refused only until the ledger switch is set. The rule now
admits durable-gated routes and still refuses in-memory and provider-refused ones. A mutation that names an in-memory
operations route as a replacement still fails the test.

## Not covered

Equivalence of rules. Each replacement has its own scope, review and version rules, which are not compared with the
process-local adapter's.
