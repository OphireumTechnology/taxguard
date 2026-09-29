# TAXGUARD COMPLETE SYSTEM DEVELOPMENT PROGRAM

Baseline:
M18.3 Production Authority Conversion

The M18.3 production-authority architecture is considered the
protected starting point.

Do not reintroduce demo/browser authority.

---

## M18.4 — Production Persistence

Implement durable authoritative persistence for:

- Tenant
- User
- Client
- Engagement
- Tax Year
- Tax Case
- Stage State
- Documents
- Evidence
- Extracted Fields
- Validation
- Exceptions
- Reviews
- Approvals
- Audit Events
- Return Versions
- Filing Records
- Government Acknowledgements
- Monitoring Records

Canonical hierarchy:

Authenticated User
→ Tenant
→ Client
→ Engagement
→ Tax Year
→ Tax Case

The server is authoritative.

Browser storage is not authoritative for tax decisions.

---

## CANONICAL STAGE ENGINE

Implement/reuse one server-authoritative stage engine.

Required operations:

evaluateStage
requestStageTransition
approveStageTransition
blockStage
reopenStage
invalidateDownstreamStages
getStageHistory

Every material transition must be audited.

Stage progression must never depend only on a frontend Next button.

---

## STAGE 01 — ONBOARD

Production-connect existing functionality:

Identity
Client Profile
Entity Information
Contact / Address
Authorization
Duplicate Check
Onboarding Gate

Persist authoritative Stage 01 state.

Duplicate-check unavailable must NOT mean CLEAR.

---

## STAGE 02 — COLLECT

Production-connect:

Required Documents
Document Intake
Classification
Missing Documents
Requests
Reminders
OCR Proposal
Provenance
Human Review
Collection Gate

Document states:

REQUESTED
RECEIVED
QUARANTINED
SCANNING
REJECTED
RELEASED
OCR_PENDING
OCR_COMPLETE
HUMAN_REVIEW_REQUIRED
VERIFIED
SUPERSEDED
ARCHIVED

---

## M18.5 — SECURE DOCUMENT PIPELINE

Required architecture:

Upload Request
→ Secure Storage
→ Quarantine
→ File Validation
→ Malware Scan
→ Controlled Release
→ OCR Queue
→ Extraction
→ Human Verification

If production scanning is unavailable:

DOCUMENT_INTAKE_NOT_READY

Never fake successful malware scanning.

Never mark upload as tax verified.

---

## M18.6 — DOCUMENT INTELLIGENCE

Provider-neutral OCR architecture.

Store:

documentId
page
field
proposedValue
confidence
boundingBox
sourceText
provider
providerVersion
timestamp
provenance

AI/OCR output remains proposed-only.

Preserve:

isAiProposedOnly: true

until authorized human acceptance.

If no provider exists:

OCR_PROVIDER_NOT_CONFIGURED

---

## STAGE 03 — VALIDATE

Production-connect:

Human Validation
Field Verification
Conflicts
Exceptions
Completeness
Maker-Checker
Professional Certification
Audit Trail
Validation Gate
Upstream Invalidation
Downstream Revalidation

Only accepted evidence may feed authoritative downstream work.

---

## STAGE 04 — RECORD

Implement accounting/tax record creation.

Support:

Income
Expenses
Assets
Liabilities
Equity / Capital
Withholding
Estimated Payments
Tax Payments
Adjustments
Basis Records
Carryforward Inputs

Every value must retain evidence provenance.

---

## STAGE 05 — RECONCILE

Implement:

Source-to-ledger reconciliation
Document-to-record reconciliation
Income reconciliation
Withholding reconciliation
Payment reconciliation
Carryforward reconciliation
Balance reconciliation
Duplicate detection
Variance detection
Unmatched items

Discrepancy states:

OPEN
INVESTIGATING
RESOLVED
WAIVED
ESCALATED

Material unresolved discrepancies block progression.

---

## STAGE 06 — REVIEW

Professional review workspace.

Include:

Case Summary
Evidence
Accounting Records
Reconciliations
Exceptions
Discrepancies
Reviewer Notes
Risk Indicators
Provenance

