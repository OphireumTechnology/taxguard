/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole =
  | 'client'
  | 'accountant'
  | 'reviewer'
  | 'senior_reviewer'
  | 'bookkeeper'
  | 'practice_manager'
  | 'operations'
  | 'admin'
  | 'super_admin'
  | 'super_administrator'
  | 'recruiter'
  | 'guest'
  | (string & {});

export type DocumentStatus =
  | 'PENDING'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'REPLACEMENT_REQUESTED'
  | 'SCAN_PENDING'
  | 'REJECTED_MALWARE'
  | (string & {});

export type EngagementStatus =
  | 'in_preparation'
  | 'ready_for_review'
  | 'in_review'
  | 'client_approval'
  | 'ready_to_file'
  | 'filed'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'CLOSED'
  | (string & {});

export interface User {
  id: string;
  uid?: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  companyName?: string;
  title?: string;
  credentials?: string[];
  clientType?: 'individual' | 'business';
  mfaEnabled?: boolean;
  status: 'active' | 'suspended' | 'pending' | 'deactivated' | string;
  isVerified?: boolean;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  onboardingStatus?: string;
  onboardingStep?: number;
  tenantId?: string;
  clientId?: string;
  authorizedClientIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface Engagement {
  id: string;
  tenantId?: string;
  clientId: string;
  clientName?: string;
  engagementId?: string;
  authorityClientId?: string;
  taxYear: number;
  status: EngagementStatus;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  dueDate?: string;
  serviceTitle?: string;
  serviceType?: string;
  businessName?: string;
  title?: string;
  returnType?: string;
  activeStage?: number;
  documents?: DocumentItem[];
  currentStage?: number;
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  assignedReviewerId?: string;
  reviewerId?: string;
  reviewerName?: string;
}

export interface DocumentItem {
  id: string;
  clientId: string;
  clientName?: string;
  title: string;
  category: string;
  taxYear: number;
  fileName?: string;
  fileSize?: number | string;
  fileType?: string;
  uploadedAt: string;
  uploadedBy?: string;
  version?: number;
  ocrConfidence?: number;
  isEncrypted?: boolean;
  status: DocumentStatus;
  url?: string;
  notes?: string;
  description?: string;
  isAiProcessed?: boolean;
  rejectionReason?: string;
  verified?: boolean;
}

export interface RequiredDocumentChecklistItem {
  id: string;
  name: string;
  category: string;
  description: string;
  isRequired: boolean;
  isReceived: boolean;
  documentId?: string;
  taxYear: number;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  advisorId?: string;
  advisorName?: string;
  accountantId?: string;
  type: string;
  title: string;
  serviceType?: string;
  startTime: string;
  endTime: string;
  date?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'confirmed' | string;
  location?: string;
  meetingLink?: string;
  notes?: string;
}

export interface ServicePlan {
  id: string;
  name: string;
  slug?: string;
  tier?: 'essential' | 'advisory' | 'enterprise' | string;
  price: number;
  billingFrequency?: 'one-time' | 'monthly' | 'annual' | string;
  billingPeriod?: string;
  tagline: string;
  description: string;
  idealFor?: string;
  popular?: boolean;
  isPopular?: boolean;
  features: string[];
  recommendedFor?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName?: string;
  engagementId?: string;
  servicePlanId?: string;
  description?: string;
  paymentMethod?: string;
  amount: number;
  amountPaid?: number;
  balanceDue?: number;
  currency: string;
  issuedDate: string;
  dueDate: string;
  paidDate?: string;
  paidAt?: string;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'void' | 'refunded' | 'pending' | string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

export interface AccountingConnection {
  id: string;
  clientId?: string;
  companyName?: string;
  provider: 'quickbooks' | 'xero' | 'stripe' | 'plaid' | string;
  providerName?: string;
  accountName: string;
  status: 'connected' | 'disconnected' | 'sync_error' | 'pending';
  syncScope?: string | string[];
  syncHealth?: string;
  lastSyncedAt?: string;
  error?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  recipientId?: string;
  recipientName?: string;
  engagementId?: string;
  subject?: string;
  content: string;
  sentAt?: string;
  timestamp?: string;
  isRead: boolean;
  isInternalOnly?: boolean;
  attachments?: string[];
}

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  workplace?: string;
  status?: string;
  type: 'Full-time' | 'Part-time' | 'Contract' | string;
  experienceLevel?: string;
  summary?: string;
  description?: string;
  responsibilities: string[];
  requirements?: string[];
  qualifications?: string[];
  benefits: string[];
  salaryRange?: string;
  isActive: boolean;
  postedAt?: string;
  postedDate?: string;
  closingDate?: string;
}

export type JobListing = JobPosting;

export interface Applicant {
  id: string;
  jobId: string;
  jobTitle?: string;
  name: string;
  fullName?: string;
  email: string;
  phone: string;
  linkedinUrl?: string;
  resumeFileName?: string;
  resumeUrl?: string;
  coverLetter?: string;
  notes?: string;
  status: 'applied' | 'screening' | 'interviewing' | 'interview' | 'offered' | 'rejected' | string;
  appliedAt: string;
  appliedDate?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  severity?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown> | string;
  status?: 'success' | 'failure' | 'warning' | string;
}

export interface OnboardingState {
  step: number;
  isCompleted: boolean;
  data: Record<string, any>;
}

export interface LegalCoordinationRecord {
  id: string;
  clientId: string;
  matterType: string;
  status: string;
  createdAt: string;
}

export interface SecurityTestResult {
  id: string;
  testName: string;
  status: 'passed' | 'failed' | 'warning';
  timestamp: string;
  details?: string;
}

export interface JobApplication {
  jobId: string;
  jobTitle?: string;
  name: string;
  email: string;
  phone: string;
  resumeFileName?: string;
  coverLetter?: string;
}

export interface JobApplicationResult {
  success: boolean;
  applicationId?: string;
  message?: string;
  error?: string;
}

export interface ServicePlanUpdateResult {
  success: boolean;
  planId?: string;
  error?: string;
}

export interface UserStatusUpdateResult {
  success: boolean;
  userId: string;
  status: string;
  message?: string;
  error?: string;
}

export interface ClientReassignmentResult {
  success: boolean;
  clientId: string;
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
  applicableForms: string[];
  recommendedServicePlan: string;
  clientCaseExample: string;
}

export type StrategyCategory = string;

export interface TaxStrategyRecord {
  id: string;
  category: StrategyCategory;
  title: string;
  strategyName?: string;
  code: string;
  benefitEstimate: string;
  complexity: 'Standard' | 'Intermediate' | 'Advanced' | 'Bespoke';
  summary: string;
  plainLanguageSummary?: string;
  eligibleTaxpayerType?: string;
  statutoryAuthority: string;
  applicability: string[];
  implementationSteps: string[];
  riskAssessment: string;
  taxObjective?: string;
  applicableTaxYear?: number | string;
}

export type TaxStrategy = TaxStrategyRecord;

export interface AdvisorRequest {
  id: string;
  clientId: string;
  title: string;
  description: string;
  status: 'pending' | 'in_review' | 'resolved';
  createdAt: string;
}
