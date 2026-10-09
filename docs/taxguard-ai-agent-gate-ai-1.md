# TaxGuard AI — Gate AI-1 report

Date: 2026-10-08

## 1. Status

**PASS WITH RESTRICTIONS.** Database and canonical registry foundations are implemented and tested locally. No autonomous agent, A00 orchestrator, AI-2 control plane, provider activation, action executor or production schema cutover has been built or activated in this gate. Production migration files were generated only; no production database was contacted or mutated.

After verifying origin and fetching successfully, `main...origin/main` and `origin/main...HEAD` both returned `0 0`. Created `feature/taxguard-ai-agents` from the unchanged HEAD `8e4735fb9319362c4ff3a5bfd49b9fc5a81ca6dc`, carrying all existing uncommitted dashboard work intact. No stash, reset, clean, commit, merge, rebase, push or deployment occurred.

## 2. Database structures created

22 new tables, with SQL domains for controlled statuses, risk, actions, permissions and data classifications:

- Registry: `ai_agents`, `ai_agent_versions`, `ai_models`, `ai_prompts`, `ai_tools`.
- Permissions/policy: `ai_agent_permissions`, `ai_data_classifications`, `ai_agent_data_permissions`, `ai_workflow_stages`, `ai_stage_permissions`, `ai_human_approval_policies`.
- Execution/evidence: `ai_runs`, `ai_evidence_sources`, `ai_run_evidence`, `ai_proposals`, `ai_verifications`, `ai_verification_evidence`.
- Review/action/events: `ai_human_reviews`, `ai_authoritative_actions`, `ai_security_events`, `ai_policy_events`, `ai_kill_switches`.

These are durable PostgreSQL structures after a separately authorized installation, not deployed production tables. Existing domain schemas and application code are unchanged.

## 3. Migration files

`supabase/migrations/20261008000000_taxguard_ai_registry_foundation.sql` is additive and transactional. It creates keys, composite references, checks, indexes, RLS and integrity triggers, then seeds only inert registry metadata. It does not create triggers that write tax/accounting records. No external model or fake run history is seeded.

Supabase's once-only migration ledger governs application. Untracked duplicate schema installation fails rather than masking drift. A failed installation rolls back atomically. Populated audit history has no destructive down migration; corrective forward migrations require review. Complete compatibility was tested by applying all six original migrations and then AI-1 in an isolated PostgreSQL engine.

## 4. Canonical agent registry

`src/ai/registry.ts` exports frozen canonical metadata. `src/ai/types.ts` defines shared database row contracts, exact agent-ID type, controlled enums and scoped record types. `src/ai/schemaManifest.ts` defines the foundation table inventory. The SQL registry and TypeScript registry are checked for equivalence.

Every entry is DRAFT, with version `1.0.0`, schema version `1`, no default model/prompt, zero token/cost budgets, zero retries and conservative review/confidence thresholds. Registration grants no execution authority. Canonical IDs cannot be renamed or deleted through ordinary row operations.

## 5. A00–A60 count

Exactly 61 agents and 61 initial agent versions. A00 is the unique Supervisor / Orchestrator. Category populations: supervisor 1; client services 4; document intelligence 7; accounting 5; tax intelligence 15; risk/QC 4; sign/file/resolve 7; practice operations 8; governance/security/platform 10. No duplicate or missing ID.

Exact specialized names not assigned by the directive remain category/ID labels, explicitly DRAFT and awaiting the missing approved multipage architecture. These are not invented certified capabilities or built agents.

## 6. Model registry

Versioned model/provider identity, status, approved/prohibited use cases, data limit, token/cost limit, effective date and referentially linked fallback model/version. SYSTEM_SECRET and AUTHENTICATION_DATA cannot be approved model data limits. Model versions used by a run are protected from modification/deletion. No live model approvals are seeded and no existing provider is reconfigured.

## 7. Prompt registry

Agent-bound prompt ID/version, system instructions, required inputs, object output schema, risk/status/effective date and timestamps. Agent/default/run references bind prompt identity to the correct agent. Prompt versions referenced by a run are immutable. No sample production prompt is seeded. Full JSON-schema validation and prompt governance belong to later gates.

