/**
 * Database Model & Persistent Storage Layer for A/R Tax Services, LLC
 * Enterprise relational in-memory engine with UUIDs, indexing, foreign key checks,
 * audit trails, and strict tenant/client isolation.
 */

import { randomUUID } from 'crypto';
import { 
  User, 
  Engagement, 
  DocumentItem, 
  Appointment, 
  ServicePlan, 
  Invoice, 
  AccountingConnection, 
  Message, 
  JobListing, 
  Applicant, 
  AuditLog,
  OnboardingState,
  JournalEntryDraft,
  LegalCoordinationRecord,
  ClientAccountantBinding,
  AccountantProfile,
  AccountingWorkflowTask,
  DocumentRequest,
  ReassignmentRequest,
  DetailedAccountingIntegration,
  PermissionScope,
  ALL_PERMISSION_SCOPES,
  ClientOnboardingDossier,
  StaffInvitation,
  StaffOnboardingDossier,
  StaffAvailabilityConfig,
  AvailabilityException,
  CalendarConnection,
  CalendarBusyBlock,
  AppointmentSlotHold,
  SynchronizedAppointment,
  FirmHoliday,
  BookkeepingTransaction,
  BankReconciliation,
  ChartOfAccountItem,
  FullClientIntakeDossier,
  GovernedResearchRule,
  AccountingStagingRecord
} from '../types';
import { 
  INITIAL_USERS, 
  INITIAL_SERVICE_PLANS, 
  INITIAL_ENGAGEMENTS, 
  INITIAL_DOCUMENTS, 
  INITIAL_APPOINTMENTS, 
  INITIAL_INVOICES, 
  INITIAL_ACCOUNTING_CONNECTIONS, 
  INITIAL_MESSAGES, 
  INITIAL_JOBS, 
  INITIAL_APPLICANTS, 
  INITIAL_AUDIT_LOGS 
} from '../data/mockData';
import {
  INITIAL_GOVERNED_RESEARCH_RULES,
  INITIAL_CLIENT_INTAKE_DOSSIER,
  INITIAL_ACCOUNTING_STAGING_RECORDS
} from '../data/intakeSeedData';

export interface WebhookRecord {
  id: string;
  idempotencyKey: string;
  source: 'stripe' | 'quickbooks' | 'xero';
  eventType: string;
  payload: any;
  status: 'processed' | 'duplicate_ignored' | 'failed';
  processedAt: string;
}

export interface SignedTokenRecord {
  token: string;
  documentId: string;
  userId: string;
  expiresAt: number; // timestamp ms
  createdAt: number;
}

export interface SecurityEventRecord {
  id: string;
  eventType: string;
  ipAddress: string;
  userId?: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

class Database {
  users: Map<string, User> = new Map();
  userPasswords: Map<string, string> = new Map(); // email -> salt:hashedPassword
  emailVerificationTokens: Map<string, string> = new Map(); // token -> email
  passwordResetTokens: Map<string, { email: string; expiresAt: number }> = new Map();
  sessions: Map<string, { userId: string; role: string; createdAt: number; expiresAt: number }> = new Map();
  
  engagements: Map<string, Engagement> = new Map();
  documents: Map<string, DocumentItem> = new Map();
  signedDownloadTokens: Map<string, SignedTokenRecord> = new Map();
  appointments: Map<string, Appointment> = new Map();
  servicePlans: Map<string, ServicePlan> = new Map();
  invoices: Map<string, Invoice> = new Map();
  accountingConnections: Map<string, AccountingConnection> = new Map();
  messages: Map<string, Message> = new Map();
  jobs: Map<string, JobListing> = new Map();
  applicants: Map<string, Applicant> = new Map();
  auditLogs: AuditLog[] = [];
  securityEvents: SecurityEventRecord[] = [];
  webhooks: Map<string, WebhookRecord> = new Map();
  onboardingStates: Map<string, OnboardingState> = new Map(); // userId -> OnboardingState
  journalEntries: Map<string, JournalEntryDraft> = new Map();
  bookkeepingTransactions: Map<string, BookkeepingTransaction> = new Map();
  bankReconciliations: Map<string, BankReconciliation> = new Map();
  chartOfAccounts: ChartOfAccountItem[] = [];
  legalRecords: Map<string, LegalCoordinationRecord> = new Map();
  
  // Accountant-Client Binding & Workspace Entities
  accountantProfiles: Map<string, AccountantProfile> = new Map();
  clientAccountantAssignments: Map<string, ClientAccountantBinding> = new Map();
  accountingTasks: Map<string, AccountingWorkflowTask> = new Map();
  documentRequests: Map<string, DocumentRequest> = new Map();
  reassignmentRequests: Map<string, ReassignmentRequest> = new Map();
  detailedIntegrations: Map<string, DetailedAccountingIntegration> = new Map();

  // -------------------------------------------------------------
  // 23 PRODUCTION ENTERPRISE COLLECTIONS (PART 11 COMPLIANCE)
  // -------------------------------------------------------------
  clientOnboarding: Map<string, ClientOnboardingDossier> = new Map(); // clientId -> dossier
  staffInvitations: Map<string, StaffInvitation> = new Map(); // id -> invitation
  staffOnboarding: Map<string, StaffOnboardingDossier> = new Map(); // id/userId -> dossier
  staffQualifications: Map<string, any> = new Map();
  credentialVerifications: Map<string, any> = new Map();
  staffPermissions: Map<string, string[]> = new Map(); // userId -> permissions[]
  staffAvailability: Map<string, StaffAvailabilityConfig> = new Map(); // staffId -> config
  availabilityExceptions: Map<string, AvailabilityException> = new Map(); // id -> exception
  calendarConnections: Map<string, CalendarConnection> = new Map(); // id -> connection
  calendarSyncStates: Map<string, any> = new Map();
  calendarBusyBlocks: Map<string, CalendarBusyBlock> = new Map(); // id -> block
  appointmentTypes: Map<string, any> = new Map();
  appointmentSlotHolds: Map<string, AppointmentSlotHold> = new Map(); // slotKey -> hold
  // appointments is already defined above
  appointmentHistory: Map<string, any[]> = new Map(); // appointmentId -> history[]
  meetingLocations: Map<string, any> = new Map();
  firmHolidays: Map<string, FirmHoliday> = new Map();
  notificationJobs: Map<string, any> = new Map();
  clientAssignments: Map<string, ClientAccountantBinding> = new Map();
  engagementLetters: Map<string, any> = new Map();
  consentRecords: Map<string, any> = new Map();
  // documentRequests is defined above
  documentMetadata: Map<string, any> = new Map();
  
  // U.S. Client Intake, Intelligence & Accounting Staging Collections
  clientIntakeDossiers: Map<string, FullClientIntakeDossier> = new Map();
  accountingStagingRecords: Map<string, AccountingStagingRecord> = new Map();
  governedResearchRules: Map<string, GovernedResearchRule> = new Map();

  auditEvents: Array<{
    id: string;
    eventType: string;
    actorId: string;
    actorRole: string;
    targetResource: string;
    targetId?: string;
    metadata?: any;
    ipAddress: string;
    timestamp: string;
  }> = [];