Actions:

Assign
Accept
Reject
Request Correction
Escalate
Complete Review

Maintain maker-checker separation.

---

## STAGE 07 — REPORT

Generate authoritative internal reports:

Income Summary
Expense Summary
Asset Summary
Payment Summary
Reconciliation Report
Exception Report
Evidence Report
Review Report
Audit Summary

Reports derive from authoritative case data.

---

## STAGE 08 — PLAN

Tax planning workspace.

Support:

Scenarios
Assumptions
Tax-year context
Estimated impact
Evidence
Professional notes
Review status

AI planning output is advisory only.

---

## STAGE 09 — PREPARE TAXES

Complete deterministic tax preparation architecture.

Tax calculations must be deterministic and versioned.

Store:

Rule Identifier
Tax Year
Inputs
Evidence
Calculation Version
Output
Timestamp

Never use an LLM as authoritative tax calculator.

---

## RETURN VERSION CONTROL

Statuses:

DRAFT
UNDER_REVIEW
CORRECTION_REQUIRED
READY_FOR_APPROVAL
APPROVED
SIGNED
FILED
SUPERSEDED

Approved versions cannot be silently modified.

Corrections create new versions.

---

## M18.8 — QUALITY CONTROL

Complete the existing QC architecture.

Evaluate:

Identity
Authorization
Evidence
Reconciliation
Tax Calculations
Review
Filing Readiness

Finding severity:

INFORMATIONAL
WARNING
MATERIAL
CRITICAL

Material and critical unresolved findings block approval.

---

## STAGE 10 — APPROVE

Require:

Completed preparation
Required reviews
QC pass
Resolved blocking exceptions
Maker-checker compliance
Authorized professional

Record:

Approver
Role
Timestamp
Return Version
Approval Basis

Approval must be server-authoritative.

---

## STAGE 11 — SIGN

Provider-neutral signature interface.

Support:

Signature Package
Signer
Document Version
Signature Request
Signature Status
Timestamp
Audit

If no provider is configured:

E_SIGNATURE_PROVIDER_NOT_CONFIGURED

Never fabricate a signature.

---

## STAGE 12 — FILE

Provider-neutral filing architecture.

Support:

Federal submission
State submission
Submission package
Submission ID
Submission timestamp
Provider response
Filing status

States:

NOT_READY
READY
QUEUED
SUBMITTED
ACCEPTED
REJECTED
REQUIRES_ACTION

Without production filing integration:

EXTERNAL_SUBMISSION_DISABLED

Never fake successful filing.

---

## STAGE 13 — GOVERNMENT FEEDBACK

Persist immutable government acknowledgements:

Submission Reference
Agency
Jurisdiction
Acknowledgement Code
Timestamp
Accepted / Rejected
Error Codes
Messages
Required Action

---

## STAGE 14 — RESOLVE

Resolution workflows:

Filing rejection
Government error
Client correction
Missing evidence
Payment discrepancy
Amended return requirement
Professional review issue

Maintain complete resolution history.

---

## STAGE 15 — MONITOR

Monitor:

Filing Status
Government Response
Payment Status
Open Exceptions
Deadlines
Follow-ups
Amendment Indicators

Do not fabricate external information.

---

## STAGE 16 — ARCHIVE

Create immutable archival package:

Final Return Version
Evidence Manifest
Approval Records
Signature Records
Filing Records
Government Acknowledgements
Audit Manifest
Hashes
Retention Metadata

Sensitive archives must never be public.

---

## STAGE 17 — RENEW

Prepare next-year engagement.

Carry forward only appropriate information.

Annual information requiring revalidation must not be
automatically accepted.

Maintain carryforward provenance.

---

## STAGE 18 — REPEAT

Create new tax-year workflow.

Prior year remains immutable historical evidence.

Create:

New Engagement / Case Context
New Document Requirements
New Authorization where required
New Stage States
New Tax Rule Version

Never overwrite prior-year records.

---

## CENTRAL EXCEPTION ENGINE

Each exception requires:

