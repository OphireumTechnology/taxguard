export const STAGE_NAMES = [
  'Intake & Identity Verification',
  'Document & Data Collection',
  'Document Intelligence & Verification',
  'Bookkeeping & Record Keeping',
  'Reconciliation & General Ledger Review',
  'Preliminary CPA Review',
  'Financial Statements & Reporting',
  'Strategic Tax Advisory & Planning',
  'Tax Return Preparation',
  'Partner Approval & Client Review',
  'Electronic Signature (Form 8879)',
  'IRS & State Electronic Transmission',
  'Client Feedback & Debrief',
  'Notice Monitoring & Resolution',
  'Ongoing Monitoring & Tax Updates',
  'Permanent Document Archival',
  'Annual Engagement Renewal',
  'Cycle Repeat & Prior Year Transfer'
];

export function caseMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Case operation failed.';
}

export function checkLabel(check: string): string {
  return check.replace(/_/g, ' ');
}

export function dependencyLabel(dep: string): string {
  return dep.replace(/_/g, ' ');
}

export function stageLabel(stage: number): string {
  return `Stage ${stage}: ${STAGE_NAMES[stage - 1] || ''}`.trim();
}

export function restaffCandidates(team: any[], c: any, role: string): any[] {
  return team.filter(t => t.role === role);
}

export interface CaseQueueItem {
  caseId: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  stage: number;
  status: string;
  myRole?: string;
}

export interface CaseDetail {
  case: {
    caseId: string;
    clientId: string;
    clientName: string;
    taxYear: number;
    stage: number;
    status: string;
    assignedPreparerUid?: string;
    assignedReviewerUid?: string;
  };
  stages: Array<{ stage: number; status: string; approvedAt?: string }>;
  returns?: any[];
  stagePolicy?: {
    requiredChecks: string[];
    dependencies: string[];
  };
}

export const caseService = {
  queue: async (filter?: any): Promise<{ items: CaseQueueItem[] }> => ({ items: [] }),
  detail: async (caseId: string): Promise<CaseDetail | null> => null,
  advanceStage: async (caseId: string, payload: any) => ({ success: true }),
  returnStage: async (caseId: string, payload: any) => ({ success: true }),
  restaff: async (caseId: string, payload: any) => ({ success: true })
};
