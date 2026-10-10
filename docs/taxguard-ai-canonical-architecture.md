# TaxGuard canonical A00-A60 architecture and authority mapping

Version 1.0.0, 2026-10-08. This is the canonical architecture index for future agent gates. Identity metadata remains in src/ai/registry.ts; executable governance remains server-side. This document does not grant a permission or commission a provider.

## Reconciliation and source order

No applicable AGENTS.md was found. Repository-wide searches excluded the protected backup, dependencies, build outputs and Git internals. Sources reconciled: src/ai/registry.ts and AI foundation migration; AI-0 through AI-6 reports/implementation; taxguard-ai-legacy-mapping.md; persistence.types.ts STAGE_NAMES; governance/SqlGovernanceStore and GovernanceControlPlane; capabilities/CapabilityRegistry and ScopedReadRepository; gateway/ModelPromptResolver; orchestration/canonicalRouting; current assignment/RLS tests; dashboard gate reports and supplied architecture-workflow/masterplan references.

The multipage Architecture Overview and its page-9 matrix are absent. No evidence assigns the six client-service functions to four individual IDs. The user's mapping-resolution instruction authorizes explicit denial rather than inventing that assignment. The earlier AI-7 request for another mapping approval is superseded.

## Common controlling boundary

Every deployment registration A00-A60 remains DRAFT. No deployment stage, model, prompt, token/cost budget or capability permission is enabled by this map. Existing database permissions remain DENY. Synthetic ACTIVE fixtures are test-only.

Authorization requires a verified server session, current active permitted role, exact tenant/client/case/tax-year, effective client/engagement/year and case assignment, actual LEGACY_18_V1 stage, matching agent/version/model/prompt lifecycle and independently authorized capability/data policy. Parent authorization is not inherited. SYSTEM_SECRET and AUTHENTICATION_DATA are prohibited.

Evidence requires exact authorized source identity, document version/hash, matching tenant/client/case/year, released/verified status and CLEAN quarantine. Document contents are untrusted and cannot authorize tools, prompts, endpoints or actions. Evidence metadata is not proof of taxpayer identity, engagement acceptance, signature or communication.

Human review remains mandatory for material/advisory proposals: PREPARER -> REVIEWER -> CPA/EA where policy requires, independent reviewer, no self-approval. All final tax/accounting changes, workflow advancement, signatures, filing, payments and autonomous client communication remain prohibited. Unknown responsibilities/capabilities are UNMAPPED / DENIED PENDING GOVERNANCE APPROVAL.

Applicable GLOBAL/AGENT/MODEL/TOOL/WORKFLOW kill switches are rechecked by existing governance/gateway/capability boundaries. Denial occurs before handlers/provider calls. Immutable scoped decisions, root/child/run/attempt/capability correlation, evidence references and terminal history remain required. Failure of required durable admission/audit fails closed; no memory authority fallback.

## A00-A04 explicit mapping

| ID | Canonical name | Proven responsibility | Allowed stages | Read | Proposal | Execution |
| --- | --- | --- | --- | --- | --- | --- |
| A00 | Supervisor / Orchestrator | Coordinate the two established A34 review purposes; not a superuser | No deployment grant; actual stage independently checked | Existing bounded workflow.read compatibility only, subject to all governance | None | None in production |
| A01 | CLIENT SERVICES 01 | Client Services group member; individual responsibility UNMAPPED | None | None | None | None |
| A02 | CLIENT SERVICES 02 | Client Services group member; individual responsibility UNMAPPED | None | None | None | None |
| A03 | CLIENT SERVICES 03 | Client Services group member; individual responsibility UNMAPPED | None | None | None | None |
| A04 | CLIENT SERVICES 04 | Client Services group member; individual responsibility UNMAPPED | None | None | None | None |

For each A01-A04: permitted stages/read/proposal/execution/data grants are empty. Required authorization context, scope, assignments, evidence, human review, maker-checker, kill switches and audit are the common boundary above, but meeting them does not overcome the missing individual responsibility. Server governance explicitly returns AI_AGENT_AUTHORITY_UNMAPPED after authenticated scope/lifecycle checks, even when isolated ACTIVE fixtures have SQL ALLOW grants. No handler is registered. Identity verification, onboarding, engagement, communication, appointment and support functions remain group-level intentions, not per-ID permissions.

## A05-A60 and bounded compatibility

