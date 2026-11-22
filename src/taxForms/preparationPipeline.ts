/**
 * Form preparation architecture mapped onto the AUTHORITATIVE 18-stage TaxGuard workflow.
 * Stage numbers reference the existing workflow (Onboard 01 … Repeat 18); nothing here changes
 * stages, transitions or approval gates. Status reflects the codebase as checked on 2026-10-12.
 */
export type PipelineStatus = 'implemented' | 'partial' | 'prototype' | 'not_implemented' | 'blocked';

export interface PipelineStep {
  id: string;
  label: string;
  workflowStages: number[];
  status: PipelineStatus;
  evidence: string;
}

export const PREPARATION_PIPELINE: PipelineStep[] = [
  { id: 'questionnaire', label: 'Guided questionnaires', workflowStages: [1, 2], status: 'partial', evidence: 'Tax-year-aware individual questionnaire and requirement engine (src/server/taxguard/taxQuestionnaire.ts). No entity-return questionnaires.' },
  { id: 'uploads', label: 'Secure source-document uploads', workflowStages: [2], status: 'blocked', evidence: 'Metadata-only intake locally; byte storage, malware scanning and private vault require provider E02.' },
  { id: 'classification', label: 'Document classification and verified extraction', workflowStages: [3], status: 'blocked', evidence: 'OCR / extraction provider not commissioned (E02).' },
  { id: 'data-entry', label: 'Tax-year-specific data entry', workflowStages: [4], status: 'prototype', evidence: 'Recorded tax-record categories feed the draft Form 1040 only.' },
  { id: 'federal-state-mapping', label: 'Federal-to-state data mapping', workflowStages: [9], status: 'not_implemented', evidence: 'No state return engine exists.' },
  { id: 'apportionment', label: 'Multi-state income allocation and apportionment', workflowStages: [9], status: 'not_implemented', evidence: 'No allocation or apportionment rules exist.' },
  { id: 'calculation', label: 'Tax calculations with authoritative rules', workflowStages: [9], status: 'prototype', evidence: 'Draft Form 1040 calculation is simplified and non-authoritative; no other return type is calculated.' },
  { id: 'schedules', label: 'Supporting schedules and worksheets', workflowStages: [9], status: 'prototype', evidence: 'Draft records two Schedule 1 totals only.' },
  { id: 'missing-info', label: 'Missing-information checks', workflowStages: [3, 9], status: 'partial', evidence: 'Questionnaire requirement conflicts and draft diagnostics (open exceptions, zero income).' },
  { id: 'review-approval', label: 'Review and approval', workflowStages: [6, 10], status: 'implemented', evidence: 'Server-enforced reviewer decisions and maker-checker draft certification / approval (case-authority routes). Durable production storage is pending (E01).' },
  { id: 'versioning', label: 'Return versioning', workflowStages: [9, 10], status: 'partial', evidence: 'Draft returns carry version, rule version and calculation version fields.' },
  { id: 'amended', label: 'Amended returns', workflowStages: [14], status: 'not_implemented', evidence: 'No amended-return preparation.' },
  { id: 'extensions', label: 'Extensions', workflowStages: [9, 12], status: 'not_implemented', evidence: 'No extension preparation or filing.' },
  { id: 'pdf', label: 'Accurate PDF generation', workflowStages: [9, 10, 11], status: 'not_implemented', evidence: 'No PDF renderer or form templates in the project.' },
  { id: 'efile', label: 'Authorized electronic filing through approved providers', workflowStages: [12], status: 'blocked', evidence: 'Filing and e-signature providers not configured; no IRS MeF / state transmitter integration (E04).' },
  { id: 'acknowledgments', label: 'Filing acknowledgment and rejection handling', workflowStages: [13, 14], status: 'not_implemented', evidence: 'Stages exist in the workflow; no acknowledgment ingestion exists.' },
  { id: 'audit-trail', label: 'Complete audit trails', workflowStages: [1, 18], status: 'implemented', evidence: 'Server audit logging, authority audit records and security events.' },
];
