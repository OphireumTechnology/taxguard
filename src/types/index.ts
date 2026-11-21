export type UserRole =
  | 'client'
  | 'prospective_client'
  | 'accountant'
  | 'reviewer'
  | 'senior_reviewer'
  | 'bookkeeper'
  | 'practice_manager'
  | 'client_service'
  | 'operations'
  | 'recruiter'
  | 'founder'
  | 'admin'
  | 'administrator'
  | 'super_admin'
  | 'super_administrator';

export type DocumentStatus =
  | 'pending'
  | 'uploaded'
  | 'processing'
  | 'in_review'
  | 'verified'
  | 'accepted'
  | 'rejected'
  | 'needs_action'
  | 'missing'
  | 'requested'
  | 'archived';

export type EngagementStatus =
  | 'draft'
  | 'onboarding'
  | 'active'
  | 'collecting_documents'
  | 'in_review'
  | 'in_preparation'
  | 'ready_for_review'
  | 'awaiting_approval'
  | 'awaiting_signature'
  | 'approved'
  | 'filed'
  | 'completed'
  | 'on_hold'
  | 'cancelled'
  | 'archived';

export interface OnboardingState {
  status?: string;
  currentStep?: number;
  completedSteps?: number[];
  taxYear?: number;
  clientId?: string;
  engagementId?: string;
  isComplete?: boolean;
  [key: string]: any;
}

export interface User {
  id: string;
  uid?: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  companyName?: string;
  clientType?: 'individual' | 'business' | string;
  title?: string;
  credentials?: string[];
  mfaEnabled?: boolean;
  status: 'active' | 'inactive' | 'disabled' | 'suspended' | 'pending' | string;
  isVerified?: boolean;
  tenantId?: string;
  clientId?: string;
  authorizedClientIds?: string[];
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  onboardingStatus?: string;
  onboardingStep?: number;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  filingStatus?: string;
  entityType?: string;
  taxYear?: number;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  [key: string]: any;
}

export interface Engagement {
  id: string;
  clientId: string;
  clientName?: string;
  title?: string;
  name?: string;
  serviceType?: string;
  taxYear: number;
  status: EngagementStatus | string;
  progress?: number;
  stage?: number;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  dueDate?: string;
  filingDeadline?: string;
  federalStatus?: string;
  stateStatus?: string;
  estimatedRefundOrDue?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface DocumentItem {
  id: string;
  clientId: string;
  engagementId?: string;
  fileName: string;
  originalName?: string;
  category: string;
  taxYear?: number;
  status: DocumentStatus | string;
  fileSize?: number | string;
  mimeType?: string;
  uploadedAt: string;
  uploadedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
  storagePath?: string;
  checksum?: string;
  [key: string]: any;
}

export interface RequiredDocumentChecklistItem {
  id: string;
  title: string;
  category: string;
  taxYear?: number;
  required: boolean;
  status: 'missing' | 'requested' | 'uploaded' | 'verified' | 'accepted' | 'waived' | 'not_applicable' | string;
  description?: string;
  dueDate?: string;
  documentId?: string;
  [key: string]: any;
}

export interface Appointment {
  id?: string;
  appointmentId?: string;
  clientId: string;
  clientName?: string;
  advisorId?: string;
  advisorName?: string;
  staffId?: string;
  staffName?: string;
  title?: any;
  type?: string;
  date?: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled' | 'pending' | string;
  location?: string;
  meetingUrl?: string;
  roomId?: string;
  notes?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ServicePlan {
  id: string;
  name: string;
  tagline?: string;
  category?: 'individual' | 'business' | 'advisory' | 'enterprise' | string;
  price: number;
  billingCycle?: string;
  priceLabel?: string;
  description?: string;
  features: string[];
  highlighted?: boolean;
  popular?: boolean;
  badge?: string;
  ctaText?: string;
  isActive?: boolean;
  [key: string]: any;
}

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  clientId: string;
  clientName?: string;
  engagementId?: string;
  description?: string;
  amount: number;
  balanceDue?: number;
  currency?: string;
  status: 'draft' | 'sent' | 'open' | 'paid' | 'overdue' | 'void' | 'refunded' | 'partial' | string;
  issuedAt?: string;
  issueDate?: string;
  dueDate: string;
  paidAt?: string;
  lineItems?: Array<{
    id?: string;
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount: number;
  }>;
  [key: string]: any;
}

export interface AccountingConnection {
  id: string;
  clientId: string;
  provider: 'quickbooks' | 'xero' | 'plaid' | 'gusto' | 'adp' | 'stripe' | string;
  institutionName?: string;
  accountName?: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending' | 'syncing' | string;
  lastSyncedAt?: string;
  [key: string]: any;
}

export interface Message {
  id: string;
  threadId?: string;
  clientId?: string;
  senderId: string;
  senderName: string;
  senderRole?: UserRole | string;
  recipientId?: string;
  subject?: string;
  body?: string;
  content?: string;
  timestamp: string;
  createdAt?: string;
  read?: boolean;
  isRead?: boolean;
  attachments?: Array<{ id?: string; name: string; url?: string }>;
  [key: string]: any;
}

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  experience?: string;
  salaryRange?: string;
  description: string;
  responsibilities?: string[];
  requirements?: string[];
  qualifications?: string[];
  benefits?: string[];
  status?: 'open' | 'closed' | 'draft' | string;
  postedAt?: string;
  [key: string]: any;
}

