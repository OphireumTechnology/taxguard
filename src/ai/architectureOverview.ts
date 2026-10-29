import { CANONICAL_AGENTS } from './registry';
import type { AgentId } from './types';

/**
 * The owner-supplied "TaxGuard AI Architecture Overview" (11 illustrated pages), transcribed for review.
 * Reference only: nothing here is read by governance, the gateway or any handler. Every agent stays
 * DRAFT and UNMAPPED / DENIED (src/ai/architectureMapping.ts) until the owner approves a mapping.
 */
export const ARCHITECTURE_OVERVIEW_SOURCE = Object.freeze({
  title: 'TaxGuard AI Architecture Overview',
  pages: 11,
  sha256: 'f11ed12ab651b8f805286c2b9f9fce31f534118670fc394b3973c80e44409c78',
  received: '2026-10-28',
  // The PDF is not committed; it is kept with the owner's development material.
  location: 'Sample Client Dcouments/TaxGuard Development (outside the repository)',
});

/** The only approval roles TaxGuard's human approval policy knows (PREPARER -> REVIEWER -> CPA_EA). */
export type ApprovalRole = 'PREPARER' | 'REVIEWER' | 'CPA_EA';
export type Page2Group = 'CLIENT_AGENTS' | 'TAX_AGENTS' | 'OPERATIONS' | 'ACCOUNTING' | 'COMPLIANCE' | 'SECURITY';

export interface OverviewAgent {
  readonly agent_id: AgentId;
  readonly overview_name: string;
  /** Page 2 "Primary Responsibility"; null where page 2 has no row for the agent. */
  readonly responsibility: string | null;
  /** Page 2 "Human Gate", verbatim; null where page 2 has no row for the agent. */
  readonly human_gate: string | null;
  /** The approval role the gate names, only when it names exactly one; otherwise an owner decision. */
  readonly gate_role: ApprovalRole | null;
  readonly page2_group: Page2Group | null;
}

const GATE_ROLES: Readonly<Record<string, ApprovalRole>> = Object.freeze({
  Preparer: 'PREPARER', Reviewer: 'REVIEWER', 'Human reviewer': 'REVIEWER', 'CPA/EA': 'CPA_EA',
  // Owner decision 2026-10-28 (OV-04, in part): a "Staff" gate requires an independent reviewer.
  Staff: 'REVIEWER',
});

