export type UserRole =
  | 'client'
  | 'prospective_client'
  | 'accountant'
  | 'preparer'
  | 'bookkeeper'
  | 'reviewer'
  | 'senior_reviewer'
  | 'practice_manager'
  | 'operations'
  | 'recruiter'
  | 'admin'
  | 'administrator'
  | 'super_admin'
  | 'super_administrator'
  | 'founder';

export type PermissionScope =
  | 'clients:read'
  | 'clients:write'
  | 'documents:read'
  | 'documents:write'
  | 'documents:approve'
  | 'engagements:read'
  | 'engagements:write'
  | 'billing:read'
  | 'billing:write'
  | 'bookkeeping:read'
  | 'bookkeeping:write'
  | 'tax:prepare'
  | 'tax:review'
  | 'tax:approve'
  | 'admin:users'
  | 'admin:audit'
  | 'admin:governance'
  | string;

export const ALL_PERMISSION_SCOPES: PermissionScope[] = [
  'clients:read',
  'clients:write',
  'documents:read',
  'documents:write',
  'documents:approve',
  'engagements:read',
  'engagements:write',
  'billing:read',
  'billing:write',
  'bookkeeping:read',
  'bookkeeping:write',
  'tax:prepare',
  'tax:review',
  'tax:approve',
  'admin:users',
  'admin:audit',
  'admin:governance',
];

export type DocumentStatus =
  | 'pending'
  | 'uploaded'
  | 'under_review'
  | 'approved'
  | 'verified'
  | 'rejected'
  | 'needs_revision'
  | 'missing'
  | 'not_applicable'
  | 'withdrawn'
  | string;

export type EngagementStatus =
  | 'onboarding'
  | 'document_collection'
  | 'in_progress'
  | 'in_review'
  | 'ready_for_signature'
  | 'filed'
  | 'completed'
  | 'archived'
  | 'on_hold'
  | string;

export interface User {
  id: string;
  uid?: string;
  clientId?: string;
  tenantId?: string;
  email: string;
  name: string;
  role: UserRole;
  title?: string;
  credentials?: string[];
  phone?: string;
  companyName?: string;
  clientType?: 'individual' | 'business' | 'trust' | 'nonprofit' | string;
  entityType?: string;
  mfaEnabled?: boolean;
  mfaEnrolled?: boolean;
  status: 'active' | 'pending' | 'pending_approval' | 'suspended' | 'disabled' | 'inactive' | string;
  isVerified?: boolean;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  authorizedClientIds?: string[];
  permissions?: PermissionScope[];
  onboardingStatus?: string;
  onboardingStep?: number;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  [key: string]: any;
}

