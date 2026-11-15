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

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title?: string;
  credentials?: string[];
  phone?: string;
  companyName?: string;
  company?: string;
  taxFilingType?: string;
  clientType?: 'individual' | 'business' | string;
  mfaEnabled: boolean;
  status: 'active' | 'disabled' | 'suspended' | 'pending_approval' | string;
  isVerified: boolean;
  tenantId?: string;
  clientId?: string;
  authorizedClientIds?: string[];
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  onboardingStatus?: string;
  onboardingStep?: number;
  onboardingCompletedAt?: string;
  createdAt?: string;
  lastLoginAt?: string;
  [key: string]: unknown;
}

export type EngagementStatus =
  | 'draft'
  | 'intake_pending'
  | 'collecting_documents'
  | 'in_preparation'
  | 'under_review'
  | 'ready_for_signature'
  | 'filed'
  | 'delivered'
  | 'completed'
  | 'on_hold'
  | 'cancelled'
  | string;

export interface EngagementTask {
  id: string;
  title: string;
  completed: boolean;
  requiredRole: string;
  dueDate?: string;
}

export interface Engagement {
  id: string;
  clientId: string;
  clientName: string;
  businessName?: string;
  taxYear: number;
  serviceType: string;
  serviceTitle: string;
  status: EngagementStatus;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | string;
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  reviewerId?: string;
  reviewerName?: string;
  dueDate?: string;
  progressPercent: number;
  progressPercentage?: number;
  internalNotes?: string;
  clientNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  tasks?: EngagementTask[];
  [key: string]: unknown;
}

export type DocumentStatus =
  | 'missing'
  | 'requested'
  | 'uploaded'
  | 'processing'
  | 'needs_review'
  | 'accountant_reviewing'
  | 'approved'
  | 'verified'
  | 'accepted'
  | 'rejected'
  | 'replacement_required'
  | string;

export interface ExtractedDocumentField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  reviewed: boolean;
  needsAttention?: boolean;
}

export interface DocumentItem {
  id: string;
  clientId: string;
  clientName?: string;
  fileName: string;
  fileSize?: string;
  fileType?: string;
  category: string;
  taxYear: number;
  status: DocumentStatus;
  uploadedAt?: string;
  uploadedBy?: string;
  version?: number;
  description?: string;
  isAiProcessed?: boolean;
  ocrConfidence?: number;
  isEncrypted?: boolean;
  extractedData?: ExtractedDocumentField[];
  reviewedBy?: string;
  reviewedAt?: string;
  [key: string]: unknown;
}

export interface RequiredDocumentChecklistItem {
  id: string;
  title: string;
  category: string;
  taxYear: number;
  status: 'missing' | 'requested' | 'uploaded' | 'verified' | 'not_applicable' | string;
  description?: string;
  submissionInstructions?: string;
  required?: boolean;
  dueDate?: string;
  [key: string]: unknown;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceType: string;
  accountantId?: string;
  accountantName?: string;
  requestedFounder?: boolean;
  date: string;
  timeSlot: string;
  type: 'virtual' | 'telephone' | 'in_office' | string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | string;
  meetingLink?: string;
  location?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ServicePlan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  billingPeriod: 'one_time' | 'monthly' | 'annual' | string;
  isPopular?: boolean;
  description: string;
  idealFor: string;
  features: string[];
  [key: string]: unknown;
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
  status: 'paid' | 'pending' | 'overdue' | 'void' | 'ISSUED' | 'PARTIALLY_PAID' | string;
  issuedDate?: string;
  dueDate?: string;
  paidAt?: string;
  paymentMethod?: string;
  balanceDue?: number;
  [key: string]: unknown;
}

export interface AccountingConnection {
  id: string;
  clientId: string;
  provider: string;
  providerName: string;
  companyName: string;
  status: 'connected' | 'disconnected' | 'error' | string;
  lastSyncedAt?: string;
  syncScope: string[];
  syncHealth: 'healthy' | 'warning' | 'error' | string;
  totalTransactionsSynced?: number;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  clientId?: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole | string;
  recipientId?: string;
  engagementId?: string;
  subject?: string;
  content: string;
  createdAt?: string;
  timestamp: string;
  isInternalOnly?: boolean;
  isInternalNote?: boolean;
  isRead: boolean;
  [key: string]: unknown;
}