  // Failed login attempts for rate limiting: ip/email -> { count: number, lockedUntil: number }
  loginAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();

  constructor() {
    this.seed();
  }

  private seed() {
    // Seed initial users
    INITIAL_USERS.forEach(user => {
      this.users.set(user.id, { ...user });
    });

    // Seed initial passwords (hashed during runtime auth init)
    // Default pass for demo clients: ClientPass123!
    // Default pass for staff: FirmPass123!
    // We will initialize hashes in auth.ts

    // Seed service plans
    INITIAL_SERVICE_PLANS.forEach(plan => {
      this.servicePlans.set(plan.id, { ...plan });
    });

    // Seed engagements
    INITIAL_ENGAGEMENTS.forEach(eng => {
      this.engagements.set(eng.id, { ...eng });
    });

    // Seed documents
    INITIAL_DOCUMENTS.forEach(doc => {
      this.documents.set(doc.id, { ...doc });
    });

    // Seed appointments
    INITIAL_APPOINTMENTS.forEach(apt => {
      this.appointments.set(apt.id, { ...apt });
    });

    // Seed invoices
    INITIAL_INVOICES.forEach(inv => {
      this.invoices.set(inv.id, { ...inv });
    });

    // Seed accounting connections
    INITIAL_ACCOUNTING_CONNECTIONS.forEach(conn => {
      this.accountingConnections.set(conn.id, { ...conn });
    });

    // Seed messages
    INITIAL_MESSAGES.forEach(msg => {
      this.messages.set(msg.id, { ...msg });
    });

    // Seed jobs & applicants
    INITIAL_JOBS.forEach(job => {
      this.jobs.set(job.id, { ...job });
    });

    INITIAL_APPLICANTS.forEach(app => {
      this.applicants.set(app.id, { ...app });
    });

    // Seed audit logs
    this.auditLogs = [...INITIAL_AUDIT_LOGS];

    // Seed initial onboarding for Michael Perotti (completed) and Prospective Client (draft)
    this.onboardingStates.set('user_client_1', {
      id: 'onb_001',
      userId: 'user_client_1',
      step: 15,
      percentComplete: 100,
      entityType: 'business',
      contactInfo: {
        fullName: 'Michael Perotti',
        email: 'm.perotti@example.com',
        phone: '803-555-0142',
        address: '1201 Main St, Suite 1400',
        city: 'Columbia',
        state: 'SC',
        zipCode: '29201'
      },
      businessInfo: {
        entityName: 'Perotti Financial Consulting',
        ein: '57-8912401',
        entityStructure: 'scorp',
        incorporationState: 'SC',
        fiscalYearEnd: '12/31'
      },
      selectedServices: ['individual_tax_1040', 'business_tax_scorp_llc'],
      intakeAnswers: {
        hasForeignAccounts: false,
        cryptoTransactions: true,
        estimatedRevenue: '$450,000'
      },
      uploadedDocuments: ['doc_w2_2025_01', 'doc_1099_misc_2025'],
      selectedPlanId: 'plan_corporate_growth',
      paymentMethodAuthorized: true,
      engagementAgreementSigned: true,
      signedAgreementDate: '2025-11-12T10:30:00Z',
      privacyDisclaimerAccepted: true,
      accountingSoftwareConnected: true,
      consultationBooked: true,
      status: 'approved',
      missingRequirements: [],
      createdAt: '2025-11-12T10:00:00Z',
      updatedAt: '2025-11-12T11:30:00Z'
    });

    // Seed a sample draft journal entry for reconciliation workspace
    this.journalEntries.set('je_001', {
      id: 'je_001',
      engagementId: 'eng_2025_002',
      clientId: 'user_client_2',
      date: '2026-08-31',
      reference: 'ADJ-2026-08',
      memo: 'August Shareholder Distribution vs Officer Compensation Adjustment',
      lines: [
        {
          id: 'line_1',
          accountNumber: '5010',
          accountName: 'Officer Compensation',
          debit: 5000,
          credit: 0,
          description: 'Reclassify distribution to reasonable officer compensation'
        },
        {
          id: 'line_2',
          accountNumber: '3020',
          accountName: 'Shareholder Distributions',
          debit: 0,
          credit: 5000,
          description: 'Offset against unclassified shareholder draw'
        }
      ],
      status: 'prepared',
      preparedBy: 'user_accountant_marcus',
      preparedByName: 'Marcus Vance',
      reviewNotes: 'Awaiting senior CPA Elena Rostova sign-off before posting to Xero ledger.',
      createdAt: '2026-09-07T16:00:00Z',
      updatedAt: '2026-09-07T16:00:00Z'
    });

    // Standard Chart of Accounts (COA) mapped to IRS Tax Forms
    this.chartOfAccounts = [
      { code: '1010', name: 'Operating Checking', category: 'Asset', subCategory: 'Cash & Cash Equivalents', taxMapping: 'Form 1120-S Schedule L Line 1' },
      { code: '1020', name: 'Payroll Checking', category: 'Asset', subCategory: 'Cash & Cash Equivalents', taxMapping: 'Form 1120-S Schedule L Line 1' },
      { code: '1050', name: 'Accounts Receivable', category: 'Asset', subCategory: 'Current Assets', taxMapping: 'Form 1120-S Schedule L Line 2a' },
      { code: '1510', name: 'Office Furniture & Equipment', category: 'Asset', subCategory: 'Fixed Assets (Depreciable)', taxMapping: 'Form 1120-S Schedule L Line 10a / Form 4562' },
      { code: '2010', name: 'Accounts Payable', category: 'Liability', subCategory: 'Current Liabilities', taxMapping: 'Form 1120-S Schedule L Line 15' },
      { code: '2050', name: 'Business Credit Card Payable', category: 'Liability', subCategory: 'Current Liabilities', taxMapping: 'Form 1120-S Schedule L Line 15' },
      { code: '2210', name: 'South Carolina Sales Tax Payable', category: 'Liability', subCategory: 'Current Liabilities', taxMapping: 'Form SC DOR-ST3 / Schedule L' },
      { code: '2410', name: 'Federal Payroll Tax Withholding', category: 'Liability', subCategory: 'Payroll Liabilities', taxMapping: 'Form 941 / Schedule L' },
      { code: '3010', name: 'Common Stock / Member Capital', category: 'Equity', subCategory: 'Paid-in Capital', taxMapping: 'Form 1120-S Schedule L Line 22' },
      { code: '3020', name: 'Shareholder Distributions', category: 'Equity', subCategory: 'Distributions', taxMapping: 'Form 1120-S Schedule K Line 16d' },
      { code: '3050', name: 'Retained Earnings', category: 'Equity', subCategory: 'Accumulated Earnings', taxMapping: 'Form 1120-S Schedule L Line 24' },
      { code: '4010', name: 'Professional Tax & Advisory Services', category: 'Revenue', subCategory: 'Operating Revenue', taxMapping: 'Form 1120-S Line 1a / Form 1040 Sch C Line 1' },
      { code: '4020', name: 'Technology & Management Consulting', category: 'Revenue', subCategory: 'Operating Revenue', taxMapping: 'Form 1120-S Line 1a' },
      { code: '5010', name: 'Direct Subcontractor Labor', category: 'COGS', subCategory: 'Direct Service Costs', taxMapping: 'Form 1120-S Line 2 (Cost of Goods Sold)' },
      { code: '5020', name: 'Client Software Licenses & Hosting', category: 'COGS', subCategory: 'Direct Service Costs', taxMapping: 'Form 1120-S Line 2' },
      { code: '6010', name: 'Officer Compensation', category: 'Operating Expense', subCategory: 'Executive Compensation', taxMapping: 'Form 1120-S Line 7 / Form 1125-E' },
      { code: '6020', name: 'Staff Salaries & Wages', category: 'Operating Expense', subCategory: 'Payroll Expenses', taxMapping: 'Form 1120-S Line 8' },
      { code: '6110', name: 'Office Rent & Facilities', category: 'Operating Expense', subCategory: 'Occupancy', taxMapping: 'Form 1120-S Line 11 / 1040 Sch C Line 20b' },
      { code: '6120', name: 'Professional Legal & CPA Fees', category: 'Operating Expense', subCategory: 'Professional Fees', taxMapping: 'Form 1120-S Line 19 / 1040 Sch C Line 17' },
      { code: '6150', name: 'Advertising & Digital Marketing', category: 'Operating Expense', subCategory: 'Marketing', taxMapping: 'Form 1120-S Line 19 / 1040 Sch C Line 8' },
      { code: '6180', name: 'Cloud Software & IT Subscriptions', category: 'Operating Expense', subCategory: 'Technology', taxMapping: 'Form 1120-S Line 19 / 1040 Sch C Line 27a' },
      { code: '6220', name: 'Business Meals (50% Deductible)', category: 'Operating Expense', subCategory: 'Travel & Entertainment', taxMapping: 'Form 1120-S Line 19 / 1040 Sch C Line 24b' }
    ];

    // Seed sample bank reconciliations
    this.bankReconciliations.set('rec_2026_08', {
      id: 'rec_2026_08',
      clientId: 'user_client_1',
      accountName: 'First Citizens Operating Checking (***9481)',
      accountNumber: 'First Citizens Bank - Acct ending in 9481',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      statementEndingBalance: 48250.00,
      clearedBookBalance: 48250.00,
      variance: 0.00,
      matchedCount: 42,
      unmatchedCount: 0,
      status: 'signed_off',
      preparedBy: 'user_accountant_marcus',
      preparedByName: 'Marcus Vance',
      signedOffBy: 'user_accountant_elena',
      signedOffByName: 'Elena Rostova, CPA',
      signedOffAt: '2026-09-05T14:30:00Z',
      isPeriodLocked: true,
      notes: 'August 2026 bank reconciliation signed off and locked. General ledger matches statement exactly.'
    });

    this.bankReconciliations.set('rec_2026_09', {
      id: 'rec_2026_09',
      clientId: 'user_client_1',
      accountName: 'First Citizens Operating Checking (***9481)',
      accountNumber: 'First Citizens Bank - Acct ending in 9481',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      statementEndingBalance: 62110.00,
      clearedBookBalance: 61780.00,
      variance: 330.00,
      matchedCount: 28,
      unmatchedCount: 2,
      status: 'in_progress',
      preparedBy: 'user_accountant_marcus',
      preparedByName: 'Marcus Vance',
      isPeriodLocked: false,
      notes: '$330.00 variance under review: pending merchant terminal credit deposit from 2026-09-28.'
    });

    // Seed sample transactions for client user_client_1
    const txData: BookkeepingTransaction[] = [
      {
        id: 'tx_101',
        clientId: 'user_client_1',
        date: '2026-09-02',
        description: 'GOOGLE WORKSPACE / CLOUD APPS',
        amount: 72.00,
        type: 'debit',
        suggestedAccountCode: '6180',
        suggestedAccountName: 'Cloud Software & IT Subscriptions',
        category: 'Software & Technology',
        confidence: 98,
        status: 'confirmed',
        vendorOrPayee: 'Google Cloud EMEA / US',
        matchedRule: 'Rule: Google Cloud/Workspace -> 6180',
        source: 'bank_feed',
        reviewerNotes: 'Recurring monthly cloud productivity license.'
      },
      {
        id: 'tx_102',
        clientId: 'user_client_1',
        date: '2026-09-04',
        description: 'PALMETTO OFFICE SUITES RENT',
        amount: 1850.00,
        type: 'debit',
        suggestedAccountCode: '6110',
        suggestedAccountName: 'Office Rent & Facilities',
        category: 'Rent & Facilities',
        confidence: 96,
        status: 'confirmed',
        vendorOrPayee: 'Palmetto Commercial Properties LLC',
        matchedRule: 'Rule: Office lease payment -> 6110',
        source: 'bank_feed',
        reviewerNotes: 'Columbia SC corporate lease, month of September.'
      },
      {
        id: 'tx_103',
        clientId: 'user_client_1',
        date: '2026-09-08',
        description: 'CLIENT RETAINER - STRIPE DEPOSIT #4912',
        amount: 5400.00,
        type: 'credit',
        suggestedAccountCode: '4010',
        suggestedAccountName: 'Professional Tax & Advisory Services',
        category: 'Gross Revenue',
        confidence: 94,
        status: 'confirmed',
        vendorOrPayee: 'Carolina Logistics Group LLC',
        matchedRule: 'Rule: Merchant deposit -> 4010',
        source: 'bank_feed',
        reviewerNotes: 'Q3 Tax advisory and planning retainer invoice #AR-8921.'
      },
      {
        id: 'tx_104',
        clientId: 'user_client_1',
        date: '2026-09-12',
        description: 'HALLS CHOPHOUSE COLUMBIA DINNER',
        amount: 342.50,
        type: 'debit',
        suggestedAccountCode: '6220',
        suggestedAccountName: 'Business Meals (50% Deductible)',
        category: 'Travel & Entertainment',
        confidence: 88,
        status: 'auto_categorized',
        vendorOrPayee: 'Halls Chophouse Columbia',
        matchedRule: 'AI Match: Restaurant / Business Meal -> 6220',
        source: 'bank_feed',
        reviewerNotes: 'Client dinner with Carolina Logistics CFO; receipt uploaded.'
      },
      {
        id: 'tx_105',
        clientId: 'user_client_1',
        date: '2026-09-15',
        description: 'AMAZON.COM* OFFICE HARDWARE EXP',
        amount: 489.99,
        type: 'debit',
        suggestedAccountCode: '1510',
        suggestedAccountName: 'Office Furniture & Equipment',
        category: 'Capital / Fixed Assets',
        confidence: 76,
        status: 'needs_review',
        vendorOrPayee: 'Amazon Commercial Services',
        matchedRule: 'Ambiguity: Could be 6180 Supplies or 1510 Capital Asset (Section 179 / De Minimis Safe Harbor)',
        source: 'bank_feed',
        reviewerNotes: 'Confirm whether item qualifies for de minimis safe harbor ($2,500 threshold).'
      },
      {
        id: 'tx_106',
        clientId: 'user_client_1',
        date: '2026-09-18',
        description: 'SC DEPARTMENT OF REVENUE ESTIMATED TAX',
        amount: 1250.00,
        type: 'debit',
        suggestedAccountCode: '3020',
        suggestedAccountName: 'Shareholder Distributions',
        category: 'Tax & Distributions',
        confidence: 91,
        status: 'auto_categorized',
        vendorOrPayee: 'SC Department of Revenue',
        matchedRule: 'Rule: State tax withholding/estimate on behalf of owner -> 3020',
        source: 'bank_feed',
        reviewerNotes: 'Q3 South Carolina estimated pass-through tax payment.'
      }
    ];

    txData.forEach(tx => this.bookkeepingTransactions.set(tx.id, tx));

    // Seed sample legal coordination record
    this.legalRecords.set('legal_001', {
      id: 'legal_001',
      clientId: 'user_client_1',
      clientName: 'Michael Perotti',
      title: 'Family Revocable Living Trust & Operating Agreement Review',
      category: 'estate_trust',
      assignedExternalAttorney: 'Jonathan Sterling, Esq.',
      attorneyLawFirm: 'Palmetto Estate & Business Law, LLC',
      attorneyBarNumber: 'SC-BAR #74921',
      filingDeadline: '2026-10-15',
      publicRecordReference: 'Richland County Register of Deeds Doc #2024-8192',
      status: 'counsel_review',
      notes: 'Administrative tax package prepared and transmitted to external estate counsel for review. Not legal advice.',
      disclaimerAcknowledged: true,
      documentIds: ['doc_legal_estate_01'],
      createdAt: '2026-08-20T14:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z'
    });

    // -----------------------------------------------------------------
    // SEED: Accountant Profiles
    // -----------------------------------------------------------------
    this.accountantProfiles.set('user_accountant_desmond', {
      id: 'prof_desmond',
      userId: 'user_accountant_desmond',
      name: 'Desmond Hinds',
      title: 'Founder & Senior Managing Accountant',
      email: 'dhinds@artaxservices.com',
      phone: '678-205-9486',
      credentials: ['EA Candidate', 'AFSP Registered Tax Return Preparer', 'Certified QuickBooks ProAdvisor'],
      specializations: ['S-Corporation Filings (1120-S)', 'Small Business Accountancy', 'Strategic Tax Planning', 'IRS Resolution'],
      avatarUrl: '/ceo/123456789-desmond.png',
      status: 'active',
      maxClients: 25,
      currentActiveClients: 1,
      availability: 'available',
      internalNotes: 'Practice Managing Partner. Leads executive filings and high-wealth advisory.'
    });

    this.accountantProfiles.set('user_accountant_marcus', {
      id: 'prof_marcus',
      userId: 'user_accountant_marcus',
      name: 'Marcus Vance',
      title: 'Staff Tax Accountant',
      email: 'mvance@artaxservices.com',
      phone: '803-555-0182',
      credentials: ['MS Accounting', 'Certified Bookkeeper', 'Xero Advisor Certified'],
      specializations: ['Monthly Bookkeeping', 'Bank Reconciliations', '1065 Partnership Filings', 'Payroll Compliance'],
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      maxClients: 35,
      currentActiveClients: 1,
      availability: 'available',
      internalNotes: 'Specializes in tech companies and e-commerce ledger maintenance.'
    });

    this.accountantProfiles.set('user_reviewer_elena', {
      id: 'prof_elena',
      userId: 'user_reviewer_elena',
      name: 'Elena Rostova, CPA',
      title: 'Principal Quality & Compliance Reviewer',
      email: 'erostova@artaxservices.com',
      phone: '803-555-0177',
      credentials: ['CPA (South Carolina Board of Accountancy)', 'IRS Enrolled Agent'],
      specializations: ['Quality Review & Maker-Checker', 'Audit Support & Representation', 'Section 7216 Disclosures'],
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      maxClients: 60,
      currentActiveClients: 2,
      availability: 'available',
      internalNotes: 'Senior signatory on Form 8879 and final workpaper authorization.'
    });

    // -----------------------------------------------------------------
    // SEED: Client-Accountant Bindings
    // -----------------------------------------------------------------
    this.clientAccountantAssignments.set('bind_001', {
      id: 'bind_001',
      clientId: 'user_client_1',
      clientName: 'Michael Perotti',
      clientCompanyName: 'Perotti Financial Consulting',
      accountantId: 'user_accountant_desmond',
      accountantName: 'Desmond Hinds',
      accountantTitle: 'Founder & Senior Managing Accountant',
      assignmentType: 'primary',
      status: 'active',
      accessScope: [...ALL_PERMISSION_SCOPES],
      assignedBy: 'user_admin',
      assignedByName: 'Victoria Reynolds',
      assignedAt: '2025-11-12T10:00:00Z',
      effectiveDate: '2025-11-12',
      reason: 'Assigned as primary lead for S-Corp and individual tax packaging.',
      internalNotes: 'Client requires monthly P&L review and timely quarterly estimates.',
      lastAccessAt: '2026-09-08T08:15:00Z'
    });

    this.clientAccountantAssignments.set('bind_002', {
      id: 'bind_002',
      clientId: 'user_client_1',
      clientName: 'Michael Perotti',
      clientCompanyName: 'Perotti Financial Consulting',
      accountantId: 'user_reviewer_elena',
      accountantName: 'Elena Rostova, CPA',
      accountantTitle: 'Principal Quality & Compliance Reviewer',
      assignmentType: 'reviewer',
      status: 'active',
      accessScope: ['view_profile', 'view_documents', 'download_files', 'view_accounting_records', 'submit_work_for_review', 'view_internal_notes', 'add_internal_notes'],
      assignedBy: 'user_admin',
      assignedByName: 'Victoria Reynolds',
      assignedAt: '2025-11-12T10:30:00Z',
      effectiveDate: '2025-11-12',
      reason: 'Mandatory independent CPA compliance reviewer assignment.',
      internalNotes: 'Independent sign-off gate for Form 1120-S filing.',
      lastAccessAt: '2026-09-08T08:10:00Z'
    });

    this.clientAccountantAssignments.set('bind_003', {
      id: 'bind_003',
      clientId: 'user_client_2',
      clientName: 'Comfort Dondo',
      clientCompanyName: 'Dondo Enterprise Holdings LLC',
      accountantId: 'user_accountant_marcus',
      accountantName: 'Marcus Vance',
      accountantTitle: 'Staff Tax Accountant',
      assignmentType: 'primary',
      status: 'active',
      accessScope: [...ALL_PERMISSION_SCOPES],
      assignedBy: 'user_admin',
      assignedByName: 'Victoria Reynolds',
      assignedAt: '2025-08-10T14:30:00Z',
      effectiveDate: '2025-08-10',
      reason: 'Primary assignment for monthly bookkeeping and multi-member partnership returns.',
      internalNotes: 'Xero integration active. Reconciles on the 5th of each month.',
      lastAccessAt: '2026-09-07T16:45:00Z'
    });

    this.clientAccountantAssignments.set('bind_004', {
      id: 'bind_004',
      clientId: 'user_client_2',
      clientName: 'Comfort Dondo',
      clientCompanyName: 'Dondo Enterprise Holdings LLC',
      accountantId: 'user_reviewer_elena',
      accountantName: 'Elena Rostova, CPA',
      accountantTitle: 'Principal Quality & Compliance Reviewer',
      assignmentType: 'reviewer',
      status: 'active',
      accessScope: ['view_profile', 'view_documents', 'download_files', 'view_accounting_records', 'submit_work_for_review', 'view_internal_notes', 'add_internal_notes'],
      assignedBy: 'user_admin',
      assignedByName: 'Victoria Reynolds',
      assignedAt: '2025-08-10T15:00:00Z',
      effectiveDate: '2025-08-10',
      reason: 'Mandatory maker-checker senior reviewer assignment.',
      internalNotes: 'Reviews journal entries and monthly reconciliations before posting.',
      lastAccessAt: '2026-09-07T16:50:00Z'
    });

    // Seed a historical unbound assignment to prove audit retention
    this.clientAccountantAssignments.set('bind_hist_001', {
      id: 'bind_hist_001',
      clientId: 'user_client_1',
      clientName: 'Michael Perotti',
      clientCompanyName: 'Perotti Financial Consulting',
      accountantId: 'user_accountant_marcus',
      accountantName: 'Marcus Vance',
      accountantTitle: 'Staff Tax Accountant',
      assignmentType: 'supporting',
      status: 'unbound',
      accessScope: ['view_documents', 'view_accounting_records'],
      assignedBy: 'user_admin',
      assignedByName: 'Victoria Reynolds',
      assignedAt: '2025-09-01T09:00:00Z',
      effectiveDate: '2025-09-01',
      unboundBy: 'user_admin',
      unboundByName: 'Victoria Reynolds',
      unboundAt: '2025-11-12T09:30:00Z',
      reason: 'Initial setup assistance completed; transitioned fully to Senior Managing Partner Desmond Hinds.',
      internalNotes: 'Archived per standard client reassignment procedure. Access immediately revoked.',
      lastAccessAt: '2025-11-11T16:00:00Z'
    });

    // -----------------------------------------------------------------
    // SEED: Accounting Tasks (Multi-Module Workflow)
    // -----------------------------------------------------------------
    this.accountingTasks.set('task_001', {
      id: 'task_001',
      clientId: 'user_client_1',
      clientName: 'Michael Perotti',
      engagementId: 'eng_2025_001',
      module: 'financial_statement_prep',
      title: 'Q3 Balance Sheet & Income Statement Preparation',
      description: 'Prepare and finalize comparative quarterly financial statements from connected QuickBooks Online ledger.',
      assignedAccountantId: 'user_accountant_desmond',
      assignedAccountantName: 'Desmond Hinds',
      reviewerId: 'user_reviewer_elena',
      reviewerName: 'Elena Rostova, CPA',
      priority: 'high',
      status: 'in_progress',
      dueDate: '2026-09-25',
      checklist: [
        { id: 'c1', title: 'Verify clearing account balances match zero', completed: true },
        { id: 'c2', title: 'Reconcile payroll liabilities with 941 filings', completed: true },
        { id: 'c3', title: 'Confirm depreciation expense schedules', completed: false },
        { id: 'c4', title: 'Generate PDF deliverable package', completed: false }
      ],
      attachments: [
        { id: 'att_1', fileName: 'Q3_Preliminary_Trial_Balance.xlsx', fileSize: '240 KB', uploadedAt: '2026-09-05T14:00:00Z' }
      ],
      comments: [
        { id: 'comm_1', authorId: 'user_accountant_desmond', authorName: 'Desmond Hinds', authorRole: 'accountant', content: 'Section 179 depreciation needs final check against vehicle purchase receipt.', createdAt: '2026-09-06T10:00:00Z', isInternal: true }
      ],
      approvalHistory: [],
      preparedAt: '2026-09-05T14:00:00Z',
      createdAt: '2026-09-01T09:00:00Z',
      updatedAt: '2026-09-06T10:00:00Z'
    });

    this.accountingTasks.set('task_002', {
      id: 'task_002',
      clientId: 'user_client_1',
      clientName: 'Michael Perotti',
      engagementId: 'eng_2025_001',
      module: 'tax_doc_prep',
      title: 'Form 1120-S Schedule K-1 Distribution Verification',
      description: 'Calculate and cross-verify shareholder distributions against adjusted basis worksheet.',
      assignedAccountantId: 'user_accountant_desmond',
      assignedAccountantName: 'Desmond Hinds',
      reviewerId: 'user_reviewer_elena',
      reviewerName: 'Elena Rostova, CPA',
      priority: 'urgent',
      status: 'ready_for_review',
      dueDate: '2026-09-15',
      checklist: [
        { id: 'c5', title: 'Calculate beginning vs ending stock basis', completed: true },
        { id: 'c6', title: 'Match Form 1099-DIV and officer distributions', completed: true },
        { id: 'c7', title: 'Compile supporting statements for Reviewer sign-off', completed: true }
      ],
      attachments: [
        { id: 'att_2', fileName: 'Shareholder_Basis_Worksheet_2025.pdf', fileSize: '1.2 MB', uploadedAt: '2026-09-07T11:00:00Z' }
      ],
      comments: [
        { id: 'comm_2', authorId: 'user_accountant_desmond', authorName: 'Desmond Hinds', authorRole: 'accountant', content: 'Completed preparation. Transmitting to Elena for independent maker-checker sign-off.', createdAt: '2026-09-07T11:15:00Z', isInternal: true }
      ],
      approvalHistory: [],
      preparedAt: '2026-09-07T11:00:00Z',
      createdAt: '2026-09-02T08:30:00Z',
      updatedAt: '2026-09-07T11:15:00Z'
    });

    this.accountingTasks.set('task_003', {
      id: 'task_003',
      clientId: 'user_client_2',
      clientName: 'Comfort Dondo',
      engagementId: 'eng_2025_002',
      module: 'bank_reconciliation',
      title: 'Monthly Multi-Account Bank & Merchant Reconciliation',
      description: 'Reconcile 3 operating accounts and Stripe clearing account against Xero bank feeds.',
      assignedAccountantId: 'user_accountant_marcus',
      assignedAccountantName: 'Marcus Vance',
      reviewerId: 'user_reviewer_elena',
      reviewerName: 'Elena Rostova, CPA',
      priority: 'medium',
      status: 'in_progress',
      dueDate: '2026-09-20',
      checklist: [
        { id: 'c8', title: 'Chase Commercial Operating account reconciliation', completed: true },
        { id: 'c9', title: 'Stripe merchant deposit variance check', completed: true },
        { id: 'c10', title: 'Investigate $5,000 unclassified shareholder debit', completed: false }
      ],
      attachments: [
        { id: 'att_3', fileName: 'August_2026_Bank_Statements_Combined.pdf', fileSize: '4.8 MB', uploadedAt: '2026-09-04T15:00:00Z' }
      ],
      comments: [
        { id: 'comm_3', authorId: 'user_accountant_marcus', authorName: 'Marcus Vance', authorRole: 'accountant', content: 'Drafted journal entry JE-001 to reclassify $5k distribution to officer compensation.', createdAt: '2026-09-07T16:05:00Z', isInternal: true }
      ],
      approvalHistory: [],
      preparedAt: '2026-09-07T16:00:00Z',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-07T16:05:00Z'
    });

    // -----------------------------------------------------------------
    // SEED: Document Requests
    // -----------------------------------------------------------------
    this.documentRequests.set('dreq_001', {
      id: 'dreq_001',
      clientId: 'user_client_1',
      clientName: 'Michael Perotti',
      accountantId: 'user_accountant_desmond',
      accountantName: 'Desmond Hinds',
      title: '2025 Form 1099-NEC from Palmetto Tech Ventures',
      description: 'Please upload the non-employee compensation slip received for software advisory services.',
      category: '1099_series',
      taxYear: 2025,
      dueDate: '2026-09-20',
      status: 'pending',
      requestedAt: '2026-09-05T09:00:00Z',
      notes: 'Required to reconcile gross receipts against business deposit ledger.'
    });

    this.documentRequests.set('dreq_002', {
      id: 'dreq_002',
      clientId: 'user_client_2',
      clientName: 'Comfort Dondo',
      accountantId: 'user_accountant_marcus',
      accountantName: 'Marcus Vance',
      title: 'Q3 SC Department of Revenue Sales & Use Tax Summary',
      description: 'Official monthly return copy filed for Columbia warehouse retail sales.',
      category: 'state_tax',
      taxYear: 2026,
      dueDate: '2026-09-22',
      status: 'pending',
      requestedAt: '2026-09-06T14:30:00Z',
      notes: 'Needed for sales tax liability verification in Xero.'
    });

    // -----------------------------------------------------------------
    // SEED: Detailed Accounting Integrations
    // -----------------------------------------------------------------
    this.detailedIntegrations.set('integ_001', {
      id: 'integ_001',
      clientId: 'user_client_1',
      clientName: 'Michael Perotti',
      provider: 'quickbooks_online',
      organizationName: 'Perotti Financial Consulting LLC',
      maskedOrgId: 'QB-***-9104',
      status: 'connected',
      authorizedScopes: ['com.intuit.quickbooks.accounting', 'openid', 'profile', 'email'],
      connectedBy: 'Michael Perotti (Client)',
      connectedAt: '2025-11-12T10:45:00Z',
      lastSuccessfulSync: '2026-09-08T06:00:00Z',
      nextScheduledSync: '2026-09-09T06:00:00Z',
      syncLogs: [
        { id: 'slog_1', timestamp: '2026-09-08T06:00:00Z', status: 'success', recordsSynced: 142, message: 'Synchronized general ledger entries, chart of accounts, and bank feeds.' },
        { id: 'slog_2', timestamp: '2026-09-07T06:00:00Z', status: 'success', recordsSynced: 88, message: 'Nightly incremental sync completed.' }
      ]
    });

    this.detailedIntegrations.set('integ_002', {
      id: 'integ_002',
      clientId: 'user_client_2',
      clientName: 'Comfort Dondo',
      provider: 'xero',
      organizationName: 'Dondo Enterprise Holdings LLC',
      maskedOrgId: 'XERO-***-4482',
      status: 'connected',
      authorizedScopes: ['accounting.transactions.read', 'accounting.reports.read', 'accounting.contacts.read'],
      connectedBy: 'Comfort Dondo (Client)',
      connectedAt: '2025-08-10T15:15:00Z',
      lastSuccessfulSync: '2026-09-08T04:30:00Z',
      nextScheduledSync: '2026-09-09T04:30:00Z',
      syncLogs: [
        { id: 'slog_3', timestamp: '2026-09-08T04:30:00Z', status: 'success', recordsSynced: 215, message: 'Synchronized multi-currency ledger, invoice batches, and bank accounts.' },
        { id: 'slog_4', timestamp: '2026-09-07T04:30:00Z', status: 'success', recordsSynced: 120, message: 'Nightly incremental sync completed.' }
      ]
    });

    // -----------------------------------------------------------------
    // SEED: Appointment Types (Part 8 Compliance)
    // -----------------------------------------------------------------
    const defaultAppointmentTypes = [
      { code: 'new_client_consultation', title: 'New Client Consultation', durationMinutes: 30, priceCents: 0, depositRequired: false },
      { code: 'founder_consultation', title: 'Founder Executive Consultation', durationMinutes: 45, priceCents: 15000, depositRequired: true },
      { code: 'individual_tax_consultation', title: 'Individual Tax Consultation', durationMinutes: 30, priceCents: 0, depositRequired: false },
      { code: 'business_tax_consultation', title: 'Business Tax Consultation', durationMinutes: 45, priceCents: 0, depositRequired: false },
      { code: 'tax_planning_session', title: 'Strategic Tax Planning Session', durationMinutes: 60, priceCents: 25000, depositRequired: true },
      { code: 'bookkeeping_consultation', title: 'Bookkeeping & Reconciliation Consultation', durationMinutes: 30, priceCents: 0, depositRequired: false },
      { code: 'payroll_consultation', title: 'Payroll Compliance Consultation', durationMinutes: 30, priceCents: 0, depositRequired: false },
      { code: 'irs_notice_consultation', title: 'IRS Notice Resolution Consultation', durationMinutes: 45, priceCents: 15000, depositRequired: true },
      { code: 'accounting_software_setup', title: 'Accounting Software (QBO/Xero) Setup', durationMinutes: 60, priceCents: 20000, depositRequired: false },
      { code: 'document_review', title: 'Tax Document Review Meeting', durationMinutes: 30, priceCents: 0, depositRequired: false },
      { code: 'return_review', title: 'Tax Return & Form 8879 Final Review', durationMinutes: 45, priceCents: 0, depositRequired: false },
      { code: 'follow_up_meeting', title: 'Engagement Follow-Up Meeting', durationMinutes: 30, priceCents: 0, depositRequired: false },
      { code: 'internal_staff_meeting', title: 'Internal Staff Quality Review Meeting', durationMinutes: 30, priceCents: 0, depositRequired: false }
    ];
    defaultAppointmentTypes.forEach(t => this.appointmentTypes.set(t.code, t));

    // -----------------------------------------------------------------
    // SEED: Meeting Locations & Firm Holidays
    // -----------------------------------------------------------------
    this.meetingLocations.set('columbia_hq', {
      id: 'columbia_hq',
      name: 'Columbia Executive Office',
      address: '1201 Main Street, Suite 1400, Columbia, SC 29201',
      room: 'Main Conference Room A',
      type: 'in_office',
      isActive: true
    });
    this.meetingLocations.set('virtual_meet', {
      id: 'virtual_meet',
      name: 'Google Meet HD Video Conference',
      address: 'https://meet.google.com/art-tax-secure',
      type: 'virtual',
      isActive: true
    });
    this.meetingLocations.set('phone_direct', {
      id: 'phone_direct',
      name: 'Direct Private Line (Accountant Outbound)',
      address: '+1 (803) 555-0100',
      type: 'telephone',
      isActive: true
    });

    const defaultHolidays = [
      { id: 'hol_new_year', name: "New Year's Day", date: '2026-01-01', isFirmClosed: true },
      { id: 'hol_memorial_day', name: 'Memorial Day', date: '2026-05-25', isFirmClosed: true },
      { id: 'hol_juneteenth', name: 'Juneteenth National Independence Day', date: '2026-06-19', isFirmClosed: true },
      { id: 'hol_independence_day', name: 'Independence Day', date: '2026-07-04', isFirmClosed: true },
      { id: 'hol_labor_day', name: 'Labor Day', date: '2026-09-07', isFirmClosed: true },
      { id: 'hol_thanksgiving', name: 'Thanksgiving Day', date: '2026-11-26', isFirmClosed: true },
      { id: 'hol_christmas', name: 'Christmas Day', date: '2026-12-25', isFirmClosed: true }
    ];
    defaultHolidays.forEach(h => this.firmHolidays.set(h.id, h));

    // -----------------------------------------------------------------
    // SEED: Staff Availability Configs (Weekly Recurring & Buffers)
    // -----------------------------------------------------------------
    const standardWeekSchedule = [
      { dayOfWeek: 0, isAvailable: false, timeSlots: [] }, // Sun
      { dayOfWeek: 1, isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00' }], lunchBreak: { start: '12:00', end: '13:00' } }, // Mon
      { dayOfWeek: 2, isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00' }], lunchBreak: { start: '12:00', end: '13:00' } }, // Tue
      { dayOfWeek: 3, isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00' }], lunchBreak: { start: '12:00', end: '13:00' } }, // Wed
      { dayOfWeek: 4, isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00' }], lunchBreak: { start: '12:00', end: '13:00' } }, // Thu
      { dayOfWeek: 5, isAvailable: true, timeSlots: [{ start: '09:00', end: '16:00' }], lunchBreak: { start: '12:00', end: '13:00' } }, // Fri
      { dayOfWeek: 6, isAvailable: false, timeSlots: [] }  // Sat
    ] as any;

    this.staffAvailability.set('user_accountant_desmond', {
      id: 'avail_desmond',
      staffId: 'user_accountant_desmond',
      staffName: 'Desmond Hinds',
      staffRole: 'founder',
      timeZone: 'America/New_York',
      isFounder: true,
      weeklySchedule: standardWeekSchedule,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 15,
      minNoticeHours: 12,
      maxAdvanceDays: 60,
      maxDailyAppointments: 6,
      maxWeeklyAppointments: 25,
      virtualEnabled: true,
      telephoneEnabled: true,
      officeEnabled: true,
      officeLocation: 'Columbia Executive Office',
      founderControls: {
        acceptsNewClients: true,
        existingClientsOnly: false,
        referralRequired: false,
        adminApprovalRequired: false,
        paidConsultationRequired: true,
        consultationFeeCents: 15000,
        priorityClientAccess: true,
        maxMeetingsPerDay: 5,
        autoNextAvailableFallback: true
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z'
    });

    this.staffAvailability.set('user_accountant_marcus', {
      id: 'avail_marcus',
      staffId: 'user_accountant_marcus',
      staffName: 'Marcus Vance',
      staffRole: 'accountant',
      timeZone: 'America/New_York',
      isFounder: false,
      weeklySchedule: standardWeekSchedule,
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 10,
      minNoticeHours: 6,
      maxAdvanceDays: 45,
      maxDailyAppointments: 8,
      maxWeeklyAppointments: 32,
      virtualEnabled: true,
      telephoneEnabled: true,
      officeEnabled: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z'
    });

    this.staffAvailability.set('user_reviewer_elena', {
      id: 'avail_elena',
      staffId: 'user_reviewer_elena',
      staffName: 'Elena Rostova, CPA',
      staffRole: 'reviewer',
      timeZone: 'America/New_York',
      isFounder: false,
      weeklySchedule: standardWeekSchedule,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 15,
      minNoticeHours: 24,
      maxAdvanceDays: 30,
      maxDailyAppointments: 5,
      maxWeeklyAppointments: 20,
      virtualEnabled: true,
      telephoneEnabled: true,
      officeEnabled: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z'
    });

    // Seed Calendar Connections
    this.calendarConnections.set('conn_desmond_google', {
      id: 'conn_desmond_google',
      staffId: 'user_accountant_desmond',
      staffName: 'Desmond Hinds',
      provider: 'google_calendar',
      status: 'connected',
      providerAccountEmail: 'dhinds@artaxservices.com',
      selectedCalendarId: 'primary',
      selectedCalendarName: 'Desmond Hinds (Work)',
      syncFreeBusyOnly: true,
      twoWaySyncEnabled: true,
      lastSuccessfulSync: '2026-09-10T10:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-09-10T10:00:00Z'
    });

    // Seed sample external busy blocks (Details strictly masked as "Unavailable" per privacy mandate)
    this.calendarBusyBlocks.set('block_001', {
      id: 'block_001',
      staffId: 'user_accountant_desmond',
      source: 'google',
      startUtc: '2026-09-15T14:00:00Z',
      endUtc: '2026-09-15T15:00:00Z',
      isAllDay: false,
      displayLabel: 'Unavailable'
    });

    // Seed initial clientOnboarding for Michael Perotti
    this.clientOnboarding.set('user_client_1', {
      id: 'conb_001',
      clientId: 'user_client_1',
      status: 'active_client',
      currentSection: 'I',
      percentComplete: 100,
      identityContact: {
        legalFirstName: 'Michael',
        legalLastName: 'Perotti',
        preferredName: 'Mike',
        email: 'm.perotti@example.com',
        mobilePhone: '803-555-0142',
        residentialAddress: {
          street: '1201 Main St',
          city: 'Columbia',
          state: 'SC',
          zip: '29201',
          country: 'United States'
        },
        mailingAddressSameAsResidential: true,
        preferredLanguage: 'English',
        preferredChannel: 'portal',
        timeZone: 'America/New_York'
      },
      entityClassification: {
        isBusiness: true,
        legalEntityName: 'Perotti Financial Consulting LLC',
        dbaName: 'Perotti Advisory',
        entityType: 'llc',
        dateEstablished: '2020-04-15',
        formationState: 'SC',
        statesOfOperation: ['SC', 'NC', 'GA'],
        hasExistingAccountant: false
      },
      taxProfile: {
        requestedTaxYear: 2025,
        filingStatus: 'married_filing_jointly',
        dependentsCount: 2,
        incomeCategories: ['w2', '1099_nec', 'k1'],
        selfEmploymentActivity: true,
        rentalPropertiesCount: 0,
        investmentActivity: true,
        foreignIncomeOrAccounts: false,
        digitalAssetActivity: false,
        madeEstimatedTaxPayments: true,
        estimatedPaymentsAmount: 18000,
        priorYearReturnAvailable: true,
        hasIrsOrStateNotices: false,
        outstandingTaxBalances: false,
        extensionOrAmendedRequired: false,
        multiStateFilingRequired: true,
        multiStatesList: ['SC', 'NC']
      },
      accountingRequirements: {
        bookkeepingRequired: true,
        frequency: 'monthly',
        accountingSoftware: 'quickbooks_online',
        payrollSupportRequired: true,
        salesTaxFilingRequired: false,
        accountsPayableRequired: true,
        accountsReceivableRequired: true,
        financialReportingRequired: true,
        bankReconciliationRequired: true,
        cleanupOrCatchupNeeded: false,
        businessAdvisoryRequired: true
      },
      serviceSelection: {
        selectedServices: ['individual_tax_1040', 'business_tax_scorp_llc', 'bookkeeping_monthly']
      },
      documentChecklist: [
        { id: 'chk_1', category: 'government_id', name: "Driver's License / Passport", description: 'State-issued photo ID', required: true, status: 'verified' },
        { id: 'chk_2', category: 'prior_returns', name: '2024 Federal Tax Return', description: 'Form 1040 and 1120-S with all schedules', required: true, status: 'verified' },
        { id: 'chk_3', category: 'wage_forms', name: '2025 Form W-2 & 1099-NEC', description: 'Wage and non-employee slips', required: true, status: 'verified' }
      ],
      consultationPreferences: {
        serviceRequired: 'business_tax_scorp_llc',
        preferredProfessional: 'founder',
        meetingType: 'virtual',
        preferredTimeZone: 'America/New_York'
      },
      engagementConsent: {
        engagementLetterAcknowledged: true,
        scopeAcknowledged: true,
        pricingAcknowledged: true,
        privacyNoticeAcknowledged: true,
        electronicConsentAcknowledged: true,
        retentionPolicyAcknowledged: true,
        electronicSignatureName: 'Michael Perotti',
        signatureTimestamp: '2025-11-12T10:30:00Z',
        policyVersion: '2026.1'
      },
      reviewSubmission: {
        submittedAt: '2025-11-12T10:35:00Z',
        reviewedByStaffId: 'user_accountant_desmond',
        reviewedAt: '2025-11-12T11:00:00Z',
        staffDecision: 'approved',
        lockedForClient: true
      },
      createdAt: '2025-11-12T10:00:00Z',
      updatedAt: '2025-11-12T11:00:00Z'
    });

    // Seed U.S. Client Intake Dossiers
    this.clientIntakeDossiers.set(INITIAL_CLIENT_INTAKE_DOSSIER.clientId, { ...INITIAL_CLIENT_INTAKE_DOSSIER });

    // Seed Accounting Staging Records
    INITIAL_ACCOUNTING_STAGING_RECORDS.forEach(rec => {
      this.accountingStagingRecords.set(rec.id, { ...rec });
    });

    // Seed Governed Tax Research Rules
    INITIAL_GOVERNED_RESEARCH_RULES.forEach(rule => {
      this.governedResearchRules.set(rule.id, { ...rule });
    });
  }

  // -----------------------------------------------------------------
  // HELPER METHODS: Accountant-Client Bindings & Workspaces
  // -----------------------------------------------------------------

  isAccountantAssignedToClient(accountantId: string, clientId: string): boolean {
    for (const binding of this.clientAccountantAssignments.values()) {
      if (
        binding.accountantId === accountantId &&
        binding.clientId === clientId &&
        binding.status === 'active'
      ) {
        return true;
      }
    }
    return false;
  }

  hasPermissionScope(accountantId: string, clientId: string, scope: PermissionScope): boolean {
    for (const binding of this.clientAccountantAssignments.values()) {
      if (
        binding.accountantId === accountantId &&
        binding.clientId === clientId &&
        binding.status === 'active'
      ) {
        return binding.accessScope.includes(scope);
      }
    }
    return false;
  }

  getAccountantBindings(accountantId: string): ClientAccountantBinding[] {
    return Array.from(this.clientAccountantAssignments.values()).filter(
      b => b.accountantId === accountantId
    );
  }

  getClientBindings(clientId: string): ClientAccountantBinding[] {
    return Array.from(this.clientAccountantAssignments.values()).filter(
      b => b.clientId === clientId
    );
  }

  hasDuplicateActiveAssignment(clientId: string, accountantId: string, assignmentType: string): boolean {
    for (const binding of this.clientAccountantAssignments.values()) {
      if (
        binding.clientId === clientId &&
        binding.accountantId === accountantId &&
        binding.assignmentType === assignmentType &&
        (binding.status === 'active' || binding.status === 'pending')
      ) {
        return true;
      }
    }
    return false;
  }

  // Audit Log recording (Immutable)
  logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>) {
    const log: AuditLog = {
      id: `aud_${randomUUID()}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.auditLogs.unshift(log);
    // Keep max 500 in memory
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    return log;
  }

  // Security event recording
  logSecurityEvent(event: Omit<SecurityEventRecord, 'id' | 'timestamp'>) {
    const secEvent: SecurityEventRecord = {
      id: `sec_${randomUUID()}`,
      timestamp: new Date().toISOString(),
      ...event
    };
    this.securityEvents.unshift(secEvent);
    return secEvent;
  }

  // -------------------------------------------------------------
  // CONCURRENCY & SLOT HOLD METHODS (PART 7 & 11)
  // -------------------------------------------------------------

  cleanExpiredSlotHolds() {
    const now = Date.now();
    for (const [key, hold] of this.appointmentSlotHolds.entries()) {
      if (hold.expiresAtMs < now) {
        this.appointmentSlotHolds.delete(key);
      }
    }
  }

  createSlotHold(
    staffId: string,
    startUtc: string,
    endUtc: string,
    clientId: string,
    serviceType: string,
    idempotencyKey: string
  ): { success: boolean; hold?: AppointmentSlotHold; error?: string } {
    this.cleanExpiredSlotHolds();
    const slotKey = `${staffId}_${startUtc}`;

    // Check if appointment already confirmed
    const existingApt = Array.from(this.appointments.values()).find(
      a => a.accountantId === staffId && a.date === startUtc.slice(0, 10) && (a.status === 'confirmed' || a.status === 'pending')
    );
    if (existingApt && (existingApt as any).startUtc === startUtc) {
      return { success: false, error: 'This time slot is already confirmed by another client.' };
    }

    // Check existing hold
    const existingHold = this.appointmentSlotHolds.get(slotKey);
    if (existingHold) {
      if (existingHold.idempotencyKey === idempotencyKey && existingHold.clientId === clientId) {
        return { success: true, hold: existingHold };
      }
      if (existingHold.expiresAtMs > Date.now()) {
        return { success: false, error: 'This time slot is currently on hold by another client. Please select another slot.' };
      }
    }

    const hold: AppointmentSlotHold = {
      id: `hold_${randomUUID()}`,
      slotKey,
      staffId,
      clientId,
      serviceType,
      startUtc,
      endUtc,
      idempotencyKey,
      expiresAtMs: Date.now() + 10 * 60 * 1000, // 10 minute hold
      createdAt: new Date().toISOString()
    };

    this.appointmentSlotHolds.set(slotKey, hold);
    return { success: true, hold };
  }

  releaseSlotHold(slotKey: string) {
    this.appointmentSlotHolds.delete(slotKey);
  }

  logAuditEvent(actorId: string, actorRole: string, eventType: string, targetResource: string, targetId?: string, metadata?: any, ipAddress: string = '127.0.0.1') {
    const event = {
      id: `evt_${randomUUID()}`,
      eventType,
      actorId,
      actorRole,
      targetResource,
      targetId,
      metadata,
      ipAddress,
      timestamp: new Date().toISOString()
    };
    this.auditEvents.unshift(event);
    if (this.auditEvents.length > 1000) this.auditEvents.pop();
    return event;
  }
}

export const db = new Database();
