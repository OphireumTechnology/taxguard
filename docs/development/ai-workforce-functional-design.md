# TaxGuard AI workforce functional and access design

This design covers all 61 TaxGuard application agents and maps them to the existing case workflow and administrative surfaces. Stage numbers follow `LEGACY_18_V1`. Surface labels are target placements based on the current application routes and panels. Some features require new review UI or durable services. Every registration remains DRAFT.

## Application feature map

| Module | Features needed | Main agent groups |
| --- | --- | --- |
| Client portal and engagement | Onboarding checklist, qualification and review queue, adaptive organizer, client-visible request status | A01–A04, A43–A44, A50 |
| Collection and evidence | Upload status, quarantine display, classification and extraction review, missing evidence list, evidence links | A05–A11 |
| Accounting and reporting | Transaction classification review, reconciliation workbench, journal proposals, statement variance report, book-to-tax bridge | A12–A16, A48 |
| Tax preparation and planning | Versioned research, federal and state issue review, entity and individual workspaces, deductions, credits, depreciation, payroll, estimates, scenario comparison, return assembly and diagnostics | A17–A31 |
| Review and release | Exception and risk queues, reviewer checklist, independent QC, human signature and filing gates, feedback and resolution | A32–A42, A57 |
| Practice operations | Communication drafts, appointment options, task queue, deadlines, billing drafts, archive and renewal readiness | A43–A50 |
| Administration and governance | Control Center, audit investigations, policy and access review, privacy and security triage, provider and service health, management reporting | A00, A51–A60 |

## Common feature and access contract

- The portal and staff workspaces submit task intent. The API resolves the signed-in actor, current role and case assignment, tenant, client, engagement, case, tax year, actual workflow stage, and permitted capability. Administrative jobs use explicit tenant-level capability and audience rules.
- Each job declares an agent ID, task, input/output schema version, evidence references, allowed tools, resource limits, expiry and idempotency key. The worker rechecks policy and kill switches before dispatch and at governed result acceptance. A00 passes references and route intent. Every child is independently authorized.
- Use read-only evidence and structured, reviewable proposals. Human approval is required for advisory outputs. Staff approve final records through existing domain workflows. Signing, filing, communications, ledger posting, refunds, payments, access changes and provider settings stay under human control.
- Taxpayer documents remain in private storage. Use scoped release and quarantine checks, exact document versions, and minimum necessary fields. Exclude session tokens, credentials and raw taxpayer material from queues, shared memory and operational logs. A model or external tool needs an approved per-capability data policy.
- Show queued, running, review required, refused, failed and resolved states with correlated audit evidence. Reviewers can inspect source references, compare the proposed change, return it for correction or resolve it under existing case policy.
- The gate labels below are sourced from the architecture overview. Resolve ambiguous gate labels before granting access. The listed inputs are proposed per-agent ceilings. All runtime grants still need owner approval and verification.

## Specific task and access by agent

