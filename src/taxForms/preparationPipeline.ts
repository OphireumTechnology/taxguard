export interface PreparationPipelineStage {
  id: string;
  label: string;
  workflowStages: number[];
  status: 'available' | 'partial' | 'not_implemented';
  evidence: string;
}

export const PREPARATION_PIPELINE: PreparationPipelineStage[] = [
  {
    id: 'intake',
    label: 'Document Intake & Classification',
    workflowStages: [1, 2],
    status: 'available',
    evidence: 'Client portal intake and structured document classification workflows.',
  },
  {
    id: 'validation',
    label: 'Extraction & Discrepancy Validation',
    workflowStages: [3, 4, 5],
    status: 'partial',
    evidence: 'Structured workpaper validation and book-to-tax reconciliation views.',
  },
  {
    id: 'review',
    label: 'Practitioner Quality Review',
    workflowStages: [6, 7, 8, 9],
    status: 'partial',
    evidence: 'Human practitioner review queues and audit traceability.',
  },
  {
    id: 'authorization',
    label: 'Client Authorization & Filing Readiness',
    workflowStages: [10, 11, 12],
    status: 'not_implemented',
    evidence: 'Requires commissioned e-signature and authorized e-file provider.',
  },
];
