export type UserRole =
  | 'client'
  | 'prospective_client'
  | 'accountant'
  | 'tax_preparer'
  | 'cpa'
  | 'senior_reviewer'
  | 'reviewer'
  | 'bookkeeper'
  | 'practice_manager'
  | 'operations'
  | 'admin'
  | 'administrator'
  | 'super_admin'
  | 'super_administrator'
  | 'recruiter'
  | 'guest'
  | string;

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  companyName?: string;
  clientType?: 'individual' | 'business' | string;
  mfaEnabled?: boolean;
  status: 'active' | 'suspended' | 'pending' | 'inactive' | string;
  isVerified?: boolean;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  onboardingStatus?: string;
  onboardingStep?: number;
  createdAt?: string;
  lastLoginAt?: string;
  updatedAt?: string;
  title?: string;
  credentials?: string[];
  tenantId?: string;
  clientId?: string;
  authorizedClientIds?: string[];
  [key: string]: any;
}

export type DocumentStatus =
  | 'uploaded'
  | 'pending'
  | 'needs_review'
  | 'accountant_reviewing'
  | 'approved'
  | 'rejected'
  | string;

export type EngagementStatus =
  | 'draft'
  | 'intake'
  | 'collecting_docs'
  | 'preparing'
  | 'under_review'
  | 'client_approval'
  | 'ready_to_file'
  | 'filed'
  | 'completed'
  | string;

export type OnboardingState =
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | {
      step?: number;
      totalSteps?: number;
      completed?: boolean;
      data?: any;
      [key: string]: any;
    }
  | any;

export interface ExtractedDataField {
  key: string;
  label: string;
  value: string | number;
  confidence: number;
  reviewed?: boolean;
  needsAttention?: boolean;
}

export interface DocumentItem {
  id: string;
  clientId: string;
  clientName?: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  category: string;
  taxYear: number;
  status: DocumentStatus;
  uploadedAt: string;
  uploadedBy?: string;
  version?: number;
  description?: string;
  isAiProcessed?: boolean;
  ocrConfidence?: number;
  isEncrypted?: boolean;
  extractedData?: ExtractedDataField[];
  reviewedBy?: string;
  reviewedAt?: string;
  [key: string]: any;
}

export interface EngagementTask {
  id: string;
  title: string;
  completed: boolean;
  requiredRole?: string;
  dueDate?: string;
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
  type: 'virtual' | 'in_office' | 'phone' | string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | string;
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
  status: 'paid' | 'pending' | 'overdue' | 'cancelled' | string;
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
  location?: string;
  type?: string;
  experience?: string;
  description?: string;
  responsibilities?: string[];
  qualifications?: string[];
  benefits?: string[];
  isActive?: boolean;
  status?: string;
  salaryRange?: string;
  workplace?: string;
  requirements?: string[];
  postedDate?: string;
  closingDate?: string;
}

export type JobPosting = JobListing;

export interface Applicant {
  id: string;
  jobId: string;
  jobTitle: string;
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl?: string;
  resumeFileName?: string;
  coverLetter?: string;
  status: string;
  appliedDate: string;
  notes?: string;
  rating?: number;
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
  severity: 'info' | 'warning' | 'error' | 'critical' | string;
}

export interface LegalCoordinationRecord {
  id: string;
  clientId: string;
  engagementId?: string;
  attorneyName?: string;
  matterDescription?: string;
  status: string;
  [key: string]: any;
}

export interface SecurityTestResult {
  id?: string;
  name?: string;
  status?: string;
  message?: string;
  passed?: boolean;
  timestamp: string;
  details?: string;
}

export interface JobApplication {
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  resumeFile?: any;
  coverLetter?: string;
  linkedinUrl?: string;
}

export interface JobApplicationResult {
  success: boolean;
  applicationId?: string;
  error?: string;
}

export interface ServicePlanUpdateResult {
  success: boolean;
  planId?: string;
  plan?: any;
  message?: string;
  error?: string;
}

export interface UserStatusUpdateResult {
  success: boolean;
  userId?: string;
  user?: any;
  message?: string;
  error?: string;
}

export interface ClientReassignmentResult {
  success: boolean;
  clientId?: string;
  client?: any;
  accountantId?: string;
  reviewerId?: string;
  message?: string;
  error?: string;
}

export interface IndustrySolutionRecord {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  keyChallenges: string[];
  strategicSolutions: string[];
  [key: string]: any;
}

export type StrategyCategory =
  | 'individuals'
  | 'families'
  | 'self_employed'
  | 'small_businesses'
  | 's_corporations'
  | 'c_corporations'
  | 'real_estate'
  | 'high_net_worth'
  | string;

export interface TaxStrategyWorkflowStep {
  stepNumber: number;
  title: string;
  description: string;
}

export interface TaxStrategyRecord {
  id: string;
  title: string;
  strategyName?: string;
  plainLanguageSummary?: string;
  category: StrategyCategory;
  shortDescription: string;
  fullDescription: string;
  estimatedSavingsRange: string;
  ircCodeCitation: string;
  eligibilityCriteria: string[];
  workflowSteps: TaxStrategyWorkflowStep[];
  auditRiskLevel: 'Low' | 'Moderate' | 'Substantial' | string;
  isPopular?: boolean;
}

export type TaxStrategy = TaxStrategyRecord;

export interface RequiredDocumentChecklistItem {
  id: string;
  name: string;
  category: string;
  required: boolean;
  uploaded: boolean;
  documentId?: string;
  notes?: string;
}

export interface AdvisorRequest {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | string;
  createdAt: string;
  dueDate?: string;
  assignedAdvisor?: string;
}

export * from './staffSessions';
export * from './staffAccess';
export * from './staffRecovery';
export * from './reviewerDashboard';
export * from './practiceManagerDashboard';
export * from './clientServiceDashboard';
export * from './bookkeeperDashboard';
export * from './onboarding';
export * from './intake';
export * from './clientPortal';
export * from './accountingIntake';
export * from './consultationRoom';
export * from './calendar';
