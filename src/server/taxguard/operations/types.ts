/**
 * TaxGuard Production Practice Operations Domain Types
 * Defines interfaces, lifecycle enums, and deterministic structures for:
 * - Durable Jobs & Dead-Letter
 * - Durable Idempotency
 * - Practice Tasks & Dependencies
 * - Staff Assignments & Workload
 * - Deadlines & Escalation
 * - Client Communications (Client Visible vs Internal)
 * - Request Center
 * - Notifications (Channels, truthful NOT_CONFIGURED)
 * - Service Catalog & Scope
 * - Billing & Invoices (Deterministic currency arithmetic)
 * - Data Retention & Archive Integrity
 */

// ==============================================================================
// 1. DURABLE JOBS
// ==============================================================================

export type JobStatus = 
  | 'PENDING'
  | 'CLAIMED'
  | 'RUNNING'
  | 'RETRY_SCHEDULED'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'CANCELLED';

export type JobType =
  | 'DOCUMENT_PROCESSING'
  | 'OCR_REQUEST'
  | 'AI_PROPOSAL'
  | 'NOTIFICATION_DISPATCH'
  | 'PROVIDER_SYNCHRONIZATION'
  | 'ACCOUNTING_IMPORT'
  | 'REPORT_GENERATION'
  | 'ARCHIVE_GENERATION'
  | 'SCHEDULED_COMPLIANCE_CHECK'
  | 'RENEWAL_GENERATION'
  | 'RETRYABLE_PROVIDER_OPERATION';

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: string;
  errorCode: string;
  errorMessage: string;
  nextAvailableAt?: string;
}

