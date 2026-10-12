# Tax engine foundation (Phase 5)

**PRODUCTION STATUS: NO-GO. TaxGuard ships no tax rules.** Proposal 033
(`20261012330000_taxguard_tax_engine_foundation.sql`) is **not applied**. Stages 9-18 remain
**blocked** (proposal 026 policy unchanged); every calculation response carries `returnUse: BLOCKED`.
All sources, rule sets and values in the repository are **synthetic test fixtures** (`synthetic_test`
authority type, jurisdiction code `ZZ`), never tax law.

## Building blocks

| Requirement | Implementation |
| --- | --- |
| Decimal money | Existing `TaxDecimal` (BigInt fixed point, explicit rounding modes). Inputs and parameters are decimal **strings**; any JavaScript number is refused (`TAX_ENGINE_FLOAT_REJECTED`). `0.1 + 0.2 = 0.3` exactly. |
| Rule-set format | `ruleSetDefinition.ts`: a rule-agnostic, straight-line declarative program — `sum`, `subtract`, `multiply` (explicit scale + rounding), `min`, `max`, `floor_zero`, `round` — over `input:`, `param:`, `const:` and **earlier** `step:` references only (no loops, recursion or dynamic code, so it always terminates). Validation rejects forward/self references, unknown ops, missing scales, float-like values and parameters without a source and pinpoint citation. |
| Source-of-law references | `taxguard_tax_sources`: authority type (statute, regulation, form instructions, publication, revenue procedure/ruling, notice, state statute/regulation/guidance, `synthetic_test`), issuer, citation, https URL, applicable tax years. **PROPOSED → VERIFIED by a reviewer other than the registrant**, recording the SHA-256 of the document they checked. Synthetic sources are flagged and taint any rule set and run that cites them. |
| Tax-year and rule-set versioning | `taxguard_tax_rule_sets`: versions per (jurisdiction, code, return family, tax year), serialized. `DRAFT → PENDING_REVIEW → APPROVED / REJECTED`; approval supersedes the previous approved version (one approved version per key, enforced by a partial unique index). Every cited source must be VERIFIED **for that tax year** to submit and to approve. Definition, hash and identity are frozen once submitted (trigger). |
| Deterministic interface | `evaluateRuleSet(definition, request)` is pure: canonical JSON (sorted keys, no numbers) → SHA-256 of the definition, the normalized inputs (order-independent, evidence sorted) and the outputs + trace. Same inputs ⇒ byte-identical result. |
| Calculation provenance | Each run stores engine version, rule-set id + hash, input hash, output hash, inputs with evidence IDs, outputs and a step trace in which every parameter carries its source ID and citation. Runs are immutable (trigger). |
| Pinning and integrity | Before evaluating, the server re-hashes the stored definition and refuses a mismatch (`TAX_RULE_SET_INTEGRITY`); the database refuses a hash that differs from the approved one. Runs are idempotent per (case, rule set, input hash); a different output for the same pinned inputs is refused as `TAX_ENGINE_NONDETERMINISM`, and that refusal is **audited and committed** (found by the tests: a raised exception had rolled its own audit row back). |
| Human review boundaries | Rule sets: approved only by a reviewer other than the preparer. Runs: `COMPUTED → REVIEW_APPROVED / REVIEW_REJECTED` only by the **case's reviewer**, never by the requester, once, with a note. Runs only on APPROVED rule sets whose tax year equals the case's. A reviewed run is evidence for review, not a return. |
| Synthetic fixtures | `syntheticFixtures.ts` (`SYNTHETIC-SOURCE-1`, `SYN-1`, `ZZ`, arbitrary values). |

## API (`/api/tax-engine`, development only)

`GET|POST /sources`, `POST /sources/:id/verify`, `GET /rule-sets[?taxYear]`, `GET /rule-sets/:id`,
`POST /rule-sets`, `POST /rule-sets/:id/(submit|approve|reject)`, `GET|POST /cases/:caseId/runs`,
`POST /runs/:runId/(approve|reject)`. Clients, recruiters and bookkeepers are refused. Managers may
register sources and draft / submit rule sets (capability list, decision HC5); verification and
approval need a reviewer.

## Tests

`taxEngineFoundation.test.ts` (14: exact decimals, determinism and hash sensitivity, filing-status
parameter resolution, refusals, nine invalid-definition cases), `taxEngineHttp.test.ts` (7: source
maker-checker, versioning and supersession, unverified-source refusal, immutability, approved-only and
tax-year pinning, idempotent replay, audited nondeterminism refusal, tamper detection by re-hash,
reviewer-only single review, stage 9 still blocked, tenant isolation, grants), browser-suite
`07-tax-engine` (real server and capability lists end to end).

## What is deliberately not here

No federal or state rule content, brackets, thresholds, rates or forms; no return generation; no
e-file. Commissioning a real rule set requires the firm to register and verify actual sources, author
and independently approve the rule set, and a separate decision to unblock stage 9 — none of which is
assumed.

## Source-cited verification cases (proposal 036, added 2026-10-13)

Approval by reading is not evidence that a rule set computes what its sources say. Proposal 036
(`20261012360000_taxguard_tax_rule_verification_cases.sql`, **not applied**) adds worked cases:
inputs as exact decimal strings, expected outputs, and the **verified** source (with pinpoint
citation, e.g. a published worksheet example) the expectation comes from. Cases can be added or
removed only while the rule set is a DRAFT. `POST /rule-sets/:id/run-tests` evaluates every case
with the deterministic engine (exact decimal comparison; any engine error fails that case with its
code) and records an **immutable** run pinned to the definition hash, the case-set hash (recomputed
by the database) and the engine version. Submitting and approving (superseded 033 transition,
generated with anchored patches) require at least one case and a recorded **all-passing run for the
current content and case set**; adding a case after a run invalidates it. TaxGuard ships no cases.

Tests: `taxRuleVerificationCases.test.ts` (4; removing the submission gate fails 3), browser-suite
`07-tax-engine` updated (a case is required and must pass before submission on the real server).