export interface JobListing {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  workplace: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  isActive: boolean;
  status: 'open' | 'closed' | 'paused' | string;
  salaryRange?: string;
  postedDate: string;
  closingDate?: string;
  applicantCount?: number;
  [key: string]: unknown;
}

export type JobPosting = JobListing;

export interface JobApplication {
  jobId: string;
  jobTitle?: string;
  fullName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  yearsExperience?: number;
  resumeFileName: string;
  coverLetter?: string;
  [key: string]: unknown;
}

export interface JobApplicationResult {
  success: boolean;
  applicationId?: string;
  applicantId?: string;
  applicant?: Applicant;
  message?: string;
  error?: string;
}

export interface Applicant {
  id: string;
  jobId: string;
  jobTitle: string;
  fullName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  yearsExperience?: number;
  resumeFileName: string;
  coverLetter?: string;
  status: 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | string;
  appliedDate?: string;
  appliedAt?: string;
  notes?: string;
  rating?: number;
  [key: string]: unknown;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole | string;
  action: string;
  resource: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
  severity?: 'info' | 'warning' | 'critical' | string;
  [key: string]: unknown;
}

export interface OnboardingState {
  currentStep?: number;
  completedSteps?: number[];
  status?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LegalCoordinationRecord {
  id: string;
  clientId: string;
  matterType: string;
  counselName?: string;
  status: string;
  notes?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface SecurityTestResult {
  id: string;
  name: string;
  passed?: boolean;
  status?: string;
  message?: string;
  details?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface ServicePlanUpdateResult {
  success: boolean;
  message?: string;
  error?: string;
  plan?: ServicePlan;
}

export interface UserStatusUpdateResult {
  success: boolean;
  message?: string;
  error?: string;
  user?: User;
}

export interface ClientReassignmentResult {
  success: boolean;
  message?: string;
  error?: string;
  client?: {
    id: string;
    accountantId: string;
    reviewerId?: string;
  };
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
  clientCaseExample: string;
  [key: string]: unknown;
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
  | 'payroll_benefits'
  | 'credits_incentives'
  | 'state_local_tax'
  | 'international'
  | 'year_end_planning';

export interface TaxStrategyWorkflowStep {
  id: string;
  step: string;
  requiredRole: string;
}

export interface TaxStrategyRecord {
  id: string;
  strategyName: string;
  category: StrategyCategory;
  plainLanguageSummary: string;
  eligibleTaxpayerType: string;
  taxObjective: string;
  applicableTaxYear: string;
  jurisdiction: string;
  requiredDocuments: string[];
  workflowChecklist: TaxStrategyWorkflowStep[];
  potentialBenefits: string[];
  materialRisksAndLimitations: string[];
  officialAuthority: {
    title: string;
    codeCitation: string;
    url: string;
  };
  status: 'draft' | 'under_review' | 'approved' | 'active' | 'archived';
  assignedProfessional: string;
  clientSuitabilityAssessment: string;
  professionalReviewRequirement: boolean;
  approvalHistory: Array<{
    version: string;
    approvedBy: string;
    approvedDate: string;
    notes: string;
  }>;
  expirationDate: string;
  lastReviewedDate: string;
  version: string;
  [key: string]: unknown;
}

export interface TaxStrategy {
  id: string;
  title: string;
  ircCode: string;
  potentialSavings: string;
  status: 'active' | 'in_progress' | 'recommended' | string;
  description: string;
  [key: string]: unknown;
}

export interface AdvisorRequest {
  id: string;
  advisorName: string;
  taxYear?: number;
  createdAt: string;
  status: 'open' | 'pending' | 'answered' | 'resolved' | string;
  question: string;
  response?: string;
  [key: string]: unknown;
}
