/**
 * A/R Tax Services, LLC - Role-Based Demonstration Environment
 * Central Type Definitions and Contracts
 */

export const APP_MODE = 'demo' as const;

export type DemoRole = 
  | 'client'
  | 'intake'
  | 'bookkeeper'
  | 'payroll'
  | 'accountant'
  | 'reviewer'
  | 'advisor'
  | 'billing'
  | 'compliance'
  | 'operations'
  | 'admin'
  | 'executive'
  | 'reception'
  | 'engagement-manager'
  | 'verification'
  | 'documents'
  | 'data-entry'
  | 'accounts-payable'
  | 'accounts-receivable'
  | 'quality-control'
  | 'filing'
  | 'acknowledgements'
  | 'correspondence'
  | 'resolution'
  | 'audit'
  | 'amendments'
  | 'records'
  | 'client-success'
  | 'support';

export interface DemoRoleConfig {
  role: DemoRole;
  title: string;
  department: string;
  loginPath: string;
  dashboardPath: string;
  sampleUser: {
    id: string;
    name: string;
    title: string;
    email: string;
  };
  description: string;
}

export const DEMO_ROLES: Record<DemoRole, DemoRoleConfig> = {
  client: {
    role: 'client',
    title: 'Client / Taxpayer',
    department: 'Taxpayer Portal',
    loginPath: '/client/login',
    dashboardPath: '/client/dashboard',
    sampleUser: {
      id: 'usr_client_perotti',
      name: 'Michael Perotti',
      title: 'Managing Principal, Perotti Holdings',
      email: 'm.perotti@example.com'
    },
    description: 'Participate in document collection, questionnaires, review prepared returns, e-signatures, fee payments, and notices.'
  },
  intake: {
    role: 'intake',
    title: 'Intake & Client Services',
    department: 'Client Relations & Onboarding',
    loginPath: '/intake/login',
    dashboardPath: '/intake/dashboard',
    sampleUser: {
      id: 'usr_intake_taylor',
      name: 'Taylor Brooks',
      title: 'Client Intake Coordinator',
      email: 't.brooks@artaxservices.com'
    },
    description: 'Manage prospective leads, conflict checks, client qualification, onboarding checklists, engagement proposals, and scheduling.'
  },
  bookkeeper: {
    role: 'bookkeeper',
    title: 'Bookkeeper',
    department: 'Accounting & Bookkeeping Services',
    loginPath: '/bookkeeping/login',
    dashboardPath: '/bookkeeping/dashboard',
    sampleUser: {
      id: 'usr_bk_samuel',
      name: 'Samuel Rivera',
      title: 'Senior Bookkeeper',
      email: 's.rivera@artaxservices.com'
    },
    description: 'Chart of accounts, transaction categorization, bank feeds, accounts payable/receivable, and reconciliation preparation.'
  },
  payroll: {
    role: 'payroll',
    title: 'Payroll Specialist',
    department: 'Payroll & Compliance',
    loginPath: '/payroll/login',
    dashboardPath: '/payroll/dashboard',
    sampleUser: {
      id: 'usr_pay_morgan',
      name: 'Morgan Vance',
      title: 'Payroll Compliance Specialist',
      email: 'm.vance@artaxservices.com'
    },
    description: 'Employee/contractor records, compensation schedules, payroll calculations, quarterly payroll returns (941/940), and W-2/1099 filing preparation.'
  },
  accountant: {
    role: 'accountant',
    title: 'Accountant / Tax Preparer',
    department: 'Tax Preparation & Accounting',
    loginPath: '/accountant/login',
    dashboardPath: '/accountant/dashboard',
    sampleUser: {
      id: 'usr_acc_marcus',
      name: 'Marcus Vance, EA',
      title: 'Senior Tax Preparer',
      email: 'm.vance.ea@artaxservices.com'
    },
    description: 'Trial balance mapping, Form 1040/1065/1120-S workpapers, book-to-tax adjustments, depreciation, and return preparation.'
  },
  reviewer: {
    role: 'reviewer',
    title: 'Senior Reviewer / CPA / EA',
    department: 'Quality Control & Final Review',
    loginPath: '/reviewer/login',
    dashboardPath: '/reviewer/dashboard',
    sampleUser: {
      id: 'usr_rev_elena',
      name: 'Elena Rostova, CPA',
      title: 'Director of Tax Review & Compliance',
      email: 'e.rostova@artaxservices.com'
    },
    description: 'Maker-checker audit gates, source-to-return traceability, technical tax positions, period-lock approval, and return release certification.'
  },
  advisor: {
    role: 'advisor',
    title: 'Tax Strategy & Advisory',
    department: 'Strategic Advisory & Wealth Planning',
    loginPath: '/advisor/login',
    dashboardPath: '/advisor/dashboard',
    sampleUser: {
      id: 'usr_adv_desmond',
      name: 'Desmond Hinds, MSA',
      title: 'Founder & Principal Tax Strategist',
      email: 'd.hinds@artaxservices.com'
    },
    description: 'Scenario modeling, entity selection, R&D credits, state tax nexus, cash-flow forecasting, and client wealth action plans.'
  },
  billing: {
    role: 'billing',
    title: 'Billing & Collections',
    department: 'Firm Billing & Accounts Receivable',
    loginPath: '/billing/login',
    dashboardPath: '/billing/dashboard',
    sampleUser: {
      id: 'usr_bill_claire',
      name: 'Claire Dupont',
      title: 'Billing & Collections Manager',
      email: 'c.dupont@artaxservices.com'
    },
    description: 'Engagement pricing, retainers, invoices, simulated payment confirmations, accounts receivable aging, and fee collection tracking.'
  },
  compliance: {
    role: 'compliance',
    title: 'Compliance & Security',
    department: 'Governance, Risk & Information Security',
    loginPath: '/compliance/login',
    dashboardPath: '/compliance/dashboard',
    sampleUser: {
      id: 'usr_comp_arthur',
      name: 'Arthur Sterling, CISA',
      title: 'Chief Compliance & Security Officer',
      email: 'a.sterling@artaxservices.com'
    },
    description: 'Section 7216 consent registry, PTIN/EFIN tracking, access reviews, audit logs, retention schedules, and AI processing governance.'
  },
  operations: {
    role: 'operations',
    title: 'Firm Operations Manager',
    department: 'Practice Operations & Resource Planning',
    loginPath: '/operations/login',
    dashboardPath: '/operations/dashboard',
    sampleUser: {
      id: 'usr_ops_patricia',
      name: 'Patricia Chen',
      title: 'Director of Firm Operations',
      email: 'p.chen@artaxservices.com'
    },
    description: 'Firmwide workflow board, staff capacity, bottleneck alerts, deadline calendars, service-level monitoring, and filing season command center.'
  },
  admin: {
    role: 'admin',
    title: 'Administrator',
    department: 'System Administration & IT Governance',
    loginPath: '/admin/login',
    dashboardPath: '/admin/dashboard',
    sampleUser: {
      id: 'usr_adm_greg',
      name: 'Gregory Scott',
      title: 'Senior Systems Administrator',
      email: 'g.scott@artaxservices.com'
    },
    description: 'User access controls, temporary access management, route permissions, integration registry, system health, and demo data management.'
  },
  executive: {
    role: 'executive',
    title: 'Firm Owner / Executive',
    department: 'Executive Leadership & Strategy',
    loginPath: '/executive/login',
    dashboardPath: '/executive/dashboard',
    sampleUser: {
      id: 'usr_exec_desmond',
      name: 'Desmond Hinds, Founder',
      title: 'Managing Principal & Firm Owner',
      email: 'founder@artaxservices.com'
    },
    description: 'Executive KPIs, firm revenue, work-in-progress, staff utilization, client retention, filing season metrics, and strategic growth.'
  },
  reception: {
    role: 'reception',
    title: 'Reception & Scheduling',
    department: 'Front Office & Client Intake Scheduling',
    loginPath: '/reception/login',
    dashboardPath: '/reception/dashboard',
    sampleUser: {
      id: 'usr_rec_alicia',
      name: 'Alicia Mendoza',
      title: 'Client Reception & Scheduling Coordinator',
      email: 'a.mendoza@artaxservices.com'
    },
    description: 'Receive inquiries, register prospective clients, maintain inquiry source, schedule consultations, manage appointments and callback queues.'
  },
  'engagement-manager': {
    role: 'engagement-manager',
    title: 'Engagement Manager',
    department: 'Practice Operations & Engagement Management',
    loginPath: '/engagement-manager/login',
    dashboardPath: '/engagement-manager/dashboard',
    sampleUser: {
      id: 'usr_eng_brandon',
      name: 'Brandon Cole',
      title: 'Senior Engagement Manager',
      email: 'b.cole@artaxservices.com'
    },
    description: 'Convert accepted proposals into engagements, assign engagement IDs, configure jurisdictions and deadlines, manage scope and change orders.'
  },
  verification: {
    role: 'verification',
    title: 'Identity & Client Verification Specialist',
    department: 'KYC & Client Identity Verification',
    loginPath: '/verification/login',
    dashboardPath: '/verification/dashboard',
    sampleUser: {
      id: 'usr_ver_claudia',
      name: 'Claudia Vance',
      title: 'Identity & Verification Specialist',
      email: 'c.vance@artaxservices.com'
    },
    description: 'Review identity submissions, entity formation documents, address matching, EIN verification, ownership % and dependent records.'
  },
  documents: {
    role: 'documents',
    title: 'Document Intake & Records Specialist',
    department: 'Document Operations & Records Management',
    loginPath: '/documents/login',
    dashboardPath: '/documents/dashboard',
    sampleUser: {
      id: 'usr_doc_derek',
      name: 'Derek Shaw',
      title: 'Document Intake Specialist',
      email: 'd.shaw@artaxservices.com'
    },
    description: 'Review uploaded files, split packages, detect duplicates, classify tax forms/notices, index documents and maintain chain of custody.'
  },
  'data-entry': {
    role: 'data-entry',
    title: 'Accounting Data Entry Specialist',
    department: 'Bookkeeping Data Operations',
    loginPath: '/data-entry/login',
    dashboardPath: '/data-entry/dashboard',
    sampleUser: {
      id: 'usr_ent_fiona',
      name: 'Fiona Gallagher',
      title: 'Accounting Data Entry Specialist',
      email: 'f.gallagher@artaxservices.com'
    },
    description: 'Enter cash transactions, bills, deposits, vendor/customer records, match source receipts, mileage logs, and submit batches to Bookkeeping.'
  },
  'accounts-payable': {
    role: 'accounts-payable',
    title: 'Accounts Payable Specialist',
    department: 'Accounts Payable & Vendor Disbursements',
    loginPath: '/accounts-payable/login',
    dashboardPath: '/accounts-payable/dashboard',
    sampleUser: {
      id: 'usr_ap_grant',
      name: 'Grant Holloway',
      title: 'Accounts Payable Specialist',
      email: 'g.holloway@artaxservices.com'
    },
    description: 'Receive vendor bills, detect duplicate invoices, suggest expense coding, prepare payment batches, AP aging, and track W-9/1099 compliance.'
  },
  'accounts-receivable': {
    role: 'accounts-receivable',
    title: 'Accounts Receivable Specialist',
    department: 'Client Billing & Collections',
    loginPath: '/accounts-receivable/login',
    dashboardPath: '/accounts-receivable/dashboard',
    sampleUser: {
      id: 'usr_ar_heather',
      name: 'Heather Lin',
      title: 'Accounts Receivable Specialist',
      email: 'h.lin@artaxservices.com'
    },
    description: 'Prepare client invoices, apply retainers, record simulated payments, track AR aging, send reminders, and manage payment plans.'
  },
  'quality-control': {
    role: 'quality-control',
    title: 'Quality Control Specialist',
    department: 'Quality Assurance & Technical Review',
    loginPath: '/quality-control/login',
    dashboardPath: '/quality-control/dashboard',
    sampleUser: {
      id: 'usr_qc_isabel',
      name: 'Isabel Thorpe',
      title: 'Quality Control Specialist',
      email: 'i.thorpe@artaxservices.com'
    },
    description: 'Inspect completed accounting/tax workpapers, verify source-to-return traceability, confirm maker-checker separation, and verify release gates.'
  },
  filing: {
    role: 'filing',
    title: 'ERO & Filing Specialist',
    department: 'Electronic Filing & ERO Operations',
    loginPath: '/filing/login',
    dashboardPath: '/filing/dashboard',
    sampleUser: {
      id: 'usr_ero_julian',
      name: 'Julian Mercer, ERO',
      title: 'Filing & ERO Operations Manager',
      email: 'j.mercer@artaxservices.com'
    },
    description: 'Verify 7-point release gates, run schema diagnostics, create submission batches, transmit returns (simulated), and track submission IDs.'
  },
  acknowledgements: {
    role: 'acknowledgements',
    title: 'Government Acknowledgement Specialist',
    department: 'Government Transmissions & Acknowledgements',
    loginPath: '/acknowledgements/login',
    dashboardPath: '/acknowledgements/dashboard',
    sampleUser: {
      id: 'usr_ack_kendra',
      name: 'Kendra Washington',
      title: 'Government Acknowledgement Specialist',
      email: 'k.washington@artaxservices.com'
    },
    description: 'Receive simulated federal & state acknowledgements, match submission IDs, record acceptances/rejections, and route correction cases.'
  },
  correspondence: {
    role: 'correspondence',
    title: 'Government Correspondence & Notice Specialist',
    department: 'Tax Agency Correspondence & Notice Defense',
    loginPath: '/correspondence/login',
    dashboardPath: '/correspondence/dashboard',
    sampleUser: {
      id: 'usr_cor_liam',
      name: 'Liam O’Connor',
      title: 'Notice & Correspondence Specialist',
      email: 'l.oconnor@artaxservices.com'
    },
    description: 'Log IRS/state notices, classify notice types, compare against acknowledgements, draft response cases, and manage deadlines.'
  },
  resolution: {
    role: 'resolution',
    title: 'Tax Resolution & Representation Specialist',
    department: 'Tax Resolution & Controversy Practice',
    loginPath: '/resolution/login',
    dashboardPath: '/resolution/dashboard',
    sampleUser: {
      id: 'usr_res_miranda',
      name: 'Miranda Cruz, EA',
      title: 'Tax Resolution Specialist',
      email: 'm.cruz.ea@artaxservices.com'
    },
    description: 'Form 2848 representation, transcript analysis, penalty abatement, installment agreements, OIC, lien/levy relief, and appeal hearings.'
  },
  audit: {
    role: 'audit',
    title: 'Audit & Examination Specialist',
    department: 'Tax Audit Representation & Defense',
    loginPath: '/audit/login',
    dashboardPath: '/audit/dashboard',
    sampleUser: {
      id: 'usr_aud_nathan',
      name: 'Nathaniel Drake, CPA',
      title: 'Audit Defense Specialist',
      email: 'n.drake.cpa@artaxservices.com'
    },
    description: 'Manage examination cases, track Information Document Requests (IDRs), issue workpapers, examiner meetings, and protest/appeals.'
  },
  amendments: {
    role: 'amendments',
    title: 'Amendment & Correction Specialist',
    department: 'Tax Amendments & Corrective Filings',
    loginPath: '/amendments/login',
    dashboardPath: '/amendments/dashboard',
    sampleUser: {
      id: 'usr_amd_olivia',
      name: 'Olivia Sterling',
      title: 'Amendment Specialist',
      email: 'o.sterling@artaxservices.com'
    },
    description: 'Receive amendment requests, preserve original filed returns, compare original vs amended amounts, route to preparer and reviewer.'
  },
  records: {
    role: 'records',
    title: 'Records & Archive Manager',
    department: 'Records Governance & Digital Archive',
    loginPath: '/records/login',
    dashboardPath: '/records/dashboard',
    sampleUser: {
      id: 'usr_rec_preston',
      name: 'Preston Bailey',
      title: 'Records & Archive Manager',
      email: 'p.bailey@artaxservices.com'
    },
    description: 'Receive completed engagements, verify archive checklists, preserve final returns, apply 7-year retention schedules, and roll forward.'
  },
  'client-success': {
    role: 'client-success',
    title: 'Client Success & Annual Renewal Specialist',
    department: 'Client Success & Account Retention',
    loginPath: '/client-success/login',
    dashboardPath: '/client-success/dashboard',
    sampleUser: {
      id: 'usr_cs_quinn',
      name: 'Quinn Adams',
      title: 'Client Success Specialist',
      email: 'q.adams@artaxservices.com'
    },
    description: 'Deliver completed records, post-engagement surveys, service feedback, annual renewals, recurring CAS enrollment, and workflow reactivation.'
  },
  support: {
    role: 'support',
    title: 'IT & Application Support Specialist',
    department: 'Information Technology & User Support',
    loginPath: '/support/login',
    dashboardPath: '/support/dashboard',
    sampleUser: {
      id: 'usr_sup_ross',
      name: 'Ross Martinez',
      title: 'Application Support Specialist',
      email: 'r.martinez@artaxservices.com'
    },
    description: 'Technical support tickets, login issues, session resets, sanitized error monitoring, system announcements, and mock service status.'
  }
};

