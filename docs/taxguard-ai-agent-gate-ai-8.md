# AI-8 Document Intelligence - bounded duplicate advisory

Status: PASS WITH RESTRICTIONS for the narrow proven A10 advisory. A10 DOCUMENT_DUPLICATE_CHECK checks selected authorized document metadata. The full A05-A11 pipeline is not built.

## Architecture

The registry explicitly names A10 Duplicate / Fraud Check. Existing document.read returns exact scoped version/hash/release/CLEAN metadata with current assignment checks. Deterministic hash comparison supports duplicate-byte advisory without content export, provider execution or fabricated extraction. Stage 03 is persisted VALIDATE. All deployment agents stay DRAFT.

A00 routes the fixed purpose to A10; governance independently limits it to Stage 03, ADVISORY, document.read READ, INTERNAL metadata and ten selected evidence IDs. The server-owned handler uses existing capability admission, audit/provenance, replay, kill switches and scope validation. Two references to one document are not two duplicate documents. Matching distinct-document hashes produce EVIDENCE_REQUIRED for human resolution; no matches still require human review and make no whole-case completeness or fraud claim. GovernedAIGateway refuses provider transport for this deterministic purpose.

## Changed files

- Added src/server/ai/documents/DocumentDuplicateAdvisory.ts and src/tests/aiDocumentDuplicateAdvisory.test.ts.
- Added supabase/migrations/20261008060000_taxguard_ai_document_advisory_routing.sql.
- Modified orchestration/contracts.ts and canonicalRouting.ts, governance/GovernanceControlPlane.ts, gateway/GovernedAIGateway.ts, src/ai/architectureMapping.ts.
- Updated migration inventories in stageTwoStorageAndAssignmentGovernance.test.ts and supabaseProductionInfrastructure.test.ts.
- Updated canonical architecture/checkpoint and added this report.

## Database and restrictions

The minimum additive migration expands only the existing purpose constraint. No tables, grants, activation, business data, history replacement or RLS changes. Historical rows stay valid. Testing uses disposable PGlite only.

A05 intake, A06 classification, A07 OCR, A08 extraction validation, A09 unmapped function, A11 evidence creation and A10 fraud analysis remain unavailable as governed specialized executions. Existing document-intelligence types/legacy implementations remain intact. Hash matching is not identity proof or a financial fact. No fixed sample extraction, memory authority fallback, Gemini or legacy bypass. No tax/accounting mutation, workflow advancement, communication or production action.

Next: AI-9 accounting responsibility audit. Missing per-ID privileged mappings stay denied. A01-A04 remain unavailable and unbuilt.

## Validation

127 files / 2,420 tests PASS; 27 new targeted tests PASS, including scoped SQL/A00/capability integration, actual hash match, same-document reference deduplication, role/lifecycle/assignment/scope/evidence/maker-checker/stage denials, kill switches, root replay and zero provider calls. All thirteen migrations were exercised in disposable PGlite fixtures. Typecheck PASS, configured lint PASS, frontend/server build PASS with unchanged chunk/mixed-import warnings; git diff --check PASS. All original regressions retained. Branch feature/taxguard-ai-agents, approved dirty tree preserved; no commit, publication or production action.