export type JobListing = JobPosting;

export interface Applicant {
  id: string;
  jobId: string;
  jobTitle?: string;
  name?: string;
  fullName?: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  resumeFileName?: string;
  coverLetter?: string;
  status: 'new' | 'reviewing' | 'interview' | 'offer' | 'hired' | 'rejected' | string;
  appliedAt?: string;
  appliedDate?: string;
  notes?: string;
  rating?: number;
  [key: string]: any;
}

export interface JobApplication {
  jobId: string;
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
  applicant?: Applicant;
  applicantId?: string;
  message?: string;
  error?: string;
  [key: string]: any;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  target?: string;
  status?: 'success' | 'failure' | 'denied' | string;
  ipAddress?: string;
  details?: string | Record<string, any>;
  severity?: 'info' | 'warning' | 'critical' | string;
  [key: string]: any;
}

export interface LegalCoordinationRecord {
  id: string;
  clientId: string;
  matterType: string;
  attorneyName?: string;
  firmName?: string;
  status: string;
  summary?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface SecurityTestResult {
  id?: string;
  name: string;
  passed: boolean;
  status?: 'passed' | 'failed' | 'warning' | string;
  details?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface ServicePlanUpdateResult {
  success: boolean;
  plan?: ServicePlan;
  message?: string;
  error?: string;
  [key: string]: any;
}

export interface UserStatusUpdateResult {
  success: boolean;
  user?: User;
  message?: string;
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
  title: string;
  description?: string;
  category?: string;
  status: 'open' | 'pending' | 'in_progress' | 'responded' | 'resolved' | 'completed' | string;
  priority?: 'low' | 'normal' | 'high' | 'urgent' | string;
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
  requestedBy?: string;
  response?: string;
  [key: string]: any;
}

export type StrategyCategory = string;

export interface TaxStrategyWorkflowStep {
  step: number;
  title: string;
  description: string;
  [key: string]: any;
}

export interface TaxStrategyRecord {
  id: string;
  title?: string;
  strategyName?: string;
  category?: StrategyCategory;
  summary?: string;
  plainLanguageSummary?: string;
  description?: string;
  ircReference?: string;
  estimatedSavings?: string;
  targetAudience?: string[];
  eligibility?: string[];
  requirements?: string[];
  requiredDocuments?: string[];
  complexity?: 'Low' | 'Moderate' | 'High' | string;
  workflowSteps?: TaxStrategyWorkflowStep[];
  [key: string]: any;
}

export interface TaxStrategy extends TaxStrategyRecord {
  status?: 'recommended' | 'active' | 'implemented' | 'under_review' | string;
}

export interface IndustrySolutionRecord {
  id: string;
  slug?: string;
  name: string;
  title?: string;
  tagline?: string;
  summary?: string;
  description?: string;
  challenges?: string[];
  keyChallenges?: string[];
  solutions?: string[];
  strategicSolutions?: string[];
  services?: string[];
  keyForms?: string[];
  applicableForms?: string[];
  recommendedServicePlan?: string;
  clientCaseExample?: string;
  imageKey?: string;
  [key: string]: any;
}