/**
 * The 18 Unified Stages of the Complete Operating Cycle
 * Onboard → Collect → Validate → Record → Reconcile → Review → Report → Plan → Prepare Taxes → Approve → Sign → File → Government Feedback → Resolve → Monitor → Archive → Renew → Repeat
 */
export type WorkCycleStage = 
  | 'Onboard'
  | 'Collect'
  | 'Validate'
  | 'Record'
  | 'Reconcile'
  | 'Review'
  | 'Report'
  | 'Plan'
  | 'Prepare Taxes'
  | 'Approve'
  | 'Sign'
  | 'File'
  | 'Government Feedback'
  | 'Resolve'
  | 'Monitor'
  | 'Archive'
  | 'Renew'
  | 'Repeat';

export const WORK_CYCLE_STAGES: WorkCycleStage[] = [
  'Onboard',
  'Collect',
  'Validate',
  'Record',
  'Reconcile',
  'Review',
  'Report',
  'Plan',
  'Prepare Taxes',
  'Approve',
  'Sign',
  'File',
  'Government Feedback',
  'Resolve',
  'Monitor',
  'Archive',
  'Renew',
  'Repeat'
];

/**
 * 30 Unified Statuses
 */
export type UnifiedStatus = 
  | 'New Lead'
  | 'Consultation Scheduled'
  | 'Proposal Sent'
  | 'Engagement Accepted'
  | 'Identity Verification'
  | 'Onboarding'
  | 'Awaiting Documents'
  | 'Collection in Progress'
  | 'Recording Transactions'
  | 'Reconciliation in Progress'
  | 'Accounting Review'
  | 'Reports Ready'
  | 'Planning in Progress'
  | 'Tax Preparation'
  | 'Awaiting Client Information'
  | 'Senior Review'
  | 'Corrections Required'
  | 'Ready for Client Review'
  | 'Awaiting Signature'
  | 'Awaiting Payment'
  | 'Ready to File'
  | 'Submitted—Awaiting Acknowledgement'
  | 'Accepted—Simulated'
  | 'Rejected—Simulated Action Required'
  | 'Monitoring'
  | 'Completed'
  | 'Archived'
  | 'Rolled Forward'
  | 'Amendment Open'
  | 'Notice or Audit Open';

