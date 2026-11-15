export type UserRole =
  | 'client'
  | 'prospective_client'
  | 'accountant'
  | 'preparer'
  | 'reviewer'
  | 'senior_reviewer'
  | 'bookkeeper'
  | 'practice_manager'
  | 'operations'
  | 'recruiter'
  | 'founder'
  | 'administrator'
  | 'admin'
  | 'super_admin'
  | 'super_administrator';

export type DocumentStatus =
  | 'uploaded'
  | 'received'
  | 'processing'
  | 'pending_review'
  | 'verified'
  | 'accepted'
  | 'rejected'
  | 'missing'
  | 'requested'
  | 'not_applicable';

export type EngagementStatus =
  | 'onboarding'
  | 'intake'
  | 'document_collection'
  | 'in_preparation'
  | 'in_review'
  | 'pending_client_approval'
  | 'ready_to_file'
  | 'filed'
  | 'completed'
  | 'archived';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title?: string;
  credentials?: string[];
  phone?: string;
  companyName?: string;
  clientType?: 'individual' | 'business';
  clientId?: string;
  tenantId?: string;
  mfaEnabled?: boolean;
  status: 'active' | 'inactive' | 'suspended' | 'pending' | string;
  isVerified?: boolean;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  authorizedClientIds?: string[];
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
  taxYear: number;
  title?: string;
  serviceType?: string;
  entityType?: string;
  status: EngagementStatus | string;
  progress?: number;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  dueDate?: string;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface DocumentItem {
  id: string;
  clientId: string;
  engagementId?: string;
  fileName: string;
  category?: string;
  taxYear?: number;
  status: DocumentStatus | string;
  uploadedAt?: string;
  fileSize?: number | string;
  mimeType?: string;
  notes?: string;
  [key: string]: any;
}

export interface RequiredDocumentChecklistItem {
  id: string;
  title: string;
  category?: string;
  taxYear?: number;
  required?: boolean;
  status: 'missing' | 'requested' | 'uploaded' | 'verified' | 'accepted' | 'not_applicable' | string;
  description?: string;
  [key: string]: any;
}

export interface Appointment {
  id: string;
  clientId?: string;
  staffId?: string;
  title?: string;
  date?: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  type?: string;
  modality?: 'video' | 'phone' | 'in_person' | string;
  status: string;
  meetingLink?: string;
  notes?: string;
  [key: string]: any;
}

export interface ServicePlan {
  id: string;
  name: string;
  category?: string;
  price: number;
  billingCycle?: string;
  description: string;
  features: string[];
  popular?: boolean;
  badge?: string;
  [key: string]: any;
}

export interface Invoice {
  id: string;
  clientId: string;
  engagementId?: string;
  invoiceNumber?: string;
  title?: string;
  description?: string;
  amount: number;
  amountCents?: number;
  status: 'draft' | 'issued' | 'pending' | 'paid' | 'overdue' | 'void' | 'refunded' | string;
  dueDate?: string;
  issuedAt?: string;
  paidAt?: string;
  [key: string]: any;
}

export interface AccountingConnection {
  id: string;
  clientId: string;
  provider: string;
  status: 'connected' | 'disconnected' | 'error' | string;
  lastSyncAt?: string;
  accountCount?: number;
  [key: string]: any;
}

export interface Message {
  id: string;
  threadId?: string;
  clientId?: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  recipientId?: string;
  subject?: string;
  body?: string;
  content?: string;
  timestamp?: string;
  createdAt?: string;
  isRead?: boolean;
  [key: string]: any;
}

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  compensation?: string;
  salaryRange?: string;
  summary?: string;
  description: string;
  requirements: string[];
  responsibilities?: string[];
  status?: string;
  postedAt?: string;
  [key: string]: any;
}

export type JobListing = JobPosting;

export interface JobApplication {
  jobId: string;
  jobTitle?: string;
  name?: string;
  fullName?: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  resumeFileName?: string;
  coverLetter?: string;
  [key: string]: any;
}

export interface JobApplicationResult {
  success: boolean;
  applicantId?: string;
  message?: string;
  applicant?: Applicant;
  error?: string;
}

export interface Applicant {
  id: string;
  jobId: string;
  jobTitle?: string;
  name?: string;
  fullName?: string;
  email: string;
  phone?: string;
  status: string;
  appliedAt?: string;
  [key: string]: any;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  resource?: string;
  targetId?: string;
  status?: string;
  details?: string;
  ipAddress?: string;
  [key: string]: any;
}

export interface OnboardingState {
  clientId?: string;
  status?: string;
  currentStep?: number;
  completedSteps?: number[];
  [key: string]: any;
}

export interface LegalCoordinationRecord {
  id: string;
  clientId: string;
  matterTitle?: string;
  status: string;
  [key: string]: any;
}

export interface SecurityTestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'warning' | string;
  details?: string;
  checkedAt?: string;
  [key: string]: any;
}

export interface ServicePlanUpdateResult {
  success: boolean;
  message?: string;
  plan?: ServicePlan;
  error?: string;
}

export interface UserStatusUpdateResult {
  success: boolean;
  message?: string;
  user?: User;
  error?: string;
}

export interface ClientReassignmentResult {
  success: boolean;
  message?: string;
  client?: any;
  error?: string;
}

export interface AdvisorRequest {
  id: string;
  clientId?: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface TaxStrategy {
  id: string;
  title: string;
  category?: string;
  estimatedSavings?: string;
  status?: string;
  description?: string;
  [key: string]: any;
}

export type StrategyCategory = string;

export interface TaxStrategyWorkflowStep {
  id?: string;
  step: number | string;
  title?: string;
  description?: string;
  requiredRole?: string;
  [key: string]: any;
}

export interface TaxStrategyRecord {
  id: string;
  strategyName?: string;
  title?: string;
  category: StrategyCategory;
  plainLanguageSummary?: string;
  summary?: string;
  eligibility?: string;
  estimatedImpact?: string;
  ircCitation?: string;
  steps?: TaxStrategyWorkflowStep[];
  [key: string]: any;
}

export interface IndustrySolutionRecord {
  id: string;
  slug?: string;
  title?: string;
  name?: string;
  tagline?: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  challenges?: string[];
  keyChallenges?: string[];
  solutions?: string[];
  strategicSolutions?: string[];
  keyForms?: string[];
  applicableForms?: string[];
  [key: string]: any;
}
