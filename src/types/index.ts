export type UserRole =
  | 'client'
  | 'prospective_client'
  | 'accountant'
  | 'reviewer'
  | 'senior_reviewer'
  | 'bookkeeper'
  | 'client_service'
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
  | 'processing'
  | 'needs_review'
  | 'accountant_reviewing'
  | 'approved'
  | 'rejected'
  | 'verified'
  | 'accepted'
  | 'missing'
  | 'requested'
  | string;

export type EngagementStatus =
  | 'draft'
  | 'intake_pending'
  | 'collecting_documents'
  | 'in_preparation'
  | 'under_review'
  | 'ready_for_signature'
  | 'filed'
  | 'delivered'
  | 'archived'
  | string;

export type OnboardingState =
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'approved'
  | 'completed'
  | string
  | {
      currentStep?: number;
      step?: number;
      totalSteps?: number;
      completed?: boolean;
      status?: string;
      data?: Record<string, any>;
      [key: string]: any;
    };

export interface User {
  id: string;
  uid?: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'disabled' | 'suspended' | 'pending' | string;
  tenantId?: string;
  clientId?: string;
  authorizedClientIds?: string[];
  title?: string;
  credentials?: string[];
  phone?: string;
  companyName?: string;
  clientType?: 'individual' | 'business' | string;
  mfaEnabled?: boolean;
  isVerified?: boolean;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  onboardingStatus?: OnboardingState;
  onboardingStep?: number;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  [key: string]: any;
}

export interface EngagementTask {
  id: string;
  title: string;
  completed: boolean;
  requiredRole: string;
  dueDate?: string;
  [key: string]: any;
}

export interface Engagement {
  id: string;
  clientId: string;
  clientName?: string;
  businessName?: string;
  taxYear: number;
  serviceType: string;
  serviceTitle: string;
  status: EngagementStatus;
  priority?: 'low' | 'normal' | 'high' | 'urgent' | string;
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  reviewerId?: string;
  reviewerName?: string;
  dueDate?: string;
  progressPercent?: number;
  internalNotes?: string;
  clientNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  tasks?: EngagementTask[];
  [key: string]: any;
}

export interface DocumentItem {
  id: string;
  clientId: string;
  clientName?: string;
  fileName: string;
  fileSize?: string;
  fileType?: string;
  category: string;
  taxYear?: number;
  status: DocumentStatus;
  uploadedAt: string;
  uploadedBy?: string;
  version?: number;
  description?: string;
  isAiProcessed?: boolean;
  ocrConfidence?: number;
  isEncrypted?: boolean;
  extractedData?: Array<{
    key: string;
    label: string;
    value: string;
    confidence?: number;
    reviewed?: boolean;
    needsAttention?: boolean;
  }>;
  reviewedBy?: string;
  reviewedAt?: string;
  [key: string]: any;
}

export interface RequiredDocumentChecklistItem {
  id: string;
  title: string;
  category: string;
  status: 'missing' | 'requested' | 'uploaded' | 'verified' | 'not_applicable' | string;
  taxYear?: number;
  description?: string;
  required?: boolean;
  [key: string]: any;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceType: string;
  accountantId?: string;
  accountantName?: string;
  requestedFounder?: boolean;
  date: string;
  timeSlot: string;
  type: 'virtual' | 'phone' | 'in_office' | string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | string;
  meetingLink?: string;
  location?: string;
  notes?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ServicePlan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  billingPeriod: 'one_time' | 'monthly' | 'annual' | string;
  isPopular?: boolean;
  description: string;
  idealFor?: string;
  features: string[];
  [key: string]: any;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName?: string;
  servicePlanId?: string;
  description: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'void' | 'refunded' | string;
  issuedDate: string;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: string;
  [key: string]: any;
}

export interface AccountingConnection {
  id: string;
  clientId: string;
  provider: string;
  providerName: string;
  companyName: string;
  status: 'connected' | 'disconnected' | 'error' | string;
  lastSyncedAt?: string;
  syncScope?: string[];
  syncHealth?: string;
  totalTransactionsSynced?: number;
  [key: string]: any;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId?: string;
  engagementId?: string;
  content: string;
  timestamp: string;
  isInternalOnly?: boolean;
  isRead?: boolean;
  [key: string]: any;
}

export interface JobListing {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  workplace?: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  isActive: boolean;
  status: 'open' | 'closed' | string;
  salaryRange?: string;
  postedDate?: string;
  closingDate?: string;
  [key: string]: any;
}

export type JobPosting = JobListing;

export interface Applicant {
  id: string;
  jobId: string;
  jobTitle?: string;
  fullName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  resumeFileName?: string;
  coverLetter?: string;
  status: string;
  appliedDate?: string;
  appliedAt?: string;
  notes?: string;
  rating?: number;
  [key: string]: any;
}

export interface JobApplication {
  jobId: string;
  fullName: string;
  email: string;
  phone?: string;
  coverLetter?: string;
  resumeFileName?: string;
  [key: string]: any;
}

export interface JobApplicationResult {
  success: boolean;
  applicantId?: string;
  message?: string;
  error?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  resource: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
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
  notes?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface SecurityTestResult {
  id: string;
  name: string;
  passed: boolean;
  status: 'pass' | 'fail' | string;
  message: string;
  timestamp: string;
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
  error?: string;
  [key: string]: any;
}

export interface IndustrySolutionRecord {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  keyChallenges: string[];
  strategicSolutions: string[];
  applicableForms: string[];
  recommendedServicePlan: string;
  clientCaseExample?: string;
  [key: string]: any;
}

export type StrategyCategory =
  | 'individuals'
  | 'families'
  | 'self_employed'
  | 'small_businesses'
  | 's_corporations'
  | 'c_corporations'
  | 'partnerships'
  | 'real_estate'
  | 'retirement'
  | 'estates_trusts'
  | 'charitable_planning'
  | string;

export interface TaxStrategyWorkflowStep {
  stepNumber?: number;
  title: string;
  description: string;
  owner?: string;
  [key: string]: any;
}

export interface TaxStrategyRecord {
  id: string;
  title?: string;
  strategyName?: string;
  category: StrategyCategory;
  summary?: string;
  plainLanguageSummary?: string;
  ircCitation?: string;
  estimatedImpact?: string;
  eligibility?: string[];
  steps?: TaxStrategyWorkflowStep[];
  [key: string]: any;
}

export interface AdvisorRequest {
  id: string;
  title: string;
  question: string;
  status: 'open' | 'answered' | 'resolved' | string;
  priority?: string;
  requestedBy?: string;
  requestedAt?: string;
  category?: string;
  dueDate?: string;
  [key: string]: any;
}

export interface TaxStrategy {
  id: string;
  title: string;
  ircCode?: string;
  potentialSavings?: string;
  status?: string;
  description: string;
  [key: string]: any;
}