| ID | Agent | Trigger and application surface | Minimum read access | Specific task | Feature output | Human design gate |
| --- | --- | --- | --- | --- | --- | --- |
| A00 | Supervisor / Orchestrator Agent | 01–18 · AI Control Center / case task | Validated job intent, current stage and approved route catalog | Route allowlisted work and correlate child outcomes | Case-scoped run summary with blocked routes and reason codes | Yes (material) |
| A01 | Client Onboarding Agent | 01 · Client portal / onboarding review | Submitted checklist, consent receipts and contact-completeness flags | Identify unfinished onboarding requirements | Staff checklist and portal prompt draft | Staff |
| A02 | Identity Verification Agent | 01 · Staff onboarding review | Scoped identity verification status and exception codes | Compare evidence consistency and flag discrepancies | Restricted decision referral without identity secrets or approval | Staff |
| A03 | Engagement Agent | 01 · Engagements / after intake | Approved service catalog, intake facts and engagement status | Propose engagement type, tax years and workflow requirements | Draft engagement checklist for staff | Staff |
| A04 | Tax Organizer Agent | 01–02 · Client organizer / questionnaire step | Scoped organizer answers and applicable question catalog | Select follow-up questions for incomplete or conflicting answers | Reviewable organizer question set | Preparer |
| A05 | Document Intake Agent | 02 · Vault / incoming upload event | Upload metadata, request link and quarantine status | Check document intake completeness and queue eligibility | Intake disposition proposal with reason codes | Staff |
| A06 | Document Classification Agent | 02–03 · Collection / released document | Released content or OCR snippet, approved document taxonomy | Suggest document family and subtype | Classification proposal with confidence and evidence reference | Reviewer |
| A07 | OCR Extraction Agent | 02–03 · Vault / approved extraction request | Eligible released file reference and approved OCR tool | Extract allowed fields into an isolated staging record | Structured field candidates with source page anchors | Reviewer |
| A08 | Document Validation Agent | 03 · Validate / extraction review | Staged fields and exact released source version | Compare field values and source anchors, flag mismatches | Validation findings without marking data verified | Reviewer |
| A09 | Missing Document Agent | 02 · Collection / manifest refresh | Current scoped Stage Two requirement IDs, levels and statuses | Distinguish missing evidence, pending review and correction | Requirement-level findings with manifest version | Staff |
| A10 | Duplicate/Fraud Indicator Agent | 03 · Validate / selected evidence | One to ten selected authorized document metadata records | Compare hashes across distinct document records | Duplicate-group count and review referral | Human review required in draft; reviewer role pending |
| A11 | Evidence Agent | 02–06 · Case evidence / when linking a finding | Document versions, verification status and workpaper references | Propose traceable links between evidence and requirements | Evidence chain draft with missing or stale sources | Preparer |
| A12 | Bookkeeping Agent | 04 · Bookkeeping / imported transactions | Scoped ledger staging rows and chart of accounts | Suggest account classification for uncategorized rows | Coded transaction proposals with rationale | Accountant |
| A13 | Reconciliation Agent | 05 · Reconciliation / period close | Scoped statement and ledger rows with match keys | Identify unmatched entries and balance differences | Reconciliation exceptions and candidate matches | Accountant |
| A14 | Journal Entry Agent | 04–05 · Journal entry review | Approved account catalog, ledger exceptions and evidence | Propose balanced entries for supported adjustments | Debit/credit draft with references and explicit posting gate | Accountant |
| A15 | Financial Statement Agent | 07 · Financial reports / finalized period snapshot | Reviewed trial balance and statement snapshots | Explain variances and cross-statement inconsistencies | Reported findings linked to statement lines | Accountant |
| A16 | Book-to-Tax Agent | 08–09 · Book-to-tax / bridge review | Reviewed books, adjustment evidence and approved tax mapping | Suggest permanent and temporary book-to-tax bridge items | Adjustment proposal showing provenance and reconciliation effect | Tax professional |
| A17 | Tax Research Agent | 08–09 · Tax research workspace | Approved versioned authorities and redacted research facts | Retrieve applicable sources and flag uncertain applicability | Cited research memo with jurisdiction and effective date | CPA/EA |
| A18 | Federal Tax Agent | 09 · Federal return preparation | Verified case facts and approved federal rule set | Produce treatment alternatives and identify federal issues | Federal position proposal with citations and supporting facts | Preparer/CPA |
| A19 | State Tax Agent | 09 · State return preparation | Verified jurisdiction facts and approved state rules | Identify jurisdiction obligations and state adjustments | State issue checklist and reviewable treatment proposal | Preparer/CPA |
| A20 | Entity Tax Agent | 08–09 · Entity return workspace | Verified entity classification, elections and approved rules | Analyze entity-specific treatment and missing elections | Entity issue proposal tied to return family | CPA/EA |
| A21 | Individual Tax Agent | 09 · Individual return workspace | Verified individual facts and approved return rules | Identify individual return issues and unresolved inputs | Individual return review checklist and cited findings | Preparer |
| A22 | Deduction Agent | 09 · Deduction worksheet | Verified expense evidence and approved eligibility rules | Propose eligible deductions and flag missing substantiation | Deduction candidates with disallowance reasons | Preparer |
| A23 | Credit Agent | 09 · Credit worksheet | Verified qualifying facts, approved credit parameters and carryovers | Screen credits and flag phaseouts or missing inputs | Credit candidates with deterministic engine references | Preparer |
| A24 | Depreciation Agent | 09 · Asset and depreciation worksheet | Verified asset facts, elections and approved depreciation rules | Compare applicable depreciation treatments | Asset treatment options with engine calculation references | Preparer |
| A25 | Payroll Tax Agent | 08–09 · Payroll review | Scoped payroll summaries and approved rules | Compare reported wages and withholding for inconsistencies | Payroll issue report with affected periods | Professional |
| A26 | Estimated Tax Agent | 08–09 · Estimated tax worksheet | Approved case totals, prior payments and deterministic calculator | Produce an estimate schedule and identify data gaps | Payment schedule proposal with assumptions | Professional |
| A27 | Tax Planning Agent | 08 · Planning / what-if workspace | Approved baseline, isolated scenario inputs and calculator | Compare scenarios under a stated rule set | Scenario report with assumptions and side-by-side totals | CPA/EA |
| A28 | Tax Calculation Verification Agent | 09–10 · Calculation verification | Approved input snapshot, engine version and outputs | Compare reproducible results and flag mismatches | Verification findings with input and rule references | Reviewer |
| A29 | Return Preparation Agent | 09 · Return assembly | Verified tax facts, case approvals and selected form set | Identify required return components and assembly gaps | Draft return assembly checklist and handoff dependencies | Preparer |
| A30 | Form Mapping Agent | 09 · Form mapping | Verified fields, form schema and approved line mappings | Propose field-to-line mappings and unresolved values | Staged mapping diff with schema and evidence versions | Preparer |
| A31 | Return Diagnostics Agent | 09–10 · Return diagnostics | Draft return snapshot, diagnostic rules and workpapers | Run consistency and completeness checks | Diagnostic findings grouped by severity and blocking status | Reviewer |
| A32 | Exception Agent | 06, 10, 14 · Exceptions / failed check | Scoped failing rule, affected task and assignment metadata | Suggest exception category, owner and next step | Exception draft with evidence and proposed route | Reviewer |
| A33 | Risk & Materiality Agent | 06, 10 · Risk review | Scoped risk signals and approved scoring thresholds | Explain material risk and request review for outliers | Risk assessment with rationale and source references | CPA/EA |
| A34 | Reviewer Agent | 06, 10 · Reviewer workspace | Case-scoped evidence completeness counts and allowed workflow status | Identify review questions and evidence gaps | Advisory reviewer checklist and evidence references | Human reviewer |
| A35 | Quality-Control Agent | 10 · Final quality-control queue | Reviewed return version, QC rules and open exceptions | Run independent final checklist and flag unresolved items | QC report for CPA/EA decision | CPA/EA |
| A36 | Signature Readiness Agent | 11 · Signature readiness | Approved return version, consent and signature package metadata | Check prerequisite and package freshness | Signature readiness checklist | Staff |
| A37 | Filing Readiness Agent | 12 · Filing readiness | Signed package status, authorization and validation metadata | Check required filing prerequisites and unresolved blockers | Filing readiness report for authorized filer | Authorized filer |
| A38 | Filing Agent | 12 · Filing handoff | Approved package metadata and readiness outcome | Prepare a handoff checklist for the authorized filer | Draft submission handoff with required approvals | Explicit authorization |
| A39 | Government Response Agent | 13 · Government feedback (reserved) | No access until the owner approves a responsibility and review gate | Keep handler and route unassigned | Owner decision required | Unassigned |
| A40 | Rejection Resolution Agent | 13–14 · Rejected filing work queue | Verified rejection codes and approved return snapshot | Explain likely cause and propose correction steps | Correction plan for preparer review | Preparer |
| A41 | Tax Notice Agent | 13–14 · Tax notice workspace | Released notice metadata and approved notice categories | Classify notice and identify required follow-up | Restricted notice summary with proposed deadlines | CPA/EA |
| A42 | Amendment Agent | 14 · Amendment workspace | Original filing version, new evidence and approved procedure | Identify amendment prerequisites and changed items | Amendment comparison and workflow proposal | CPA/EA |
| A43 | Client Communication Agent | 02, 14–17 · Staff communication center | Approved templates, scoped status and recipient role | Prepare a case update or reminder for review | Message draft and recipient confirmation checklist | Staff |
| A44 | Appointment Agent | 01, 15 · Calendar and appointment workspace | Authorized free/busy slots and appointment requirements | Propose available appointment times | Booking options for staff/client confirmation | Staff / client |
| A45 | Task Agent | 01–18 · Work queue / event rule | Scoped workflow events, task catalog and assignment rules | Draft a task or suggest an owner and due date | Task proposal with provenance and deduplication key | Policy-controlled |
| A46 | Deadline Agent | 15 · Deadline monitoring | Approved filing/payment calendar, verified jurisdiction and case status | Flag upcoming or overdue obligations | Deadline alert draft with source and date assumptions | Staff |
| A47 | Billing Agent | 15 · Billing workspace | Scoped engagement terms, approved charges and invoice status | Suggest invoice line items and flag billing discrepancies | Invoice draft or exception referral | Authorized staff |
| A48 | Payment Reconciliation Agent | 05, 15 · Payment reconciliation | Scoped settled payment metadata and invoice balances | Suggest payment-to-invoice matches and discrepancies | Reconciliation proposal for accounting | Accounting |
| A49 | Archive Agent | 16 · Archive checklist | Final return, evidence retention and case completeness metadata | Check archive prerequisites and retention category | Archive checklist and unresolved items | Staff |
| A50 | Renewal Agent | 17–18 · Renewal workspace | Eligible prior engagement metadata and current service catalog | Draft renewal checklist for client confirmation | Proposed next-year engagement and prerequisites | Staff |
| A51 | Audit Trail Agent | Admin · Audit Center / scheduled check | Scoped append-only audit event metadata and expected event model | Flag gaps or unexpected event sequences | Compliance investigation referral with event references | Compliance |
| A52 | Compliance Agent | Admin · Compliance review | Approved workflow policy and scoped case control evidence | Compare case decisions against policy | Compliance findings and remediation draft | Compliance officer |
| A53 | Privacy Agent | Admin · Privacy review | Data classification metadata, approved handling policy and redacted event samples | Flag unexpected retention, export or disclosure | Restricted privacy finding with minimal evidence | Security/compliance |
| A54 | Security Agent | Admin · Security review | Approved security telemetry and tenant-scoped incident metadata | Flag suspicious sign-in and access patterns | Incident triage alert for security staff | Security/admin |
| A55 | Access-Control Agent | Admin · Access review | Role and grant inventories, assignment metadata and approved policy tests | Flag privilege drift and unexpected access grants | Access review report for administrator approval | Admin |
| A56 | AI Governance Agent | Admin · AI Control Center | Registry, model and prompt versions, utilization and audit metadata | Flag configuration drift and usage outside approved limits | Governance alert and change proposal | Admin/compliance |
| A57 | Hallucination/Verification Agent | 06, 10, Admin · AI proposal review | Proposal claims, approved sources and cited evidence references | Identify unsupported or stale claims | Claim-by-claim verification findings | Human review |
| A58 | System Health Agent | Admin · Operations health | Redacted API, database and worker health metrics | Detect degraded service and growing queue age | Incident summary with observed indicators | Admin |
| A59 | Provider Integration Agent | Admin · Provider integrations | Approved integration status and redacted provider telemetry | Identify provider availability and configuration gaps | Integration incident or remediation recommendation | Admin |
| A60 | Practice Intelligence Agent | Admin · Practice dashboard | Authorized aggregate workload, SLA and review metrics | Surface bottlenecks by work group and period | Management dashboard insights and staffing proposals | Management |