export interface Engagement {
  id: string;
  clientId: string;
  tenantId?: string;
  title?: string;
  serviceType?: string;
  taxYear: number;
  status: EngagementStatus;
  progress?: number;
  currentStage?: number;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  dueDate?: string;
  filingStatus?: string;
  estimatedRefund?: number;
  estimatedBalanceDue?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface DocumentItem {
  id: string;
  clientId: string;
  engagementId?: string;
  tenantId?: string;
  name?: string;
  fileName?: string;
  category: string;
  taxYear?: number;
  status: DocumentStatus;
  size?: number | string;
  mimeType?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  url?: string;
  storagePath?: string;
  checksum?: string;
  extractedFields?: ExtractedField[];
  [key: string]: any;
}

export interface ExtractedField {
  field?: string;
  key?: string;
  label?: string;
  value: string | number | boolean | null;
  confidence?: number;
  source?: string;
  verified?: boolean;
  reviewed?: boolean;
  needsAttention?: boolean;
  [key: string]: any;
}

export interface RequiredDocumentChecklistItem {
  id: string;
  name: string;
  category: string;
  required: boolean;
  status: DocumentStatus;
  description?: string;
  taxYear?: number;
  uploadedDocumentId?: string;
  [key: string]: any;
}

export interface Appointment {
  id: string;
  clientId: string;
  staffId?: string;
  accountantId?: string;
  title?: string;
  type?: string;
  date: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  status: string;
  location?: string;
  meetingUrl?: string;
  notes?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ServicePlan {
  id: string;
  name: string;
  category?: string;
  tier?: string;
  price: number | string;
  billingCycle?: string;
  description: string;
  features: string[];
  popular?: boolean;
  highlighted?: boolean;
  badge?: string;
  ctaLabel?: string;
  [key: string]: any;
}

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  clientId: string;
  engagementId?: string;
  amount: number;
  currency?: string;
  status: 'draft' | 'sent' | 'pending' | 'paid' | 'overdue' | 'void' | 'refunded' | string;
  dueDate: string;
  issuedDate?: string;
  paidAt?: string;
  description?: string;
  lineItems?: Array<{ description: string; quantity?: number; unitPrice?: number; amount: number }>;
  [key: string]: any;
}

export interface AccountingConnection {
  id: string;
  clientId: string;
  provider: 'quickbooks' | 'xero' | 'plaid' | 'stripe' | 'gusto' | string;
  status: 'connected' | 'disconnected' | 'pending' | 'error' | 'syncing' | string;
  accountName?: string;
  lastSyncedAt?: string;
  connectedAt?: string;
  [key: string]: any;
}

export interface DetailedAccountingIntegration extends AccountingConnection {
  scopes?: string[];
  syncFrequency?: string;
  errorCount?: number;
  metadata?: Record<string, any>;
}

export interface Message {
  id: string;
  threadId?: string;
  clientId?: string;
  senderId: string;
  senderName?: string;
  senderRole?: UserRole | string;
  recipientId?: string;
  subject?: string;
  content: string;
  body?: string;
  read?: boolean;
  isRead?: boolean;
  timestamp?: string;
  createdAt?: string;
  attachments?: Array<{ id?: string; name: string; url?: string }>;
  [key: string]: any;
}

export interface JobListing {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  experience?: string;
  salaryRange?: string;
  summary?: string;
  description: string;
  responsibilities?: string[];
  qualifications?: string[];
  requirements?: string[];
  benefits?: string[];
  status?: 'open' | 'closed' | 'draft' | string;
  postedAt?: string;
  [key: string]: any;
}

export type JobPosting = JobListing;

export interface Applicant {
  id: string;
  jobId: string;
  name?: string;
  fullName?: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  coverLetter?: string;
  linkedinUrl?: string;
  status: string;
  appliedAt?: string;
  appliedDate?: string;
  notes?: string;
  [key: string]: any;
}

export interface JobApplication {
  jobId: string;
  jobTitle?: string;
  name?: string;
  fullName?: string;
  email: string;
  phone?: string;
  coverLetter?: string;
  linkedinUrl?: string;
  resumeFileName?: string;
  resumeData?: string;
  [key: string]: any;
}

export interface JobApplicationResult {
  success: boolean;
  applicantId?: string;
  applicant?: Applicant;
  error?: string;
  message?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action?: string;
  event?: string;
  resource?: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  severity?: 'info' | 'warning' | 'critical' | string;
  timestamp: string;
  [key: string]: any;
}

export interface OnboardingState {
  clientId?: string;
  currentStep?: number;
  completedSteps?: number[];
  status?: string;
  taxYear?: number;
  data?: Record<string, any>;
  updatedAt?: string;
  [key: string]: any;
}

export interface JournalEntryDraft {
  id: string;
  clientId?: string;
  date?: string;
  description?: string;
  lines?: Array<{ id?: string; accountCode?: string; accountName?: string; debit: number; credit: number; [key: string]: any }>;
  status?: string;
  createdBy?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface LegalCoordinationRecord {
  id: string;
  clientId?: string;
  title?: string;
  matterType?: string;
  attorneyName?: string;
  firmName?: string;
  status?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface ClientAccountantBinding {
  id: string;
  clientId: string;
  accountantId: string;
  reviewerId?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'revoked' | string;
  effectiveFrom?: string;
  effectiveTo?: string;
  assignedAt?: string;
  [key: string]: any;
}

export interface AccountantProfile {
  id: string;
  userId?: string;
  name?: string;
  email?: string;
  title?: string;
  credentials?: string[];
  specialties?: string[];
  maxClients?: number;
  activeClientsCount?: number;
  status?: string;
  [key: string]: any;
}

export interface AccountingWorkflowTask {
  id: string;
  clientId?: string;
  engagementId?: string;
  title?: string;
  description?: string;
  assignedTo?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface DocumentRequest {
  id: string;
  clientId?: string;
  engagementId?: string;
  title?: string;
  description?: string;
  category?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  requestedBy?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ReassignmentRequest {
  id: string;
  clientId?: string;
  fromAccountantId?: string;
  toAccountantId?: string;
  requestedBy?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
  resolvedAt?: string;
  [key: string]: any;
}

export interface AdvisorRequest {
  id: string;
  clientId?: string;
  title?: string;
  description?: string;
  category?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface TaxStrategy {
  id: string;
  title?: string;
  category?: string;
  summary?: string;
  description?: string;
  estimatedSavings?: string;
  eligibility?: string;
  status?: string;
  [key: string]: any;
}

export type StrategyCategory =
  | 'Individual'
  | 'Business'
  | 'Real Estate'
  | 'Retirement & Wealth'
  | 'Credits & Incentives'
  | 'Estate & Legacy'
  | string;

export interface TaxStrategyWorkflowStep {
  step?: number;
  title?: string;
  description?: string;
  [key: string]: any;
}

export interface TaxStrategyRecord {
  id: string;
  title?: string;
  category?: StrategyCategory;
  shortDescription?: string;
  summary?: string;
  description?: string;
  targetAudience?: string[];
  estimatedImpact?: string;
  ircCitations?: string[];
  eligibilityCriteria?: string[];
  workflowSteps?: TaxStrategyWorkflowStep[];
  complianceNotes?: string;
  [key: string]: any;
}

export interface IndustrySolutionRecord {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
  tagline?: string;
  summary?: string;
  description?: string;
  challenges?: string[];
  solutions?: string[];
  keyServices?: string[];
  complianceFocus?: string[];
  imageKey?: string;
  [key: string]: any;
}

export interface SecurityTestResult {
  id?: string;
  name?: string;
  status?: 'pass' | 'fail' | 'warn' | string;
  details?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface ServicePlanUpdateResult {
  success: boolean;
  plan?: ServicePlan;
  message?: string;
  error?: string;
}

export interface UserStatusUpdateResult {
  success: boolean;
  user?: User;
  message?: string;
  error?: string;
}

export interface ClientReassignmentResult {
  success: boolean;
  reassignment?: any;
  client?: any;
  message?: string;
  error?: string;
}

export interface BookkeepingTransaction {
  id: string;
  clientId?: string;
  date?: string;
  description?: string;
  amount?: number;
  category?: string;
  accountId?: string;
  status?: string;
  reconciled?: boolean;
  [key: string]: any;
}

export interface BankReconciliation {
  id: string;
  clientId?: string;
  accountName?: string;
  statementDate?: string;
  statementBalance?: number;
  bookBalance?: number;
  variance?: number;
  status?: string;
  [key: string]: any;
}

export interface ChartOfAccountItem {
  id?: string;
  clientId?: string;
  code: string;
  name: string;
  type?: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense' | string;
  category?: string;
  subCategory?: string;
  taxMapping?: string;
  balance?: number;
  active?: boolean;
  [key: string]: any;
}

export interface StaffInvitation {
  id: string;
  email: string;
  role: UserRole;
  invitedBy?: string;
  status?: string;
  token?: string;
  expiresAt?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface StaffAvailabilityConfig {
  staffId?: string;
  timezone?: string;
  weeklyHours?: Record<string, any>;
  [key: string]: any;
}

export interface AvailabilityException {
  id: string;
  staffId?: string;
  date?: string;
  available?: boolean;
  reason?: string;
  [key: string]: any;
}

export interface CalendarConnection {
  id: string;
  userId?: string;
  staffId?: string;
  provider?: string;
  email?: string;
  status?: string;
  lastSyncedAt?: string;
  [key: string]: any;
}

export interface CalendarBusyBlock {
  id: string;
  staffId?: string;
  start?: string;
  end?: string;
  startUtc?: string;
  endUtc?: string;
  source?: string;
  [key: string]: any;
}

export interface AppointmentSlotHold {
  id: string;
  staffId?: string;
  start?: string;
  end?: string;
  startUtc?: string;
  endUtc?: string;
  expiresAt?: string;
  expiresAtMs?: number;
  [key: string]: any;
}

export interface SynchronizedAppointment extends Appointment {
  externalEventId?: string;
  provider?: string;
}

export interface FirmHoliday {
  id?: string;
  name: string;
  date: string;
  [key: string]: any;
}

export type {
  ClientOnboardingDossier,
  StaffOnboardingDossier,
  ClientCategory,
} from './onboarding';

export type {
  FullClientIntakeDossier,
  GovernedResearchRule,
  AccountingStagingRecord,
  USEntityType,
  USStateCode,
  OwnerOrOfficer,
} from './intake';