All canonical names/categories from the registry are preserved. Named responsibilities do not establish a safe executable implementation. Missing per-ID stages, tools/data permissions and evidence mappings remain DRAFT / UNMAPPED and denied; do not copy another agent's grants. A34 alone has the existing narrowly documented IDENTIFY_REVIEW_QUESTIONS and REVIEW_EVIDENCE_COMPLETENESS compatibility classification. Its counts-only gateway and metadata-read capability infrastructure remain isolated-test boundaries, not a commissioned specialist.

The companion src/ai/architectureMapping.ts contains exactly 61 immutable mapping entries and preserves registry names/categories. Its empty deployment grants are a ceiling, not a replacement for server policy. Extend proven mappings only through reviewed source evidence and security regression coverage.

AI-8 adds a bounded A10 DOCUMENT_DUPLICATE_CHECK classification: only LEGACY_18_V1 stage 03, ADVISORY, document.read READ, INTERNAL metadata, 1-10 exact selected authorized evidence sources. It computes matching hashes among distinct selected documents; it does not assess fraud or authorize deletion, broader search, raw bytes, provider transport, OCR or extracted tax facts. Runtime policy requires independent A00 and A10 authorization plus current assignments/evidence/kill switches and durable capability/orchestration history. Production registrations/grants remain unchanged and DRAFT. BOUNDED_COMPATIBILITY denotes narrowly tested infrastructure, not a fully built Duplicate/Fraud specialist.

## Workflow authority

LEGACY_18_V1 remains: 01 Onboard, 02 Collect, 03 Validate, 04 Record, 05 Reconcile, 06 Review, 07 Report, 08 Plan, 09 Prepare Taxes, 10 Approve, 11 Sign, 12 File, 13 Government Feedback, 14 Resolve, 15 Monitor, 16 Archive, 17 Renew, 18 Repeat. Visual masterplan numbers after stage 04 are not persisted identities. No renumbering or implicit compatibility grant is authorized.

## Legacy and subsequent gates

Keep legacy public cutover/evidence refusals; disabled Gemini and fixed-sample extraction stay excluded from production. Existing clientRequest.service.ts contains a process-local Map and must not be treated as durable authority by AI agents. Existing domain service availability does not itself assign an agent responsibility.

AI-7 completes the mapping/denial boundary only; A01-A04 are not built specialized agents. Continue subsequent non-production gates using proven narrow responsibilities. Optional missing privileges stay denied and documented; production commissioning, destructive changes and security conflicts retain hard stops.

## Complete preserved identity inventory

