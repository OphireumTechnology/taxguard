export type UserRole = 
  | 'prospective_client'
  | 'client'
  | 'consultant'
  | 'accountant'
  | 'reviewer'
  | 'senior_reviewer'
  | 'managing_consultant'
  | 'founder'
  | 'administrator'
  | 'super_administrator'
  | 'legal_specialist'
  | 'firm_manager'
  | 'recruiter'
  | 'admin'
  | 'super_admin';

export * from './onboarding';
export * from './calendar';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  mfaEnabled?: boolean;
  companyName?: string;
  company?: string;
  taxFilingType?: string;
  title?: string;
  credentials?: string[];
  clientType?: 'individual' | 'business';
  status: 'active' | 'suspended' | 'disabled' | 'pending';
  isVerified: boolean;
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  assignedReviewerId?: string;
  assignedReviewerName?: string;
  onboardingStatus?: 'not_started' | 'in_progress' | 'submitted' | 'approved';
  onboardingStep?: number;
  mustResetPassword?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export type EngagementStatus = 
  | 'new'
  | 'intake'
  | 'awaiting_client'
  | 'ready_for_assignment'
  | 'assigned'
  | 'in_preparation'
  | 'in_progress'
  | 'client_action_required'
  | 'review_needed'
  | 'under_review'
  | 'ready_for_signature'
  | 'approved'
  | 'ready_for_delivery'
  | 'delivered'
  | 'filed'
  | 'completed'
  | 'closed'
  | 'archived';

export type ServiceType = 
  | 'individual_tax_1040'
  | 'business_tax_scorp_llc'
  | 'bookkeeping_monthly'
  | 'tax_planning_strategy'
  | 'estate_planning_coordination'
  | 'credit_financial_solutions'
  | 'irs_transcript_review'
  | 'prior_year_amended';

export interface Engagement {
  id: string;
  clientId: string;
  clientName: string;
  businessName?: string;
  taxYear: number;
  serviceType: ServiceType;
  serviceTitle: string;
  servicePlanId?: string;
  servicePlanName?: string;
  title?: string;
  status: EngagementStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedAccountantId: string;
  assignedAccountantName: string;
  reviewerId?: string;
  reviewerName?: string;
  dueDate: string;
  estimatedCompletion?: string;
  progressPercent: number;
  progressPercentage?: number;
  internalNotes?: string;
  clientNotes?: string;
  tasks: EngagementTask[];
  createdAt: string;
  updatedAt: string;
}

export interface EngagementTask {
  id: string;
  title: string;
  completed: boolean;
  requiredRole: 'client' | 'accountant' | 'reviewer';
  dueDate?: string;
}

export type DocumentStatus = 
  | 'requested'
  | 'uploaded'
  | 'scanning'
  | 'processing'
  | 'needs_review'
  | 'pending_review'
  | 'missing_information'
  | 'client_action_required'
  | 'accountant_reviewing'
  | 'approved'
  | 'verified'
  | 'needs_correction'
  | 'delivered'
  | 'archived'
  | 'rejected';

export type DocumentCategory = 
  | 'tax_form_w2'
  | 'tax_form_1099'
  | 'tax_form_1098'
  | 'bank_statement'
  | 'profit_and_loss'
  | 'balance_sheet'
  | 'receipt_expense'
  | 'prior_year_return'
  | 'identification'
  | 'legal_document'
  | 'deliverable_tax_return'
  | 'other';

export interface ExtractedField {
  key: string;
  label: string;
  value: string | number;
  confidence: number; // 0 to 100
  needsAttention?: boolean;
  reviewed?: boolean;
}

export interface DocumentItem {
  id: string;
  clientId: string;
  clientName: string;
  fileName: string;
  name?: string;
  fileSize: string;
  fileType: string;
  category: DocumentCategory;
  taxYear: number;
  status: DocumentStatus;
  uploadedAt: string;
  uploadedBy: string;
  version: number;
  description?: string;
  isAiProcessed?: boolean;
  ocrConfidence?: number;
  extractedData?: ExtractedField[];
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  downloadUrl?: string;
  url?: string;
  notes?: string;
  isEncrypted: boolean;
}