// [id, overview name, responsibility, human gate, page-2 group]. A10 and A39 appear only on pages 3, 5 and 6.
const ROWS: ReadonlyArray<readonly [AgentId, string, string | null, string | null, Page2Group | null]> = [
  ['A00', 'Supervisor / Orchestrator Agent', 'Routes work between agents, workflows and stages', 'Yes (material)', null],
  ['A01', 'Client Onboarding Agent', 'Guides onboarding and detects missing information', 'Staff', 'CLIENT_AGENTS'],
  ['A02', 'Identity Verification Agent', 'Reviews identity evidence and inconsistencies', 'Staff', 'CLIENT_AGENTS'],
  ['A03', 'Engagement Agent', 'Determines required engagement workflow', 'Staff', 'CLIENT_AGENTS'],
  ['A04', 'Tax Organizer Agent', 'Intelligent taxpayer questionnaire', 'Preparer', 'CLIENT_AGENTS'],
  ['A05', 'Document Intake Agent', 'Controls incoming documents', 'Staff', 'CLIENT_AGENTS'],
  ['A06', 'Document Classification Agent', 'Classifies W-2, 1099, K-1, receipts, etc.', 'Reviewer', 'TAX_AGENTS'],
  ['A07', 'OCR Extraction Agent', 'Extracts structured fields', 'Reviewer', 'TAX_AGENTS'],
  ['A08', 'Document Validation Agent', 'Checks extracted info against source', 'Reviewer', 'TAX_AGENTS'],
  ['A09', 'Missing Document Agent', 'Identifies missing evidence', 'Staff', 'CLIENT_AGENTS'],
  ['A10', 'Duplicate/Fraud Indicator Agent', null, null, null],
  ['A11', 'Evidence Agent', 'Builds evidence chains', 'Preparer', 'TAX_AGENTS'],
  ['A12', 'Bookkeeping Agent', 'Suggests transaction classifications', 'Accountant', 'ACCOUNTING'],
  ['A13', 'Reconciliation Agent', 'Identifies reconciliation differences', 'Accountant', 'ACCOUNTING'],
  ['A14', 'Journal Entry Agent', 'Proposes journal entries', 'Accountant', 'ACCOUNTING'],
  ['A15', 'Financial Statement Agent', 'Analyzes P&L, balance sheet, cash flow', 'Accountant', 'ACCOUNTING'],
  ['A16', 'Book-to-Tax Agent', 'Identifies accounting/tax differences', 'Tax professional', 'TAX_AGENTS'],
  ['A17', 'Tax Research Agent', 'Researches applicable tax rules', 'CPA/EA', 'TAX_AGENTS'],
  ['A18', 'Federal Tax Agent', 'Analyzes federal tax treatment', 'Preparer/CPA', 'TAX_AGENTS'],
  ['A19', 'State Tax Agent', 'Determines state issues', 'Preparer/CPA', 'TAX_AGENTS'],
  ['A20', 'Entity Tax Agent', 'LLC, partnership, S-Corp, C-Corp', 'CPA/EA', 'TAX_AGENTS'],
  ['A21', 'Individual Tax Agent', 'Individual return analysis', 'Preparer', 'TAX_AGENTS'],
  ['A22', 'Deduction Agent', 'Identifies deductions', 'Preparer', 'TAX_AGENTS'],
  ['A23', 'Credit Agent', 'Identifies credits', 'Preparer', 'TAX_AGENTS'],
  ['A24', 'Depreciation Agent', 'Asset/depreciation treatment', 'Preparer', 'TAX_AGENTS'],
  ['A25', 'Payroll Tax Agent', 'Payroll-related analysis', 'Professional', 'TAX_AGENTS'],
  ['A26', 'Estimated Tax Agent', 'Projects estimated payments', 'Professional', 'TAX_AGENTS'],
  ['A27', 'Tax Planning Agent', 'Scenario and planning analysis', 'CPA/EA', 'TAX_AGENTS'],
  ['A28', 'Tax Calculation Verification Agent', 'Checks deterministic outputs', 'Reviewer', 'TAX_AGENTS'],
  ['A29', 'Return Preparation Agent', 'Coordinates return assembly', 'Preparer', 'TAX_AGENTS'],
  ['A30', 'Form Mapping Agent', 'Maps validated info to tax forms', 'Preparer', 'TAX_AGENTS'],
  ['A31', 'Return Diagnostics Agent', 'Detects incomplete/inconsistent returns', 'Reviewer', 'TAX_AGENTS'],
  ['A32', 'Exception Agent', 'Creates and routes exceptions', 'Reviewer', 'TAX_AGENTS'],
  ['A33', 'Risk & Materiality Agent', 'Scores material risks', 'CPA/EA', 'TAX_AGENTS'],
  ['A34', 'Reviewer Agent', 'AI-assisted second-level review', 'Human reviewer', 'COMPLIANCE'],
  ['A35', 'Quality-Control Agent', 'Independent final QC', 'CPA/EA', 'COMPLIANCE'],
  ['A36', 'Signature Readiness Agent', 'Verifies prerequisites before signature', 'Staff', 'COMPLIANCE'],
  ['A37', 'Filing Readiness Agent', 'Determines if filing gates satisfied', 'Authorized filer', 'TAX_AGENTS'],
  ['A38', 'Filing Agent', 'Coordinates approved submission', 'Explicit authorization', 'TAX_AGENTS'],
  ['A39', 'Government Response Agent', null, null, null],
  ['A40', 'Rejection Resolution Agent', 'Diagnoses rejected filings', 'Preparer', 'TAX_AGENTS'],
  ['A41', 'Tax Notice Agent', 'Classifies government notices', 'CPA/EA', 'TAX_AGENTS'],
  ['A42', 'Amendment Agent', 'Identifies amendment workflow', 'CPA/EA', 'TAX_AGENTS'],
  ['A43', 'Client Communication Agent', 'Drafts client communications', 'Staff', 'CLIENT_AGENTS'],
  ['A44', 'Appointment Agent', 'Coordinates appointments', 'Staff / client', 'CLIENT_AGENTS'],
  ['A45', 'Task Agent', 'Creates workflow tasks', 'Policy-controlled', 'CLIENT_AGENTS'],
  ['A46', 'Deadline Agent', 'Tracks filing/payment deadlines', 'Staff', 'CLIENT_AGENTS'],
  ['A47', 'Billing Agent', 'Assists billing/invoice workflows', 'Authorized staff', 'OPERATIONS'],
  ['A48', 'Payment Reconciliation Agent', 'Matches payments to invoices', 'Accounting', 'OPERATIONS'],
  ['A49', 'Archive Agent', 'Checks completeness before archival', 'Staff', 'OPERATIONS'],
  ['A50', 'Renewal Agent', 'Prepares next-year engagement', 'Staff', 'CLIENT_AGENTS'],
  ['A51', 'Audit Trail Agent', 'Detects missing/abnormal audit events', 'Compliance', 'COMPLIANCE'],
  ['A52', 'Compliance Agent', 'Evaluates workflow-policy compliance', 'Compliance officer', 'COMPLIANCE'],
  ['A53', 'Privacy Agent', 'Detects sensitive-data handling issues', 'Security/compliance', 'COMPLIANCE'],
  ['A54', 'Security Agent', 'Monitors suspicious activity', 'Security/admin', 'SECURITY'],
  ['A55', 'Access-Control Agent', 'Reviews RBAC/RLS anomalies', 'Admin', 'SECURITY'],
  ['A56', 'AI Governance Agent', 'Monitors model use, prompts and AI decisions', 'Admin/compliance', 'COMPLIANCE'],
  ['A57', 'Hallucination/Verification Agent', 'Challenges unsupported AI conclusions', 'Human review', 'COMPLIANCE'],
  ['A58', 'System Health Agent', 'Monitors services and integration health', 'Admin', 'OPERATIONS'],
  ['A59', 'Provider Integration Agent', 'Monitors external provider connectivity', 'Admin', 'OPERATIONS'],
  ['A60', 'Practice Intelligence Agent', 'Operational analytics and workload analysis', 'Management', 'OPERATIONS'],
];