| ID | Canonical name | Category | Deployment | Mapping |
| --- | --- | --- | --- | --- |
| A00 | Supervisor / Orchestrator | SUPERVISOR | DRAFT | BOUNDED_COMPATIBILITY; no production grant |
| A01 | CLIENT SERVICES 01 | CLIENT_SERVICES | DRAFT | UNMAPPED / DENIED |
| A02 | CLIENT SERVICES 02 | CLIENT_SERVICES | DRAFT | UNMAPPED / DENIED |
| A03 | CLIENT SERVICES 03 | CLIENT_SERVICES | DRAFT | UNMAPPED / DENIED |
| A04 | CLIENT SERVICES 04 | CLIENT_SERVICES | DRAFT | UNMAPPED / DENIED |
| A05 | Document Intake | DOCUMENT_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A06 | Document Classification | DOCUMENT_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A07 | OCR / Extraction | DOCUMENT_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A08 | Extraction Validation | DOCUMENT_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A09 | DOCUMENT INTELLIGENCE 09 | DOCUMENT_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A10 | Duplicate / Fraud Check | DOCUMENT_INTELLIGENCE | DRAFT | BOUNDED_COMPATIBILITY; no production grant |
| A11 | Evidence | DOCUMENT_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A12 | ACCOUNTING 12 | ACCOUNTING | DRAFT | UNMAPPED / DENIED |
| A13 | ACCOUNTING 13 | ACCOUNTING | DRAFT | UNMAPPED / DENIED |
| A14 | ACCOUNTING 14 | ACCOUNTING | DRAFT | UNMAPPED / DENIED |
| A15 | ACCOUNTING 15 | ACCOUNTING | DRAFT | UNMAPPED / DENIED |
| A16 | ACCOUNTING 16 | ACCOUNTING | DRAFT | UNMAPPED / DENIED |
| A17 | TAX INTELLIGENCE 17 | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A18 | Federal Tax Analysis | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A19 | State Tax Analysis | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A20 | TAX INTELLIGENCE 20 | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A21 | TAX INTELLIGENCE 21 | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A22 | TAX INTELLIGENCE 22 | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A23 | TAX INTELLIGENCE 23 | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A24 | TAX INTELLIGENCE 24 | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A25 | TAX INTELLIGENCE 25 | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A26 | TAX INTELLIGENCE 26 | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A27 | TAX INTELLIGENCE 27 | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A28 | Calculation Verification | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A29 | TAX INTELLIGENCE 29 | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A30 | Form Mapping | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A31 | Diagnostics | TAX_INTELLIGENCE | DRAFT | UNMAPPED / DENIED |
| A32 | RISK QC 32 | RISK_QC | DRAFT | UNMAPPED / DENIED |
| A33 | RISK QC 33 | RISK_QC | DRAFT | UNMAPPED / DENIED |
| A34 | Reviewer Support | RISK_QC | DRAFT | BOUNDED_COMPATIBILITY; no production grant |
| A35 | RISK QC 35 | RISK_QC | DRAFT | UNMAPPED / DENIED |
| A36 | SIGN FILE RESOLVE 36 | SIGN_FILE_RESOLVE | DRAFT | UNMAPPED / DENIED |
| A37 | SIGN FILE RESOLVE 37 | SIGN_FILE_RESOLVE | DRAFT | UNMAPPED / DENIED |
| A38 | SIGN FILE RESOLVE 38 | SIGN_FILE_RESOLVE | DRAFT | UNMAPPED / DENIED |
| A39 | SIGN FILE RESOLVE 39 | SIGN_FILE_RESOLVE | DRAFT | UNMAPPED / DENIED |
| A40 | SIGN FILE RESOLVE 40 | SIGN_FILE_RESOLVE | DRAFT | UNMAPPED / DENIED |
| A41 | SIGN FILE RESOLVE 41 | SIGN_FILE_RESOLVE | DRAFT | UNMAPPED / DENIED |
| A42 | SIGN FILE RESOLVE 42 | SIGN_FILE_RESOLVE | DRAFT | UNMAPPED / DENIED |
| A43 | PRACTICE OPERATIONS 43 | PRACTICE_OPERATIONS | DRAFT | UNMAPPED / DENIED |
| A44 | PRACTICE OPERATIONS 44 | PRACTICE_OPERATIONS | DRAFT | UNMAPPED / DENIED |
| A45 | PRACTICE OPERATIONS 45 | PRACTICE_OPERATIONS | DRAFT | UNMAPPED / DENIED |
| A46 | PRACTICE OPERATIONS 46 | PRACTICE_OPERATIONS | DRAFT | UNMAPPED / DENIED |
| A47 | PRACTICE OPERATIONS 47 | PRACTICE_OPERATIONS | DRAFT | UNMAPPED / DENIED |
| A48 | PRACTICE OPERATIONS 48 | PRACTICE_OPERATIONS | DRAFT | UNMAPPED / DENIED |
| A49 | PRACTICE OPERATIONS 49 | PRACTICE_OPERATIONS | DRAFT | UNMAPPED / DENIED |
| A50 | PRACTICE OPERATIONS 50 | PRACTICE_OPERATIONS | DRAFT | UNMAPPED / DENIED |
| A51 | GOVERNANCE SECURITY PLATFORM 51 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | UNMAPPED / DENIED |
| A52 | GOVERNANCE SECURITY PLATFORM 52 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | UNMAPPED / DENIED |
| A53 | GOVERNANCE SECURITY PLATFORM 53 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | UNMAPPED / DENIED |
| A54 | GOVERNANCE SECURITY PLATFORM 54 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | UNMAPPED / DENIED |
| A55 | GOVERNANCE SECURITY PLATFORM 55 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | UNMAPPED / DENIED |
| A56 | GOVERNANCE SECURITY PLATFORM 56 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | UNMAPPED / DENIED |
| A57 | GOVERNANCE SECURITY PLATFORM 57 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | UNMAPPED / DENIED |
| A58 | GOVERNANCE SECURITY PLATFORM 58 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | UNMAPPED / DENIED |
| A59 | GOVERNANCE SECURITY PLATFORM 59 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | UNMAPPED / DENIED |
| A60 | GOVERNANCE SECURITY PLATFORM 60 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | UNMAPPED / DENIED |
