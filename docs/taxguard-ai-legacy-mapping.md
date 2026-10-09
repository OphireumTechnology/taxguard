# TaxGuard AI legacy compatibility map — AI-1

Date: 2026-10-08. Scope: schemas and inert registries. No runtime cutover.

## Disposition

| Existing implementation | Disposition | Canonical target / restriction |
| --- | --- | --- |
| Gate 2–8 shared shell, dashboards, scoped services and tests | KEEP | No source changes. Registry does not confer dashboard or backend privileges. |
| `server/ai/OpenAIReasoningProvider.ts` | ADAPT later | Counts-only provider becomes a governed model/prompt gateway in AI-4. No model/prompt approval is seeded in AI-1. |
| `server/ai/TaxGuardOpenAIService.ts` | ADAPT later | Existing helper remains unchanged; migrate request/proposal provenance to audited runs after A00/governance/durable adapter exist. |
| `server/ai/TaxGuardAiAudit.ts` and static decision trace/review components | MIGRATE later | Replace process-memory ledger authority with durable scoped events/runs. Preserve historical data through a separately approved cutover. |
| Intelligence evidence, rule/knowledge registries and governance boundary | KEEP / ADAPT | Reuse deterministic validation and scoped provenance; add independently verified evidence in later gates. |
| Federal/state deterministic calculation contracts | KEEP | LLM remains advisory; no calculation engine rewrite or claimed new jurisdiction support. |
| Supabase sessions, RBAC, assignment checks, private storage, existing RLS | KEEP | New tables deny end-user access; no existing policy is broadened. |
| Gemini gateway | DEPRECATE / KEEP disabled | No working provider; do not treat its labels as active model approval. No deletion in AI-1. |
| Local heuristic OCR and explicit `src/demo` AI | KEEP inside development/test/demo boundaries | Not production evidence or agent execution. |
| Legacy fixed-value `aiExtraction.ts` | REMOVE-LATER after replacement | Production release must continue to reject the legacy document routes. Do not infer extraction from fixed values. |
| `tools/taxguard-agent*` developer automation | KEEP, unrelated | Not A00, no migration into taxpayer-serving runtime. |

## Canonical identities

The new IDs are exactly A00–A60. There are no existing numbered application agents to rename or merge. A00 is Supervisor / Orchestrator. Categories follow the directive's exact ranges. Names explicitly associated with IDs in the directive are retained (A05/A06/A07/A08/A10/A11/A18/A19/A28/A30/A31/A34). Other entries use category/ID labels and explicitly state that exact specialized names require the missing approved architecture mapping. They remain DRAFT with zero token/cost budgets, no model/prompt binding and only DENY permissions. These entries are registry metadata, not built agents or approved tax capabilities.

## Workflow compatibility

The new stage vocabulary `LEGACY_18_V1` reflects `src/server/taxguard/persistence.types.ts`, not a new workflow engine. All 61 × 18 stage permissions are DENY. No stage mutation service, stage execution or competing persisted state is introduced.

| Stage | Existing authority | Architecture image |
| --- | --- | --- |
| 01 | Onboard | Onboard |
| 02 | Collect | Collect |
| 03 | Validate | Validate |
| 04 | Record | Record |
| 05 | Reconcile | Categorize |
| 06 | Review | Reconcile |
| 07 | Report | Analyze |
| 08 | Plan | Adjust |
| 09 | Prepare Taxes | Summarize |
| 10 | Approve | Prepare |
| 11 | Sign | Review |
| 12 | File | Quality Check |
| 13 | Government Feedback | Approve |
| 14 | Resolve | Sign |
| 15 | Monitor | File |
| 16 | Archive | Deliver |
| 17 | Renew | Close |
| 18 | Repeat | Repeat |

This table compares semantics; it is not an authorized one-to-one transition mapping. No automatic renumbering is safe. An approved compatibility mapping or controlled migration remains required before granting AI stage permissions. The permission matrix on the missing architecture page 9 is not invented.

## In-memory case authority: no silent cutover

Location: `src/server/taxguard/transactionalDatabase.ts`, exported `globalAuthorityDatabase`. `src/server/routes/case-authority.routes.ts` constructs `TaxGuardAuthorityRepository` against that instance, including the AI-review path. The repository stores scoped cases, members/assignments, stage/gate state, documents/extracted values, tax/accounting records, reconciliations, exceptions, workpapers, reviews/approvals, signature/filing/lifecycle artifacts, evidence, AI requests/proposals/provider provenance, decision traces, review requests and audit/idempotency records in document-style paths.

Records are held in a process-local Map. Restart loses them unless another layer separately persists/reconstructs a particular record; no complete durable adapter was found. Transactions serialize on a process-local promise queue and clone a snapshot. This prevents some same-process races but does not coordinate multiple server instances or provide PostgreSQL durability. Revision/idempotency controls are not distributed locks in this implementation.

Migration target: a server-authoritative PostgreSQL adapter using existing `taxguard_*` domain tables plus the AI-1 `ai_*` foundations. The new AI tables reference existing persisted case rows, members, documents and audit IDs. They are not populated from memory automatically and cannot assume a memory-only case exists in PostgreSQL. Data inventory, reconciliation, authorized history export/import, distributed transaction design, shadow validation and explicit cutover authorization are future work. Existing production durability guards remain in place.

## Fixed sample extraction reachability