export const UNIFIED_STATUSES: UnifiedStatus[] = [
  'New Lead',
  'Consultation Scheduled',
  'Proposal Sent',
  'Engagement Accepted',
  'Identity Verification',
  'Onboarding',
  'Awaiting Documents',
  'Collection in Progress',
  'Recording Transactions',
  'Reconciliation in Progress',
  'Accounting Review',
  'Reports Ready',
  'Planning in Progress',
  'Tax Preparation',
  'Awaiting Client Information',
  'Senior Review',
  'Corrections Required',
  'Ready for Client Review',
  'Awaiting Signature',
  'Awaiting Payment',
  'Ready to File',
  'Submitted—Awaiting Acknowledgement',
  'Accepted—Simulated',
  'Rejected—Simulated Action Required',
  'Monitoring',
  'Completed',
  'Archived',
  'Rolled Forward',
  'Amendment Open',
  'Notice or Audit Open'
];

export interface DemoClient {
  id: string;
  name: string;
  businessName?: string;
  entityType: 'Individual' | 'Sole Proprietorship' | 'Partnership' | 'S Corporation' | 'C Corporation' | 'Nonprofit';
  einOrSsnMasked: string;
  email: string;
  phone: string;
  address: string;
  primaryJurisdiction: string;
  secondaryJurisdictions?: string[];
  assignedAccountantId: string;
  assignedAccountantName: string;
  assignedReviewerId: string;
  assignedReviewerName: string;
  status: UnifiedStatus;
  riskScore: 'Low' | 'Medium' | 'High';
  hasActiveNotice?: boolean;
  hasOpenAmendment?: boolean;
}