export interface Appointment {
  id: string;
  clientId?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceType: string;
  accountantId: string;
  accountantName: string;
  requestedFounder: boolean; // Desmond Hinds specifically
  date: string;
  timeSlot: string;
  type: 'virtual' | 'phone' | 'in_office';
  status: 'confirmed' | 'pending' | 'rescheduled' | 'cancelled' | 'completed' | 'no_show' | 'canceled_by_client' | 'canceled_by_staff';
  meetingLink?: string;
  location?: string;
  notes?: string;
  cancellationReason?: string;
  rescheduleReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ServicePlan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  billingPeriod: 'one_time' | 'monthly' | 'annual';
  isPopular?: boolean;
  features: string[];
  description: string;
  idealFor: string;
  updatedAt?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  servicePlanId?: string;
  description: string;
  serviceDescription?: string;
  amount: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'CAD';
  status: 'paid' | 'pending' | 'overdue' | 'draft' | 'refunded' | 'unpaid';
  issuedDate: string;
  issueDate?: string;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: string;
}

export interface AccountingConnection {
  id: string;
  clientId: string;
  provider: 'quickbooks_online' | 'xero' | 'freshbooks' | 'csv_manual' | string;
  providerName?: string;
  status: 'connected' | 'disconnected' | 'syncing' | 'error' | 'pending_auth';
  companyName: string;
  realmId?: string;
  readOnlyDefault?: boolean;
  lastSyncedAt?: string;
  lastSyncAt?: string;
  syncScope?: string[];
  syncHealth?: 'healthy' | 'warning' | 'error';
  totalTransactionsSynced?: number;
  accountCount?: number;
  errorCount?: number;
  syncErrors?: string[];
  writeAuthorization?: {
    clientAuthorized: boolean;
    accountantPrepared: boolean;
    reviewerApproved: boolean;
    explicitlyConfirmed: boolean;
  };
}

export interface Message {
  id: string;
  clientId?: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId?: string;
  recipientName?: string;
  engagementId?: string;
  content: string;
  timestamp?: string;
  createdAt?: string;
  isInternalOnly?: boolean; // hidden from client
  isInternalNote?: boolean;
  hasAttachments?: boolean;
  attachments?: string[];
  attachmentName?: string;
  isRead?: boolean;
}

export interface JobListing {
  id: string;
  title: string;
  department: 'Tax' | 'Accounting' | 'Advisory' | 'Operations' | string;
  location: string;
  type: 'Full-Time' | 'Part-Time' | 'Contract';
  workplace: 'Remote' | 'Hybrid' | 'Onsite';
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  isActive: boolean;
  status: 'open' | 'closed' | 'draft';
  applicantCount?: number;
  salaryRange?: string;
  postedDate: string;
  closingDate?: string;
}

export interface Applicant {
  id: string;
  jobId: string;
  jobTitle: string;
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl?: string;
  yearsExperience?: number;
  resumeFileName: string;
  coverLetter?: string;
  status: 'new' | 'screening' | 'interview' | 'assessment' | 'offer' | 'hired' | 'rejected' | 'submitted';
  appliedDate?: string;
  appliedAt?: string;
  notes?: string;
  internalNotes?: string;
  interviewDate?: string;
  rating?: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  actor?: string;
  userRole: UserRole | string;
  action: string;
  resource?: string;
  entityType?: string;
  entityId?: string;
  details: string;
  ipAddress: string;
  timestamp: string;
  severity?: 'info' | 'warning' | 'critical';
}

// Canonical Type Declarations
export type JobPosting = JobListing;
export type AppUser = User;
export type ClientAssignment = ClientAccountantBinding;
export type TaxEngagement = Engagement;
export type TaxDocument = DocumentItem;

export interface JobApplication {
  jobId: string;
  jobTitle: string;
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl?: string;
  yearsExperience?: number;
  resumeFileName: string;
  coverLetter?: string;
}

export interface JobApplicationResult {
  success: boolean;
  applicantId?: string;
  message: string;
  error?: string;
}

