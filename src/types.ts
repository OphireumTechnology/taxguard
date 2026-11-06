export type UserRole =
  | 'client'
  | 'prospective_client'
  | 'accountant'
  | 'reviewer'
  | 'senior_reviewer'
  | 'bookkeeper'
  | 'practice_manager'
  | 'operations'
  | 'admin'
  | 'super_admin'
  | 'super_administrator'
  | 'recruiter';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole | string;
  phone?: string;
  title?: string;
  credentials?: string[];
  companyName?: string;
  clientType?: 'individual' | 'business';
  clientId?: string;
  tenantId?: string;
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  assignedReviewerId?: string;
  assignedReviewerName?: string;
  mfaEnabled?: boolean;
  status: 'active' | 'disabled' | 'pending' | string;
  isVerified?: boolean;
  onboardingStatus?: string;
  onboardingStep?: number;
  createdAt?: string;
  lastLoginAt?: string;
}

export type DocumentStatus =
  | 'pending'
  | 'needs_review'
  | 'accountant_reviewing'
  | 'approved'
  | 'rejected'
  | 'archived';

export interface ExtractedDataField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  reviewed?: boolean;
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
  uploadedAt: string;
  uploadedBy?: string;
  version?: number;
  description?: string;
  isAiProcessed?: boolean;
  ocrConfidence?: number;
  isEncrypted?: boolean;
  downloadUrl?: string;
  extractedData?: ExtractedDataField[];
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface RequiredDocumentChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  required: boolean;
  status: 'missing' | 'uploaded' | 'verified';
  documentId?: string;
}

export type EngagementStatus =
  | 'intake'
  | 'in_preparation'
  | 'under_review'
  | 'pending_signature'
  | 'ready_to_file'
  | 'filed'
  | 'delivered'
  | 'completed';

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
  clientName: string;
  businessName?: string;
  taxYear: number;
  serviceType: string;
  serviceTitle: string;
  status: EngagementStatus | string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  reviewerId?: string;
  reviewerName?: string;
  dueDate: string;
  progressPercent: number;
  internalNotes?: string;
  clientNotes?: string;
  createdAt: string;
  updatedAt: string;
  tasks?: EngagementTask[];
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  serviceType: string;
  accountantId: string;
  accountantName: string;
  requestedFounder?: boolean;
  date: string;
  timeSlot: string;
  type: 'virtual' | 'in_office' | 'phone';
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  meetingLink?: string;
  location?: string;
  notes?: string;
  createdAt: string;
}

export interface ServicePlan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  billingPeriod: 'one_time' | 'monthly' | 'annually';
  isPopular?: boolean;
  description: string;
  idealFor: string;
  features: string[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  servicePlanId?: string;
  description: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  issuedDate: string;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: string;
}

export interface AccountingConnection {
  id: string;
  clientId: string;
  provider: 'quickbooks_online' | 'xero' | string;
  providerName: string;
  companyName: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncedAt: string;
  syncScope: string[];
  syncHealth: 'healthy' | 'warning' | 'error';
  totalTransactionsSynced: number;
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
}

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  workplace: 'Onsite' | 'Hybrid' | 'Remote';
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  isActive: boolean;
  status: 'open' | 'closed';
  salaryRange: string;
  postedDate: string;
  closingDate?: string;
}

export type JobListing = JobPosting;

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
  status: 'screening' | 'interview' | 'offer' | 'rejected' | 'hired';
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
  ipAddress: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

export interface OnboardingState {
  currentStep: number;
  isComplete: boolean;
  taxYear: number;
  entityType?: string;
  verifiedIdentity?: boolean;
}

export interface LegalCoordinationRecord {
  id: string;
  title: string;
  status: string;
  category: string;
  updatedAt: string;
}

export interface SecurityTestResult {
  id: string;
  passed: boolean;
  title: string;
  details: string;
  timestamp: string;
}

export interface JobApplication {
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  resumeText?: string;
  coverLetter?: string;
}

export interface JobApplicationResult {
  success: boolean;
  applicationId?: string;
  error?: string;
}

export interface ServicePlanUpdateResult {
  success: boolean;
  planId?: string;
  error?: string;
}

export interface UserStatusUpdateResult {
  success: boolean;
  userId?: string;
  error?: string;
}

export interface ClientReassignmentResult {
  success: boolean;
  clientId?: string;
  newAccountantId?: string;
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
  applicableForms: string[];
  recommendedServicePlan: string;
  clientCaseExample: string;
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
  | 'year_end_planning'

export interface TaxStrategyWorkflowStep {
  step: number;
  title: string;
  description: string;
}

export interface TaxStrategyRecord {
  id: string;
  title: string;
  category: StrategyCategory;
  categoryLabel: string;
  shortDescription: string;
  fullOverview: string;
  estimatedSavingsRange: string;
  applicabilityCriteria: string[];
  keyBenefits: string[];
  implementationSteps: TaxStrategyWorkflowStep[];
  irsCodeReferences: string[];
  caseStudyExample: string;
}

export type TaxStrategy = TaxStrategyRecord;

export interface AdvisorRequest {
  id: string;
  subject: string;
  category: string;
  status: 'pending' | 'in_progress' | 'resolved';
  createdAt: string;
  details?: string;
}
