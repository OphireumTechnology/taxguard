export type UserRole =
  | 'guest'
  | 'prospective_client'
  | 'client'
  | 'bookkeeper'
  | 'accountant'
  | 'reviewer'
  | 'senior_reviewer'
  | 'client_service'
  | 'operations'
  | 'practice_manager'
  | 'admin'
  | 'administrator'
  | 'super_admin'
  | 'super_administrator'
  | string;

export type PermissionScope =
  | 'read:clients'
  | 'write:clients'
  | 'read:documents'
  | 'write:documents'
  | 'review:returns'
  | 'approve:returns'
  | 'manage:billing'
  | 'manage:staff'
  | 'manage:ai'
  | 'audit:read'
  | string;

export const ALL_PERMISSION_SCOPES: PermissionScope[] = [
  'read:clients',
  'write:clients',
  'read:documents',
  'write:documents',
  'review:returns',
  'approve:returns',
  'manage:billing',
  'manage:staff',
  'manage:ai',
  'audit:read',
];

export type DocumentStatus =
  | 'pending'
  | 'uploaded'
  | 'under_review'
  | 'verified'
  | 'approved'
  | 'rejected'
  | 'missing'
  | 'archived'
  | string;

export type EngagementStatus =
  | 'draft'
  | 'onboarding'
  | 'in_progress'
  | 'document_collection'
  | 'under_review'
  | 'ready_for_signature'
  | 'filed'
  | 'completed'
  | 'archived'
  | string;

export type StrategyCategory =
  | 'individual'
  | 'business'
  | 'real_estate'
  | 'wealth'
  | 'retirement'
  | 'credits'
  | string;

export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  status: 'active' | 'pending' | 'suspended' | 'disabled' | string;
  clientId?: string;
  tenantId?: string;
  phone?: string;
  companyName?: string;
  entityType?: string;
  filingStatus?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  avatarUrl?: string;
  mfaEnabled?: boolean;
  emailVerified?: boolean;
  onboardingCompleted?: boolean;
  authorizedClientIds?: string[];
  permissions?: PermissionScope[];
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  assignedReviewerId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  passwordHash?: string;
  [key: string]: any;
}

export interface Engagement {
  id: string;
  clientId: string;
  tenantId?: string;
  taxYear?: number;
  serviceType?: string;
  title?: string;
  status: EngagementStatus;
  stage?: string | number;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  dueDate?: string;
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface DocumentItem {
  id: string;
  clientId?: string;
  engagementId?: string;
  name?: string;
  fileName?: string;
  category?: string;
  documentType?: string;
  taxYear?: number;
  status: DocumentStatus;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  storagePath?: string;
  notes?: string;
  [key: string]: any;
}

export interface RequiredDocumentChecklistItem {
  id: string;
  title?: string;
  category?: string;
  required?: boolean;
  status?: DocumentStatus;
  description?: string;
  documentId?: string;
  [key: string]: any;
}

export interface ExtractedField {
  id?: string;
  label?: string;
  name?: string;
  value: any;
  confidence?: number;
  source?: string;
  verified?: boolean;
  [key: string]: any;
}

export interface Appointment {
  id: string;
  clientId?: string;
  staffId?: string;
  title?: string;
  type?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  meetingLink?: string;
  notes?: string;
  [key: string]: any;
}

export interface ServicePlan {
  id: string;
  name: string;
  tier?: string;
  category?: string;
  price?: number | string;
  billingCycle?: string;
  description?: string;
  features?: string[];
  popular?: boolean;
  active?: boolean;
  [key: string]: any;
}

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  clientId?: string;
  amount?: number;
  amountCents?: number;
  currency?: string;
  status: string;
  dueDate?: string;
  issuedAt?: string;
  paidAt?: string;
  description?: string;
  items?: Array<{ description: string; amount: number; quantity?: number; [key: string]: any }>;
  [key: string]: any;
}

export interface AccountingConnection {
  id: string;
  clientId?: string;
  provider: string;
  status: string;
  lastSyncedAt?: string;
  accountName?: string;
  [key: string]: any;
}

export interface DetailedAccountingIntegration extends AccountingConnection {
  scopes?: string[];
  realmId?: string;
  [key: string]: any;
}

export interface Message {
  id: string;
  threadId?: string;
  clientId?: string;
  senderId?: string;
  senderName?: string;
  senderRole?: UserRole;
  recipientId?: string;
  subject?: string;
  body?: string;
  content?: string;
  timestamp?: string;
  createdAt?: string;
  read?: boolean;
  isRead?: boolean;
  [key: string]: any;
}

export interface JobPosting {
  id: string;
  title: string;
  department?: string;
  location?: string;
  type?: string;
  employmentType?: string;
  salaryRange?: string;
  summary?: string;
  description?: string;
  responsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  postedAt?: string;
  status?: string;
  [key: string]: any;
}

export type JobListing = JobPosting;

export interface Applicant {
  id: string;
  jobId: string;
  name?: string;
  fullName?: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  coverLetter?: string;
  status?: string;
  appliedAt?: string;
  [key: string]: any;
}

export interface JobApplication {
  jobId: string;
  jobTitle?: string;
  name?: string;
  fullName?: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  coverLetter?: string;
  resumeFileName?: string;
  [key: string]: any;
}