## 8. Tool registry

11 DRAFT capability definitions: database.read, document.read, ocr.extract, tax_authority.search, calculation.execute, workflow.read, workflow.propose, message.draft, calendar.read, billing.read, filing.prepare. These are definitions without handlers or global grants; filing preparation is not transmission.

## 9. Permission structures

61 × 11 × 8 = 5,368 explicit DENY tool/resource action entries. Permission domains support READ, CREATE, UPDATE, DELETE, EXECUTE, APPROVE, EXPORT, TRANSMIT and ALLOW/DENY/CONDITIONAL. Wildcard resources are rejected and conditional entries require conditions. All nine classifications are recorded, with 549 DENY data mappings. SYSTEM_SECRET and AUTHENTICATION_DATA mappings are constrained to DENY.

Tenant-scoped human approval policy records support agent/action/risk/confidence/stage/data/materiality/financial threshold. AI-1 conservatively retains the PREPARER → REVIEWER → CPA_EA chain and separation; no policy is seeded to weaken review. Rich policy evaluation and safe approved policy changes are AI-2/later work.

## 10. Stage permissions

1,098 DENY entries cover 61 agents × 18 legacy stages. `LEGACY_18_V1` vocabulary mirrors existing authoritative stage labels. Out-of-range and unregistered vocabulary are rejected. This vocabulary table is not a state machine and does not modify cases or dashboard projections. The architecture-image stage-number discrepancy is documented, not silently resolved.

## 11. AI-run foundation

Versioned agent/model/provider/prompt references, request identity and actor, required tenant/client/case/year scope, existing case-row UUID, workflow vocabulary/stage, hashes, proposed action, confidence/risk, mandatory human-review flag, reviewer/decision, execution time, token/cost usage, timestamps/status and audit reference.

Composite member/client and model/prompt/version references reject orphan records. Case-scope trigger validates caller-supplied scope against the existing persisted case. Run identity is protected; deletion and terminal-run mutation are denied. Full transition orchestration, usage enforcement, immutable transition events and approval routing are later gates. A valid schema row is not authorization to execute a DRAFT agent.

## 12. Evidence foundation

A typed source registry supports DOCUMENT, AUTHORITY, CALCULATION and RULE sources. Document evidence requires an existing document-row UUID and matching tenant/client/case/year/version. Other source types require explicit classification, reference and hash; semantic verification of authorities/calculations is future work. Run evidence references a real source in the exact same scope, with page/field/value/hash and provenance references. Verification/evidence linkage uses real foreign keys rather than unvalidated ID arrays. Evidence/proposal/verification rows are append-only.

## 13. Human-review foundation

Review rows reference the exact proposal/run and scope. Assigned case reviewer identity must match an active tenant member and declared role; preparer and run requester cannot approve their own work. Approval requires verified unexpired CPA/EA/attorney credentials. Completed decisions require a meaningful reason and timestamp. Audit history is append-only: record a new completed decision instead of rewriting a pending record. Active/effective assignment policy and configurable multi-step approvals must also be enforced by future server services; the schema is not a substitute for those controls.

Action records require a linked review and existing scoped audit entry. AUTHORIZED/EXECUTED records require an approved independent review matching the authorizer. These records never apply tax changes; no action execution endpoint exists. Verification/materiality/role/action policy and authoritative action service remain later gates.

## 14. Kill-switch foundation

Tenant-scoped GLOBAL, AGENT, MODEL, TOOL and WORKFLOW switch structures with typed referential targets, reason, activation/deactivation actor and timestamps. Unknown targets and incomplete deactivation are rejected. No switches, UI controls, API or runtime enforcement are activated here; runtime enforcement belongs to AI-2.

## 15. RLS policies

ENABLE and FORCE RLS on all 22 new tables. End-user/public privileges are revoked. No permissive anon/authenticated policies are introduced: access is denied by default, including registry metadata. PostgreSQL tests verify anon/authenticated cannot read or insert even after test-only table grants. Existing RLS/private storage/assignment policies are untouched.

Privileged migration owners and server service-role/BYPASSRLS connections are not end-user authorization. Future server services must authenticate actor, tenant, client, case/year and effective assignment before privileged access. No broad staff/tenant-wide client access or frontend secret is introduced.