export const OVERVIEW_AGENTS: readonly OverviewAgent[] = Object.freeze(ROWS.map(([agent_id, overview_name, responsibility, human_gate, page2_group]) => Object.freeze({
  agent_id, overview_name, responsibility, human_gate, page2_group,
  gate_role: human_gate === null ? null : GATE_ROLES[human_gate] ?? null,
})));

export function findOverviewAgent(agentId: string): OverviewAgent {
  const agent = OVERVIEW_AGENTS.find(row => row.agent_id === agentId);
  if (!agent) throw new Error('UNKNOWN_AI_AGENT');
  return agent;
}

/** Page 9 "Agent Permissions Matrix (Example)" columns, left to right. */
export const PERMISSION_COLUMNS = Object.freeze([
  ['READ_CLIENT_DATA', 'Read client data'], ['READ_DOCUMENTS', 'Read documents'], ['READ_ACCOUNTING', 'Read accounting'],
  ['READ_TAX_RULES', 'Read tax rules'], ['WRITE_STAGING', 'Write staging'], ['WRITE_RETURN_DATA', 'Write return data'],
  ['CREATE_PROPOSAL', 'Create proposal'], ['MARK_VERIFIED', 'Mark verified'], ['APPROVE_TAX_POSITION', 'Approve tax position'],
  ['MODIFY_RETURN', 'Modify return'], ['FILE_RETURN', 'File return'], ['SIGN_RETURN', 'Sign return'],
  ['TOOL_OCR', 'OCR'], ['TOOL_LLM', 'LLM'], ['TOOL_TAX_ENGINE', 'Tax engine'], ['TOOL_FILING_PROVIDER', 'Filing provider'],
  ['STAGE_COLLECT', 'Collect stage'], ['STAGE_VALIDATE', 'Validate stage'], ['STAGE_PREPARE', 'Prepare stage'],
  ['STAGE_REVIEW', 'Review stage'], ['STAGE_FILE', 'File stage'],
] as const);
export type PermissionColumn = typeof PERMISSION_COLUMNS[number][0];
export type DrawnPermission = 'ALLOWED' | 'NOT_ALLOWED' | 'CONDITIONAL' | 'ILLEGIBLE';

/**
 * Authority the canonical boundary keeps with humans whatever an agent matrix shows: changing or
 * approving return data, marking verified, signing, filing, the filing provider and the File stage.
 */
export const HUMAN_ONLY_COLUMNS: ReadonlySet<PermissionColumn> = new Set<PermissionColumn>([
  'WRITE_RETURN_DATA', 'MARK_VERIFIED', 'APPROVE_TAX_POSITION', 'MODIFY_RETURN', 'FILE_RETURN', 'SIGN_RETURN',
  'TOOL_FILING_PROVIDER', 'STAGE_FILE',
]);