export interface ServicePlanUpdatePayload {
  planId: string;
  price: number;
  currency?: 'USD';
  effectiveDate?: string;
  changeReason: string;
}

export interface ServicePlanUpdateResult {
  success: boolean;
  message: string;
  plan?: ServicePlan;
  error?: string;
}

export interface UserStatusUpdatePayload {
  userId: string;
  status: 'active' | 'suspended' | 'disabled';
  reason: string;
  confirmation: boolean;
}

export interface UserStatusUpdateResult {
  success: boolean;
  message: string;
  user?: User;
  error?: string;
}

export interface ClientReassignmentPayload {
  clientId: string;
  assignedAccountantId: string;
  assignedReviewerId?: string;
  reason: string;
}

export interface ClientReassignmentResult {
  success: boolean;
  message: string;
  client?: User;
  error?: string;
}

export interface AsyncOperationState {
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
}

export interface OnboardingState {
  id: string;
  userId: string;
  step: number; // 1 to 15
  percentComplete: number;
  entityType: 'individual' | 'business';
  contactInfo: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
  businessInfo?: {
    entityName: string;
    ein: string;
    entityStructure: 'llc' | 'scorp' | 'ccorp' | 'partnership' | 'sole_prop';
    incorporationState: string;
    fiscalYearEnd: string;
  };
  selectedServices: ServiceType[];
  intakeAnswers: Record<string, any>;
  uploadedDocuments: string[]; // Document IDs
  selectedPlanId?: string;
  paymentMethodAuthorized: boolean;
  engagementAgreementSigned: boolean;
  signedAgreementDate?: string;
  privacyDisclaimerAccepted: boolean;
  accountingSoftwareConnected: boolean;
  consultationBooked: boolean;
  appointmentId?: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'action_required';
  adminReviewNotes?: string;
  missingRequirements: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryDraft {
  id: string;
  engagementId: string;
  clientId: string;
  date: string;
  reference: string;
  memo: string;
  lines: Array<{
    id: string;
    accountNumber: string;
    accountName: string;
    debit: number;
    credit: number;
    description: string;
  }>;
  status: 'draft' | 'prepared' | 'reviewed' | 'approved' | 'posted' | 'rejected';
  preparedBy: string;
  preparedByName: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewNotes?: string;
  supportingDocId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalCoordinationRecord {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  category: 'estate_trust' | 'operating_agreement' | 'probate_document' | 'court_pleading' | 'power_of_attorney';
  assignedExternalAttorney?: string;
  attorneyLawFirm?: string;
  attorneyBarNumber?: string;
  filingDeadline?: string;
  publicRecordReference?: string;
  status: 'intake' | 'reviewing' | 'transmitted_to_counsel' | 'counsel_review' | 'completed';
  notes: string;
  disclaimerAcknowledged: boolean;
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SecurityTestResult {
  testId: string;
  name: string;
  category: 'client_isolation' | 'rbac_enforcement' | 'maker_checker' | 'url_expiration' | 'payment_idempotency' | 'session_revocation' | 'isolation' | 'rbac' | 'auth' | 'upload_security' | 'scheduling' | 'accountant_binding' | 'token_protection' | 'internal_notes_privacy';
  passed?: boolean;
  status?: 'passed' | 'failed';
  expectedOutcome?: string;
  actualOutcome?: string;
  httpStatus?: number | string;
  details: string;
  timestamp?: string;
  testedAt?: string;
}

// -------------------------------------------------------------
// ACCOUNTANT-CLIENT BINDING & WORKSPACE ARCHITECTURE
// -------------------------------------------------------------

export type AssignmentStatus = 
  | 'pending'
  | 'active'
  | 'suspended'
  | 'unbound'
  | 'reassigned'
  | 'expired';

export type AssignmentType = 
  | 'primary'
  | 'supporting'
  | 'reviewer';

export type PermissionScope = 
  | 'view_profile'
  | 'view_documents'
  | 'upload_files'
  | 'download_files'
  | 'request_documents'
  | 'view_accounting_records'
  | 'import_accounting_records'
  | 'perform_reconciliations'
  | 'prepare_tax_work'
  | 'submit_work_for_review'
  | 'view_messages'
  | 'send_messages'
  | 'manage_appointments'
  | 'view_billing_status'
  | 'view_internal_notes'
  | 'add_internal_notes'
  | 'export_records';

export const ALL_PERMISSION_SCOPES: PermissionScope[] = [
  'view_profile',
  'view_documents',
  'upload_files',
  'download_files',
  'request_documents',
  'view_accounting_records',
  'import_accounting_records',
  'perform_reconciliations',
  'prepare_tax_work',
  'submit_work_for_review',
  'view_messages',
  'send_messages',
  'manage_appointments',
  'view_billing_status',
  'view_internal_notes',
  'add_internal_notes',
  'export_records'
];

export interface ClientAccountantBinding {
  id: string;
  clientId: string;
  clientName: string;
  clientCompanyName?: string;
  accountantId: string;
  accountantName: string;
  accountantTitle?: string;
  assignmentType: AssignmentType;
  status: AssignmentStatus;
  accessScope: PermissionScope[];
  assignedBy: string;
  assignedByName: string;
  assignedAt: string;
  effectiveDate: string;
  expirationDate?: string;
  unboundBy?: string;
  unboundByName?: string;
  unboundAt?: string;
  reason?: string;
  internalNotes?: string;
  lastAccessAt?: string;
}

export interface AccountantProfile {
  id: string;
  userId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  credentials: string[];
  specializations: string[];
  avatarUrl?: string;
  status: 'active' | 'on_leave' | 'inactive';
  maxClients: number;
  maxCapacity?: number;
  currentActiveClients: number;
  activeClientCount?: number;
  availability: 'available' | 'near_capacity' | 'at_capacity';
  internalNotes?: string;
}

export type AccountingWorkflowModule = 
  | 'bookkeeping'
  | 'bank_reconciliation'
  | 'accounts_payable'
  | 'accounts_receivable'
  | 'payroll_review'
  | 'expense_categorization'
  | 'financial_statement_prep'
  | 'tax_doc_prep'
  | 'filing_review'
  | 'compliance_tasks'
  | 'year_end_closing'
  | 'audit_support'
  | 'client_requested';

export interface AccountingWorkflowTask {
  id: string;
  clientId: string;
  clientName: string;
  engagementId?: string;
  module?: AccountingWorkflowModule;
  category?: string;
  title: string;
  description: string;
  assignedAccountantId: string;
  assignedAccountantName: string;
  reviewerId?: string;
  reviewerName?: string;
  priority: 'low' | 'normal' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'not_started' | 'in_progress' | 'needs_client_input' | 'review_needed' | 'ready_for_review' | 'under_review' | 'approved' | 'rejected' | 'completed';
  dueDate: string;
  estimatedHours?: number;
  checklist?: Array<{ id: string; title: string; completed: boolean }>;
  attachments?: Array<{ id: string; fileName: string; fileSize?: string; uploadedAt: string; url?: string }>;
  comments?: Array<{ id: string; authorId: string; authorName: string; authorRole: string; content: string; createdAt: string; isInternal: boolean }>;
  approvalHistory?: Array<{ reviewerId: string; reviewerName: string; action: 'approved' | 'rejected' | 'requested_changes'; timestamp: string; notes: string }>;
  preparedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRequest {
  id: string;
  clientId: string;
  clientName: string;
  accountantId: string;
  accountantName: string;
  title: string;
  description: string;
  category: string;
  taxYear: number;
  dueDate: string;
  status: 'pending' | 'fulfilled' | 'waived' | 'overdue';
  requestedAt: string;
  fulfilledAt?: string;
  fulfilledDocumentId?: string;
  notes?: string;
}

export interface ReassignmentRequest {
  id: string;
  clientId: string;
  clientName: string;
  currentAccountantId: string;
  currentAccountantName: string;
  reason: string;
  preferredSpecialization?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  createdAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface DetailedAccountingIntegration {
  id: string;
  clientId: string;
  clientName: string;
  provider: 'quickbooks_online' | 'xero' | 'freshbooks' | 'custom_csv';
  organizationName: string;
  companyName?: string;
  maskedOrgId: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing' | 'needs_reauth';
  authorizedScopes: string[];
  connectedBy: string;
  connectedAt: string;
  lastSuccessfulSync?: string;
  lastSyncAt?: string;
  nextScheduledSync?: string;
  accountCount?: number;
  writeAuthorization?: {
    clientAuthorized: boolean;
    accountantPrepared: boolean;
    reviewerApproved: boolean;
    explicitlyConfirmed: boolean;
    committedAt?: string;
    locked: boolean;
  };
  mostRecentError?: string;
  syncLogs: Array<{ id: string; timestamp: string; status: 'success' | 'failed'; recordsSynced: number; message: string }>;
}

export interface BookkeepingTransaction {
  id: string;
  clientId: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  suggestedAccountCode: string;
  suggestedAccountName: string;
  category: string;
  confidence: number; // 0-100
  status: 'auto_categorized' | 'confirmed' | 'modified' | 'needs_review';
  vendorOrPayee?: string;
  matchedRule?: string;
  source: 'bank_feed' | 'document_extraction' | 'manual';
  sourceDocumentId?: string;
  reviewerNotes?: string;
}

export interface BankReconciliation {
  id: string;
  clientId: string;
  accountName: string;
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  statementEndingBalance: number;
  clearedBookBalance: number;
  variance: number;
  matchedCount: number;
  unmatchedCount: number;
  status: 'in_progress' | 'balanced' | 'discrepancy' | 'signed_off' | 'period_locked';
  preparedBy?: string;
  preparedByName?: string;
  signedOffBy?: string;
  signedOffByName?: string;
  signedOffAt?: string;
  isPeriodLocked: boolean;
  notes?: string;
}

export interface ChartOfAccountItem {
  code: string;
  name: string;
  category: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Operating Expense' | 'Other Income/Expense';
  subCategory?: string;
  description?: string;
  taxMapping?: string;
}

// -------------------------------------------------------------
// REQUIRED DOCUMENT CHECKLIST & CLIENT DELIVERABLES
// -------------------------------------------------------------

export type DocumentRequirementStatus =
  | 'not_requested'
  | 'requested'
  | 'missing'
  | 'uploaded'
  | 'processing'
  | 'needs_clarification'
  | 'needs_correction'
  | 'verified'
  | 'accepted'
  | 'waived'
  | 'completed';

export interface RequiredDocumentChecklistItem {
  id: string;
  clientId: string;
  engagementId?: string;
  title: string;
  category: string;
  taxYear: number;
  status: DocumentRequirementStatus;
  responsibleParty: string;
  dueDate: string;
  submissionInstructions: string;
  uploadedDocumentId?: string;
  accountantNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type DeliverableStatus =
  | 'draft'
  | 'under_review'
  | 'approved'
  | 'delivered'
  | 'client_acknowledged'
  | 'client_approved'
  | 'client_rejected'
  | 'clarification_requested';

export interface DeliverableItem {
  id: string;
  clientId: string;
  clientName: string;
  engagementId?: string;
  title: string;
  type: 'financial_report' | 'bookkeeping_report' | 'reconciliation_summary' | 'advisory_report' | 'tax_organizer' | 'filing_package';
  taxYear: number;
  period?: string;
  status: DeliverableStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  preparedBy?: string;
  preparedByName?: string;
  clientFeedback?: string;
  signatureRequired?: boolean;
  isClientSigned?: boolean;
  clientSignedAt?: string;
  fileUrl?: string;
  fileName: string;
  fileSize?: string;
  version: string;
  versionHistory?: Array<{ version: string; date: string; author: string; summary: string }>;
  createdAt: string;
  updatedAt: string;
}

export type FirmTemplateCategory =
  | 'engagement_letter'
  | 'intake_form'
  | 'chart_of_accounts'
  | 'reconciliation_template'
  | 'journal_template'
  | 'closing_checklist'
  | 'tax_organizer'
  | 'advisory_report'
  | 'client_letter'
  | 'review_checklist'
  | 'financial_report_template'
  | 'industry_procedure';

export interface FirmTemplate {
  id: string;
  title: string;
  category: FirmTemplateCategory;
  owner: string;
  version: string;
  status: 'draft' | 'approved' | 'superseded' | 'archived';
  effectiveDate: string;
  jurisdiction: string;
  applicableEntityTypes: string[];
  applicableEngagementTypes: string[];
  approvedBy?: string;
  approvedDate?: string;
  reviewDate?: string;
  changeHistory: Array<{ version: string; changedBy: string; date: string; notes: string }>;
  ragKnowledgeBaseApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReviewQueueItemType =
  | 'journal_entry'
  | 'tax_position'
  | 'reconciliation'
  | 'advisory_report'
  | 'deliverable'
  | 'high_risk_transaction'
  | 'low_confidence_ai'
  | 'quickbooks_posting';

export interface ReviewQueueItem {
  id: string;
  type: ReviewQueueItemType;
  referenceId: string;
  clientId: string;
  clientName: string;
  engagementId?: string;
  title: string;
  preparedBy: string;
  preparedByName: string;
  preparedAt: string;
  status: 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'returned_for_correction' | 'escalated';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  materialityScore?: number;
  riskFlags: string[];
  aiConfidenceScore?: number;
  reviewNotes?: string;
  approvalConditions?: string;
  authorizedQuickBooksPosting?: boolean;
  authorizedClientRelease?: boolean;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
}

export type ProcessingJobStatus =
  | 'RECEIVED'
  | 'SECURITY_SCREENING'
  | 'EXTRACTION_PENDING'
  | 'EXTRACTED'
  | 'CLASSIFICATION_PENDING'
  | 'CLASSIFIED'
  | 'NEEDS_INFORMATION'
  | 'AI_PROCESSING'
  | 'AI_DRAFTED'
  | 'PREPARER_REVIEW'
  | 'REVIEWER_REVIEW'
  | 'CPA_APPROVED'
  | 'CLIENT_APPROVAL'
  | 'POSTING_PENDING'
  | 'POSTED'
  | 'DELIVERED'
  | 'ARCHIVED'
  | 'REJECTED'
  | 'PROCESSING_FAILED';

export interface ProcessingJob {
  id: string;
  documentId: string;
  fileName: string;
  clientId: string;
  clientName: string;
  status: ProcessingJobStatus;
  checksum: string;
  fileSize: number;
  mimeType: string;
  malwareScanStatus: 'clean' | 'scanning' | 'quarantined' | 'failed';
  ocrEngine: 'Google Document AI' | 'Native Parser';
  aiModel: 'gemini-flash-latest' | 'gpt-4o';
  extractedFieldsCount: number;
  confidenceAverage: number;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
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
  requiredRole: 'client' | 'accountant' | 'reviewer' | 'administrator';
  completed?: boolean;
}

export interface TaxStrategyOfficialAuthority {
  title: string;
  codeCitation: string;
  url: string;
}

export interface TaxStrategyApprovalEvent {
  version: string;
  approvedBy: string;
  approvedDate: string;
  notes?: string;
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
  officialAuthority: TaxStrategyOfficialAuthority;
  status: 'draft' | 'under_review' | 'approved' | 'active' | 'archived';
  assignedProfessional: string;
  clientSuitabilityAssessment: string;
  professionalReviewRequirement: boolean;
  approvalHistory: TaxStrategyApprovalEvent[];
  expirationDate: string;
  lastReviewedDate: string;
  version: string;
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

export interface AdvisorRequest {
  id: string;
  clientId: string;
  advisorName: string;
  question: string;
  status: 'pending' | 'answered' | 'resolved';
  createdAt: string;
  taxYear?: number;
  response?: string;
}

export interface TaxStrategy {
  id: string;
  title: string;
  ircCode: string;
  potentialSavings: string;
  status: 'active' | 'in_progress' | 'recommended';
  description: string;
}

export * from './intake';