## 16. Tests added

75 new tests across `aiRegistryFoundation.test.ts` and `aiLegacyProductionBoundary.test.ts` cover registry completeness/category counts, SQL/TS parity, invalid identities/versions/models/prompts/permissions/stages, default denial, SYSTEM_SECRET rejection, scope/hash/status constraints, orphan governance records, document/version evidence links, immutable versions/history, independent reviewer/mandatory reason, pending-review action rejection, kill-switch targets/deactivation, RLS and unreleased legacy extraction/AI routes.

Two existing migration-inventory tests were extended to preserve the exact six existing files and assert the seventh migration. No tests were removed or disabled. Tests run against isolated PGlite PostgreSQL and local HTTP servers, never live Supabase or paid providers.

## 17. Total test result

Final full suite: **118 files / 1,872 tests passed**, including all 75 new AI-1 tests. Initial failures (SQL generation syntax and two migration-count expectations) were diagnosed and repaired; final results refer to the repaired tree.

## 18. Typecheck result

`npm.cmd run typecheck`: PASS (`tsc --noEmit`).

## 19. Lint result

`npm.cmd run lint`: PASS. Configured lint currently runs `tsc --noEmit`; no separate style/security linter is configured.

## 20. Build result

`npm.cmd run build`: PASS for Vite frontend and esbuild server. Existing warnings remain: LiveCalendarModule has both static/dynamic imports; main frontend chunk is approximately 1,434 kB, above the 850 kB warning threshold. No deployment occurred.

## 21. Legacy compatibility findings

See `docs/taxguard-ai-legacy-mapping.md` for KEEP/MIGRATE/ADAPT/DEPRECATE/REMOVE-LATER dispositions, the full stage comparison, exact memory-authority location/record inventory/restart and concurrency risks, migration target and sample extraction paths.

Legacy sample extraction at `src/server/aiExtraction.ts` is called by legacy document upload/reprocess handlers mounted in the development server. The inspected production boundary does not release those routes. Tests assert production 503/API_NOT_RELEASED; a deployment exposing them without that boundary is BLOCKING. No replacement OCR output is fabricated and no existing route is removed by AI-1.

## 22. Remaining blockers/restrictions

- Missing approved architecture pages 9/10 and exact specialized-agent naming/permission values; metadata remains inert pending verification.
- In-memory case authority has not been cut over to PostgreSQL. AI-run FKs require genuinely persisted cases/documents/members; no automatic memory-to-Supabase migration is performed.
- Legacy versus image workflow semantics require an approved mapping before permission grants or stage execution.
- No governance evaluator, A00 runtime, tool execution, approved prompt/model, provider commissioning, budget enforcement, kill-switch enforcement, independent evidence verifier, action service or control center is implemented by this gate.
- Existing malware-scanner/OCR commissioning and fixed-sample extraction hazards remain documented. Configuration flags are not verified processing evidence.
- This is local schema/contract validation, not live Supabase RLS deployment acceptance or production AI readiness. Migration review/install/cutover require separate authorization.

## 23. Files changed and Git status

Added:

- `supabase/migrations/20261008000000_taxguard_ai_registry_foundation.sql`
- `src/ai/types.ts`
- `src/ai/registry.ts`
- `src/ai/schemaManifest.ts`
- `src/tests/aiRegistryFoundation.test.ts`
- `src/tests/aiLegacyProductionBoundary.test.ts`
- `docs/taxguard-ai-legacy-mapping.md`
- `docs/taxguard-ai-agent-gate-ai-1.md`

Modified (test inventory only):

- `src/tests/stageTwoStorageAndAssignmentGovernance.test.ts`
- `src/tests/supabaseProductionInfrastructure.test.ts`

All other modified/untracked dashboard files predate AI-1 and remain preserved. The AI-0 baseline is retained. Branch is `feature/taxguard-ai-agents`; working tree remains uncommitted and dirty by design. `git diff --check` is checked at delivery, along with whitespace checks for new untracked files. The hardening backup remains untracked and untouched.

**STOP AFTER AI-1. Await explicit authorization for AI-2.**