export interface DemoEngagement {
  id: string;
  clientId: string;
  clientName: string;
  businessName?: string;
  entityType: DemoClient['entityType'];
  taxYear: number;
  jurisdiction: string;
  formType: string;
  currentStage: WorkCycleStage;
  currentStatus: UnifiedStatus;
  assignedStaff: string;
  assignedPreparerId: string;
  assignedReviewerId: string;
  completionPercentage: number;
  statutoryDeadline: string;
  internalDeadline: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  missingRequirements: string[];
  lastActivity: string;
  nextAction: string;
  clientResponsibility: string;
  staffResponsibility: string;
  approvalState: 'Pending Preparation' | 'Pending Review' | 'Corrections Required' | 'Reviewer Approved' | 'Client Approved' | 'Signed & Ready to File' | 'Filed (Simulated)';
  feeAmount: number;
  feeStatus: 'Unbilled' | 'Invoiced' | 'Paid (Simulated)' | 'Overdue';
  isArchived?: boolean;
  isRolledForward?: boolean;
}

export interface DemoDocument {
  id: string;
  clientId: string;
  engagementId?: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  category: string;
  taxYear: number;
  uploadedAt: string;
  uploadedBy: string;
  sha256Hash: string;
  malwareScanStatus: 'clean (simulated)' | 'suspicious (simulated)' | 'pending (simulated)';
  status: 'Pending Review' | 'Verified' | 'Clarification Requested' | 'Archived';
  notes?: string;
}