export interface DurableJob<T = Record<string, unknown>> {
  id: string;
  tenantId: string;
  clientId?: string;
  caseId?: string;
  jobType: JobType;
  payload: T;
  status: JobStatus;
  priority: number; // 1 to 10 (1 is highest)
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  lockedAt?: string;
  lockedBy?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  retryHistory: RetryAttempt[];
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

// ==============================================================================
// 2. DURABLE IDEMPOTENCY
// ==============================================================================

export type MutationIdempotencyStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface MutationIdempotencyRecord {
  id: string;
  tenantId: string;
  operation: string;
  provider: string;
  idempotencyKey: string;
  requestFingerprint: string;
  status: MutationIdempotencyStatus;
  resultReference?: Record<string, unknown>;
  auditEventId?: string;
  errorCode?: string;
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
}

// ==============================================================================
// 3. PRACTICE TASKS & DEPENDENCIES
// ==============================================================================

export type TaskStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_ON_CLIENT'
  | 'WAITING_ON_PROVIDER'
  | 'READY_FOR_REVIEW'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface PracticeTask {
  id: string;
  tenantId: string;
  clientId?: string;
  engagementId?: string;
  taxYear?: number;
  caseId?: string;
  stage?: number;
  taskType: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedUserId?: string;
  assignedRole?: string;
  createdBy: string;
  dueDate?: string;
  completedAt?: string;
  completedBy?: string;
  dependencies: string[]; // List of task IDs that MUST be COMPLETED first
  relatedResource?: {
    type: 'document' | 'transaction' | 'request' | 'invoice' | 'notice' | 'review';
    id: string;
  };
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ==============================================================================
// 4. STAFF ASSIGNMENTS & WORKLOAD
// ==============================================================================

export type StaffRole = 
  | 'preparer'
  | 'accountant'
  | 'reviewer'
  | 'cpa_ea'
  | 'admin'
  | 'case_owner';

export interface StaffAssignment {
  id: string;
  tenantId: string;
  clientId: string;
  engagementId?: string;
  taxYear?: number;
  role: StaffRole;
  userId: string;
  assignedBy: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'ACTIVE' | 'REASSIGNED' | 'REVOKED';
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentHistoryRecord {
  id: string;
  tenantId: string;
  clientId: string;
  role: StaffRole;
  previousUserId?: string;
  newUserId: string;
  changedBy: string;
  reassignmentReason: string;
  timestamp: string;
}

export interface StaffWorkloadSummary {
  userId: string;
  role: string;
  assignedClientsCount: number;
  activeEngagementsCount: number;
  openTasksCount: number;
  overdueTasksCount: number;
  pendingReviewsCount: number;
  waitingOnClientCount: number;
  waitingOnProviderCount: number;
}

// ==============================================================================
// 5. DEADLINES & ESCALATION
// ==============================================================================

export type DeadlineCategory =
  | 'client_request'
  | 'internal_prep'
  | 'review'
  | 'signature'
  | 'filing'
  | 'estimated_payment'
  | 'extension'
  | 'notice_response'
  | 'bookkeeping_close'
  | 'renewal';

export type DeadlineAuthority =
  | 'STATUTORY'
  | 'PROVIDER'
  | 'CLIENT_COMMITMENT'
  | 'INTERNAL'
  | 'ESTIMATED'
  | 'MANUAL';

export type DeadlineStatus = 'PENDING' | 'MET' | 'OVERDUE' | 'WAIVED';

export interface PracticeDeadline {
  id: string;
  tenantId: string;
  clientId?: string;
  caseId?: string;
  taxYear?: number;
  category: DeadlineCategory;
  title: string;
  dueDate: string; // ISO 8601 UTC timestamp or date
  authorityType: DeadlineAuthority;
  status: DeadlineStatus;
  escalationLevel: number; // 0=none, 1=approaching, 2=due_soon, 3=overdue, 4=critical
  lastEscalatedAt?: string;
  provenance: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ==============================================================================
// 6. CLIENT COMMUNICATIONS
// ==============================================================================

export type MessageVisibility = 'CLIENT_VISIBLE' | 'INTERNAL_ONLY';

export interface CommunicationThread {
  id: string;
  tenantId: string;
  clientId: string;
  engagementId?: string;
  caseId?: string;
  subject: string;
  category: 'GENERAL' | 'TAX_QUESTION' | 'DOCUMENT_QUERY' | 'INVOICING' | 'ADVISORY';
  status: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED';
  createdBy: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationMessage {
  id: string;
  threadId: string;
  tenantId: string;
  clientId: string;
  senderId: string;
  senderRole: string;
  visibility: MessageVisibility;
  content: string;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// ==============================================================================
// 7. CLIENT REQUEST CENTER
// ==============================================================================

export type RequestType =
  | 'DOCUMENT'
  | 'QUESTIONNAIRE'
  | 'TRANSACTION_CLARIFICATION'
  | 'BUSINESS_PURPOSE'
  | 'MISSING_RECEIPT'
  | 'SIGNATURE'
  | 'PAYMENT'
  | 'GENERAL_INFORMATION';

export type RequestStatus =
  | 'OPEN'
  | 'VIEWED'
  | 'RESPONDED'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'CLOSED';

export interface ClientRequestItem {
  id: string;
  tenantId: string;
  clientId: string;
  engagementId?: string;
  caseId?: string;
  requestType: RequestType;
  title: string;
  description?: string;
  status: RequestStatus;
  priority: TaskPriority;
  dueDate?: string;
  createdBy: string;
  assignedToClientId: string;
  responseText?: string;
  responseData?: Record<string, unknown>;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ==============================================================================
// 8. NOTIFICATIONS
// ==============================================================================

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS';

export type NotificationStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'NOT_CONFIGURED'
  | 'FAILED';

export interface NotificationRecord {
  id: string;
  tenantId: string;
  recipientId: string;
  recipientRole: string;
  clientId?: string;
  templateType: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: Record<string, unknown>;
  isMandatorySecurity: boolean;
  status: NotificationStatus;
  providerReference?: string;
  failureCode?: string;
  failureMessage?: string;
  readAt?: string;
  sentAt?: string;
  createdAt: string;
}

export interface UserNotificationPreferences {
  tenantId: string;
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  remindersEnabled: boolean;
  updatedAt: string;
}

// ==============================================================================
// 9. SERVICE CATALOG & ENGAGEMENTS
// ==============================================================================

export type BillingMethod = 'FLAT_FEE' | 'HOURLY' | 'SUBSCRIPTION' | 'CONTINGENCY';

export interface ServiceCatalogItem {
  id: string;
  tenantId: string;
  serviceCode: string;
  name: string;
  description: string;
  category: 'INDIVIDUAL_TAX' | 'BUSINESS_TAX' | 'BOOKKEEPING' | 'ADVISORY' | 'AUDIT_RESOLUTION';
  billingMethod: BillingMethod;
  baseFee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EngagementLifecycleStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'TERMINATED'
  | 'RENEWAL_DUE';

export interface EngagementDossier {
  id: string;
  tenantId: string;
  clientId: string;
  engagementCode: string;
  taxYear: number;
  status: EngagementLifecycleStatus;
  authorizedServices: string[]; // service codes
  responsibleAccountantId?: string;
  responsibleReviewerId?: string;
  termsAgreed: boolean;
  termsAgreedAt?: string;
  termsHash?: string;
  consents: Record<string, boolean>;
  totalContractValue: number;
  createdAt: string;
  updatedAt: string;
}

// ==============================================================================
// 10. BILLING & INVOICING (Deterministic Monetary Math)
// ==============================================================================

export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'PAST_DUE'
  | 'VOID';

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  serviceCode: string;
  description: string;
  quantity: number;
  unitRate: number;
  amount: number;
}

export interface InvoiceRecord {
  id: string;
  tenantId: string;
  clientId: string;
  engagementId?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  lines: InvoiceLineItem[];
  subtotal: number;
  adjustments: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  dueDate: string;
  issueDate?: string;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  createdBy: string;
  issuedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePaymentRecord {
  id: string;
  tenantId: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  paymentMethod: 'STRIPE' | 'ACH' | 'CHECK' | 'WIRE' | 'MANUAL_ADJUSTMENT';
  status: 'PENDING' | 'SETTLED' | 'FAILED' | 'REFUNDED';
  providerTransactionId?: string;
  idempotencyKey?: string;
  recordedBy: string;
  createdAt: string;
}

/**
 * Deterministic Currency Arithmetic Helper
 * Ensures exact 2-decimal rounded calculation to avoid binary floating point issues.
 */
export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function computeInvoiceTotals(
  lines: Array<{ quantity: number; unitRate: number }>,
  adjustments = 0,
  tax = 0
): { subtotal: number; total: number } {
  let subtotalCents = 0;
  for (const line of lines) {
    const lineCents = Math.round(line.quantity * 100) * Math.round(line.unitRate * 100);
    subtotalCents += Math.round(lineCents / 100);
  }
  const subtotal = roundCurrency(subtotalCents / 100);
  const total = roundCurrency(subtotal + adjustments + tax);
  return { subtotal, total };
}
