
export type PermissionScope =
  | "DOCUMENTS_READ"
  | "DOCUMENTS_WRITE"
  | "TAX_RETURNS_READ"
  | "TAX_RETURNS_WRITE"
  | "COMMUNICATIONS"
  | "BILLING"
  | "CLIENT_PROFILE"
  | "AUDIT_LOGS";

export const ALL_PERMISSION_SCOPES: PermissionScope[] = [
  "DOCUMENTS_READ",
  "DOCUMENTS_WRITE",
  "TAX_RETURNS_READ",
  "TAX_RETURNS_WRITE",
  "COMMUNICATIONS",
  "BILLING",
  "CLIENT_PROFILE",
  "AUDIT_LOGS"
];

export type UserRole =
  | 'client'
  | 'prospective_client'
  | 'accountant'
  | 'senior_reviewer'
  | 'reviewer'
  | 'bookkeeper'
  | 'practice_manager'
  | 'operations'
  | 'recruiter'
  | 'admin'
  | 'super_admin'
  | 'super_administrator';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole | string;
  status: 'active' | 'suspended' | 'disabled' | 'pending';
  tenantId?: string;
  clientId?: string;
  phone?: string;
  companyName?: string;
  clientType?: 'individual' | 'business';
  mfaEnabled?: boolean;
  isVerified?: boolean;
  title?: string;
  credentials?: string[];
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  onboardingStatus?: string;
  onboardingStep?: number;
  authorizedClientIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export type DocumentStatus = 'draft' | 'pending' | 'reviewing' | 'verified' | 'rejected' | 'archived';
export type DocumentCategory = 'tax_return' | 'w2_1099' | 'financial_statement' | 'bank_statement' | 'identity' | 'legal' | 'receipt' | 'other';

export interface DocumentItem {
  id: string;
  name: string;
  fileName?: string;
  category?: DocumentCategory | string;
  size?: number | string;
  uploadedAt?: string;
  status: DocumentStatus | string;
  url?: string;
  clientId?: string;
  taxYear?: number;
  mimeType?: string;
}

export type EngagementStatus = 'inquiry' | 'proposal_pending' | 'active' | 'in_review' | 'completed' | 'closed';

export interface Engagement {
  id: string;
  clientId: string;
  taxYear: number;
  status: EngagementStatus | string;
  planId?: string;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Appointment {
  id: string;
  clientId?: string;
  clientName?: string;
  advisorName?: string;
  date?: string;
  time?: string;
  startsAt?: string;
  endsAt?: string;
  mode?: string;
  status: string;
  notes?: string;
}

export interface ServicePlan {
  id: string;
  name: string;
  tagline?: string;
  price: number;
  billingPeriod?: 'one_time' | 'monthly' | 'annual';
  isPopular?: boolean;
  description: string;
  idealFor?: string;
  features: string[];
}

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  clientId: string;
  clientName?: string;
  amount: number;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'voided';
  dueDate?: string;
  issuedAt?: string;
  paidAt?: string;
  lineItems?: Array<{ description: string; amount: number }>;
}

export interface AccountingConnection {
  id: string;
  provider: 'quickbooks' | 'xero';
  status: 'connected' | 'disconnected' | 'syncing';
  lastSyncedAt?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  senderName?: string;
  content: string;
  timestamp: string;
  read?: boolean;
}

export interface JobListing {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requirements?: string[];
}
export type JobPosting = JobListing;

export interface Applicant {
  id: string;
  jobId: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  appliedAt: string;
}

export interface AuditLog {
  id: string;
  actorId?: string;
  actorName?: string;
  action: string;
  target?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface OnboardingState {
  step: number;
  completed: boolean;
  dossier?: Record<string, unknown>;
}

export interface LegalCoordinationRecord {
  id: string;
  clientId: string;
  title: string;
  status: string;
}

export interface SecurityTestResult {
  id: string;
  passed: boolean;
  testedAt: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  fullName: string;
  email: string;
}

export interface JobApplicationResult { success: boolean; id?: string }
export interface ServicePlanUpdateResult { success: boolean }
export interface UserStatusUpdateResult { success: boolean }
export interface ClientReassignmentResult { success: boolean }
export interface RequiredDocumentChecklistItem { id: string; name: string; required: boolean }
export interface JournalEntryDraft { id: string; amount: number }
export interface IndustrySolutionRecord { id: string; name: string }
export interface ExtractedField { field: string; value: string }
export interface TaxStrategy { id: string; title: string }
export interface TaxStrategyRecord { id: string; title: string }
export type StrategyCategory = string;
export type ClientCategory = string;
export type WorkCycleStage = string;
export const WORK_CYCLE_STAGES: WorkCycleStage[] = [];
export interface AdvisorRequest { id: string; status: string }
