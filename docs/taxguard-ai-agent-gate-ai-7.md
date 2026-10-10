# AI-7 Client Services mapping and restricted implementation

Status: PASS WITH RESTRICTIONS for the proven mapping/denial scope. A01-A04 are NOT built specialized agents. Their individual responsibilities cannot be proven, so their capability/stage grants remain empty and execution remains unavailable.

The user-authorized deny-and-continue rule supersedes the earlier mapping blocker. Repository instructions, canonical registry/schema, AI-0 through AI-6 reports, legacy mapping, persisted workflow, authorization/capability code, assignment/RLS rules, dashboard references and tests were reconciled. No per-ID client-service responsibility was found. Group-level functions do not establish individual authority.

## Files changed in this gate

- Added src/ai/architectureMapping.ts: frozen canonical 61-entry mapping and explicit client-service authority restriction.
- Added src/tests/aiArchitectureMapping.test.ts: 10 registry/mapping integrity tests.
- Modified src/server/ai/governance/GovernanceControlPlane.ts: authenticated, scoped, lifecycle-checked A01-A04 refuse AI_AGENT_AUTHORITY_UNMAPPED, even if SQL grants are accidentally broadened.
- Modified src/tests/aiGovernanceControlPlane.test.ts: four disposable-SQL synthetic ACTIVE/ALLOW denial tests; immutable scoped refusal evidence; no AI run created.
- Modified src/tests/aiA00Orchestration.test.ts: eight unmapped client-service routing refusals asserting zero underlying handler calls and zero provider runs.
- Added docs/taxguard-ai-canonical-architecture.md and docs/README.md.
- Updated AI-7 pre-review and autonomous checkpoint to remove the superseded approval blocker.
- Added this report.

## Security and integrations

No new provider, handler, API, model, prompt, permission seed or migration. Existing fresh server identity, role, assignment, tenant/client/case/year and stage checks precede the mapping denial. Human review, independent reviewer, evidence version/hash/release/CLEAN state, kill switches, replay and immutable history remain controlling. A00 does not inherit or confer child authority. Legacy cutover refusals remain unchanged. No production action or backup access.

The existing operations ClientRequestService has process-local Map state: it is not substituted for durable agent authority. Client communications, identity verification, engagement acceptance and appointments remain unavailable as agent operations.

## Validation

Complete suite: 126 files, 2,393 tests PASS (22 added). Targeted mapping/governance/orchestration: 203 tests PASS. Disposable PGlite exercises all existing migrations and scoped denials; no persistent/production migration applied. Typecheck PASS; configured lint PASS; frontend/server production build PASS, with existing chunk-size/mixed-import warnings. git diff --check PASS. Branch feature/taxguard-ai-agents; existing uncommitted work preserved. No commit, push, merge, rebase or deployment.

## Next gate

Proceed automatically to AI-8 Document Intelligence using explicitly named identities and proven narrow functions. Classification/OCR/fraud/evidence creation must not be fabricated or activated. Missing optional privileges remain denied; actual production commissioning remains blocked. Completion of this restricted scope does not claim the full client-services ecosystem is built.
