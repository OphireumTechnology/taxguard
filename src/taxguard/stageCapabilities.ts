import { CANONICAL_STAGE_LABELS } from '../server/taxguard/persistence.types';

export const BLOCKED_STAGES: readonly number[] = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export interface StageCapability {
  stage: number;
  name: string;
  purpose: string;
  evidence: 'SYSTEM_VERIFIED' | 'HUMAN_ATTESTED' | 'BLOCKED';
  blockedReason?: string;
  responsibility: string;
  clientGuidance: string;
}

const STAGE_DETAILS: Record<number, Omit<StageCapability, 'stage' | 'name'>> = {
  1: {
    purpose: 'Validate taxpayer identity, engagement terms, and assign professional team.',
    evidence: 'SYSTEM_VERIFIED',
    responsibility: 'System automated validation and engagement coordinator assignment.',
    clientGuidance: 'Review your personal or business profile and confirm contact information.',
  },
  2: {
    purpose: 'Collect required tax documents, statements, prior year returns, and questionnaires.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Client provides documents; practice manager confirms intake receipt.',
    clientGuidance: 'Upload requested source documents to the Document Vault and complete questionnaires.',
  },
  3: {
    purpose: 'Verify document completeness, integrity, and extract transaction data.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Case reviewer verifies document completeness and clarifies discrepancies.',
    clientGuidance: 'Review open document requests or answer clarification questions from your accountant.',
  },
  4: {
    purpose: 'Record bookkeeping transactions, classify business expenses, and balance books.',
    evidence: 'SYSTEM_VERIFIED',
    responsibility: 'Bookkeeper and accounting team post entries to the general ledger.',
    clientGuidance: 'No action needed unless your bookkeeper requests clarification on specific transactions.',
  },
  5: {
    purpose: 'Reconcile bank accounts, credit cards, loans, and review ledger balances.',
    evidence: 'SYSTEM_VERIFIED',
    responsibility: 'Accounting specialist completes periodic reconciliations.',
    clientGuidance: 'Provide end-of-year bank statements or merchant account reports if requested.',
  },
  6: {
    purpose: 'Conduct preliminary CPA review of workpapers, tax positions, and audit risk.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Certified Public Accountant (CPA) conducts review.',
    clientGuidance: 'Your designated CPA is reviewing workpapers. You will be notified if additional records are needed.',
  },
  7: {
    purpose: 'Generate book-to-tax adjustments and compile financial statements.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'CPA reviews and releases final financial workpapers.',
    clientGuidance: 'Review your preliminary year-end financial summaries in the documents tab.',
  },
  8: {
    purpose: 'Formulate tax advisory strategy, evaluate deductions, and document tax positions.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Senior Tax Advisor and CPA document planning considerations.',
    clientGuidance: 'Schedule a consultation meeting to discuss strategic tax recommendations.',
  },
  9: {
    purpose: 'Prepare federal and state income tax return forms and schedules.',
    evidence: 'BLOCKED',
    blockedReason: 'Verified tax preparation engine is required for return computation.',
    responsibility: 'Tax preparer and automated calculation engine.',
    clientGuidance: 'Preparation begins once prior stage evidence and workpaper attestations are satisfied.',
  },
  10: {
    purpose: 'Partner-level quality control review and taxpayer preview authorization.',
    evidence: 'BLOCKED',
    blockedReason: 'Requires completed draft return computation from Stage 09.',
    responsibility: 'Managing Partner / Senior CPA.',
    clientGuidance: 'You will receive an invitation to review your completed return draft once approved.',
  },
  11: {
    purpose: 'Execute IRS Form 8879 and state e-file authorization signatures.',
    evidence: 'BLOCKED',
    blockedReason: 'Regulated electronic signature provider integration required.',
    responsibility: 'Taxpayer / Authorized Officer signature.',
    clientGuidance: 'E-signature packages will be delivered to your verified email and portal inbox.',
  },
  12: {
    purpose: 'Direct electronic transmission to the IRS Modernized e-File (MeF) system and state DORs.',
    evidence: 'BLOCKED',
    blockedReason: 'Direct electronic transmission is not authorized in this environment.',
    responsibility: 'Authorized E-File Provider.',
    clientGuidance: 'Filing transmissions are handled directly by your licensed accounting firm.',
  },
  13: {
    purpose: 'Post-filing debrief and client feedback session.',
    evidence: 'BLOCKED',
    blockedReason: 'Dependent on successful filing transmission.',
    responsibility: 'Client Relationship Manager.',
    clientGuidance: 'Schedule an optional debrief call after tax filing completion.',
  },
  14: {
    purpose: 'Monitor IRS and state tax authority correspondence and notice tracking.',
    evidence: 'BLOCKED',
    blockedReason: 'Dependent on filed return processing.',
    responsibility: 'Practice Support Team.',
    clientGuidance: 'Upload any tax agency correspondence immediately to the Document Vault.',
  },
  15: {
    purpose: 'Ongoing quarterly monitoring, estimated tax projections, and mid-year tax updates.',
    evidence: 'BLOCKED',
    blockedReason: 'Dependent on filed return processing.',
    responsibility: 'Tax Advisory Team.',
    clientGuidance: 'Check back for quarterly estimated tax reminders throughout the year.',
  },
  16: {
    purpose: 'Permanent document archival and compliance record retention.',
    evidence: 'BLOCKED',
    blockedReason: 'Dependent on return completion and engagement close.',
    responsibility: 'Compliance and Records Officer.',
    clientGuidance: 'Download and archive copies of all finalized returns and workpapers for your permanent records.',
  },
  17: {
    purpose: 'Annual engagement review, service tier adjustment, and contract renewal.',
    evidence: 'BLOCKED',
    blockedReason: 'Requires completion of the current annual cycle.',
    responsibility: 'Engagement Partner.',
    clientGuidance: 'Review your upcoming year service agreement when renewal approaches.',
  },
  18: {
    purpose: 'Transfer prior-year basis, depreciation schedules, and carryforwards into next tax year.',
    evidence: 'BLOCKED',
    blockedReason: 'Requires completion of all prior stages.',
    responsibility: 'Automated Migration System.',
    clientGuidance: 'Your historical carryover amounts will be automatically transferred to the next tax year.',
  },
};

export function stageCapability(stage: number): StageCapability | undefined {
  const detail = STAGE_DETAILS[stage];
  if (!detail) return undefined;
  return {
    stage,
    name: CANONICAL_STAGE_LABELS[stage] ?? `Stage ${stage}`,
    ...detail,
  };
}
