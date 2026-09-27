# TAXGUARD MASTER AUTONOMOUS BUILD POLICY

START:
M3 — Stage 02 COLLECT Integration

PRESERVE:
M1 — LIVE Client Routing
M2 — Stage 01 Integration

DO NOT repeat completed milestones.

============================================================
TARGET WORKFLOW
============================================================

LIVE Firebase Login
→ TaxGuard Server Session
→ Permanent Client ID
→ Stage 01 ONBOARD
→ Stage 01 Hard Exit Gate
→ Stage 02 COLLECT
→ Stage 02 Hard Exit Gate
→ Stage 03 VALIDATE
→ Remaining TaxGuard Workflow
→ Knowledge / Rules
→ Deterministic Calculation Engine
→ Provider-Neutral AI
→ Evidence / Provenance
→ Human Review
→ Approval / Governance
→ Audit / Security

External filing/transmission remains DISABLED.

============================================================
M3 — STAGE 02 COLLECT
============================================================

Integrate the EXISTING Stage 02 engine.

Do not rebuild Stage 02.

Required:

authenticated LIVE client
→ permanent Client ID
→ Stage 01 PASS
→ StageTwoCollectionWorkspace

All Stage 02 data must be scoped to authenticated LIVE client.

Never substitute DEMO records.

Preserve:

document requirements
secure uploads
SHA-256
malware/quarantine controls
document intelligence
missing-document detection
document requests
exception management
source tie-out
collection completeness
Stage 02 hard exit gate
audit trail

Client role must not self-approve professional review decisions.

Stage 03 remains LOCKED until canonical Stage 02 gate passes.

No fake completion flags.

============================================================
M4 — STAGE 03 VALIDATE
============================================================

Connect existing StageThreeValidationWorkspace.

Required:

Stage 02 PASS
→ Stage 03 VALIDATE

Preserve:

OCR provenance
extraction provenance
field validation
exception handling
confidence/risk handling
human review
anti-silent-repair
AI-proposed-only status

AI output is never automatically tax-verified.

============================================================
M5 — WORKFLOW GATES
============================================================

Enforce canonical sequential workflow.

A later stage cannot be entered before the preceding hard gate passes.

Direct URL/hash manipulation must not bypass gates.

No UI-only fake gate.

Gate status must come from authoritative workflow state.

============================================================
M6 — PERMANENT CLIENT ID
============================================================

Preserve server/database allocation.

Never calculate permanent Client ID in browser.

Properties:

LIVE only
unique
immutable
never reused
separate from Firebase UID
persisted
audited

Required sequence tests remain valid.

============================================================
M7 — LIVE / DEMO ISOLATION
============================================================

DEMO:
artest2026

LIVE:
Firebase authenticated users

DEMO may use seeded data.

LIVE must NEVER:

inherit demo client records
inherit demo engagements
inherit demo documents
inherit demo onboarding state
fall back to demo data when LIVE data is empty

Empty LIVE data means empty/new LIVE state.

============================================================
M8 — INTELLIGENCE CORE
============================================================

Integrate existing:

TG-CORE-001 Knowledge Registry
TG-CORE-002 Rule Engine
TG-CORE-003 Evidence Package
TG-CORE-004 Human Review Bridge
TG-CORE-005 AI Reasoning Gateway
TG-CORE-006 Approval Orchestrator
TG-CORE-007 Decision Trace Ledger
TG-CORE-008 Governance Boundary

Core rule:

AI proposes.
Evidence supports.
Rules validate.
Calculations compute.
Governance controls.
Authorized humans approve material tax decisions.

============================================================
M9 — KNOWLEDGE ARCHITECTURE
============================================================

Implement/integrate architecture for:

TG-KNOW-001 Source Registry
TG-KNOW-002 Tax-Year Versioning
TG-KNOW-003 Federal Knowledge Pack
TG-KNOW-004 Rule Schema
TG-KNOW-005 Calculation Registry
TG-KNOW-006 Retrieval Engine
TG-KNOW-007 Evidence Citation Engine
TG-KNOW-008 Conflict Detector
TG-KNOW-009 Confidence/Risk Engine
TG-KNOW-010 Human Review Queue
TG-KNOW-011 Case Evaluation Suite
TG-KNOW-012 Knowledge Update Pipeline

Do NOT invent tax law.

Missing authoritative knowledge must fail closed.

============================================================
M10 — CALCULATION ENGINE
============================================================

Tax calculations must be deterministic.

LLMs must not become the authoritative calculator.

Every material calculation must be:

versioned
tax-year scoped
input traceable
output traceable
testable
auditable

============================================================
M11 — PROVIDER-NEUTRAL AI
============================================================

TaxGuard owns business logic.

AI providers are replaceable adapters.

Architecture:

TaxGuard
→ AI Gateway
→ provider adapter

No business-critical workflow may depend exclusively on one LLM.

System must remain usable in deterministic + human-review mode
when AI provider is unavailable.

============================================================
M12 — EVIDENCE / PROVENANCE
============================================================

Maintain:

Document ID
→ SHA-256
→ OCR Artifact
→ Extraction Artifact
→ Page
→ Bounding Box
→ Extracted Field
→ Validation
→ Decision
→ Human Review

Quarantined or rejected evidence cannot become verified evidence.

Missing required provenance must fail closed.

============================================================
M13 — HUMAN REVIEW / GOVERNANCE
============================================================

Preserve maker-checker separation.

AI cannot approve material tax decisions.

Clients cannot self-verify professional-review controls.

Require appropriate:

review queues
justification
approval history
decision trace
actor identity
role
timestamp
audit record

============================================================
M14 — SECURITY / AUDIT
============================================================

Preserve:

authentication
authorization
tenant/client isolation
session validation
role boundaries
audit events
credential secrecy
Firebase Admin secrecy

Never create authentication bypasses.

Never disable security merely to make tests pass.

============================================================
M15 — UI / ENCODING / CLEANUP
============================================================

Fix remaining mojibake/encoding problems.

Examples:

IRC Â§ 7216
â€”
â€¢

must become proper UTF-8.

Do not redesign unrelated screens.

Maintain clean, simple, professional navigation.

============================================================
FINAL VALIDATION
============================================================

Required:

npm.cmd run typecheck

Stage 02 tests PASS
Stage 03 tests PASS
Client ID tests PASS
Intelligence Core tests PASS
All automated tests PASS
Production build PASS

Run existing E2E tests if already configured.

Do not invent an E2E PASS when no E2E suite exists.

============================================================
AUTONOMOUS ENGINEERING RULES
============================================================

1. No historical broad repository scan.
2. Use known files first.
3. Target only files required by current milestone.
4. Never edit *.backup.*, *.before-*, *.bak.
5. Never run retired V1 AutoFix.
6. Never weaken/delete a test to make a milestone pass.
7. Back up a file before changing it.
8. After each milestone run TypeScript.
9. Run relevant milestone tests.
10. Roll back milestone changes when validation fails.
11. Retry only the failed root cause.
12. Do not redo completed milestones.
13. Do not create Test Client 006.
14. Do not reset Client 005 password.
15. Do not expose Firebase credentials.
16. External submission remains disabled.
17. Never fake stage completion.
18. Never substitute DEMO data into LIVE.
19. Never automatically mark AI output tax-verified.
20. Continue until M15 and FINAL validation or a genuine external dependency blocks progress.
