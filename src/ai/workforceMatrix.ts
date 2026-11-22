import { CANONICAL_AGENTS } from './registry';
import { OVERVIEW_AGENTS } from './architectureOverview';
import type { AgentCategory, AgentId } from './types';

/**
 * Single repository-tracked 61-row AI Workforce Matrix (A00 through A60).
 *
 * Browser-safe and server-safe source of truth:
 * - Preserves every approved agent ID (A00–A60), name, purpose, workflow stage, and human review gate.
 * - Reports exact, separate totals for designed, locally implemented, website-integrated,
 *   staging-accepted, and production-commissioned agents.
 * - Never claims hosted staging acceptance or production commissioning without observed evidence.
 */

export type MatrixBatchId =
  | 'BATCH_1_FOUNDATION_COLLECTION'
  | 'BATCH_2_ACCOUNTING'
  | 'BATCH_3_TAX_PREPARATION'
  | 'BATCH_4_REVIEW_RELEASE'
  | 'BATCH_5_PRACTICE_OPERATIONS'
  | 'BATCH_6_ADMIN_GOVERNANCE';

export interface WorkforceMatrixRow {
  readonly agentId: AgentId;
  readonly canonicalName: string;
  readonly overviewName: string;
  readonly category: AgentCategory;
  readonly batchId: MatrixBatchId;
  readonly workflowStages: string;
  readonly designed: boolean;
  readonly locallyImplemented: boolean;
  readonly websiteIntegrated: boolean;
  readonly stagingAccepted: boolean;
  readonly productionCommissioned: boolean;
  // Nine required repository-tracked matrix columns:
  readonly plannedTaskAndSurface: string;
  readonly implementedDomainFunctionAndSourcePath: string;
  readonly authorizedInputsToolsAndAudience: string;
  readonly apiWorkerDbAndWebsiteIntegration: string;
  readonly humanReviewerAndPermittedDecisions: string;
  readonly localTestEvidence: string;
  readonly hostedStagingAcceptance: string;
  readonly productionCommissioningAndReleaseEvidence: string;
  readonly openDependencyOrOwnerDecision: string;
}

export interface WorkforceMatrixTotals {
  readonly totalRows: number;
  readonly designed: number;
  readonly locallyImplemented: number;
  readonly reservedFailClosed: number;
  readonly websiteIntegrated: number;
  readonly stagingAccepted: number;
  readonly productionCommissioned: number;
}

interface RowSpec {
  readonly batchId: MatrixBatchId;
  readonly stages: string;
  readonly surface: string;
  readonly fnName: string;
  readonly sourcePath: string;
  readonly inputsToolsAudience: string;
  readonly integration: string;
  readonly reviewerDecisions: string;
  readonly tests: string;
  readonly dependency: string;
  readonly implemented: boolean;
  readonly websiteIntegrated: boolean;
}

const B1 = 'src/server/ai/workforce/batches/batch1FoundationCollection.ts';
const B2 = 'src/server/ai/workforce/batches/batch2Accounting.ts';
const B3 = 'src/server/ai/workforce/batches/batch3TaxPreparation.ts';
const B4 = 'src/server/ai/workforce/batches/batch4ReviewRelease.ts';
const B5 = 'src/server/ai/workforce/batches/batch5PracticeOperations.ts';
const B6 = 'src/server/ai/workforce/batches/batch6AdminGovernance.ts';
const A10_PATH = 'src/server/ai/workforce/a10DuplicateWorkflow.ts + src/server/ai/documents/DocumentDuplicateAdvisory.ts';

const CASE_API = 'POST /api/ai-workforce/agents/:id/execute, GET /api/ai-workforce/cases/:caseId/advisories, POST /api/ai-workforce/advisories/:id/decisions; SQL ai_workforce_advisories/decisions; UI CaseAiWorkforcePanel + AiWorkforceMatrixView';
const ADMIN_API = 'POST /api/ai-workforce/agents/:id/execute, POST /api/ai-workforce/advisories/:id/decisions; SQL ai_workforce_advisories/decisions; UI AiWorkforceMatrixView (Admin Control Center)';

