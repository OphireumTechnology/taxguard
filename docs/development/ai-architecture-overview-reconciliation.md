# AI Architecture Overview reconciliation (2026-10-28)

The owner supplied the **TaxGuard AI Architecture Overview**: 11 illustrated pages, SHA-256
`f11ed12ab651b8f805286c2b9f9fce31f534118670fc394b3973c80e44409c78`, kept outside the repository with the owner's
development material. The canonical architecture (`docs/taxguard-ai-canonical-architecture.md`) recorded this document
and its page-9 matrix as missing, which is why 58 of the 61 agents are UNMAPPED / DENIED.

This change records the overview for review. **It grants nothing.** No agent, model, prompt, provider, stage, tool or
data permission is enabled; every registration stays DRAFT; the registry names and categories are unchanged (they are
seeded by the applied migration `20261008000000`). Governance, the gateway and handlers do not read the record, and a
unit test enforces that.

## What was recorded

| Overview page | Content | Where |
|---|---|---|
| 2 | Name, primary responsibility, human gate and display group of 59 agents | `src/ai/architectureOverview.ts` `OVERVIEW_AGENTS` |
| 3, 5, 6 | Names of A10 Duplicate/Fraud Indicator and A39 Government Response (absent from page 2) | same |
| 9 | Example permission matrix: 13 agents by 21 columns (data access, actions, tools, workflow stages) | `PAGE9_EXAMPLE` |
| 1, 4, 8, 10, 11 | Architecture, processing flow, ai_run record, Control Center mock-up | compared below; not encoded |

The text is a transcription of images (the PDF has no text layer). Unreadable matrix cells are recorded as unreadable,
never guessed.

A gate is mapped to an approval role only when it names exactly one of TaxGuard's roles: Preparer, Reviewer or Human
reviewer (REVIEWER), CPA/EA, or when the owner has decided its meaning ("Staff" means REVIEWER). Every other gate is
an owner decision. The overview gate never replaces the existing
PREPARER -> REVIEWER -> CPA_EA chain for material proposals.

`overviewCeiling()` narrows a page-9 row: authority the canonical boundary keeps with people (write return data, mark
verified, approve a tax position, modify, file or sign a return, the filing provider, the File stage) and unreadable
cells become NOT_ALLOWED. The result is a ceiling for the owner's review, never wider than drawn, and it is not used by
any runtime path.

## Owner decisions

`overviewDecisions()` lists thirteen, each with its status and the owner's answer, shown in the AI Control Center's
**Architecture overview** tab. The owner answered four on 2026-10-28 (three decided, one in part); ten remain open.

1. **OV-01** A10 and A39 have no responsibility or human gate. **Decided:** leave A10 at its existing narrow
   duplicate-hash check and A39 unassigned until their definitions are supplied.
2. **OV-02** Page 2 groups differ from the registry categories (page 3 agrees with the registry, which is kept).
3. **OV-03** Agent names vary between pages (A10, A28, A31, A35).
4. **OV-04** Gates that name no single approval role. **Partly decided:** "Staff" means REVIEWER (A01-A03, A05, A09,
   A36, A43, A46, A49, A50). 33 of the 59 recorded gates now map to PREPARER, REVIEWER or CPA_EA; 26 remain open
   ("Accountant", "Admin", "Preparer/CPA", "Authorized staff", "Staff / client", "Management" ...).
5. **OV-05** A44 names a client as a gate.
6. **OV-06** Page 9 draws human-only authority as allowed or conditional in 21 cells, e.g. A29 Mark verified; A16,
   A18-A20, A29, A34 and A35 Write return data; A34/A35 Modify return; A38 Filing provider and File stage.
   **Decided:** these powers stay with people; agents may only propose.
7. **OV-07** Unreadable page-9 cells: A08 Write staging and OCR, A11 OCR, A16 Approve tax position, A38 Read tax rules,
   Write staging, Write return data, Create proposal and LLM.
8. **OV-08** Page-9 stages are not LEGACY_18_V1 stage numbers; A29 lacks Prepare and A34 lacks Review.
9. **OV-09** Page 4 lets low-risk proposals proceed automatically; TaxGuard requires human review. **Decided:** always
   human review, whatever the risk score.
10. **OV-10** Live e-file and payments appear on pages 1, 9 and 11; they stay disabled.
11. **OV-11** Page 8 names a model provider and pages 10-11 show illustrative metrics (page 11 says simulated).
12. **OV-12** The Master Architecture Implementation Directive (2026-10-28) calls A21 "International"; pages 2, 3 and 6
    name it Individual Tax Agent. The overview name is recorded.
13. **OV-13** Prerequisites for commissioning any agent: approved responsibility and grants, model and prompt,
    budgets, evaluation, staging validation and a commissioning decision; who approves each step and the evaluation
    pass criteria are undecided. Until then no agent is commissioned.

## Comparison with what is built

| Overview element | State in TaxGuard |
|---|---|
| A00-A60 registry (pages 1-3) | Built: `src/ai/registry.ts`, migration `20261008000000`; all DRAFT |
| Governance control plane: agent, model, prompt, tool registries, data and stage permissions, thresholds, kill switch, audit (page 7) | Built and default-deny (register AI-GOV-PLANE, AI-PERMISSIONS, AI-KILL-SWITCH, AI-MODEL-PROMPT-REGISTRY) |
| ai_run record (page 8) | Built: `AIRun` contract and execution ledger `20261008050000` with the same fields |
| Agent permissions (page 9) | Recorded here as an example ceiling; runtime grants remain empty pending owner approval |
| Control Center (page 10) | Built, showing only server data; the mock-up figures are not reproduced |
| Processing flow (page 4) | Orchestration, admission and human review built; automatic low-risk approval not authorized (OV-09) |
| W-2 pipeline and return pipeline (pages 5-6) | Deterministic parts built and human-gated: extraction review, evidence, conclusions (Block 66), calculation, form mapping (Block 67, not merged); no specialist agent built |
| Live filing, payments, model providers | Disabled by standing instruction |

## Verification

- `src/tests/aiArchitectureOverview.test.ts` (10): 61 identities in registry order; still DRAFT and denied; never read
  under `src/server`; A10/A39 recorded as missing; strict gate mapping and the "Staff" decision; page-9
  transcription; ceiling never widens and keeps human-only authority; decisions computed with the owner answers of
  2026-10-28.
- `src/tests/aiArchitectureOverviewView.test.tsx` (4): reference-only note, 61 + 13 rows, decisions, captions.
- Suite 14 browser journey: keyboard reach of the new tab, contents, no governance request, no overflow at 375 px.

No screen-reader test was performed (not available in this environment).