id
tenantId
caseId
type
severity
source
status
assignedRole
createdAt
resolution
resolvedAt
resolvedBy

Blocking exceptions prevent stage progression.

---

## AI GOVERNANCE

Preserve existing:

AIReasoningGateway
OpenAIReasoningProvider
TaxGuardOpenAIService

OpenAI calls remain SERVER SIDE.

Never use:

VITE_OPENAI_API_KEY

AI may assist with:

Classification
Extraction proposals
Summaries
Exception explanations
Planning proposals
Professional review assistance

AI cannot independently:

Verify identity
Verify evidence
Approve reconciliation
Approve return
Sign return
File return
Create authoritative tax liability

---

## AUDIT

Audit all material actions:

Authentication-sensitive operations
Client creation
Case creation
Document lifecycle
Validation
Record changes
Reconciliation
Exceptions
Stage transitions
Review
QC
Approval
Signature
Filing
Government feedback
Archive

Never unnecessarily place taxpayer PII or secrets in audit logs.

---

## SECURITY

Enforce:

Tenant isolation
Client isolation
Engagement isolation
Case isolation
Server RBAC
Maker-checker
Session validation
Input validation
Secret isolation
Safe errors
Audit
Secure document authorization

No production secret may be shipped to frontend code.

---

## DASHBOARDS

Complete:

Client Dashboard
Preparer Dashboard
Reviewer Dashboard
CPA / EA Dashboard
Administrator Dashboard
SecOps Dashboard

Use left navigation.

Collapse related modules.

Hide irrelevant content.

Stages unlock only after authoritative gate approval.

---

## PROVIDER READINESS

Track:

DATABASE
DOCUMENT_STORAGE
MALWARE_SCANNER
OCR
AI
EMAIL
E_SIGNATURE
IRS_FILING
STATE_FILING

States:

CONFIGURED
DEGRADED
NOT_CONFIGURED
DISABLED

Never show a provider as operational unless it actually is.

---

## STRUCTURED ERRORS

Support existing equivalents of:

AUTHENTICATION_REQUIRED
AUTHORIZATION_DENIED
CROSS_TENANT_ACCESS_DENIED
CLIENT_SCOPE_DENIED
ENGAGEMENT_SCOPE_REQUIRED
CASE_SCOPE_REQUIRED
SERVER_AUTHORITY_REQUIRED
DOCUMENT_INTAKE_NOT_READY
OCR_PROVIDER_NOT_CONFIGURED
MISSING_PROVENANCE
VALIDATION_REQUIRED
RECONCILIATION_REQUIRED
UNRESOLVED_EXCEPTION
MAKER_CHECKER_VIOLATION
QC_REQUIRED
APPROVAL_REQUIRED
E_SIGNATURE_PROVIDER_NOT_CONFIGURED
EXTERNAL_SUBMISSION_DISABLED
INVALID_STATE_TRANSITION
VERSION_CONFLICT

---

## REQUIRED TESTS

Maintain existing tests.

Add coverage for:

Tenant isolation
Client isolation
Engagement isolation
Case isolation
RBAC
Maker-checker
Stage transitions
Downstream invalidation
Document fail-closed
OCR fail-closed
Provenance
Duplicate handling
Reconciliation
Exceptions
Tax-rule versioning
Return versioning
QC
Approval
Signature fail-closed
Filing fail-closed
Government acknowledgements
Archive immutability
Renewal
Next-year creation
Audit events

---

## COMPLETION DEFINITION

TaxGuard application development is complete when:

Stages 01–18 are connected through authoritative case state.

Canonical records are server-authoritative.

Material values maintain provenance.

Material actions are auditable.

Stage gates enforce requirements.

Maker-checker is enforced.

AI remains advisory.

External services fail closed.

No demo authority exists in production.

No fake production success exists.

TypeScript passes.

Regression tests pass.

Production build passes.

Production authority tests pass.

Git integrity passes.

Security scans pass.

External providers must NOT be described as operational until
they are actually configured and tested.

Real taxpayer documents must remain blocked until secure
production storage, quarantine, malware scanning, isolation,
retention and recovery have passed production readiness review.