## Build sequence and acceptance

1. **Shared execution and review.** Complete the authoritative dispatch boundary, queue lease and durable result transaction, Control Center evidence, and independent review UI. Verify revoked roles, changed evidence, replay, cancellation, retry, stale lease, audit durability, and fail-closed provider behavior.
2. **Collection pilot.** Start with A00, A09, A10 and A34. Align the Stage Two manifest resolver with current records. Add A05–A08 and A11 once the released-evidence and OCR staging contracts are verified. Test quarantined, superseded, wrong-year and mixed-scope documents.
3. **Client and staff workflows.** Extend A01–A04 and A43–A50 after consent, appointment, task, billing, archive and renewal approval paths are verified. Test drafts separately from staff-approved actions.
4. **Ledger and tax work.** Build A12–A31 against deterministic accounting and tax engines, approved source versions and synthetic workflows. Require reproducible calculations and cited evidence. Test unsupported entity, jurisdiction, tax year and rule versions.
5. **Return review to resolution.** Build A32–A42 in the case flow. Keep A39 reserved until defined and signing and submission limited to authorized humans. Test outdated packages, stale approval and duplicate submission prevention in synthetic fixtures.
6. **Controls and reporting.** Add A51–A60 as scoped monitoring and advisory tasks. Verify redaction, audit immutability, role and audience isolation, provider failure and aggregate suppression where required.

Existing development evidence covers bounded A00, A10 and A34 handlers plus a local A09 evaluator. A10 has a disposable PostgreSQL queue and result draft. The other 57 specialist designs are proposed. A21 follows the Overview's Individual Tax name while the conflicting directive label awaits reconciliation. A39 remains an owner decision. Staging validation and production commissioning require separate approval per agent.

[Architecture and hosting](ai-workforce-architecture.md) · [Local rehearsals](ai-workforce-rehearsal.md) · [Architecture reconciliation](ai-architecture-overview-reconciliation.md)