// One character per column in PERMISSION_COLUMNS order: Y allowed, N not allowed, C conditional,
// ? unreadable in the source image (never guessed).
const DRAWN: ReadonlyArray<readonly [AgentId, string]> = [
  ['A05', 'YYNYYNYNNNNNCNNNYYNNN'],
  ['A06', 'YYNYYNYNNNNNCNNNYYNNN'],
  ['A07', 'YYCCCNYNNNNNYYNNYYNNN'],
  ['A08', 'YYYY?NYNNNNN?YNNYYNNN'],
  ['A11', 'YYYYYNYNNNNN?NNNYYYNN'],
  ['A16', 'YYYYYYYN?CNNCNNNNYYYN'],
  ['A18', 'YYNYYYYNNCNNCNNNNYYYN'],
  ['A19', 'YYNYYYYNNCNNCNNNNYYYN'],
  ['A20', 'YYNYYYYNNCNNCNNNNYYYN'],
  ['A29', 'YYNCYYYYCCNNCNNNCNNNN'],
  ['A34', 'YYYYYYYNCYNNCNNNYNNNN'],
  ['A35', 'YYYYYYYNCYNNCNNNYYNNN'],
  ['A38', 'YYC????NCNNNY?NYYYYYY'],
];
const CODE: Readonly<Record<string, DrawnPermission>> = Object.freeze({ Y: 'ALLOWED', N: 'NOT_ALLOWED', C: 'CONDITIONAL', '?': 'ILLEGIBLE' });

export type PermissionRow = Readonly<Record<PermissionColumn, DrawnPermission>>;
export const PAGE9_EXAMPLE: ReadonlyArray<Readonly<{ agent_id: AgentId; drawn: PermissionRow }>> = Object.freeze(DRAWN.map(([agent_id, cells]) => {
  if (cells.length !== PERMISSION_COLUMNS.length) throw new Error(`PAGE9_ROW_LENGTH ${agent_id}`);
  return Object.freeze({ agent_id, drawn: Object.freeze(Object.fromEntries(PERMISSION_COLUMNS.map(([key], i) => [key, CODE[cells[i]]])) as PermissionRow) });
}));

/**
 * The page-9 row narrowed by TaxGuard's boundary: human-only authority and unreadable cells become
 * NOT_ALLOWED. A ceiling for the owner's review, never wider than drawn and never a grant.
 */
export function overviewCeiling(agentId: string): PermissionRow | null {
  const row = PAGE9_EXAMPLE.find(r => r.agent_id === agentId);
  if (!row) return null;
  return Object.freeze(Object.fromEntries(PERMISSION_COLUMNS.map(([key]) => {
    const drawn = row.drawn[key];
    return [key, HUMAN_ONLY_COLUMNS.has(key) || drawn === 'ILLEGIBLE' ? 'NOT_ALLOWED' : drawn];
  })) as PermissionRow);
}

export interface OverviewDecision {
  readonly id: string; readonly title: string; readonly detail: string;
  readonly status: 'OPEN' | 'PARTLY_DECIDED' | 'DECIDED';
  /** The owner's answer and its date, when given. */
  readonly resolution: string | null;
}

const OWNER_DECIDED = '2026-10-28';
const RESOLUTIONS: Readonly<Record<string, Pick<OverviewDecision, 'status' | 'resolution'>>> = Object.freeze({
  'OV-01': { status: 'DECIDED', resolution: `Owner, ${OWNER_DECIDED}: leave A10 at its existing narrow duplicate-hash check and A39 unassigned until their definitions are supplied.` },
  'OV-04': { status: 'PARTLY_DECIDED', resolution: `Owner, ${OWNER_DECIDED}: a "Staff" gate means REVIEWER. The gates listed remain open.` },
  'OV-06': { status: 'DECIDED', resolution: `Owner, ${OWNER_DECIDED}: keep these powers with people. Agents may only propose; a person writes, verifies, approves, signs and files.` },
  'OV-09': { status: 'DECIDED', resolution: `Owner, ${OWNER_DECIDED}: always human review. Every material or advisory proposal needs a person, whatever its risk score.` },
});

