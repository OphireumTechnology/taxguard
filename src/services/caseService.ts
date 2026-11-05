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
  activeStage?: number;
  status: string;
  myRole?: string;
  returnFamily?: string | null;
  blockedDependency?: string | null;
  awaitingReviewer?: boolean;
  nextDeadline?: string | null;
  [key: string]: any;
}

export interface CaseDetail {
  case: {
    caseId: string;
    clientId: string;
    clientName: string;
    taxYear: number;
    stage: number;
    activeStage: number;
    version?: number;
    preparerUid?: string;
    reviewerUid?: string;
    returnFamily?: string | null;
    status: string;
    assignedPreparerUid?: string;
    assignedReviewerUid?: string;
    engagementId?: string;
    [key: string]: any;
  };
  stages: Array<{ stage: number; status: string; approvedAt?: string; [key: string]: any }>;
  returns?: any[];
  stagePolicy?: {
    requiredChecks?: string[];
    dependencies?: string[];
    checklist?: string[];
    evidence?: string;
    [key: string]: any;
  };
  events: Array<{
    action: string;
    toStage: number;
    evidenceType?: string;
    reason?: string;
    actorUid?: string;
    at: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export const caseService = {
  queue: async (_filter?: any): Promise<{ items: CaseQueueItem[] }> => ({ items: [] }),
  detail: async (caseId: string): Promise<CaseDetail> => ({
    case: {
      caseId,
      clientId: 'user_client_1',
      clientName: 'Michael Perotti',
      engagementId: 'eng_001',
      taxYear: 2025,
      stage: 1,
      activeStage: 1,
      version: 1,
      preparerUid: 'usr_staff_desmond',
      reviewerUid: 'usr_staff_elena',
      returnFamily: '1040',
      status: 'ACTIVE'
    },
    stages: [],
    stagePolicy: {
      requiredChecks: [],
      dependencies: [],
      checklist: [],
      evidence: 'VERIFIED'
    },
    events: []
  }),
  advance: async (..._args: any[]) => ({ success: true }),
  advanceStage: async (..._args: any[]) => ({ success: true }),
  returnTo: async (..._args: any[]) => ({ success: true }),
  returnStage: async (..._args: any[]) => ({ success: true }),
  hold: async (..._args: any[]) => ({ success: true }),
  restaff: async (..._args: any[]) => ({ success: true })
};