export interface DemoTransaction {
  id: string;
  clientId: string;
  clientName?: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  category: string;
  confidence: number;
  account: string;
  status: 'Matched' | 'Needs Review' | 'Categorized' | 'Exception';
  receiptAttached: boolean;
}

export interface DemoReconciliationItem {
  id: string;
  clientId: string;
  accountName: string;
  statementDate: string;
  statementBalance: number;
  bookBalance: number;
  difference: number;
  status: 'In Progress' | 'Balanced' | 'Exceptions Exist' | 'Prepared (Awaiting Review)' | 'Approved by CPA';
  preparedBy?: string;
  preparedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface DemoPayrollRecord {
  id: string;
  clientId: string;
  payPeriod: string;
  payDate: string;
  employeeCount: number;
  contractorCount: number;
  grossPay: number;
  federalWithholding: number;
  ficaWithholding: number;
  stateWithholding: number;
  netPay: number;
  status: 'Draft' | 'Calculated (Simulated)' | 'Review Required' | 'Approved' | 'Direct Deposit (Simulated)';
}

export interface DemoTaxWorkpaper {
  id: string;
  engagementId: string;
  clientId: string;
  title: string;
  section: string;
  formLine: string;
  bookAmount: number;
  taxAdjustment: number;
  taxAmount: number;
  notes: string;
  preparedBy: string;
  reviewedBy?: string;
  status: 'In Prep' | 'Needs Info' | 'Ready for Review' | 'Reviewer Approved';
}

export interface DemoAdvisoryCase {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  taxYear: number;
  jurisdiction: string;
  assumptions: string;
  sourceInformation: string;
  estimatedImpact: string;
  confidence: number;
  requiredProfessionalReview: string;
  clientAction: string;
  dueDate: string;
  status: 'Draft' | 'Presented' | 'Client Accepted' | 'Implemented';
}

export interface DemoInvoice {
  id: string;
  clientId: string;
  clientName: string;
  engagementId?: string;
  invoiceNumber: string;
  description?: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  balanceDue: number;
  status: 'Draft' | 'Sent' | 'Paid (Simulated)' | 'Overdue';
  items: Array<{ description: string; hours?: number; rate?: number; total: number }>;
}

export interface DemoAuditEvent {
  id: string;
  timestamp: string;
  user: string;
  role: DemoRole;
  action: string;
  record: string;
  result: 'Success (Simulated)' | 'Denied (Simulated)' | 'Warning (Simulated)';
  reason?: string;
  previousValue?: string;
  newValue?: string;
  sessionId?: string;
}

export interface IntegrationRegistryItem {
  id: string;
  name: string;
  category: 'Cloud Database' | 'Identity' | 'AI & OCR' | 'Accounting Feeds' | 'Payroll & Banking' | 'Payment Gateway' | 'E-Signature' | 'IRS & Government E-File' | 'Communications';
  businessPurpose: string;
  currentStatus: 'Not Configured';
  requiredCredentials: string[];
  requiredAuthorization: string;
  dataExchanged: string;
  webhookRequirement: string;
  securityReviewStatus: 'Pending Phase 2 Architecture Review';
  productionReadiness: 'Planned Future Integration';
}

export interface DemoAiResponse {
  id: string;
  role: DemoRole;
  assistantTitle: string;
  prompt: string;
  summary: string;
  details: string[];
  sourceRecords: string[];
  confidence: number;
  assumptions: string[];
  humanReviewRequirement: string;
  timestamp: string;
}

/**
 * Cross-Role Handoff Engine
 * Prompt Section 7 requirement
 */
export interface DemoHandoff {
  id: string;
  client: string;
  entity: string;
  engagement: string;
  taxYear: number;
  jurisdiction: string;
  fromRole: DemoRole;
  toRole: DemoRole;
  currentStage: WorkCycleStage;
  reason: string;
  requiredAction: string;
  requiredDocuments: string[];
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  internalDeadline: string;
  statutoryDeadline: string;
  handoffNotes: string;
  acceptanceStatus: 'Pending' | 'Accepted' | 'Rejected' | 'Escalated';
  acceptedBy?: string;
  acceptedTimestamp?: string;
  rejectionReason?: string;
  escalationStatus?: string;
}

/**
 * Government Agency and Authority Registry
 * Prompt Section 8 requirement
 */
export interface GovernmentAgencyAuthority {
  id: string;
  agencyName: string;
  jurisdiction: string;
  agencyType: 'Federal' | 'State Department of Revenue' | 'State Workforce / Unemployment' | 'State Sales Tax' | 'Local / Municipal' | 'Secretary of State';
  returnOrNoticeTypes: string[];
  filingMethod: string;
  paymentMethod: string;
  acknowledgementMethod: string;
  contactInformation: string;
  integrationStatus: 'Not Configured';
  requiredAuthorization: string;
  responsibleStaffRole: DemoRole;
  lastConfigurationReviewDate: string;
}

/**
 * Government Feedback Lifecycle (22 states)
 * Prompt Section 9 requirement
 */
export type GovernmentFeedbackState = 
  | 'Ready for Submission'
  | 'Final Validation'
  | 'Authorized for Submission'
  | 'Submitted—Simulated'
  | 'Awaiting Acknowledgement—Simulated'
  | 'Accepted—Simulated'
  | 'Rejected—Simulated'
  | 'Partially Accepted—Simulated'
  | 'Correction Required'
  | 'Ready for Retransmission'
  | 'Retransmitted—Simulated'
  | 'Notice Received'
  | 'Response Required'
  | 'Response Under Review'
  | 'Response Submitted—Simulated'
  | 'Additional Information Requested'
  | 'Under Examination'
  | 'Under Appeal'
  | 'Resolved'
  | 'Closed'
  | 'Archived'
  | 'Rolled Forward';

export interface GovernmentFeedbackRecord {
  id: string;
  authority: string;
  jurisdiction: string;
  form: string;
  taxYear: number;
  submissionId: string;
  responseCode: string;
  responseDescription: string;
  receivedDate: string;
  deadline: string;
  responsibleRole: DemoRole;
  requiredAction: string;
  relatedReturnVersion: string;
  relatedDocuments: string[];
  resolutionHistory: string[];
  clientNotificationStatus: 'Notified' | 'Pending' | 'Queued';
  status: GovernmentFeedbackState;
}

// 4A. Reception and Scheduling Models
export interface ReceptionInquiry {
  id: string;
  contactName: string;
  companyName?: string;
  phone: string;
  email: string;
  source: 'Walk-In' | 'Telephone' | 'Website' | 'Referral' | 'Email';
  inquiryType: 'Tax Return' | 'Bookkeeping' | 'IRS Notice Escalation' | 'General Advisory';
  urgentNoticeFlag: boolean;
  communicationPreference: 'Phone' | 'Email' | 'Text';
  notes: string;
  status: 'New' | 'Scheduled' | 'Routed to Intake' | 'Callback Needed' | 'No-Show';
  createdAt: string;
}

export interface AppointmentRecord {
  id: string;
  inquiryId?: string;
  clientName: string;
  staffName: string;
  staffRole: DemoRole;
  dateTime: string;
  durationMinutes: number;
  consultationType: 'Virtual Zoom (Simulated)' | 'Phone Call' | 'In-Person Office';
  reminderSent: boolean;
  status: 'Confirmed' | 'Completed' | 'Rescheduled' | 'Cancelled';
}

export interface CallLogRecord {
  id: string;
  callerName: string;
  phone: string;
  timestamp: string;
  reason: string;
  routedTo: DemoRole;
  actionTaken: string;
}

// 4B. Engagement Manager Models
export interface ScopeChangeOrder {
  id: string;
  engagementId: string;
  clientName: string;
  title: string;
  scopeDescription: string;
  priceDelta: number;
  originalBudget: number;
  revisedBudget: number;
  status: 'Draft' | 'Sent for Approval' | 'Client Accepted' | 'Declined';
  createdAt: string;
}

export interface WorkloadTimelineItem {
  stage: WorkCycleStage;
  responsibleRole: DemoRole;
  targetDays: number;
  status: 'Completed' | 'In Progress' | 'Upcoming' | 'On Hold';
  handoffGate: string;
}

// 4C. Identity & Client Verification Models
export interface IdentityVerificationRecord {
  id: string;
  clientId: string;
  clientName: string;
  entityType: 'Individual' | 'S-Corporation' | 'LLC / Partnership' | 'Trust';
  idDocumentType: "Driver's License" | 'Passport' | 'State ID';
  idStatus: 'Verified (Simulated)' | 'Pending Review' | 'Flagged Discrepancy' | 'Expired Document';
  addressMatchStatus: 'Match' | 'Address Discrepancy' | 'Unverified';
  einVerificationStatus: 'IRS Letter 147C Verified' | 'Pending SSA Verification' | 'Not Applicable';
  articlesOfOrgStatus: 'State SOS Active' | 'Missing Operating Agreement' | 'Verified';
  dependentCheckStatus: 'SSN Status Verified (Simulated)' | 'Custody Document Missing' | 'N/A';
  maskedSsn: string;
  notes: string;
  verifiedBy?: string;
  verifiedAt?: string;
  escalationFlag: boolean;
}

// 4D. Document Intake & Records Specialist Models
export interface IntakeDocumentRecord {
  id: string;
  fileName: string;
  fileSize: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  classification: 'Tax Form (W-2/1099/K-1)' | 'Bank/Brokerage Statement' | 'Receipt/Invoice' | 'Agency Notice' | 'Corporate Charter';
  packageCondition: 'Clean Single Document' | 'Multi-Page Bundle (Requires Split)' | 'Unreadable Scan' | 'Missing Pages';
  duplicateDetected: boolean;
  assignedRole: DemoRole;
  retentionCategory: '7-Year Tax Workpaper' | 'Permanent Corporate Record' | 'Notice Response File';
  chainOfCustody: Array<{ timestamp: string; actor: string; action: string }>;
  status: 'Demo file received' | 'Scan not configured' | 'Classification simulated' | 'Awaiting staff review' | 'Accepted' | 'Routed';
  receivedAt: string;
}

// 4E. Accounting Data Entry Specialist Models
export interface DataEntryBatch {
  id: string;
  batchName: string;
  clientId: string;
  clientName: string;
  totalEntries: number;
  totalAmount: number;
  sourceType: 'Client Spreadsheet Import' | 'Receipt Shoebox' | 'Cash Log';
  status: 'In Progress' | 'Submitted to Bookkeeping' | 'Corrections Requested' | 'Approved by Bookkeeper';
  submittedBy: string;
  submittedAt?: string;
  notes?: string;
}

export interface CashTransactionEntry {
  id: string;
  batchId: string;
  date: string;
  vendorOrPayee: string;
  description: string;
  suggestedAccount: string;
  amount: number;
  matchedReceiptHash?: string;
  status: 'Entered' | 'Pending Documentation' | 'Bookkeeper Approved';
}

// 4F. Accounts Payable Models
export interface VendorBillRecord {
  id: string;
  clientId: string;
  clientName: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  suggestedGlAccount: string;
  w9OnFileType: boolean;
  requires1099: boolean;
  duplicateWarning: boolean;
  paymentBatchId?: string;
  approvalStatus: 'Pending Review' | 'Approved for Payment' | 'On Hold / Disputed' | 'Simulated Paid';
}

export interface PaymentBatchRecord {
  id: string;
  batchDate: string;
  totalAmount: number;
  billCount: number;
  status: 'Prepared' | 'Routed for Approval' | 'Authorized (Simulated)' | 'Released (Simulated)';
}

// 4G. Accounts Receivable Models
export interface ClientArRecord {
  id: string;
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  originalAmount: number;
  retainerApplied: number;
  balanceDue: number;
  agingBucket: 'Current' | '1-30 Days' | '31-60 Days' | '61-90 Days' | '90+ Days';
  paymentPlanActive: boolean;
  status: 'Sent' | 'Reminder Sent (Simulated)' | 'Paid (Simulated)' | 'Overdue' | 'Write-off Requested';
}

export interface PaymentPlanRecord {
  id: string;
  clientId: string;
  clientName: string;
  totalBalance: number;
  monthlyInstallment: number;
  installmentsTotal: number;
  installmentsRemaining: number;
  startDate: string;
  status: 'Active' | 'Delinquent' | 'Completed';
}

// 4H. Quality Control Specialist Models
export interface QualityInspectionRecord {
  id: string;
  engagementId: string;
  clientName: string;
  taxYear: number;
  formType: string;
  inspectedBy: string;
  inspectionDate: string;
  traceabilityScore: number; // 0-100%
  makerCheckerSeparationConfirmed: boolean;
  reviewerEvidenceAttached: boolean;
  clientConsentOnRecord: boolean;
  findings: Array<{ severity: 'Critical' | 'Warning' | 'Observation'; description: string; remediated: boolean }>;
  qcReleaseStatus: 'Pending Inspection' | 'Findings Open - Release Blocked' | 'Remediated' | 'Quality Control Cleared';
}

// 4I. ERO & Filing Specialist Models
export interface FilingGateStatus {
  preparerCompleted: boolean;
  reviewerApproved: boolean;
  qcCleared: boolean;
  clientApproved: boolean;
  signatureCompleted: boolean;
  billingReleased: boolean;
  filingSpecialistConfirmed: boolean;
}

export interface FilingSubmissionBatch {
  id: string;
  batchNumber: string;
  formType: string;
  jurisdictions: string[];
  submissionCount: number;
  transmissionTimestamp?: string;
  schemaValidationStatus: 'Passed (Simulated)' | 'Schema Diagnostics Failed (Simulated)' | 'Pending Diagnostics';
  status: 'Ready for Transmission' | 'Transmitted—Simulated' | 'Awaiting Agency Ack' | 'Rejection Detected';
}

// 4J. Government Acknowledgement Specialist Models
export interface AcknowledgementRecord {
  id: string;
  submissionId: string;
  clientName: string;
  taxYear: number;
  formType: string;
  jurisdiction: 'Federal IRS' | 'South Carolina DOR' | 'North Carolina DOR' | 'Georgia DOR';
  ackType: 'Federal' | 'State';
  status: 'Accepted—Simulated' | 'Rejected—Simulated' | 'Pending Acknowledgement' | 'Overdue Ack Warning';
  returnCode: string;
  messageText: string;
  timestamp: string;
  correctionCaseCreated: boolean;
}

// 4K. Government Correspondence & Notice Models
export interface GovernmentNoticeRecord {
  id: string;
  clientId: string;
  clientName: string;
  authority: string;
  noticeNumber: string; // e.g. CP2000, LTR 5071C, SC DOR-Notice 301
  taxYear: number;
  noticeDate: string;
  responseDeadline: string;
  proposedTaxAmount: number;
  proposedPenaltyAmount: number;
  category: 
    | 'Balance due'
    | 'Missing return'
    | 'Income mismatch'
    | 'Math error'
    | 'Identity verification'
    | 'Payment not credited'
    | 'Penalty or interest'
    | 'Information request'
    | 'Payroll notice'
    | 'Sales-tax notice'
    | 'Audit examination'
    | 'Collection notice'
    | 'Levy or lien warning'
    | 'Amended-return update'
    | 'Refund adjustment'
    | 'State residency inquiry';
  assignedPractitioner: string;
  status: 'Notice Received' | 'Response Case Open' | 'Drafting Response' | 'Practitioner Review' | 'Response Submitted—Simulated' | 'Resolved';
}

// 4L. Tax Resolution Models
export interface TaxResolutionCase {
  id: string;
  clientId: string;
  clientName: string;
  form2848OnRecord: boolean;
  totalTaxLiability: number;
  openYears: number[];
  collectionStage: 'Notice' | 'Notice of Intent to Levy' | 'Federal Tax Lien Filed' | 'Appeals Conference';
  resolutionStrategy: 'Penalty Abatement (First-Time / Reasonable Cause)' | 'Installment Agreement (Form 9465)' | 'Offer in Compromise (Form 656)' | 'Currently Not Collectible' | 'Innocent Spouse (Form 8857)';
  hearingDate?: string;
  caseStatus: 'Intake & Transcripts' | 'Strategy Selected' | 'Form Package Prepared' | 'Submitted to IRS ACS (Simulated)' | 'Accepted by Appeals' | 'Closed Resolved';
  assignedPractitioner: string;
}

// 4M. Audit Specialist Models
export interface AuditCaseRecord {
  id: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  agency: string;
  examinerName: string;
  examType: 'Correspondence Exam' | 'Office Exam' | 'Field Examination';
  examIssues: string[];
  idrCount: number;
  proposedAdjustments: number;
  responseDeadline: string;
  status: 'Exam Notice' | 'IDR Production' | 'Interview Scheduled' | 'Form 4549 Proposed Adjustments' | '30-Day Letter Protest Filed' | 'Settlement Finalized';
  assignedDefenseLead: string;
}

// 4N. Amendment Specialist Models
export interface AmendmentCaseRecord {
  id: string;
  originalEngagementId: string;
  clientName: string;
  taxYear: number;
  originalForm: string;
  amendedForm: string; // e.g. 1040-X, 1120-X
  reasonForAmendment: string;
  originalTaxableIncome: number;
  amendedTaxableIncome: number;
  originalTaxLiability: number;
  amendedTaxLiability: number;
  netRefundOrBalanceDue: number;
  preparerAssigned: string;
  reviewerApproved: boolean;
  clientSignatureForm8879X: boolean;
  filingStatus: 'Under Preparation' | 'Review Approved' | 'Signed by Client' | 'Filed (Simulated)' | 'Accepted—Simulated';
}

// 4O. Records & Archive Models
export interface ArchiveRecord {
  id: string;
  engagementId: string;
  clientName: string;
  taxYear: number;
  packageType: 'Full Tax Filing Archive' | 'Trial Balance & Financial Statements' | 'Agency Correspondence & Notice File';
  documentCount: number;
  archiveDate: string;
  retentionExpiryDate: string;
  legalHoldActive: boolean;
  destructionEligible: boolean;
  destructionStatus: 'Retained Active' | 'Legal Hold' | 'Destruction Approved (Simulated)' | 'Destroyed (Simulated)';
  rolledForward: boolean;
}

// 4P. Client Success & Renewal Models
export interface ClientRenewalRecord {
  id: string;
  clientId: string;
  clientName: string;
  priorTaxYear: number;
  renewalTaxYear: number;
  servicesPriorYear: string[];
  proposedServices: string[];
  feedbackScore: number; // 1-10
  clientSatisfaction: 'Delighted' | 'Satisfied' | 'Neutral' | 'At Risk';
  renewalStatus: 'Renewal Proposal Sent' | 'Follow-up Call Scheduled' | 'Contract Signed' | 'Rolled Forward to Intake' | 'Offboarded';
  notes: string;
}

// 4Q. IT & Application Support Models
export interface SupportTicketRecord {
  id: string;
  ticketNumber: string;
  userRole: DemoRole;
  userName: string;
  category: 'Login Assistance' | 'Session Timeout' | 'Dashboard Render' | 'Mock Data Desync' | 'Feature Request';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  browserEnvironment: string;
  summary: string;
  sanitizedLogs: string;
  status: 'Open' | 'Investigating' | 'Resolved (Simulated)' | 'Escalated to Engineering';
  createdAt: string;
}
