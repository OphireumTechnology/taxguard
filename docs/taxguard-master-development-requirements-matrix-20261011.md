# TaxGuard Master Development Requirements Matrix — 2026-10-11

Production recommendation: **NO-GO** (unchanged).

This matrix maps the 2026-10-11 Master Directive and the 16 reference files in `D:\TaxGuard\Sample Client Dcouments\TaxGuard Development` to code. It builds on, and does not replace:

- the generated per-requirement evidence in [taxguard-master-traceability.md](taxguard-master-traceability.md) and its JSON (160 requirements, with source and test hashes);
- the [remaining-work inventory](taxguard-remaining-work-inventory-20261009.md);
- the H01–H09 / E01–E08 [dependency register](taxguard-master-remaining-decisions.md).

**Status vocabulary**

| Status | Meaning |
| --- | --- |
| Complete | Bounded function implemented and locally tested. It never means "end-to-end verified". |
| Partial | Some required behavior exists; the rest is missing. |
| Missing | Not implemented. |
| Blocked | Requires a human decision (H-ID) or external infrastructure (E-ID). |

Rendering, a registry entry or a green unit test is never treated as end-to-end proof. All 29 browser journeys remain **NOT VERIFIED** (E06).

## 1. Reference inspection (this session)

| Reference file | Read | Principal requirements extracted |
| --- | --- | --- |
| TaxGuard AI Dashboard Architecture Masterplan.png | Yes | 10 role dashboards, 5 architecture layers, cross-cutting services, 18-stage engine row, end-to-end process row |
| TaxGuard AI Architecture & Workflow Board.png | Yes | Same layers; shared navigation shell (search, notifications, role switch, help, profile); role-based process flow |
| TaxGuard AI Client Dashboard Architecture.png | Yes | 7-step client journey, tax years 2022+, checklist, state-specific panel, quick actions |
| TaxGuard AI Accountant Dashboard.png | Yes | KPI tiles, work queue, pipeline, deadlines, AI preparation, form list, document preview, 9-step accountant workflow |
| TaxGuard AI Control Center Dashboard.png | Yes | Agent status, runs, exceptions, security events, token/cost, model usage, approval queue, **Emergency Kill Switch** |
| AI Governance Layer.png | Yes | 14 control-plane components including Kill Switch ("disable an agent, model or tool immediately") |
| TaxGuard AI Permissions Matrix.png | Yes | Permission model; **labelled "(EXAMPLE)"** matrix for 13 agents; universal rules: no AI approve/sign/file; kill switch for any agent |
| How an Agent Processes Work.png | Yes | 14-step execution path |
| TaxGuard AI Run Audit Trail.png | Yes | `ai_run` record fields, input/output hashes, linked records |
| Tax Return Multi-Agent Pipeline.png | Yes | 15-step pipeline A11 → A16 → A17 → A18–A27 → rule engine → deterministic calc → A28–A35 → CPA/EA → approval |
| Critical Multi-Agent Tax Workflow.png | Yes | 17-step W-2 example with two human validation gates |
| Agent Hierarchy.png | Yes | Category tiers, A00-only routing, no peer-to-peer, names for all 61 agents |
| TaxGuard AI — Complete AI Agent Architecture.png | Yes | Registry A00–A60 with primary responsibility and **human gate** per agent |
| TaxGuard AI Architecture Overview.png | Yes | Ecosystem and human authorization layer |
| TaxGuard AI Architecture Infographic.png | Yes | Layered summary; stamped "DEMO ENVIRONMENT — Simulated data — No live filing" |
| TaxGuard AI Architecture Overview.pdf | Not read this session | Cited by four earlier documents; its companion PNG was read |

## 2. Reference conflicts (recorded; established behaviour not changed)