`src/server/aiExtraction.ts:70` creates predetermined W-2/1099/bank-style fields and fixed confidence values; input content is not a source of verified financial extraction. All application call sites found are `src/server/routes/documents.routes.ts` at the upload and reprocess handlers (approximately lines 291 and 457). `server.ts` mounts the router at `/api/documents` around line 423. The upload handler also supplies a sample-content fallback. This is unsafe for real taxpayer documents even if an advisory review notice appears.

For the current `NODE_ENV=production` entry point, `server.ts` delegates `/api` requests to `createProductionApp` before the legacy mounts. That app does not release `/api/documents`; its unknown-API boundary returns 503 rather than falling through. Therefore these sample-extraction handlers are development-reachable, not released through the inspected production routing. Tests of that boundary are retained and extended in AI-1. A deployment using the legacy server paths without the production boundary would be **BLOCKING** for production readiness. No replacement extraction output is fabricated, and no route is silently removed here.

Cloud OCR needs commissioned transport, authorized vault retrieval, timeout/confidence hardening and a verified malware scanner. Those gaps remain explicitly blocking for a real end-to-end W-2 production pipeline.

## Migration operation and rollback

`20261008000000_taxguard_ai_registry_foundation.sql` is a single transaction, additive to existing domain tables; it changes no existing application route or existing RLS policy. Supabase's migration ledger provides once-only application. It intentionally fails on an untracked duplicate schema rather than hiding drift with blanket IF NOT EXISTS. Seed IDs are deterministic, with no production execution history, model approval or prompt seed.

A failed migration rolls back transactionally. No destructive down migration is supplied for a populated audit ledger: dropping AI history is forbidden normal behavior. Before any separately approved installation, use a disposable database to verify it, preserve a schema backup, and use a reviewed corrective forward migration after deployment. An empty local schema can be discarded only within an explicitly disposable test environment. No production migration was executed by AI-1.

## AI-2 controlled compatibility layer (2026-10-08)

The canonical registry remains unchanged and DRAFT. `src/server/ai/governance/legacyCompatibility.ts` maps the existing counts-only OpenAI purposes REVIEW_EVIDENCE_COMPLETENESS and IDENTIFY_REVIEW_QUESTIONS to A34 for governance classification. This does not claim that the existing helper is a complete built A34 agent.

The existing case-authority HTTP AI-review route now uses that adapter. The new server governance layer re-verifies a durable session, scoped persisted membership and effective client/engagement/year plus case assignments. A memory-only evidence ID is not relabeled as durable provenance. Missing production governance configuration/schema returns AI_GOVERNANCE_UNAVAILABLE; missing evidence mapping returns AI_LEGACY_EVIDENCE_MAPPING_REQUIRED; a successful governance assessment still returns AI_LEGACY_CUTOVER_REQUIRED instead of dispatching the legacy provider. This is an intentional fail-closed restriction, not fabricated successful migration.

Existing internal OpenAI helper/provider implementations and their passing tests are retained. They are trusted legacy server interfaces without newly exposed HTTP execution access. The disabled Gemini gateway and unreleased fixed-sample extraction routes remain disabled/unreleased. They must not be repurposed as an A00 bypass.

The new `ai_governance_decisions` migration stores policy evaluations and denials, not AI execution history. It does not migrate existing memory state or create fake ai_runs. A00 dispatch, durable run creation, full provider gateway, source authority verification, human decision recording and authoritative action cutover remain later gates. No application table, RLS grant, workflow number or taxpayer record was rewritten to fit canonical naming.

## AI-3 orchestration boundary (2026-10-08)

KEEP existing legacy providers/helpers, dashboard modules and LEGACY_18_V1 business authority. ADAPT the two existing review purposes into canonical A00 planning with A34 child identities, minimum metadata and fresh independent governance. The new coordinator has no production handlers or released dispatch endpoint. Isolated test handlers prove routing only; they are not implemented specialists or migrated provider execution.

The append-only orchestration root/event tables preserve scoped correlation, purposes, decisions, replay reservations and test outcomes without creating fake ai_runs. They do not import memory-backed authority or grant final action rights. MIGRATE-LATER provider usage/full run transitions, durable case/evidence authority and audited human/action services under the approved later gates. All AI-2 legacy unavailable/evidence-mapping/cutover refusals remain controlling.

## AI-4 governed gateway boundary (2026-10-08)

KEEP legacy reason() helpers and public cutover refusals unchanged. ADAPT OpenAI transport through a separate governed compatibility method using trusted model/prompt/schema and isolated SDK doubles. The gateway owns fresh authorization, minimum durable run admission, versioned pricing/reservations, attempts and nullable usage/cost accounting. Existing recorded accounting values are preserved; new unknown run accounting has no zero default.

The initial gateway accepts only the two previously mapped A34 purposes and a narrow counts-review output profile. It does not convert legacy prose or confidence categories into verified findings/numerical confidence. No live provider factory, taxpayer-content export, fallback dispatch or production handler is commissioned. A00 integration is test-only and does not grant child authority or multiply retries. All deployment registrations remain DRAFT.

MIGRATE-LATER full execution transitions/correlation, durable case/evidence cutover, independently verified authorities, general tool handlers, human decision/action services and production admission/recovery commissioning. Do not infer these are complete from a valid isolated gateway run. Disabled Gemini and unreleased fixed-sample extraction remain outside production execution.