const ROW_SPECS: Readonly<Record<AgentId, RowSpec>> = Object.freeze({
  A00: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stages 1–18',
    surface: 'Supervisor/Orchestrator bounded stage routing (CaseWorkflowPanel & AI Control Center)',
    fnName: 'runA00SupervisorOrchestrator', sourcePath: `${B1} (composes canonicalRouting.ts)`,
    inputsToolsAudience: 'Inputs: scope, target_agents, stage | Tools: workflow.read | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER | ACKNOWLEDGE, APPROVE_PROPOSAL, REJECT_PROPOSAL',
    tests: 'src/tests/aiWorkforceBatches.test.ts, src/tests/aiWorkforceRoutesAndUi.test.ts',
    dependency: 'Owner commissioning approval & live model/prompt policy (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A01: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stages 1–2',
    surface: 'Client onboarding completeness detection (Staff Onboarding & Case Workflow)',
    fnName: 'runA01ClientOnboarding', sourcePath: B1,
    inputsToolsAudience: 'Inputs: scope, profile metadata | Tools: workflow.read, database.read | Audience: OPERATIONS_STAFF',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (OV-04 Staff→REVIEWER) | ACKNOWLEDGE, RETURN_FOR_CORRECTION, DISMISS',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A02: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stages 1–2',
    surface: 'Identity evidence consistency review (Onboarding & Case Workflow)',
    fnName: 'runA02IdentityVerification', sourcePath: B1,
    inputsToolsAudience: 'Inputs: scope, id_expires_on, name_matches_tax_record, evidence | Tools: document.read | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (OV-04) | ACKNOWLEDGE, ESCALATE, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & KYC verification sign-off policy (OV-06, OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A03: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stages 1–2',
    surface: 'Engagement workflow & IRC §7216 checklist determination (Case Workflow)',
    fnName: 'runA03Engagement', sourcePath: B1,
    inputsToolsAudience: 'Inputs: scope, entity_type, states | Tools: workflow.read | Audience: OPERATIONS_STAFF',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (OV-04) | ACKNOWLEDGE, APPROVE_PROPOSAL, REJECT_PROPOSAL',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A04: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stages 2–3',
    surface: 'Tax organizer questionnaire analysis & schedule trigger detection (Case Workflow)',
    fnName: 'runA04TaxOrganizer', sourcePath: B1,
    inputsToolsAudience: 'Inputs: scope, answers, required_questions | Tools: workflow.read | Audience: STAFF_PREPARER',
    integration: CASE_API,
    reviewerDecisions: 'PREPARER | ACKNOWLEDGE, RETURN_FOR_CORRECTION, DISMISS',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A05: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stage 3',
    surface: 'Document intake metadata, file type & clean-scan gate (Stage 3 Document Queue)',
    fnName: 'runA05DocumentIntake', sourcePath: B1,
    inputsToolsAudience: 'Inputs: scope, authorized clean evidence_source_ids | Tools: document.read | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (OV-04) | ACKNOWLEDGE, RETURN_FOR_CORRECTION, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A06: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stages 3–4',
    surface: 'Tax document classification advisory W-2/1099/K-1/1098/receipts (Case Workflow)',
    fnName: 'runA06DocumentClassification', sourcePath: B1,
    inputsToolsAudience: 'Inputs: scope, evidence_source_ids, document_descriptors | Tools: document.read | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER | APPROVE_PROPOSAL, REJECT_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A07: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stages 3–4',
    surface: 'OCR structured field extraction gated on approved OCR provider + verifiable lineage (Case Workflow)',
    fnName: 'runA07OcrExtraction', sourcePath: B1,
    inputsToolsAudience: 'Inputs: scope, evidence_source_ids, provider_extractions | Tools: document.read, ocr.extract | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER | APPROVE_PROPOSAL, REJECT_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts (tests both unconfigured fail-closed & lineage-verified staging path)',
    dependency: 'OPEN: Owner-approved OCR provider configuration & cryptographic document lineage service required',
    implemented: true, websiteIntegrated: true,
  },
  A08: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stages 3–4',
    surface: 'Extracted field cross-validation against source metadata & math invariants (Case Workflow)',
    fnName: 'runA08DocumentValidation', sourcePath: B1,
    inputsToolsAudience: 'Inputs: scope, evidence_source_ids, extracted_fields | Tools: document.read | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER | ACKNOWLEDGE, RETURN_FOR_CORRECTION, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A09: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stages 3–4',
    surface: 'Missing evidence comparison vs. prior-year & organizer expectations (Case Workflow)',
    fnName: 'runA09MissingDocument', sourcePath: B1,
    inputsToolsAudience: 'Inputs: scope, expected_document_types, received_document_types | Tools: document.read, workflow.read | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (OV-04) | ACKNOWLEDGE, DISMISS, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A10: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stage 3',
    surface: 'Pilot: Exact SHA-256 byte-duplicate document advisory (StageThreeDuplicateAdvisoryPanel in CaseWorkflowPanel)',
    fnName: 'A10DuplicateWorkflowService + inspectSelectedDocumentDuplicates', sourcePath: A10_PATH,
    inputsToolsAudience: 'Inputs: scope, 1–10 authorized clean RELEASED/VERIFIED evidence_source_ids | Tools: document.read | Audience: STAFF_REVIEWER',
    integration: 'POST /api/ai-workforce/a10/jobs, POST /api/ai-workforce/a10/jobs/:jobId/process, GET /api/ai-workforce/cases/:caseId/advisories, POST /api/ai-workforce/advisories/:id/decisions; SQL ai_workforce_jobs/advisories/decisions; UI StageThreeDuplicateAdvisoryPanel',
    reviewerDecisions: 'PENDING_OWNER_APPROVAL (live decision blocked; synthetic staging permission tested) | ACKNOWLEDGE, ESCALATE, DISMISS, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceA10Pilot.test.ts, src/tests/aiWorkforceBatches.test.ts, src/tests/aiWorkforceRoutesAndUi.test.ts',
    dependency: 'OPEN: Owner approval of A10 production reviewer role required before enabling live decision button (OV-01 narrow scope retained)',
    implemented: true, websiteIntegrated: true,
  },
  A11: {
    batchId: 'BATCH_1_FOUNDATION_COLLECTION', stages: 'Stages 3–5',
    surface: 'Hash-linked source-to-fact evidence chain builder (Case Workflow & Reviewer Traceability)',
    fnName: 'runA11EvidenceChain', sourcePath: B1,
    inputsToolsAudience: 'Inputs: scope, evidence_source_ids, case_facts | Tools: document.read | Audience: STAFF_PREPARER',
    integration: CASE_API,
    reviewerDecisions: 'PREPARER | ACKNOWLEDGE, APPROVE_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A12: {
    batchId: 'BATCH_2_ACCOUNTING', stages: 'Stages 4–6',
    surface: 'Transaction classification proposals preserving accountant posting authority (Bookkeeper/Accountant Workspace)',
    fnName: 'runA12Bookkeeping', sourcePath: B2,
    inputsToolsAudience: 'Inputs: scope, transactions | Tools: database.read | Audience: ACCOUNTANT',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (Accountant role mapping OV-04) | APPROVE_PROPOSAL, REJECT_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 mapping "Accountant" gate + staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A13: {
    batchId: 'BATCH_2_ACCOUNTING', stages: 'Stages 5–6',
    surface: 'Integer-cent bank vs. ledger reconciliation variance detection (Accountant Workspace)',
    fnName: 'runA13Reconciliation', sourcePath: B2,
    inputsToolsAudience: 'Inputs: scope, bank/ledger ending cents, deposits in transit, outstanding checks | Tools: database.read | Audience: ACCOUNTANT',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (Accountant gate OV-04) | ACKNOWLEDGE, RETURN_FOR_CORRECTION, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 mapping "Accountant" gate + staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A14: {
    batchId: 'BATCH_2_ACCOUNTING', stages: 'Stages 5–6',
    surface: 'Strictly balanced debit=credit adjusting journal proposals without ledger posting (Accountant Workspace)',
    fnName: 'runA14JournalEntry', sourcePath: B2,
    inputsToolsAudience: 'Inputs: scope, balanced cent journal lines | Tools: database.read, workflow.propose | Audience: ACCOUNTANT',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (Accountant gate OV-04) | APPROVE_PROPOSAL, REJECT_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 mapping "Accountant" gate + accountant posting authority preserved',
    implemented: true, websiteIntegrated: true,
  },
  A15: {
    batchId: 'BATCH_2_ACCOUNTING', stages: 'Stages 6–7',
    surface: 'Financial statement A=L+E tie-out, P&L net income & margin analysis (Ledger Reports)',
    fnName: 'runA15FinancialStatement', sourcePath: B2,
    inputsToolsAudience: 'Inputs: scope, assets/liabilities/equity/revenue/expenses cents | Tools: database.read | Audience: ACCOUNTANT',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (Accountant gate OV-04) | ACKNOWLEDGE, RETURN_FOR_CORRECTION, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 mapping "Accountant" gate + staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A16: {
    batchId: 'BATCH_2_ACCOUNTING', stages: 'Stages 6–8',
    surface: 'Schedule M-1/M-3 permanent & temporary book-to-tax bridge advisory (BookToTaxPanel & Case Workflow)',
    fnName: 'runA16BookToTax', sourcePath: B2,
    inputsToolsAudience: 'Inputs: scope, book income, meals, penalties, book/tax depreciation cents | Tools: database.read, tax_authority.search | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA (Tax professional gate OV-04) | APPROVE_PROPOSAL, REJECT_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 mapping "Tax professional" gate + staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A17: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 7–10',
    surface: 'Versioned tax authority research compilation & missing-authority escalation (CaseResearchPanel)',
    fnName: 'runA17TaxResearch', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, tax_issue, authority_citations | Tools: tax_authority.search | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA | APPROVE_PROPOSAL, REJECT_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Approved Knowledge Engine authority corpus & staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A18: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 8–10',
    surface: 'Federal gross income, AGI & standard vs. itemized deduction analysis (Case Workflow)',
    fnName: 'runA18FederalTax', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, filing_status, gross_income, adjustments, itemized cents | Tools: tax_authority.search, calculation.execute | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA (Preparer/CPA gate OV-04) | ACKNOWLEDGE, APPROVE_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Versioned federal tax-year tables & owner decision OV-04',
    implemented: true, websiteIntegrated: true,
  },
  A19: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 8–10',
    surface: 'Multi-state residency, non-resident nexus & conformity advisory (Case Workflow)',
    fnName: 'runA19StateTax', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, resident_state, income_source_states | Tools: tax_authority.search | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA (Preparer/CPA gate OV-04) | ACKNOWLEDGE, APPROVE_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Versioned state conformity rules & owner decision OV-04',
    implemented: true, websiteIntegrated: true,
  },
  A20: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 8–10',
    surface: 'Entity structure & eligibility review for LLC, 1065, 1120-S, 1120 (Case Workflow)',
    fnName: 'runA20EntityTax', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, entity_type, owner_count, officer_compensation, distributions | Tools: tax_authority.search | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA | ACKNOWLEDGE, APPROVE_PROPOSAL, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A21: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 8–10',
    surface: 'Individual Form 1040 income stream & Schedule SE trigger analysis (Case Workflow)',
    fnName: 'runA21IndividualTax', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, w2_wages, schedule_c_net, investment_income cents | Tools: calculation.execute | Audience: STAFF_PREPARER',
    integration: CASE_API,
    reviewerDecisions: 'PREPARER | ACKNOWLEDGE, APPROVE_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-12 confirming Individual vs. International naming',
    implemented: true, websiteIntegrated: true,
  },
  A22: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 8–10',
    surface: 'Deduction screening with statutory SALT cap & substantiation alerts (Case Workflow)',
    fnName: 'runA22Deduction', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, filing_status, SALT, mortgage interest, charitable cents | Tools: tax_authority.search | Audience: STAFF_PREPARER',
    integration: CASE_API,
    reviewerDecisions: 'PREPARER | ACKNOWLEDGE, APPROVE_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A23: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 8–10',
    surface: 'Tax credit eligibility, phaseout math & Form 8867 due-diligence flag (Case Workflow)',
    fnName: 'runA23Credit', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, qualifying_children_under_17, agi_cents, filing_status | Tools: tax_authority.search, calculation.execute | Audience: STAFF_PREPARER',
    integration: CASE_API,
    reviewerDecisions: 'PREPARER | ACKNOWLEDGE, APPROVE_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A24: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 8–10',
    surface: 'Fixed asset basis, recovery period & MACRS/§179 review advisory (Case Workflow)',
    fnName: 'runA24Depreciation', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, cost_basis_cents, recovery_period_years | Tools: calculation.execute | Audience: STAFF_PREPARER',
    integration: CASE_API,
    reviewerDecisions: 'PREPARER | ACKNOWLEDGE, APPROVE_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A25: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 8–10',
    surface: 'Form 941 quarterly wages vs. Form W-3/W-2 reconciliation check (Case Workflow)',
    fnName: 'runA25PayrollTax', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, form_941_total_wages_cents, form_w3_total_wages_cents | Tools: database.read | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (Professional gate OV-04) | ACKNOWLEDGE, RETURN_FOR_CORRECTION, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 mapping "Professional" gate + staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A26: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 9–11',
    surface: 'IRC §6654 safe-harbor quarterly estimated tax voucher projection (Case Workflow)',
    fnName: 'runA26EstimatedTax', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, prior_year_tax, prior_year_agi, projected_tax, withholding cents | Tools: calculation.execute | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (Professional gate OV-04) | ACKNOWLEDGE, APPROVE_PROPOSAL, REJECT_PROPOSAL',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 mapping "Professional" gate + staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A27: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 9–11',
    surface: 'Baseline vs. tax planning scenario comparison advisory (Case Workflow)',
    fnName: 'runA27TaxPlanning', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, strategy_name, baseline_tax_cents, scenario_tax_cents | Tools: calculation.execute, tax_authority.search | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA | ACKNOWLEDGE, APPROVE_PROPOSAL, REJECT_PROPOSAL',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A28: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 10–12',
    surface: 'Deterministic calculation run tie-out verification (CaseWorkflowPanel Calculation Runs)',
    fnName: 'runA28CalculationVerification', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, computed_total_tax, payments_and_credits, reported_balance_due/refund cents | Tools: calculation.execute | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER | ACKNOWLEDGE, RETURN_FOR_CORRECTION, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A29: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 10–11',
    surface: 'Return preparation prerequisite verification without writing return (CaseDraftReturnPanel)',
    fnName: 'runA29ReturnPreparation', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, prerequisite booleans, open_blocking_exceptions | Tools: workflow.read | Audience: STAFF_PREPARER',
    integration: CASE_API,
    reviewerDecisions: 'PREPARER | ACKNOWLEDGE, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Human-only return write authority preserved (OV-06)',
    implemented: true, websiteIntegrated: true,
  },
  A30: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 10–11',
    surface: 'Validated case-fact to IRS form line mapping proposals (CaseFormMappingPanel)',
    fnName: 'runA30FormMapping', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, form_id, fact_values | Tools: workflow.read, workflow.propose | Audience: STAFF_PREPARER',
    integration: CASE_API,
    reviewerDecisions: 'PREPARER | APPROVE_PROPOSAL, REJECT_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Human-only return mutation authority preserved (OV-06)',
    implemented: true, websiteIntegrated: true,
  },
  A31: {
    batchId: 'BATCH_3_TAX_PREPARATION', stages: 'Stages 11–12',
    surface: 'Cross-form return completeness & consistency diagnostics (CaseReadinessPanel)',
    fnName: 'runA31ReturnDiagnostics', sourcePath: B3,
    inputsToolsAudience: 'Inputs: scope, schedule flags, filing_status, income/tax cents | Tools: workflow.read | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER | ACKNOWLEDGE, RETURN_FOR_CORRECTION, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A32: {
    batchId: 'BATCH_4_REVIEW_RELEASE', stages: 'Stages 11–13',
    surface: 'Exception classification & human reviewer routing (ReviewerCasePanels Exceptions)',
    fnName: 'runA32Exception', sourcePath: B4,
    inputsToolsAudience: 'Inputs: scope, exceptions | Tools: workflow.read | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER | ACKNOWLEDGE, ESCALATE, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A33: {
    batchId: 'BATCH_4_REVIEW_RELEASE', stages: 'Stages 12–14',
    surface: 'Materiality & risk scoring advisory with zero auto-approval (ReviewerCasePanels)',
    fnName: 'runA33RiskMateriality', sourcePath: B4,
    inputsToolsAudience: 'Inputs: scope, gross_income, disputed_position, open_exceptions, foreign_reporting | Tools: workflow.read | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA | ACKNOWLEDGE, ESCALATE, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'OV-09 enforced (no risk-based auto-approval); staging acceptance pending',
    implemented: true, websiteIntegrated: true,
  },
  A34: {
    batchId: 'BATCH_4_REVIEW_RELEASE', stages: 'Stages 12–14',
    surface: 'Second-level review questions & evidence completeness (ReviewerCasePanels AI Findings)',
    fnName: 'runA34ReviewerSupport (extends canonicalRouting A34)', sourcePath: `${B4} + src/server/ai/orchestration/canonicalRouting.ts`,
    inputsToolsAudience: 'Inputs: scope, review_questions, workpapers_complete, unresolved_diagnostics, evidence | Tools: workflow.read | Audience: STAFF_REVIEWER',
    integration: `${CASE_API} + ReviewerCasePanels AI Findings tab`,
    reviewerDecisions: 'REVIEWER | ACKNOWLEDGE, RETURN_FOR_CORRECTION, REJECT_PROPOSAL',
    tests: 'src/tests/aiWorkforceBatches.test.ts, src/tests/aiWorkforceRoutesAndUi.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A35: {
    batchId: 'BATCH_4_REVIEW_RELEASE', stages: 'Stages 14–15',
    surface: 'Independent final QC gate verification (QualityControlQueuePanel)',
    fnName: 'runA35QualityControl', sourcePath: B4,
    inputsToolsAudience: 'Inputs: scope, second_level_review_signed, critical_diagnostics, reconciliations_tied, citations_verified | Tools: workflow.read | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA | ACKNOWLEDGE, RETURN_FOR_CORRECTION, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A36: {
    batchId: 'BATCH_4_REVIEW_RELEASE', stages: 'Stages 15–16',
    surface: 'Form 8879/8878 signature readiness check without signing (SignatureReleaseForm)',
    fnName: 'runA36SignatureReadiness', sourcePath: B4,
    inputsToolsAudience: 'Inputs: scope, qc_approved, identity_verified, open_exceptions, final_return_locked | Tools: workflow.read | Audience: STAFF_REVIEWER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (OV-04) | ACKNOWLEDGE, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Human-only signing authority preserved (OV-06)',
    implemented: true, websiteIntegrated: true,
  },
  A37: {
    batchId: 'BATCH_4_REVIEW_RELEASE', stages: 'Stages 16–17',
    surface: 'Pre-filing gate verification without filing (FinalAuthorizationQueuePanel)',
    fnName: 'runA37FilingReadiness', sourcePath: B4,
    inputsToolsAudience: 'Inputs: scope, form_8879_signed, cpa_release_recorded, blocking_diagnostics, filing_authorization_confirmed | Tools: workflow.read | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA (Authorized filer gate OV-04) | ACKNOWLEDGE, RETURN_FOR_CORRECTION, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 & OV-10 (live filing disabled)',
    implemented: true, websiteIntegrated: true,
  },
  A38: {
    batchId: 'BATCH_4_REVIEW_RELEASE', stages: 'Stage 17',
    surface: 'Advisory filing manifest & checksum builder only; live transmission disabled (FinalAuthorizationQueuePanel)',
    fnName: 'runA38FilingManifest', sourcePath: B4,
    inputsToolsAudience: 'Inputs: scope, included_forms | Tools: filing.prepare | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA (Explicit authorization OV-06/OV-10) | ACKNOWLEDGE, REJECT_PROPOSAL',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'OPEN: Live IRS/state e-file transmission permanently blocked until separate owner cutover (OV-10)',
    implemented: true, websiteIntegrated: true,
  },
  A39: {
    batchId: 'BATCH_4_REVIEW_RELEASE', stages: 'Reserved (Unassigned)',
    surface: 'RESERVED — Government Response Agent (unassigned per owner decision OV-01)',
    fnName: 'runA39GovernmentResponseReserved (fail-closed 503)', sourcePath: B4,
    inputsToolsAudience: 'Inputs: NONE (blocked) | Tools: NONE (blocked) | Audience: UNASSIGNED',
    integration: 'Fail-closed 503 AI_AGENT_RESERVED_PENDING_OWNER_DEFINITION in WorkforceDispatcher & /api/ai-workforce; displayed as Reserved in AiWorkforceMatrixView',
    reviewerDecisions: 'UNASSIGNED | NONE (blocked until owner supplies definition & reviewer role)',
    tests: 'src/tests/aiWorkforceBatches.test.ts, src/tests/aiWorkforceMatrix.test.ts (asserts fail-closed 503)',
    dependency: 'OPEN OWNER DECISION (OV-01): Owner must define responsibility, workflow stage, and reviewer role before implementation',
    implemented: false, websiteIntegrated: false,
  },
  A40: {
    batchId: 'BATCH_4_REVIEW_RELEASE', stages: 'Stages 17–18',
    surface: 'MeF rejection code diagnosis & workpaper remediation advisory (Case Workflow)',
    fnName: 'runA40RejectionResolution', sourcePath: B4,
    inputsToolsAudience: 'Inputs: scope, rejection_code | Tools: workflow.read | Audience: STAFF_PREPARER',
    integration: CASE_API,
    reviewerDecisions: 'PREPARER | ACKNOWLEDGE, RETURN_FOR_CORRECTION, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A41: {
    batchId: 'BATCH_4_REVIEW_RELEASE', stages: 'Stage 18',
    surface: 'IRS/state notice classification & statutory response deadline calculation (Case Workflow)',
    fnName: 'runA41TaxNotice', sourcePath: B4,
    inputsToolsAudience: 'Inputs: scope, notice_code, notice_date | Tools: workflow.read, tax_authority.search | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA | ACKNOWLEDGE, ESCALATE, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A42: {
    batchId: 'BATCH_4_REVIEW_RELEASE', stages: 'Stage 18',
    surface: 'Amended return tax variance & Form 1040-X/1120-X prerequisite analysis (Case Workflow)',
    fnName: 'runA42Amendment', sourcePath: B4,
    inputsToolsAudience: 'Inputs: scope, original_tax_cents, corrected_tax_cents, amendment_reason | Tools: workflow.read, calculation.execute | Audience: CPA_EA',
    integration: CASE_API,
    reviewerDecisions: 'CPA_EA | APPROVE_PROPOSAL, REJECT_PROPOSAL, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A43: {
    batchId: 'BATCH_5_PRACTICE_OPERATIONS', stages: 'Stages 1–4, 15, 18',
    surface: 'Client communication draft generator behind staff outbound approval (Practice Operations / Case Workflow)',
    fnName: 'runA43ClientCommunication', sourcePath: B5,
    inputsToolsAudience: 'Inputs: scope, topic, requested_items | Tools: message.draft | Audience: CLIENT_DRAFT_FOR_STAFF_APPROVAL',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (OV-04) | APPROVE_PROPOSAL, REJECT_PROPOSAL, RETURN_FOR_CORRECTION (never auto-sends)',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'External client messaging remains strictly human-authorized',
    implemented: true, websiteIntegrated: true,
  },
  A44: {
    batchId: 'BATCH_5_PRACTICE_OPERATIONS', stages: 'Stages 1–2, 15, 18',
    surface: 'Appointment slot & agenda proposal behind staff confirmation (Scheduling / Case Workflow)',
    fnName: 'runA44Appointment', sourcePath: B5,
    inputsToolsAudience: 'Inputs: scope, preferred_slots_iso, meeting_purpose | Tools: calendar.read | Audience: OPERATIONS_STAFF',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (OV-05: staff only; client cannot approve AI work) | APPROVE_PROPOSAL, REJECT_PROPOSAL',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-05 enforced; staging acceptance pending',
    implemented: true, websiteIntegrated: true,
  },
  A45: {
    batchId: 'BATCH_5_PRACTICE_OPERATIONS', stages: 'Stages 1–18',
    surface: 'Policy-controlled workflow task proposals without autonomous mutation (Practice Operations)',
    fnName: 'runA45TaskProposal', sourcePath: B5,
    inputsToolsAudience: 'Inputs: scope, task_title, due_date, assignee_role | Tools: workflow.propose | Audience: OPERATIONS_STAFF',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (Policy-controlled gate OV-04) | APPROVE_PROPOSAL, REJECT_PROPOSAL',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 & staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A46: {
    batchId: 'BATCH_5_PRACTICE_OPERATIONS', stages: 'Stages 1–3, 10, 15–17',
    surface: 'Statutory filing/extension deadline tracking & escalation alerts (DeadlineEscalationsPanel)',
    fnName: 'runA46Deadline', sourcePath: B5,
    inputsToolsAudience: 'Inputs: scope, entity_type, as_of_date | Tools: calendar.read, workflow.read | Audience: PRACTICE_MANAGER',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (OV-04) | ACKNOWLEDGE, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A47: {
    batchId: 'BATCH_5_PRACTICE_OPERATIONS', stages: 'Stages 2, 15, 18',
    surface: 'Draft fee/invoice summary without issuing invoices or charging payments (Billing)',
    fnName: 'runA47Billing', sourcePath: B5,
    inputsToolsAudience: 'Inputs: scope, line_items (integer cents) | Tools: billing.read | Audience: OPERATIONS_STAFF',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (Authorized staff gate OV-04/OV-10) | APPROVE_PROPOSAL, REJECT_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Live payments & autonomous invoicing remain disabled (OV-10)',
    implemented: true, websiteIntegrated: true,
  },
  A48: {
    batchId: 'BATCH_5_PRACTICE_OPERATIONS', stages: 'Stages 15, 18',
    surface: 'Payment receipt-to-invoice matching in integer cents (Billing / Accounting)',
    fnName: 'runA48PaymentReconciliation', sourcePath: B5,
    inputsToolsAudience: 'Inputs: scope, invoice_total_cents, payments_received_cents | Tools: billing.read | Audience: ACCOUNTANT',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (Accounting gate OV-04) | ACKNOWLEDGE, RETURN_FOR_CORRECTION, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 & staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A49: {
    batchId: 'BATCH_5_PRACTICE_OPERATIONS', stages: 'Stage 18',
    surface: 'Retention package completeness check prior to case archival (Case Workflow)',
    fnName: 'runA49Archive', sourcePath: B5,
    inputsToolsAudience: 'Inputs: scope, retention artifact booleans | Tools: workflow.read | Audience: OPERATIONS_STAFF',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (OV-04) | ACKNOWLEDGE, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A50: {
    batchId: 'BATCH_5_PRACTICE_OPERATIONS', stages: 'Stage 18',
    surface: 'Next-tax-year engagement rollover & carryover checklist preparation (Case Workflow)',
    fnName: 'runA50Renewal', sourcePath: B5,
    inputsToolsAudience: 'Inputs: scope, carryover_items, prior_year_document_types | Tools: workflow.read | Audience: OPERATIONS_STAFF',
    integration: CASE_API,
    reviewerDecisions: 'REVIEWER (OV-04) | ACKNOWLEDGE, APPROVE_PROPOSAL, DISMISS',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A51: {
    batchId: 'BATCH_6_ADMIN_GOVERNANCE', stages: 'Tenant-wide (Stages 1–18)',
    surface: 'Tenant audit-trail continuity & correlation anomaly detection (AuditCenterPanel & AI Control Center)',
    fnName: 'runA51AuditTrail', sourcePath: B6,
    inputsToolsAudience: 'Inputs: tenant scope, audit event counters | Tools: database.read | Audience: COMPLIANCE_SECURITY_ADMIN',
    integration: ADMIN_API,
    reviewerDecisions: 'REVIEWER (Compliance gate OV-04) | ACKNOWLEDGE, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 mapping Compliance role + staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A52: {
    batchId: 'BATCH_6_ADMIN_GOVERNANCE', stages: 'Tenant-wide (Stages 1–18)',
    surface: 'Workflow-policy & Circular 230 compliance evaluation (AI Control Center)',
    fnName: 'runA52Compliance', sourcePath: B6,
    inputsToolsAudience: 'Inputs: tenant scope, maker_checker_violations, skipped_stage_gates, unreviewed_disclosures | Tools: database.read, workflow.read | Audience: COMPLIANCE_SECURITY_ADMIN',
    integration: ADMIN_API,
    reviewerDecisions: 'REVIEWER (Compliance officer gate OV-04) | ACKNOWLEDGE, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 & staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A53: {
    batchId: 'BATCH_6_ADMIN_GOVERNANCE', stages: 'Tenant-wide (Stages 1–18)',
    surface: 'Sensitive-data & IRC §7216 privacy boundary monitoring without raw PII logging (AI Control Center)',
    fnName: 'runA53Privacy', sourcePath: B6,
    inputsToolsAudience: 'Inputs: tenant scope, unmasked_pii_field_names, unencrypted_export_attempts | Tools: database.read | Audience: COMPLIANCE_SECURITY_ADMIN',
    integration: ADMIN_API,
    reviewerDecisions: 'REVIEWER (Security/compliance gate OV-04) | ACKNOWLEDGE, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 & staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A54: {
    batchId: 'BATCH_6_ADMIN_GOVERNANCE', stages: 'Tenant-wide (Stages 1–18)',
    surface: 'Suspicious activity, cross-tenant probe & prompt-injection anomaly monitoring (AI Control Center)',
    fnName: 'runA54Security', sourcePath: B6,
    inputsToolsAudience: 'Inputs: tenant scope, 24h security counters | Tools: database.read | Audience: COMPLIANCE_SECURITY_ADMIN',
    integration: ADMIN_API,
    reviewerDecisions: 'REVIEWER (Security/admin gate OV-04) | ACKNOWLEDGE, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 & staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A55: {
    batchId: 'BATCH_6_ADMIN_GOVERNANCE', stages: 'Tenant-wide (Stages 1–18)',
    surface: 'RBAC/RLS hygiene, MFA enrollment & expired credential anomaly review (StaffAccessManagementPanel & AI Control Center)',
    fnName: 'runA55AccessControl', sourcePath: B6,
    inputsToolsAudience: 'Inputs: tenant scope, expired_credentials, orphaned_assignments, staff_without_mfa | Tools: database.read | Audience: COMPLIANCE_SECURITY_ADMIN',
    integration: ADMIN_API,
    reviewerDecisions: 'REVIEWER (Admin gate OV-04; never mutates permissions) | ACKNOWLEDGE, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 & staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A56: {
    batchId: 'BATCH_6_ADMIN_GOVERNANCE', stages: 'Tenant-wide (Stages 1–18)',
    surface: 'Model/prompt/budget governance & kill-switch monitoring (AI Control Center)',
    fnName: 'runA56AiGovernance', sourcePath: B6,
    inputsToolsAudience: 'Inputs: tenant scope, active_kill_switches, unapproved_model_attempts, budget_breaches | Tools: database.read | Audience: COMPLIANCE_SECURITY_ADMIN',
    integration: ADMIN_API,
    reviewerDecisions: 'REVIEWER (Admin/compliance gate OV-04) | ACKNOWLEDGE, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 & staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A57: {
    batchId: 'BATCH_6_ADMIN_GOVERNANCE', stages: 'Tenant-wide (Stages 1–18)',
    surface: 'Unsupported AI conclusion verification challenge (ReviewerCasePanels & AI Control Center)',
    fnName: 'runA57HallucinationVerification', sourcePath: B6,
    inputsToolsAudience: 'Inputs: scope, claims with evidence_source_ids & authority_citations | Tools: workflow.read | Audience: STAFF_REVIEWER',
    integration: ADMIN_API,
    reviewerDecisions: 'REVIEWER | ACKNOWLEDGE, REJECT_PROPOSAL, RETURN_FOR_CORRECTION',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner commissioning & staging acceptance (OV-13)',
    implemented: true, websiteIntegrated: true,
  },
  A58: {
    batchId: 'BATCH_6_ADMIN_GOVERNANCE', stages: 'Tenant-wide (Ops)',
    surface: 'Backend service readiness, DB schema & job queue health analysis (AdminOperationalPanel & AI Control Center)',
    fnName: 'runA58SystemHealth', sourcePath: B6,
    inputsToolsAudience: 'Inputs: tenant scope, database_ready, auth_ready, failed_jobs_count, http_5xx_count_1h | Tools: database.read | Audience: COMPLIANCE_SECURITY_ADMIN',
    integration: ADMIN_API,
    reviewerDecisions: 'REVIEWER (Admin gate OV-04) | ACKNOWLEDGE, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 & staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A59: {
    batchId: 'BATCH_6_ADMIN_GOVERNANCE', stages: 'Tenant-wide (Ops)',
    surface: 'External provider readiness & connectivity check without secret leakage (AI Control Center)',
    fnName: 'runA59ProviderIntegration', sourcePath: B6,
    inputsToolsAudience: 'Inputs: tenant scope, provider readiness statuses | Tools: database.read | Audience: COMPLIANCE_SECURITY_ADMIN',
    integration: ADMIN_API,
    reviewerDecisions: 'REVIEWER (Admin gate OV-04) | ACKNOWLEDGE, ESCALATE',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 & staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
  A60: {
    batchId: 'BATCH_6_ADMIN_GOVERNANCE', stages: 'Tenant-wide (Ops)',
    surface: 'Deterministic tenant workload & stage bottleneck analytics (PracticeSummaryPanel & AI Control Center)',
    fnName: 'runA60PracticeIntelligence', sourcePath: B6,
    inputsToolsAudience: 'Inputs: tenant scope, cases_by_stage counts | Tools: database.read | Audience: PRACTICE_MANAGER',
    integration: ADMIN_API,
    reviewerDecisions: 'REVIEWER (Management gate OV-04) | ACKNOWLEDGE, DISMISS',
    tests: 'src/tests/aiWorkforceBatches.test.ts',
    dependency: 'Owner decision OV-04 & staging acceptance',
    implemented: true, websiteIntegrated: true,
  },
});

const OVERVIEW_BY_ID = new Map(OVERVIEW_AGENTS.map(a => [a.agent_id, a]));

export function buildWorkforceMatrix(): readonly WorkforceMatrixRow[] {
  return Object.freeze(
    CANONICAL_AGENTS.map(canonical => {
      const overview = OVERVIEW_BY_ID.get(canonical.agent_id)!;
      const spec = ROW_SPECS[canonical.agent_id];
      return Object.freeze({
        agentId: canonical.agent_id,
        canonicalName: canonical.agent_name,
        overviewName: overview.overview_name,
        category: canonical.category,
        batchId: spec.batchId,
        workflowStages: spec.stages,
        designed: true,
        locallyImplemented: spec.implemented,
        websiteIntegrated: spec.websiteIntegrated,
        stagingAccepted: false,
        productionCommissioned: false,
        plannedTaskAndSurface: `${overview.responsibility ?? 'Reserved / Narrow existing scope (OV-01)'} — ${spec.surface}`,
        implementedDomainFunctionAndSourcePath: `${spec.fnName} (${spec.sourcePath})`,
        authorizedInputsToolsAndAudience: spec.inputsToolsAudience,
        apiWorkerDbAndWebsiteIntegration: spec.integration,
        humanReviewerAndPermittedDecisions: spec.reviewerDecisions,
        localTestEvidence: spec.tests,
        hostedStagingAcceptance: 'Not yet run (0/61 — hosted staging access unavailable in this workspace)',
        productionCommissioningAndReleaseEvidence: 'Not commissioned (0/61 — owner approval & production cutover required)',
        openDependencyOrOwnerDecision: spec.dependency,
      });
    }),
  );
}

export function workforceMatrixTotals(rows: readonly WorkforceMatrixRow[] = buildWorkforceMatrix()): WorkforceMatrixTotals {
  return Object.freeze({
    totalRows: rows.length,
    designed: rows.filter(r => r.designed).length,
    locallyImplemented: rows.filter(r => r.locallyImplemented).length,
    reservedFailClosed: rows.filter(r => !r.locallyImplemented).length,
    websiteIntegrated: rows.filter(r => r.websiteIntegrated).length,
    stagingAccepted: rows.filter(r => r.stagingAccepted).length,
    productionCommissioned: rows.filter(r => r.productionCommissioned).length,
  });
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function renderWorkforceMatrixMarkdown(): string {
  const rows = buildWorkforceMatrix();
  const totals = workforceMatrixTotals(rows);

  return [
    '# TaxGuard 61-Agent Application Workforce Matrix (`A00`–`A60`)',
    '',
    '> Single repository-tracked source of truth generated from `src/ai/workforceMatrix.ts` (derived from `src/ai/registry.ts` and `src/ai/architectureOverview.ts`).',
    '> `src/tests/aiWorkforceMatrix.test.ts` fails if this document drifts from the code.',
    '',
    '## Aggregate Totals (Strict Separation of Lifecycle States)',
    '',
    '| Metric | Count | Notes |',
    '|---|---:|---|',
    `| Total canonical agent rows tracked (\`A00\`–\`A60\`) | **${totals.totalRows} / 61** | Exactly one row per approved canonical agent ID |`,
    `| Designed | **${totals.designed} / 61** | Every canonical ID \`A00\`–\`A60\` mapped with scope, stage, and human gate |`,
    `| Locally implemented | **${totals.locallyImplemented} / 61** | 60 active deterministic domain handlers + **${totals.reservedFailClosed} reserved fail-closed** (\`A39\` per owner decision OV-01) |`,
    `| Website-integrated | **${totals.websiteIntegrated} / 61** | Real Stage Three A10 panel, Case AI Workforce panel, Reviewer AI Findings tab, and Admin 61-Agent Workforce Matrix |`,
    `| Hosted staging-accepted | **${totals.stagingAccepted} / 61** | Honest zero: hosted staging environment was not exercised from this container |`,
    `| Production-commissioned | **${totals.productionCommissioned} / 61** | Honest zero: owner approval, live provider selection, and production cutover required |`,
    '',
    '## Key Owner Gates Preserved',
    '',
    '- **`A10` (Duplicate/Fraud Indicator Agent):** Narrow exact byte-duplicate SHA-256 scope preserved (OV-01). Never declares fraud, deletes documents, or alters tax records. Live decision action stays unavailable (`503 A10_LIVE_DECISION_PENDING_OWNER_APPROVAL`) until owner approves A10\'s pending reviewer role; end-to-end decision flow verified locally via explicit synthetic staging permission.',
    '- **`A07` (OCR Extraction Agent):** Gated on configured approved OCR provider + verifiable cryptographic document lineage; returns `UNAVAILABLE_HUMAN_REVIEW_REQUIRED` when unconfigured.',
    '- **`A39` (Government Response Agent):** Strictly reserved / unassigned per owner decision OV-01; fails closed (`503 AI_AGENT_RESERVED_PENDING_OWNER_DEFINITION`).',
    '- **Human-Only Authority (OV-06, OV-09, OV-10):** No agent can auto-approve, auto-post ledger entries, write authoritative returns, sign, e-file, send external client messages, charge payments, or mutate RBAC permissions.',
    '',
    '## Per-Agent Matrix (`A00`–`A60`)',
    '',
    '| Agent ID | Name & Stage | Planned task and application surface | Implemented domain function and source path | Authorized inputs, tools, and output audience | API, worker, database, and website integration | Human reviewer and permitted decisions | Local test evidence | Hosted staging acceptance | Production commissioning and release evidence | Open dependency or owner decision |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(r =>
      `| \`${r.agentId}\` | ${escapeCell(`${r.overviewName} (${r.workflowStages})`)} | ${escapeCell(r.plannedTaskAndSurface)} | ${escapeCell(r.implementedDomainFunctionAndSourcePath)} | ${escapeCell(r.authorizedInputsToolsAndAudience)} | ${escapeCell(r.apiWorkerDbAndWebsiteIntegration)} | ${escapeCell(r.humanReviewerAndPermittedDecisions)} | ${escapeCell(r.localTestEvidence)} | ${escapeCell(r.hostedStagingAcceptance)} | ${escapeCell(r.productionCommissioningAndReleaseEvidence)} | ${escapeCell(r.openDependencyOrOwnerDecision)} |`,
    ),
    '',
  ].join('\n');
}