| ID | Conflict | Resolution in code | Decision owner |
| --- | --- | --- | --- |
| CF-01 | **Five incompatible 18-stage label sets.** (a) persisted `LEGACY_18_V1`: Onboard, Collect, Validate, Record, Reconcile, Review, Report, Plan, Prepare Taxes, Approve, Sign, File, Government Feedback, Resolve, Monitor, Archive, Renew, Repeat. (b) Masterplan / Workflow Board engine row: …Record, Categorize, Reconcile, Analyze, Adjust, Summarize, Prepare, Review, Quality Check, Approve, Sign, File, Deliver, Close, Repeat (= the directive's list). (c) Masterplan "End-to-End Process Flow" row: duplicate numbers 10 and 13, no 17. (d) Infographic: 04 Accounting … 09 used twice. (e) Accountant 9-step and client 7-step journeys. | Persisted `LEGACY_18_V1` retained; no competing engine created. Changing stage identities would re-key persisted cases, stage permissions (`ai_stage_permissions`), kill-switch WORKFLOW targets and audit history. | **H10 (new):** approve one authoritative stage list and a migration/mapping plan from `LEGACY_18_V1` |
| CF-02 | "How an Agent Processes Work": LOW risk → *automatic workflow*. The code (`evaluateGovernancePolicy`) always returns `human_review_required: true`. | Stricter behaviour retained; no automatic authoritative action. | H02 (approval policy) |
| CF-03 | Permissions Matrix (EXAMPLE) gives A38 "Use approved filing integrations" and the File stage; directive §11 says no agent may independently file. | A38 remains DRAFT / denied; any filing requires explicit human authorization (H03/H07). | H03 / H07 |
| CF-04 | 48 of 61 registry names are placeholders ("ACCOUNTING 16", "SIGN FILE RESOLVE 38"). Every reference diagram names all 61 consistently, and category boundaries match. | Not renamed (see §5 proposal). The registry is mirrored in the canonical architecture doc and the migration seed. | H01 (part a) |
| CF-05 | Run Audit Trail sample shows `review_decision: "approved"` for a W-2 extraction. The code allows no AI-run approval path (AI-16 blocked). | Unchanged. | H03 |

## 3. Requirements matrix

Columns: **FE / BE / DB** = remaining frontend / backend / database work. Evidence entries are files and tests.

### 3.1 Secure foundation (directive Phase 1, §13)

| ID | Requirement (source) | Role | Status | Evidence | Remaining FE / BE / DB | Security / acceptance | Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | Fail-closed authentication configuration (§13) | All | Complete | `src/supabase/config.ts`, `src/server/supabase.ts`; `supabaseConfigFailClosed.test.ts` (16) | — / — / — | No network I/O when unconfigured | Real IdP: E03 |
| SEC-02 | Anon key never substitutes for service credential (§13) | Server | **Complete (this cycle)** | `src/server/supabase.ts`, `providerReadiness.service.ts`, `scripts/verify-post-restore.mjs`; 5 tests | — | Production throws; non-production fails closed; readiness reports NOT_CONFIGURED | — |
| SEC-03 | Pre-credential "not configured" notice on sign-in, registration and password reset (§15) | Client, Staff | **Complete (cycle c)** | `AuthConfigurationNotice.tsx`, `AuthPages.tsx`; `authConfigurationNotice.test.tsx` (8) | — | Submit disabled and handlers short-circuit when unconfigured; a failed reset is no longer shown as "email sent" (defect fixed) | Real IdP: E03 |
| SEC-04 | Session isolation, RBAC, tenant / client / year denial | All | Complete (bounded) | Inventory "AI, security and persistence"; role HTTP suites | — | Deployed negatives required | E07 |
| SEC-08 | Account suspension, membership removal and session revocation take effect on the next request (Phase 1) | Staff, Client | **Complete (cycle d), including a defect fix** | `SupabaseDurableSessions.verify` re-reads session, identity and membership per request; `durableSessionRevocation.test.ts` (15) | — | **Fixed:** outside production, a removed membership or identity row was resurrected from the `db.users` cache that `verify()` itself populates. Local fallbacks now apply only when the database read fails. | Deployed verification E07 |
| SEC-05 | Supabase RLS default-deny | DB | Complete (disposable DB only) | Migration / RLS tests | — / — / platform grant review | Never verified against deployed project | E01, E07 |
| SEC-06 | Audit integrity (append-only) | All | Partial | AI ledger immutable (`AI_IMMUTABLE_HISTORY` trigger, observed again this cycle); core audit append-only = proposal SQL | DB: install core proposal | Independent custody | E01 |
| SEC-07 | Rate limiting / abuse | All | Not assessed this cycle | — | — | — | — |

### 3.2 Role dashboards (§5, Masterplan)

| ID | Dashboard | Status | Existing implementation | Missing (FE / BE / DB) | Blocker |
| --- | --- | --- | --- | --- | --- |
| DB-01 | Client / Taxpayer (5.1) | Partial | Authenticated shell, scoped records, checklist, year selection, onboarding | Messaging / appointments / invoices year semantics; e-signature; filing status; state rules; 10 legacy stage screens deliberately "unavailable" | H07, H08, E02, E04 |
| DB-02 | Preparer / Accountant (5.2) | Partial | Assigned-case queue, exact-scope projections, session recovery | AI preparation, lineage, form editing, filing readiness, productivity reports | H01–H03, E02 |
| DB-03 | Reviewer / Senior (5.3) | Partial | Bounded queue / workspace, maker-checker UI, A34 RETURN / REJECT | Durable queue discovery, final APPROVED | H03, H05 |
| DB-04 | Bookkeeper (5.4) | Partial | Scoped read projections | Categorization, reconciliation, adjustments, period close | E04, H05 |
| DB-05 | Practice Manager (5.5) | Partial | Operational queue / KPIs | Capacity, SLA, reassignment | H08 |
| DB-06 | Client Service (5.6) | Partial | Scoped queues, client-visible content | Send, booking, escalation, response-time | H08, E04 |
| DB-07 | Billing / Finance (5.7) | Missing | — | All | H06, E04 |
| DB-08 | Administrator (5.8) | Partial | Provider readiness (read-only); AI Emergency Stop tab; **AI Control Center tab (cycle c)** | Users / roles, workflow settings, integrations config | H06 |
| DB-09 | Security / Compliance (5.9) | Partial | AI security events, governance decisions and the stop registry are viewable (server-authorized for `compliance_officer`), via the admin workspace's AI Control Center | A dedicated workspace: the frontend `UserRole` has no `compliance_officer` / `cpa`; incident workflow; retention controls | **H06** (role definitions), H09 |
| DB-10 | Executive / Owner (5.10) | Missing | — | All | H06 |

### 3.3 Workflow (§6)

| ID | Requirement | Status | Evidence | Blocker |
| --- | --- | --- | --- | --- |
| WF-01 | Single authoritative 18-stage engine | Partial | `LEGACY_18_V1` stage engine, transition / evidence / maker-checker tests | CF-01 / **H10** |
| WF-02 | Per-stage entry / approval / exception / reopen rules | Partial | Stage-by-stage table in the remaining-work inventory (stages 01–18, mostly BLOCKED) | H03, H05, H07, E02, E04 |
| WF-03 | 7-step client journey mapped to the 18 stages | Partial | Client journey UI; mapping against the chosen stage set depends on H10 | H10 |

### 3.4 AI ecosystem and governance (§7–§11)

| ID | Requirement (source) | Status | Evidence | Remaining | Blocker |
| --- | --- | --- | --- | --- | --- |
| AI-01 | Central registry A00–A60 (Hierarchy, Complete Architecture) | Complete (identity only) | `src/ai/registry.ts` (61, all DRAFT) | Names (§5), per-agent tools / data / stages / thresholds | H01, H02 |
| AI-02 | A00 orchestration with permission checks and audit | Partial | `A00Orchestrator.ts`, governance control plane | Specialist dispatch | H01 |
| AI-03 | 14-step execution path (How an Agent Processes Work) | Partial | Steps 1–6, 8, 10–11, 14 present for bounded A10 / A34; step 13 (authoritative action) blocked | — | H03 |
| AI-04 | `ai_run` record fields (Run Audit Trail) | Complete (schema / ledger) | `ai_runs`, `ExecutionLedgerService.ts` | Commissioned execution | H02 |
| AI-05 | **Emergency kill switch, server-enforced (Control Center, Governance Layer, Permissions Matrix)** | **Complete for activation: GLOBAL, AGENT, MODEL, TOOL, WORKFLOW stage (cycle d)** | `KillSwitchService.ts` (registry-validated targets; WORKFLOW pinned to `LEGACY_18_V1`), routes, `AiEmergencyStopPanel.tsx`; Control Center marks model-stopped agents and lists tool / stage stops. Enforcement on every execution path is proven by existing gateway (pre-dispatch, post-admission, mid-transport, pre-retry), capability executor, A00 orchestrator and human-review tests, plus service-created stops refused by the control plane (`aiKillSwitchActivation.test.ts`, 47 tests). | **Deactivation** | **H11 (new):** who may lift a stop, and under what dual control |
| AI-06 | Model / prompt registry, versioning, budgets | Complete (schema / gateway) | AI-1–6 SQL / provider-double tests | Activation | H02 |
| AI-07 | Control Center read views: registry and stop state, execution history, governance decisions (AI audit log), security events, token / cost and review-queue totals | **Complete (cycle c)**, server and UI | `ControlCenterReadService.ts`, `/api/ai-governance/control-center/*`, `AiControlCenterPanel.tsx`; `aiControlCenterRead.test.ts` (29), `aiControlCenterPanel.test.tsx` (5) | Charts; agent evaluation metrics (no evaluation records exist); live data requires commissioned runs | H02; UI entry is admin-only until H06 defines compliance roles |
| AI-08 | Tax-return multi-agent pipeline (15 steps) | Blocked | A10 / A34 bounded only | — | H01, H03, H07, E02 |
| AI-09 | Human authorization Preparer → Reviewer → CPA/EA | Partial | Maker-checker, A34 human RETURN / REJECT | Final approval / attestation | H03 |

### 3.5 Persistence and integrations (§12, §14)

The entity and provider status is unchanged from the [integration readiness](taxguard-master-integration-readiness.md) document. No provider transaction is fabricated.

| Area | Blocker |
| --- | --- |
| Migrations | Never run against production; E01 |
| Providers (OCR, e-signature, filing, payments, messaging, calendar) | E02, E04 |

## 4. New decisions surfaced this cycle

| ID | Decision required | Dependent work |
| --- | --- | --- |
| H10 | Choose the single authoritative 18-stage label set (CF-01) and approve a mapping / migration from `LEGACY_18_V1` | WF-01, WF-03, stage permissions, client journey mapping |
| H11 | Kill-switch lifting policy: authorized role(s), dual control, required evidence, audit | AI-05 deactivation |
| H01a | Approve the reference-derived agent names in §5 for the registry, canonical document and migration seed | AI-01 display |

## 5. Proposed agent-name reconciliation (H01a — not applied)

Reference names come from Agent Hierarchy.png and Complete AI Agent Architecture.png; human gates come from the latter. Category boundaries match the registry for every row.

| ID | Registry name (current) | Reference name | Category | Reference human gate |
| --- | --- | --- | --- | --- |
| A01 | CLIENT SERVICES 01 | Client Onboarding | CLIENT_SERVICES | Staff |
| A02 | CLIENT SERVICES 02 | Identity Verification | CLIENT_SERVICES | Staff |
| A03 | CLIENT SERVICES 03 | Engagement | CLIENT_SERVICES | Staff |
| A04 | CLIENT SERVICES 04 | Tax Organizer | CLIENT_SERVICES | Preparer |
| A09 | DOCUMENT INTELLIGENCE 09 | Missing Document | DOCUMENT_INTELLIGENCE | Staff |
| A12 | ACCOUNTING 12 | Bookkeeping | ACCOUNTING | Accountant |
| A13 | ACCOUNTING 13 | Reconciliation | ACCOUNTING | Accountant |
| A14 | ACCOUNTING 14 | Journal Entry | ACCOUNTING | Accountant |
| A15 | ACCOUNTING 15 | Financial Statement | ACCOUNTING | Accountant |
| A16 | ACCOUNTING 16 | Book-to-Tax | ACCOUNTING | Tax professional |
| A17 | TAX INTELLIGENCE 17 | Tax Research | TAX_INTELLIGENCE | CPA/EA |
| A20 | TAX INTELLIGENCE 20 | Entity Tax | TAX_INTELLIGENCE | CPA/EA |
| A21 | TAX INTELLIGENCE 21 | Individual Tax | TAX_INTELLIGENCE | Preparer |
| A22 | TAX INTELLIGENCE 22 | Deduction | TAX_INTELLIGENCE | Preparer |
| A23 | TAX INTELLIGENCE 23 | Credit | TAX_INTELLIGENCE | Preparer |
| A24 | TAX INTELLIGENCE 24 | Depreciation | TAX_INTELLIGENCE | Preparer |
| A25 | TAX INTELLIGENCE 25 | Payroll Tax | TAX_INTELLIGENCE | Professional |
| A26 | TAX INTELLIGENCE 26 | Estimated Tax | TAX_INTELLIGENCE | Professional |
| A27 | TAX INTELLIGENCE 27 | Tax Planning | TAX_INTELLIGENCE | CPA/EA |
| A29 | TAX INTELLIGENCE 29 | Return Preparation | TAX_INTELLIGENCE | Preparer |
| A32 | RISK QC 32 | Exception | RISK_QC | Reviewer |
| A33 | RISK QC 33 | Risk & Materiality | RISK_QC | CPA/EA |
| A35 | RISK QC 35 | Quality-Control / Independent QC | RISK_QC | CPA/EA |
| A36 | SIGN FILE RESOLVE 36 | Signature Readiness | SIGN_FILE_RESOLVE | Staff |
| A37 | SIGN FILE RESOLVE 37 | Filing Readiness | SIGN_FILE_RESOLVE | Authorized filer |
| A38 | SIGN FILE RESOLVE 38 | Filing | SIGN_FILE_RESOLVE | Explicit authorization |
| A39 | SIGN FILE RESOLVE 39 | Government Response | SIGN_FILE_RESOLVE | not stated |
| A40 | SIGN FILE RESOLVE 40 | Rejection Resolution | SIGN_FILE_RESOLVE | Preparer |
| A41 | SIGN FILE RESOLVE 41 | Tax Notice | SIGN_FILE_RESOLVE | CPA/EA |
| A42 | SIGN FILE RESOLVE 42 | Amendment | SIGN_FILE_RESOLVE | CPA/EA |
| A43 | PRACTICE OPERATIONS 43 | Client Communication | PRACTICE_OPERATIONS | Staff |
| A44 | PRACTICE OPERATIONS 44 | Appointment | PRACTICE_OPERATIONS | Staff / client |
| A45 | PRACTICE OPERATIONS 45 | Task | PRACTICE_OPERATIONS | Policy-controlled |
| A46 | PRACTICE OPERATIONS 46 | Deadline | PRACTICE_OPERATIONS | Staff |
| A47 | PRACTICE OPERATIONS 47 | Billing | PRACTICE_OPERATIONS | Authorized staff |
| A48 | PRACTICE OPERATIONS 48 | Payment Reconciliation | PRACTICE_OPERATIONS | Accounting |
| A49 | PRACTICE OPERATIONS 49 | Archive | PRACTICE_OPERATIONS | Staff |
| A50 | PRACTICE OPERATIONS 50 | Renewal | PRACTICE_OPERATIONS | Staff |
| A51 | GOVERNANCE SECURITY PLATFORM 51 | Audit Trail | GOVERNANCE_SECURITY_PLATFORM | Compliance |
| A52 | GOVERNANCE SECURITY PLATFORM 52 | Compliance | GOVERNANCE_SECURITY_PLATFORM | Compliance officer |
| A53 | GOVERNANCE SECURITY PLATFORM 53 | Privacy | GOVERNANCE_SECURITY_PLATFORM | Security/compliance |
| A54 | GOVERNANCE SECURITY PLATFORM 54 | Security | GOVERNANCE_SECURITY_PLATFORM | Security/admin |
| A55 | GOVERNANCE SECURITY PLATFORM 55 | Access-Control | GOVERNANCE_SECURITY_PLATFORM | Admin |
| A56 | GOVERNANCE SECURITY PLATFORM 56 | AI Governance | GOVERNANCE_SECURITY_PLATFORM | Admin/compliance |
| A57 | GOVERNANCE SECURITY PLATFORM 57 | Hallucination / Verification | GOVERNANCE_SECURITY_PLATFORM | Human review |
| A58 | GOVERNANCE SECURITY PLATFORM 58 | System Health | GOVERNANCE_SECURITY_PLATFORM | Admin |
| A59 | GOVERNANCE SECURITY PLATFORM 59 | Provider Integration | GOVERNANCE_SECURITY_PLATFORM | Admin |
| A60 | GOVERNANCE SECURITY PLATFORM 60 | Practice Intelligence | GOVERNANCE_SECURITY_PLATFORM | Management |

A10 and A39 human gates are not stated in the references. Names alone grant no tools, data, stages or permissions.
