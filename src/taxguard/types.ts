export type DocumentCategory =
  | 'W-2'
  | '1099-NEC'
  | '1099-MISC'
  | '1099-INT'
  | '1099-DIV'
  | 'K-1'
  | 'Bank Statement'
  | 'Receipt'
  | 'Prior Return'
  | 'Identity'
  | 'Corporate'
  | 'Other'
  | string;

export interface TaxGuardAuditEntry {
  id: string;
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action?: string;
  recordType?: string;
  recordId?: string;
  timestamp: string;
  ipAddress?: string;
  correlationId?: string;
  result?: string;
  riskLevel?: string;
  details?: string;
  [key: string]: any;
}

export interface TaxGuardDiscrepancy {
  id: string;
  caseId?: string;
  tenantId?: string;
  clientId?: string;
  taxYear?: number;
  ruleCode?: string;
  category?: string;
  title?: string;
  field?: string;
  description?: string;
  neutralDescription?: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  status: 'open' | 'resolved' | 'dismissed' | 'escalated' | string;
  affectedDocuments?: string[];
  affectedFields?: string[];
  recommendedAction?: string;
  identifiedAt?: string;
  sourceA?: string;
  sourceB?: string;
  varianceAmount?: number;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  [key: string]: any;
}

export interface TaxGuardEngagementCase {
  id: string;
  tenantId?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  entityType?: string;
  taxYear?: number;
  returnType?: string;
  jurisdictions?: string[];
  assignedPreparer?: string;
  assignedReviewer?: string;
  assignedCpa?: string;
  status?: string;
  priority?: string;
  internalDeadline?: string;
  filingDeadline?: string;
  clientProgressPercent?: number;
  missingItemsCount?: number;
  discrepanciesCount?: number;
  lockedFinalPackage?: boolean;
  makerCheckerSteps?: Array<Record<string, any>>;
  [key: string]: any;
}

export type TaxGuardDocument = Record<string, any>;
export type TaxGuardExtractionDossier = Record<string, any>;
export type TaxGuardMissingItem = Record<string, any>;
export type TaxGuardExpenseItem = Record<string, any>;
export type DraftWorkpaper = Record<string, any>;
export type PublicVerificationRecord = Record<string, any>;
export type TaxGuardFieldMapping = Record<string, any>;
export type TaxGuardSmartFormTemplate = Record<string, any>;
export type TaxGuardDocumentSummary = Record<string, any>;
export type DocumentClassificationDetail = Record<string, any>;
export type ControlledScanPackage = Record<string, any>;
export type EvidenceLibraryItem = Record<string, any>;
export type CaseTask = Record<string, any>;
