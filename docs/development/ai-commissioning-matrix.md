# AI commissioning readiness matrix

> Generated from `src/ai/registry.ts` by `src/ai/commissioningMatrix.ts`; `src/tests/aiCommissioningMatrix.test.ts` fails when this file is stale.
> No live model provider is configured or approved. No agent is staging-validated or production-commissioned.

Agents: 61. Registered 61 · handler implemented 3 · locally tested 3 · provider configured 0 · human-approved 0 · staging validated 0 · production commissioned 0.

Blocked regardless of agent state: AI-16 material-action approval; Autonomous electronic filing; Client messaging; Accounting mutations; Payments; Tax signatures; Document transmission.

| Agent | Name | Category | Registry status | Registered | Handler implemented | Locally tested | Provider configured | Human-approved | Staging validated | Production commissioned | Scope |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A00 | Supervisor / Orchestrator | SUPERVISOR | DRAFT | YES | YES | YES | NO | NO | NO | NO | Orchestration planning boundary: routes the two mapped advisory tasks; no autonomous action |
| A01 | CLIENT SERVICES 01 | CLIENT_SERVICES | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A02 | CLIENT SERVICES 02 | CLIENT_SERVICES | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A03 | CLIENT SERVICES 03 | CLIENT_SERVICES | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A04 | CLIENT SERVICES 04 | CLIENT_SERVICES | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A05 | Document Intake | DOCUMENT_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A06 | Document Classification | DOCUMENT_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A07 | OCR / Extraction | DOCUMENT_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A08 | Extraction Validation | DOCUMENT_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A09 | DOCUMENT INTELLIGENCE 09 | DOCUMENT_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A10 | Duplicate / Fraud Check | DOCUMENT_INTELLIGENCE | DRAFT | YES | YES | YES | NO | NO | NO | NO | Document duplicate check (read-only advisory) |
| A11 | Evidence | DOCUMENT_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A12 | ACCOUNTING 12 | ACCOUNTING | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A13 | ACCOUNTING 13 | ACCOUNTING | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A14 | ACCOUNTING 14 | ACCOUNTING | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A15 | ACCOUNTING 15 | ACCOUNTING | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A16 | ACCOUNTING 16 | ACCOUNTING | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A17 | TAX INTELLIGENCE 17 | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A18 | Federal Tax Analysis | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A19 | State Tax Analysis | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A20 | TAX INTELLIGENCE 20 | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A21 | TAX INTELLIGENCE 21 | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A22 | TAX INTELLIGENCE 22 | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A23 | TAX INTELLIGENCE 23 | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A24 | TAX INTELLIGENCE 24 | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A25 | TAX INTELLIGENCE 25 | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A26 | TAX INTELLIGENCE 26 | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A27 | TAX INTELLIGENCE 27 | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A28 | Calculation Verification | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A29 | TAX INTELLIGENCE 29 | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A30 | Form Mapping | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A31 | Diagnostics | TAX_INTELLIGENCE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A32 | RISK QC 32 | RISK_QC | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A33 | RISK QC 33 | RISK_QC | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A34 | Reviewer Support | RISK_QC | DRAFT | YES | YES | YES | NO | NO | NO | NO | Workflow read: review questions and evidence completeness (read-only advisory) |
| A35 | RISK QC 35 | RISK_QC | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A36 | SIGN FILE RESOLVE 36 | SIGN_FILE_RESOLVE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A37 | SIGN FILE RESOLVE 37 | SIGN_FILE_RESOLVE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A38 | SIGN FILE RESOLVE 38 | SIGN_FILE_RESOLVE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A39 | SIGN FILE RESOLVE 39 | SIGN_FILE_RESOLVE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A40 | SIGN FILE RESOLVE 40 | SIGN_FILE_RESOLVE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A41 | SIGN FILE RESOLVE 41 | SIGN_FILE_RESOLVE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A42 | SIGN FILE RESOLVE 42 | SIGN_FILE_RESOLVE | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A43 | PRACTICE OPERATIONS 43 | PRACTICE_OPERATIONS | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A44 | PRACTICE OPERATIONS 44 | PRACTICE_OPERATIONS | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A45 | PRACTICE OPERATIONS 45 | PRACTICE_OPERATIONS | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A46 | PRACTICE OPERATIONS 46 | PRACTICE_OPERATIONS | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A47 | PRACTICE OPERATIONS 47 | PRACTICE_OPERATIONS | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A48 | PRACTICE OPERATIONS 48 | PRACTICE_OPERATIONS | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A49 | PRACTICE OPERATIONS 49 | PRACTICE_OPERATIONS | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A50 | PRACTICE OPERATIONS 50 | PRACTICE_OPERATIONS | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A51 | GOVERNANCE SECURITY PLATFORM 51 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A52 | GOVERNANCE SECURITY PLATFORM 52 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A53 | GOVERNANCE SECURITY PLATFORM 53 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A54 | GOVERNANCE SECURITY PLATFORM 54 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A55 | GOVERNANCE SECURITY PLATFORM 55 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A56 | GOVERNANCE SECURITY PLATFORM 56 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A57 | GOVERNANCE SECURITY PLATFORM 57 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A58 | GOVERNANCE SECURITY PLATFORM 58 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A59 | GOVERNANCE SECURITY PLATFORM 59 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
| A60 | GOVERNANCE SECURITY PLATFORM 60 | GOVERNANCE_SECURITY_PLATFORM | DRAFT | YES | NO | NO | NO | NO | NO | NO | Registry metadata only; no handler; no execution authority |