/** Points where the overview conflicts with itself or with TaxGuard's boundary, with the owner's answers so far. */
export function overviewDecisions(): readonly OverviewDecision[] {
  const unmappedGates = OVERVIEW_AGENTS.filter(a => a.human_gate !== null && a.gate_role === null);
  const humanOnly = PAGE9_EXAMPLE.flatMap(r => PERMISSION_COLUMNS.filter(([key]) => HUMAN_ONLY_COLUMNS.has(key) && (r.drawn[key] === 'ALLOWED' || r.drawn[key] === 'CONDITIONAL'))
    .map(([key, label]) => `${r.agent_id} ${label} (${r.drawn[key] === 'ALLOWED' ? 'allowed' : 'conditional'})`));
  const illegible = PAGE9_EXAMPLE.flatMap(r => PERMISSION_COLUMNS.filter(([key]) => r.drawn[key] === 'ILLEGIBLE').map(([, label]) => `${r.agent_id} ${label}`));
  return Object.freeze([
    { id: 'OV-01', title: 'A10 and A39 have no responsibility or human gate', detail: 'Page 2 lists 59 of the 61 agents. Duplicate/Fraud Indicator (A10) and Government Response (A39) appear only on pages 3, 5 and 6.' },
    { id: 'OV-02', title: 'Page 2 groups differ from the registry categories', detail: 'Page 3 matches the registry categories and they are kept. Page 2 shows A05, A09, A43-A46 and A50 as client agents; A06-A08, A11, A16, A32, A33 and A37-A42 as tax agents; A47-A49 and A58-A60 as operations; A34-A36 as compliance. Page 1 uses a third, seven-group layout.' },
    { id: 'OV-03', title: 'Agent names vary between pages', detail: 'A28 is also "Calculation Verification Agent", A31 "Diagnostics Agent", A35 "Independent QC Agent" and A10 "Duplicate/Fraud Agent". The page-2 names are recorded; registry names are unchanged.' },
    { id: 'OV-04', title: 'Human gates that name no approval role', detail: `TaxGuard approves through PREPARER, REVIEWER and CPA_EA only. These gates need a role decision: ${unmappedGates.map(a => `${a.agent_id} "${a.human_gate}"`).join(', ')}.` },
    { id: 'OV-05', title: 'A client named as a gate', detail: 'A44 Appointment Agent lists "Staff / client". A client cannot approve AI work under the current policy.' },
    { id: 'OV-06', title: 'Page 9 gives agents human-only authority', detail: `Return data, verification, approval, modification, signing, filing, the filing provider and the File stage stay with people. Drawn as allowed or conditional: ${humanOnly.join('; ')}.` },
    { id: 'OV-07', title: 'Unreadable page 9 cells', detail: `Not guessed; treated as not allowed: ${illegible.join(', ')}.` },
    { id: 'OV-08', title: 'Page 9 stages do not match the workflow', detail: 'Collect, Validate, Prepare, Review and File are not mapped to LEGACY_18_V1 stage numbers. The example also omits Prepare for A29 Return Preparation and Review for A34 Reviewer.' },
    { id: 'OV-09', title: 'Automatic approval of low-risk work', detail: 'Page 4 lets low-risk proposals proceed automatically. TaxGuard requires human review of every material or advisory proposal; risk-based automatic approval is not authorized.' },
    { id: 'OV-10', title: 'Live filing and payments', detail: 'Pages 1, 9 and 11 show IRS/state e-file, the filing provider and payment processors. Live transmission and live payments stay disabled.' },
    { id: 'OV-11', title: 'Named models and illustrative metrics', detail: 'Page 8 names a specific model provider and pages 10-11 show sample counts, costs and model shares (page 11 is labelled simulated). No model is approved, and these figures are not shown as TaxGuard data.' },
    { id: 'OV-12', title: 'A21 is "International" in the implementation directive', detail: 'The Master Architecture Implementation Directive (2026-10-28) lists A21 International; pages 2, 3 and 6 name A21 Individual Tax Agent ("Individual return analysis"). The overview name is recorded.' },
    { id: 'OV-13', title: 'Prerequisites for commissioning any agent', detail: 'The overview shows agents operating but not how one becomes operational. TaxGuard requires, per agent: an approved responsibility and grants, an approved model and prompt, budgets, an evaluation record, staging validation and an approved commissioning decision. Who approves each step, and the evaluation pass criteria, are not decided.' },
  ].map(d => Object.freeze({ ...d, ...(RESOLUTIONS[d.id] ?? { status: 'OPEN' as const, resolution: null }) })));
}

/** True when the overview row set and the canonical registry identities are the same 61 IDs in order. */
export function overviewMatchesRegistry(): boolean {
  return OVERVIEW_AGENTS.length === CANONICAL_AGENTS.length && OVERVIEW_AGENTS.every((a, i) => a.agent_id === CANONICAL_AGENTS[i].agent_id);
}