export interface JobApplicationResult {
  success: boolean;
  applicationId?: string;
  message?: string;
  error?: string;
  [key: string]: any;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  details?: string;
  severity?: 'info' | 'warning' | 'critical' | string;
  ipAddress?: string;
  [key: string]: any;
}

export interface OnboardingState {
  clientId?: string;
  step?: number;
  currentStep?: number;
  completed?: boolean;
  status?: string;
  percentComplete?: number;
  data?: Record<string, any>;
  [key: string]: any;
}

export interface LegalCoordinationRecord {
  id: string;
  clientId?: string;
  matterType?: string;
  title?: string;
  status?: string;
  attorneyName?: string;
  notes?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface SecurityTestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'warning' | string;
  checkedAt?: string;
  details?: string;
  [key: string]: any;
}

export interface ServicePlanUpdateResult {
  success: boolean;
  plan?: ServicePlan;
  error?: string;
  [key: string]: any;
}

export interface UserStatusUpdateResult {
  success: boolean;
  user?: User;
  error?: string;
  [key: string]: any;
}

export interface ClientReassignmentResult {
  success: boolean;
  message?: string;
  error?: string;
  [key: string]: any;
}

export interface AdvisorRequest {
  id: string;
  clientId?: string;
  subject?: string;
  category?: string;
  priority?: string;
  status: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface TaxStrategyWorkflowStep {
  step?: number | string;
  title?: string;
  description?: string;
  [key: string]: any;
}

export interface TaxStrategyRecord {
  id: string;
  title?: string;
  strategyName?: string;
  category?: StrategyCategory;
  summary?: string;
  description?: string;
  estimatedSavings?: string;
  eligibility?: string[] | string;
  ircReferences?: string[] | string;
  workflowSteps?: TaxStrategyWorkflowStep[];
  [key: string]: any;
}

export type TaxStrategy = TaxStrategyRecord;

export interface IndustrySolutionRecord {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
  tagline?: string;
  description?: string;
  challenges?: string[];
  solutions?: string[];
  taxOpportunities?: string[];
  imageKey?: string;
  [key: string]: any;
}

export interface JournalEntryDraft {
  id: string;
  clientId?: string;
  date?: string;
  description?: string;
  status?: string;
  lines?: Array<{
    id?: string;
    account?: string;
    accountNumber?: string;
    accountName?: string;
    debit: number;
    credit: number;
    description?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface ClientAccountantBinding {
  id?: string;
  clientId: string;
  accountantId: string;
  role?: string;
  active?: boolean;
  effectiveFrom?: string;
  effectiveUntil?: string;
  [key: string]: any;
}

export interface AccountantProfile {
  id: string;
  userId?: string;
  name?: string;
  credentials?: string | string[];
  specialties?: string[];
  activeClients?: number;
  [key: string]: any;
}

export interface AccountingWorkflowTask {
  id: string;
  clientId?: string;
  title?: string;
  status?: string;
  assigneeId?: string;
  dueDate?: string;
  [key: string]: any;
}

export interface DocumentRequest {
  id: string;
  clientId?: string;
  title?: string;
  category?: string;
  status?: string;
  dueDate?: string;
  [key: string]: any;
}

export interface ReassignmentRequest {
  id: string;
  clientId?: string;
  fromStaffId?: string;
  toStaffId?: string;
  reason?: string;
  status?: string;
  [key: string]: any;
}

export interface StaffInvitation {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  createdAt?: string;
  expiresAt?: string;
  [key: string]: any;
}

export interface StaffAvailabilityConfig {
  staffId: string;
  timezone?: string;
  weeklyHours?: Record<string, any>;
  [key: string]: any;
}

export interface AvailabilityException {
  id: string;
  staffId: string;
  date?: string;
  reason?: string;
  [key: string]: any;
}

export interface CalendarConnection {
  id: string;
  userId?: string;
  provider?: string;
  status?: string;
  email?: string;
  [key: string]: any;
}

export interface CalendarBusyBlock {
  id: string;
  staffId: string;
  start?: string;
  end?: string;
  startUtc?: string;
  endUtc?: string;
  [key: string]: any;
}

export interface AppointmentSlotHold {
  id: string;
  staffId: string;
  start?: string;
  end?: string;
  startUtc?: string;
  endUtc?: string;
  expiresAt?: string;
  expiresAtMs?: number;
  [key: string]: any;
}

export interface SynchronizedAppointment extends Appointment {
  externalId?: string;
  provider?: string;
}

export interface FirmHoliday {
  id: string;
  date: string;
  name: string;
  [key: string]: any;
}

export interface BookkeepingTransaction {
  id: string;
  clientId?: string;
  date?: string;
  description?: string;
  amount?: number;
  category?: string;
  status?: string;
  [key: string]: any;
}

export interface BankReconciliation {
  id: string;
  clientId?: string;
  accountName?: string;
  periodEnd?: string;
  status?: string;
  [key: string]: any;
}

export interface ChartOfAccountItem {
  id?: string;
  code?: string;
  accountNumber?: string;
  name?: string;
  accountName?: string;
  type?: string;
  category?: string;
  subCategory?: string;
  taxMapping?: string;
  balance?: number;
  [key: string]: any;
}

export type { ClientOnboardingDossier, StaffOnboardingDossier } from './onboarding';
export type { FullClientIntakeDossier, GovernedResearchRule, AccountingStagingRecord } from './intake';
