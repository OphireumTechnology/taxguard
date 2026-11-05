export type UserRole =
  | 'client'
  | 'accountant'
  | 'senior_reviewer'
  | 'reviewer'
  | 'bookkeeper'
  | 'practice_manager'
  | 'operations'
  | 'admin'
  | 'super_admin'
  | 'super_administrator'
  | 'recruiter'
  | 'founder'
  | 'staff'
  | string;

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  companyName?: string;
  clientType?: 'individual' | 'business';
  mfaEnabled?: boolean;
  status: 'active' | 'pending' | 'disabled' | string;
  isVerified?: boolean;
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  assignedReviewerId?: string;
  onboardingStatus?: string;
  onboardingStep?: number;
  createdAt?: string;
  lastLoginAt?: string;
  updatedAt?: string;
  tenantId?: string;
  clientId?: string;
  authorizedClientIds?: string[];
  title?: string;
  credentials?: string[];
  [key: string]: any;
}

export type EngagementStatus =
  | 'intake_pending'
  | 'in_preparation'
  | 'under_review'
  | 'client_signature'
  | 'delivered'
  | 'completed'
  | 'archived'
  | string;

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
  status: EngagementStatus;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  reviewerId?: string;
  reviewerName?: string;
  dueDate?: string;
  progressPercent: number;
  internalNotes?: string;
  clientNotes?: string;
  createdAt: string;
  updatedAt?: string;
  tasks?: EngagementTask[];
  [key: string]: any;
}

export type DocumentStatus =
  | 'uploaded'
  | 'accountant_reviewing'
  | 'approved'
  | 'rejected'
  | 'needs_clarification'
  | string;

export interface DocumentExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  reviewed: boolean;
  needsAttention?: boolean;
  [key: string]: any;
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
  version: number;
  description?: string;
  isAiProcessed?: boolean;
  ocrConfidence?: number;
  isEncrypted?: boolean;
  extractedData?: DocumentExtractedField[];
  reviewedBy?: string;
  reviewedAt?: string;
  url?: string;
  [key: string]: any;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  accountantId?: string;
  accountantName?: string;
  dateTime?: string;
  date?: string;
  time?: string;
  type?: string;
  durationMinutes?: number;
  serviceType: string;
  meetingType?: 'virtual' | 'phone' | 'in_person' | string;
  meetingUrl?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'confirmed' | 'pending' | 'no_show' | string;
  notes?: string;
  [key: string]: any;
}

export interface ServicePlan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  billingPeriod: 'one_time' | 'monthly' | 'annually';
  isPopular: boolean;
  description: string;
  idealFor: string;
  features: string[];
}

export interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity?: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName?: string;
  invoiceNumber: string;
  amount: number;
  status: 'paid' | 'open' | 'overdue' | 'cancelled' | 'pending';
  dueDate: string;
  issuedDate: string;
  paidDate?: string;
  items?: InvoiceLineItem[];
  pdfUrl?: string;
  [key: string]: any;
}

export interface AccountingConnection {
  id: string;
  clientId: string;
  provider: 'quickbooks' | 'xero' | string;
  status: 'connected' | 'disconnected' | 'sync_error';
  lastSyncedAt?: string;
  companyName?: string;
  [key: string]: any;
}

export interface Message {
  id: string;
  conversationId?: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  recipientId?: string;
  recipientName?: string;
  content: string;
  timestamp: string;
  read?: boolean;
  isRead?: boolean;
  attachments?: { name: string; url: string; size: string }[];
  [key: string]: any;
}

export interface JobPosting {
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
  status: 'open' | 'closed';
  salaryRange: string;
  postedDate: string;
  closingDate?: string;
  applicantCount?: number;
  [key: string]: any;
}

export type JobListing = JobPosting;

export interface Applicant {
  id: string;
  jobId: string;
  jobTitle: string;
  name?: string;
  fullName?: string;
  email: string;
  phone: string;
  resumeUrl?: string;
  resumeFileName?: string;
  coverLetter?: string;
  status: 'applied' | 'screening' | 'interviewing' | 'interview' | 'offered' | 'rejected' | 'submitted';
  appliedDate?: string;
  appliedAt?: string;
  notes?: string;
  rating?: number;
  [key: string]: any;
}

export interface AuditLog {
  id: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  resource?: string;
  details?: string | Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical' | string;
  [key: string]: any;
}

export interface OnboardingState {
  step: number;
  totalSteps: number;
  completed: boolean;
  data: Record<string, any>;
}

export interface LegalCoordinationRecord {
  id: string;
  clientId: string;
  title: string;
  counselName: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface SecurityTestResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warn' | string;
  message?: string;
  timestamp: string;
}

export interface JobApplication {
  jobId: string;
  name?: string;
  fullName?: string;
  email: string;
  phone: string;
  resume?: any;
  resumeFileName?: string;
  coverLetter?: string;
  linkedinUrl?: string;
  yearsExperience?: string | number;
  [key: string]: any;
}

export interface JobApplicationResult {
  success: boolean;
  message?: string;
  applicationId?: string;
  applicantId?: string;
  error?: string;
}

export interface ServicePlanUpdateResult {
  success: boolean;
  message?: string;
  plan?: any;
  error?: string;
}

export interface UserStatusUpdateResult {
  success: boolean;
  message?: string;
  user?: any;
  error?: string;
}

export interface ClientReassignmentResult {
  success: boolean;
  message?: string;
  client?: any;
  error?: string;
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
  id: string;
  step: string;
  requiredRole: string;
}

export interface TaxStrategyApproval {
  version: string;
  approvedBy: string;
  approvedDate: string;
  notes?: string;
}

export interface TaxStrategyAuthority {
  title: string;
  codeCitation: string;
  url: string;
}

export interface TaxStrategy {
  id: string;
  strategyName?: string;
  title?: string;
  ircCode?: string;
  category?: StrategyCategory | string;
  plainLanguageSummary?: string;
  summary?: string;
  description?: string;
  eligibleTaxpayerType?: string;
  taxObjective?: string;
  applicableTaxYear?: string;
  jurisdiction?: string;
  requiredDocuments?: string[];
  workflowChecklist?: TaxStrategyWorkflowStep[];
  potentialBenefits?: string[];
  potentialSavings?: string;
  keyBenefits?: string[];
  codeSections?: string[];
  materialRisksAndLimitations?: string[];
  officialAuthority?: TaxStrategyAuthority;
  status: 'draft' | 'under_review' | 'approved' | 'active' | 'archived' | 'in_progress' | 'recommended' | string;
  assignedProfessional?: string;
  lastReviewedDate?: string;
  version?: string;
  approvalHistory?: TaxStrategyApproval[];
  savingsPotential?: string;
  actionSteps?: string[];
  eligibleEntities?: string[];
  riskProfile?: 'Conservative' | 'Moderate' | 'Aggressive' | string;
  [key: string]: any;
}

export type TaxStrategyRecord = TaxStrategy;

export interface RequiredDocumentChecklistItem {
  id?: string;
  code?: string;
  name?: string;
  category?: string;
  status?: string;
  isCompleted?: boolean;
  uploadedAt?: string;
  description?: string;
  documentId?: string;
  [key: string]: any;
}

export interface AdvisorRequest {
  id: string;
  requestId?: string;
  title: string;
  description?: string;
  status: 'pending' | 'resolved' | 'open' | 'completed' | string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | string;
  dueDate?: string;
  createdAt?: string;
  category?: string;
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
  clientCaseExample: string;
}
