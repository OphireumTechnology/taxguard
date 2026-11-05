/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ReviewScope {
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
}

export interface ReviewerQueueCase {
  id: string;
  reviewerUid: string;
  activeStage: number;
  caseStatus: string;
  reviewStatus: string;
  highRisk: boolean;
  openExceptions: number;
  dueDate?: string;
  scope: ReviewScope;
  clientName?: string;
}

export interface ReviewDiagnostic {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL_BLOCKING';
  message: string;
  resolved: boolean;
}

export interface ReviewerReturn extends ReviewScope {
  id: string;
  status: string;
  createdBy: string;
  preparerCertifiedBy?: string;
  diagnostics?: ReviewDiagnostic[];
}

export interface ReviewerArtifact {
  id: string;
  title: string;
  type: string;
  url?: string;
  uploadedAt: string;
  status: string;
}

export interface ReviewerSnapshot {
  scope: ReviewScope;
  decisionsAvailable: boolean;
  independentReviewer: boolean;
  case: {
    reviewerUid: string;
    preparerUid: string;
    status: string;
    activeStage: number;
    openExceptions: number;
  };
}
