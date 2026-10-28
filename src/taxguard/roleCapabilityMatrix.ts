/**
 * TaxGuard AI - Role-to-Capability Authorization & Integration Matrix
 * 
 * Formal mapping of practice roles, routes, permissions, data scopes,
 * added capabilities, removed controls, and rendered reusable components.
 * 
 * Architecture Principle:
 * TaxGuard AI is an integrated intelligence and automation layer,
 * not a standalone console or user role.
 */

export interface RoleCapabilityMapping {
  role: string;
  roleTitle: string;
  dashboardRoute: string;
  loginRoute: string;
  department: string;
  taxGuardCapabilities: string[];
  requiredPermissions: string[];
  allowedDataScope: string;
  controlsToAdd: string[];
  controlsToRemove: string[];
  reusableComponents: string[];
}

export const ROLE_CAPABILITY_MATRIX: Record<string, RoleCapabilityMapping> = {
  client: {
    role: 'client',
    roleTitle: 'Client / Taxpayer',
    dashboardRoute: '#/client/dashboard',
    loginRoute: '#/client/login',
    department: 'Client Facing',
    taxGuardCapabilities: [
      'Camera document scanning with edge crop and enhancement',
      'Encrypted upload queue with quarantine validation',
      'Client-friendly plain-language document summaries',
      'Missing-document checklist responses',
      'Draft return review and e-signature authorization',
      'Cryptographic SHA-256 seal and QR verification'
    ],
    requiredPermissions: ['client:read_own', 'client:upload_doc', 'client:respond_missing', 'client:sign_draft'],
    allowedDataScope: 'Strictly limited to authenticated client account and active tax engagements (e.g., Daniel Henze / Henze Construction)',
    controlsToAdd: [
      'DocumentScanner modal and camera toggle',
      'Client DocumentUploadQueue with instant receipt',
      'Plain-language summary cards with disclaimer',
      'Missing-document upload response buttons',
      'Client e-sign approval card',
      'Public safe verification badge'
    ],
    controlsToRemove: [
      'Internal OCR confidence scores',
      'Staff assignment notes and review comments',
      'Maker-checker internal CPA sign-off controls',
      'Raw extraction bounding boxes',
      'AI prompt templates and model configurations',
      'Other clients\' dossiers or engagement data'
    ],
    reusableComponents: [
      'DocumentScanner',
      'DocumentUploadQueue',
      'MissingItemsPanel',
      'VerificationPanel'
    ]
  },

  reception: {
    role: 'reception',
    roleTitle: 'Reception & Inquiries Specialist',
    dashboardRoute: '#/reception/dashboard',
    loginRoute: '#/reception/login',
    department: 'Intake & Client Services',
    taxGuardCapabilities: [
      'Prospective client inquiry logging',
      'Consultation scheduling and calendar reminders',
      'AI-suggested intake questionnaires',
      'Intake completion tracking'
    ],
    requiredPermissions: ['inquiry:create', 'inquiry:read', 'calendar:manage', 'intake:route'],
    allowedDataScope: 'Prospective clients, unassigned inquiries, and public booking calendars',
    controlsToAdd: [
      'Inquiry intake triage',
      'Simulated SMS/email reminder triggers',
      'Routing to intake specialists'
    ],
    controlsToRemove: [
      'Detailed tax return forms and line mapping',
      'Tax technical workpapers',
      'Filing gateway credentials',
      'Confidential accounting records'
    ],
    reusableComponents: ['MissingItemsPanel']
  },

  intake: {
    role: 'intake',
    roleTitle: 'Intake & Conflict Clearance Officer',
    dashboardRoute: '#/intake/dashboard',
    loginRoute: '#/intake/login',
    department: 'Intake & Client Services',
    taxGuardCapabilities: [
      'Client conflict clearance checks',
      'Engagement proposal creation',
      'Tax organizer completeness monitoring',
      'Handoff to engagement management'
    ],
    requiredPermissions: ['intake:manage', 'conflict:clear', 'proposal:generate'],
    allowedDataScope: 'Onboarding clients, engagement agreements, and initial organizers',
    controlsToAdd: [
      'Conflict check verification logs',
      'Retainer and proposal issuance',
      'Handoff confirmation gate'
    ],
    controlsToRemove: [
      'Tax position approvals',
      'Trial balance mapping',
      'Filing release gates',
      'System AI governance'
    ],
    reusableComponents: ['MissingItemsPanel']
  },

  'engagement-manager': {
    role: 'engagement-manager',
    roleTitle: 'Engagement Manager',
    dashboardRoute: '#/engagement-manager/dashboard',
    loginRoute: '#/engagement-manager/login',
    department: 'Practice Operations',
    taxGuardCapabilities: [
      'Lifecycle stage orchestration (18 stages)',
      'Scope change order generation (SCO)',
      'Staff assignment and workload balancing',
      'Blocker and escalation tracking'
    ],
    requiredPermissions: ['engagement:manage', 'scope:modify', 'staff:assign', 'timeline:track'],
    allowedDataScope: 'All practice engagements, deadlines, budgets, and staff allocations',
    controlsToAdd: [
      'Scope change order creation & tracking',
      '18-stage lifecycle milestone monitor',
      'Staff reassignment and escalation triggers'
    ],
    controlsToRemove: [
      'Raw OCR bounding boxes',
      'AI provider secrets',
      'System security and server configs'
    ],
    reusableComponents: ['MissingItemsPanel', 'DiscrepancyPanel']
  },

  verification: {
    role: 'verification',
    roleTitle: 'Client Verification Specialist',
    dashboardRoute: '#/verification/dashboard',
    loginRoute: '#/verification/login',
    department: 'Compliance & Identity',
    taxGuardCapabilities: [
      'Identity document validation (Driver License, Passport, Articles of Org)',
      'TIN ending and SSN match verification',
      'Signing authority confirmation',
      'Duplicate entity and conflicting identity alerts'
    ],
    requiredPermissions: ['identity:verify', 'tin:validate', 'flag:escalate'],
    allowedDataScope: 'Client identification records and signing authorization documents',
    controlsToAdd: [
      'Identity verification approval/rejection gates',
      'TIN mask check vs IRS database simulations',
      'Escalation alerts for mismatched SSN endings'
    ],
    controlsToRemove: [
      'General ledger entry controls',
      'Tax calculation workpapers',
      'Final e-filing transmission'
    ],
    reusableComponents: ['DiscrepancyPanel', 'MissingItemsPanel']
  },

  documents: {
    role: 'documents',
    roleTitle: 'Documents & Records Specialist',
    dashboardRoute: '#/documents/dashboard',
    loginRoute: '#/documents/login',
    department: 'Document Operations',
    taxGuardCapabilities: [
      'Scanner intake queue & controlled ingest',
      'MIME validation, quarantine, and SHA-256 duplicate detection',
      'AI document classification & confidence scoring',
      'Multi-page dossier splitting into indexed tax workpapers',
      'Chain of custody logging & version retention'
    ],
    requiredPermissions: ['doc:ingest', 'doc:classify', 'doc:split', 'doc:quarantine'],
    allowedDataScope: 'Document vault, raw scans, intake dossiers across all clients',
    controlsToAdd: [
      'DocumentScanner camera interface',
      'DocumentUploadQueue with quarantine inspector',
      'ClassificationReview with re-classification override',
      'Dossier splitting tool',
      'Chain of custody event log'
    ],
    controlsToRemove: [
      'Final tax return sign-off',
      'Client billing amounts',
      'Executive profitability metrics'
    ],
    reusableComponents: [
      'DocumentScanner',
      'DocumentUploadQueue',
      'ClassificationReview'
    ]
  },

  'data-entry': {
    role: 'data-entry',
    roleTitle: 'Data Entry & OCR Specialist',
    dashboardRoute: '#/data-entry/dashboard',
    loginRoute: '#/data-entry/login',
    department: 'Data Operations',
    taxGuardCapabilities: [
      'OCR extraction review queue',
      'Low-confidence field triage (<85% score)',
      'Side-by-side source page bounding box verification',
      'Manual correction with audit history',
      'Batch submission to bookkeeping and tax preparation'
    ],
    requiredPermissions: ['ocr:review', 'ocr:correct', 'batch:submit'],
    allowedDataScope: 'Raw extraction dossiers, extracted key-value pairs, source document images',
    controlsToAdd: [
      'ExtractionReview with field-level confidence indicators',
      'Correction modal with audit reason tracking',
      'Batch data validation controls'
    ],
    controlsToRemove: [
      'Final professional CPA certifications',
      'IRS filing transmission controls',
      'Executive financial KPIs'
    ],
    reusableComponents: ['ExtractionReview']
  },

  bookkeeper: {
    role: 'bookkeeper',
    roleTitle: 'Bookkeeping & CAS Specialist',
    dashboardRoute: '#/bookkeeper/dashboard',
    loginRoute: '#/bookkeeper/login',
    department: 'Client Accounting Services',
    taxGuardCapabilities: [
      'Bank feed auto-categorization suggestions',
      'Bank and credit card statement reconciliation',
      'Duplicate transaction detection',
      'Personal vs business expense segregation',
      'Month-end closing checklist with workpaper links'
    ],
    requiredPermissions: ['cas:categorize', 'cas:reconcile', 'cas:close_month'],
    allowedDataScope: 'Client chart of accounts, bank transactions, expense vouchers, vendor receipts',
    controlsToAdd: [
      'AI categorization review table',
      'Discrepancy alert banner for unmatched debits/credits',
      'Closing checklist with source document links'
    ],
    controlsToRemove: [
      'IRS MeF filing release gates',
      'PTIN/EFIN credential management',
      'System-wide AI infrastructure configuration'
    ],
    reusableComponents: ['DiscrepancyPanel', 'ExtractionReview']
  },

  'accounts-payable': {
    role: 'accounts-payable',
    roleTitle: 'Accounts Payable Specialist',
    dashboardRoute: '#/accounts-payable/dashboard',
    loginRoute: '#/accounts-payable/login',
    department: 'Accounting Operations',
    taxGuardCapabilities: [
      'Vendor invoice extraction',
      'W-9 compliance tracking',
      'ACH batch payment authorization',
      'Duplicate bill identification'
    ],
    requiredPermissions: ['ap:bills', 'ap:w9_check', 'ap:disburse'],
    allowedDataScope: 'Vendor bills, W-9 forms, disbursement accounts',
    controlsToAdd: [
      'Vendor invoice extraction list',
      'W-9 missing items tracker',
      'Simulated ACH payment batches'
    ],
    controlsToRemove: [
      'Client receivable balances',
      'Tax return sign-off controls',
      'Filing gateway access'
    ],
    reusableComponents: ['ExtractionReview', 'MissingItemsPanel']
  },

  'accounts-receivable': {
    role: 'accounts-receivable',
    roleTitle: 'Accounts Receivable Specialist',
    dashboardRoute: '#/accounts-receivable/dashboard',
    loginRoute: '#/accounts-receivable/login',
    department: 'Accounting Operations',
    taxGuardCapabilities: [
      'Client fee invoices and retainers',
      'Aging analysis (30/60/90 days)',
      'Automated dunning reminders',
      'Payment-to-invoice matching'
    ],
    requiredPermissions: ['ar:invoices', 'ar:aging', 'ar:collect'],
    allowedDataScope: 'Client billing ledgers, retainer agreements, payment records',
    controlsToAdd: [
      'Aging table with dunning triggers',
      'Payment receipt recorder',
      'Retainer balance monitor'
    ],
    controlsToRemove: [
      'Vendor bills',
      'Tax form field mapping',
      'AI model configuration'
    ],
    reusableComponents: ['DiscrepancyPanel']
  },

  payroll: {
    role: 'payroll',
    roleTitle: 'Payroll & Compliance Specialist',
    dashboardRoute: '#/payroll/dashboard',
    loginRoute: '#/payroll/login',
    department: 'Payroll Services',
    taxGuardCapabilities: [
      'Payroll register extraction and wage tie-out',
      'Form 941 quarterly reconciliation workpapers',
      'EFTPS liability deposit tracking',
      'W-2 & 1099 year-end compliance alerts'
    ],
    requiredPermissions: ['payroll:process', 'payroll:form941', 'payroll:eftps'],
    allowedDataScope: 'Payroll registers, federal/state tax liabilities, employee census records',
    controlsToAdd: [
      'Payroll register extraction cards',
      'Quarterly 941 draft reconciliation',
      'EFTPS deposit confirmation logger'
    ],
    controlsToRemove: [
      'Individual 1040 tax preparation queues',
      'Client general billing administration',
      'System provider secrets'
    ],
    reusableComponents: ['ExtractionReview', 'DiscrepancyPanel']
  },

  accountant: {
    role: 'accountant',
    roleTitle: 'Tax Preparer / Staff Accountant',
    dashboardRoute: '#/accountant/dashboard',
    loginRoute: '#/accountant/login',
    department: 'Tax Compliance',
    taxGuardCapabilities: [
      'Assigned tax engagement workspace',
      'Smart Form workspace & field mapping (Form 1040 & Schedule C)',
      'Draft tax workpaper generation with "DRAFT" watermark',
      'Missing-document checklist follow-up',
      'Discrepancy & variance alert triage',
      'Source-grounded IRC research assistant with citations',
      'Submission to Senior CPA Review queue'
    ],
    requiredPermissions: ['tax:prepare', 'workpaper:edit', 'mapping:edit', 'research:access', 'return:submit_review'],
    allowedDataScope: 'Assigned client engagements, extraction dossiers, workpapers, smart forms',
    controlsToAdd: [
      'FieldMappingEditor (source field to tax form line)',
      'SmartFormWorkspace (Form 1040 / Schedule C auto-population)',
      'WorkpaperEditor with prominent draft watermark',
      'MissingItemsPanel for client follow-ups',
      'DiscrepancyPanel for variance diagnostics',
      'AIResearchAssistant for statutory citations',
      'Submit to Senior CPA Review button'
    ],
    controlsToRemove: [
      'Final CPA approval certification (reserved for Senior Reviewer)',
      'IRS MeF direct transmission gates',
      'Executive firmwide financial indicators',
      'System admin and session reset controls'
    ],
    reusableComponents: [
      'FieldMappingEditor',
      'SmartFormWorkspace',
      'WorkpaperEditor',
      'MissingItemsPanel',
      'DiscrepancyPanel',
      'AIResearchAssistant'
    ]
  },

  'quality-control': {
    role: 'quality-control',
    roleTitle: 'Quality Control Specialist',
    dashboardRoute: '#/quality-control/dashboard',
    loginRoute: '#/quality-control/login',
    department: 'Quality Assurance',
    taxGuardCapabilities: [
      '7-point pre-release inspection checklist',
      'Federal vs State consistency checking',
      'Discrepancy closure verification',
      'Return-to-preparer remediation workflow'
    ],
    requiredPermissions: ['qc:inspect', 'qc:remediate', 'qc:release_check'],
    allowedDataScope: 'Prepared tax returns awaiting senior certification, reconciliation workpapers',
    controlsToAdd: [
      '7-Point QC Checklist runner',
      'Remediation finding logger',
      'Gate release checklist'
    ],
    controlsToRemove: [
      'Client fee billing adjustments',
      'Firmwide executive financial reports',
      'AI infrastructure settings'
    ],
    reusableComponents: ['DiscrepancyPanel']
  },

  reviewer: {
    role: 'reviewer',
    roleTitle: 'Senior Reviewer / CPA / EA',
    dashboardRoute: '#/reviewer/dashboard',
    loginRoute: '#/reviewer/login',
    department: 'Tax Compliance & Attest',
    taxGuardCapabilities: [
      'Maker-checker dual sign-off gate enforcement',
      'High-risk step certification (Section 179, Apportionment, M-1)',
      'Source-to-form traceability verification',
      'Correction notice issuance to preparer',
      'Filing release authorization gate'
    ],
    requiredPermissions: ['cpa:certify', 'cpa:reject_corrections', 'cpa:dual_authorize', 'cpa:release_file'],
    allowedDataScope: 'All active tax engagements in review, workpapers, audit trails, statutory forms',
    controlsToAdd: [
      'ProfessionalReviewQueue with maker-checker separation',
      'ApprovalGate with dual-authorization signatures',
      'Variance diagnostic inspector',
      'Formal correction return modal'
    ],
    controlsToRemove: [
      'Third-party AI API key configuration',
      'Routine unassigned reception inquiries',
      'System-level database wipe controls'
    ],
    reusableComponents: [
      'ProfessionalReviewQueue',
      'ApprovalGate',
      'DiscrepancyPanel',
      'AIResearchAssistant'
    ]
  },

  advisor: {
    role: 'advisor',
    roleTitle: 'Tax Strategy & Advisory Specialist',
    dashboardRoute: '#/advisor/dashboard',
    loginRoute: '#/advisor/login',
    department: 'Advisory & Strategy',
    taxGuardCapabilities: [
      'Reasonable compensation analysis for S-Corps',
      'Entity restructuring tax modeling (LLC vs S-Corp vs C-Corp)',
      'Section 41 R&D tax credit qualification',
      'Multi-year strategic advisory roadmap',
      'Source-grounded IRC research'
    ],
    requiredPermissions: ['advisory:model', 'advisory:roadmap', 'research:access'],
    allowedDataScope: 'Client historical tax returns, financial statements, advisory projections',
    controlsToAdd: [
      'Interactive compensation calculator',
      'Entity tax model comparison grid',
      'AIResearchAssistant advisory mode'
    ],
    controlsToRemove: [
      'Raw document ingestion queue',
      'Filing gateway submission controls',
      'Client payment processing'
    ],
    reusableComponents: ['AIResearchAssistant']
  },

  filing: {
    role: 'filing',
    roleTitle: 'Filing & E-File Specialist',
    dashboardRoute: '#/filing/dashboard',
    loginRoute: '#/filing/login',
    department: 'Filing & Transmission',
    taxGuardCapabilities: [
      'Locked final package verification (Form 8879 / 8453 signed)',
      'IRS MeF schema validation diagnostics',
      'Electronic filing batch creation',
      'Simulated MeF gateway transmission'
    ],
    requiredPermissions: ['filing:validate', 'filing:batch', 'filing:transmit'],
    allowedDataScope: 'Certified and locked tax packages ready for electronic filing',
    controlsToAdd: [
      'MeF validation diagnostic checklist',
      'Filing batch submission engine',
      'Submission ID and timestamp recorder'
    ],
    controlsToRemove: [
      'Draft return editing',
      'Uncertified workpaper modifications',
      'AI prompt customization'
    ],
    reusableComponents: ['ApprovalGate', 'VerificationPanel']
  },

  acknowledgements: {
    role: 'acknowledgements',
    roleTitle: 'Acknowledgements & MeF Specialist',
    dashboardRoute: '#/acknowledgements/dashboard',
    loginRoute: '#/acknowledgements/login',
    department: 'Filing & Transmission',
    taxGuardCapabilities: [
      'IRS & State electronic filing receipt tracking (MeF ACK)',
      'Rejection code parsing and alert routing',
      'Correction case creation and re-submission',
      'MeF ACK simulation tool'
    ],
    requiredPermissions: ['ack:view', 'ack:remedy', 'ack:simulate'],
    allowedDataScope: 'Electronic submission identifiers, federal/state ACK files, rejection logs',
    controlsToAdd: [
      'MeF ACK receipt feed',
      'Rejection error code translator',
      'ACK simulator trigger'
    ],
    controlsToRemove: [
      'Preparer tax line editing',
      'Client billing records',
      'AI provider secrets'
    ],
    reusableComponents: ['VerificationPanel']
  },

  correspondence: {
    role: 'correspondence',
    roleTitle: 'Correspondence & Notice Specialist',
    dashboardRoute: '#/correspondence/dashboard',
    loginRoute: '#/correspondence/login',
    department: 'Tax Controversy',
    taxGuardCapabilities: [
      'IRS and state agency notice intake and classification',
      'Statutory response deadline clock calculation',
      'AI-assisted response draft generation with IRC citations',
      'Certified mailing and delivery tracking'
    ],
    requiredPermissions: ['notice:intake', 'notice:draft', 'notice:respond'],
    allowedDataScope: 'Agency notices (CP2000, CP504, SC DOR letters), prior year returns, power of attorney',
    controlsToAdd: [
      'Notice analysis card with deadline clocks',
      'AI defense draft generator',
      'Response submission logger'
    ],
    controlsToRemove: [
      'Routine intake queues',
      'Routine payroll processing',
      'System-level user role management'
    ],
    reusableComponents: ['AIResearchAssistant', 'MissingItemsPanel']
  },

  resolution: {
    role: 'resolution',
    roleTitle: 'Tax Resolution Specialist',
    dashboardRoute: '#/resolution/dashboard',
    loginRoute: '#/resolution/login',
    department: 'Tax Controversy',
    taxGuardCapabilities: [
      'IRS Offer in Compromise (OIC) eligibility modeling',
      'Form 433-A / 433-B collection financial analysis',
      'Appeals conference scheduling and representation briefs',
      'Installment agreement settlement tracking'
    ],
    requiredPermissions: ['resolution:model', 'resolution:oic', 'resolution:settle'],
    allowedDataScope: 'Client asset/liability disclosures, IRS transcript history, collections notices',
    controlsToAdd: [
      'OIC Reasonable Collection Potential calculator',
      'Form 433 financial summary',
      'Settlement tracking card'
    ],
    controlsToRemove: [
      'New client prospective intake',
      'Accounts payable checks',
      'AI model configuration'
    ],
    reusableComponents: ['AIResearchAssistant', 'DiscrepancyPanel']
  },

  audit: {
    role: 'audit',
    roleTitle: 'Audit Defense Specialist',
    dashboardRoute: '#/audit/dashboard',
    loginRoute: '#/audit/login',
    department: 'Tax Controversy',
    taxGuardCapabilities: [
      'IRS examination defense case management',
      'Information Document Request (IDR) workpapers',
      'Form 2848 Power of Attorney validation',
      'No-change audit closure certification'
    ],
    requiredPermissions: ['audit:defend', 'idr:prepare', 'poa:verify'],
    allowedDataScope: 'Audited tax returns, IDR workpapers, substantiating receipts, IRS correspondence',
    controlsToAdd: [
      'IDR index and substantiation checklist',
      'Form 2848 POA tracker',
      'Audit closure certificate recorder'
    ],
    controlsToRemove: [
      'Routine bookkeeping bank feeds',
      'Marketing or intake pipelines',
      'System administrative settings'
    ],
    reusableComponents: ['AIResearchAssistant', 'WorkpaperEditor']
  },

  amendments: {
    role: 'amendments',
    roleTitle: 'Tax Amendments Specialist',
    dashboardRoute: '#/amendments/dashboard',
    loginRoute: '#/amendments/login',
    department: 'Tax Compliance',
    taxGuardCapabilities: [
      'Form 1040-X / 1120-X amended return preparation',
      'Original vs Revised variance comparison',
      'Part III Explanation of Changes draft generator',
      'Refund claim and statute limitation tracking'
    ],
    requiredPermissions: ['amendment:prepare', 'amendment:compare', 'amendment:transmit'],
    allowedDataScope: 'Originally filed returns, subsequent discovery documents, amended return workpapers',
    controlsToAdd: [
      'Original vs Revised variance table',
      'Explanation of changes editor',
      'Amended return submission queue'
    ],
    controlsToRemove: [
      'New client prospective intake',
      'Vendor accounts payable',
      'Executive practice realization metrics'
    ],
    reusableComponents: ['FieldMappingEditor', 'WorkpaperEditor', 'DiscrepancyPanel']
  },

  records: {
    role: 'records',
    roleTitle: 'Records Administrator',
    dashboardRoute: '#/records/dashboard',
    loginRoute: '#/records/login',
    department: 'Records & Compliance',
    taxGuardCapabilities: [
      '7-year statutory retention schedule enforcement',
      'Cryptographic SHA-256 seal & QR code verification',
      'Litigation legal hold locks',
      'Certificates of destruction & annual roll-forward'
    ],
    requiredPermissions: ['records:archive', 'records:hold', 'records:verify', 'records:destroy'],
    allowedDataScope: 'All finalized, signed, and locked tax files, audit logs, destruction certificates',
    controlsToAdd: [
      'VerificationPanel with public-safe lookups',
      'Legal hold toggle and active holds list',
      'Certificate of destruction generator'
    ],
    controlsToRemove: [
      'Tax calculation modifications',
      'Bank feed categorization',
      'Preparer smart form editing'
    ],
    reusableComponents: ['VerificationPanel', 'AuditEventViewer']
  },

  billing: {
    role: 'billing',
    roleTitle: 'Billing & Collections Specialist',
    dashboardRoute: '#/billing/dashboard',
    loginRoute: '#/billing/login',
    department: 'Finance & Billing',
    taxGuardCapabilities: [
      'Engagement fee invoices and retainer reconciliation',
      'A/R aging analysis (30/60/90+ days)',
      'Payment transaction recording & receipts',
      'Service restriction holds on delinquent accounts'
    ],
    requiredPermissions: ['billing:invoice', 'billing:payment', 'billing:aging'],
    allowedDataScope: 'Client fee agreements, retainer balances, invoices, payment history',
    controlsToAdd: [
      'Invoice creation and payment logger',
      'Aging analysis summary',
      'Payment plan monitor'
    ],
    controlsToRemove: [
      'OCR extraction bounding boxes',
      'Tax return field mapping',
      'IRS filing credentials'
    ],
    reusableComponents: ['DiscrepancyPanel']
  },

  'client-success': {
    role: 'client-success',
    roleTitle: 'Client Success Specialist',
    dashboardRoute: '#/client-success/dashboard',
    loginRoute: '#/client-success/login',
    department: 'Client Services',
    taxGuardCapabilities: [
      'Annual client renewal management',
      'Client health score and satisfaction tracking',
      'Upcoming tax year retainer proposals',
      'Roll-forward transition management'
    ],
    requiredPermissions: ['success:renewal', 'success:health', 'success:propose'],
    allowedDataScope: 'Client engagement satisfaction, renewal agreements, communication timelines',
    controlsToAdd: [
      'Client health scorecards',
      'Annual renewal status monitor',
      'Next-year retainer proposal builder'
    ],
    controlsToRemove: [
      'Confidential preparer review notes',
      'Internal tax technical workpapers',
      'System security and server configs'
    ],
    reusableComponents: ['MissingItemsPanel']
  },

  support: {
    role: 'support',
    roleTitle: 'Support & Helpdesk Specialist',
    dashboardRoute: '#/support/dashboard',
    loginRoute: '#/support/login',
    department: 'IT Support',
    taxGuardCapabilities: [
      'Support ticket resolution (document upload, camera scanner, login)',
      'Role session token diagnostics',
      'SLA tracking and incident escalation',
      'System access verification'
    ],
    requiredPermissions: ['support:ticket', 'support:session', 'support:escalate'],
    allowedDataScope: 'User support tickets, technical access logs, system incident reports',
    controlsToAdd: [
      'Support ticket queue with category filters',
      'Session token health monitor',
      'Simulated password reset tool'
    ],
    controlsToRemove: [
      'Confidential client tax returns and SSNs',
      'Tax calculations and position sign-offs',
      'IRS filing release gates'
    ],
    reusableComponents: ['IntegrationHealthPanel']
  },

  compliance: {
    role: 'compliance',
    roleTitle: 'Compliance & Security Officer',
    dashboardRoute: '#/compliance/dashboard',
    loginRoute: '#/compliance/login',
    department: 'Compliance & Security',
    taxGuardCapabilities: [
      'Immutable append-only audit trail explorer',
      'IRC § 7216 consent status monitoring',
      'PTIN and EFIN firm credential tracking',
      'AI governance, model inventory, confidence thresholds',
      'Emergency AI killswitch control'
    ],
    requiredPermissions: ['compliance:audit', 'compliance:7216', 'compliance:ai_govern', 'compliance:killswitch'],
    allowedDataScope: 'All practice audit events, consent records, regulatory credentials, security logs',
    controlsToAdd: [
      'AuditEventViewer (immutable audit trail)',
      'AI Governance Panel with emergency killswitch',
      'IRC § 7216 consent registry',
      'PTIN/EFIN credential status'
    ],
    controlsToRemove: [
      'Routine document editing controls',
      'Client billing charge adjustments',
      'Preparer form workpapers'
    ],
    reusableComponents: ['AuditEventViewer']
  },

  admin: {
    role: 'admin',
    roleTitle: 'System Administrator',
    dashboardRoute: '#/admin/dashboard',
    loginRoute: '#/admin/login',
    department: 'Administration',
    taxGuardCapabilities: [
      'Integration health monitoring (22 external adapters)',
      'Demonstration data reset & session clearing',
      'Rate-limiting lockouts and role access tester',
      'AI system configurations & model registry'
    ],
    requiredPermissions: ['admin:manage_users', 'admin:integrations', 'admin:reset_data', 'admin:diagnostics'],
    allowedDataScope: 'System settings, integration configurations, user sessions, system health diagnostics',
    controlsToAdd: [
      'IntegrationHealthPanel (22 adapters)',
      'Session management & lockout unlock',
      'Demo data reset button',
      'Role access testing console'
    ],
    controlsToRemove: [
      'Professional tax certification authority (reserved for CPAs/EAs)',
      'Client direct legal sign-off'
    ],
    reusableComponents: ['IntegrationHealthPanel', 'AuditEventViewer']
  },

  operations: {
    role: 'operations',
    roleTitle: 'Practice Operations Manager',
    dashboardRoute: '#/operations/dashboard',
    loginRoute: '#/operations/login',
    department: 'Operations',
    taxGuardCapabilities: [
      'Firmwide workflow board and bottleneck identification',
      'Staff capacity and workload allocation',
      'Statutory deadline calendar and milestone tracking',
      'Practice SLA compliance metrics'
    ],
    requiredPermissions: ['ops:workflow', 'ops:capacity', 'ops:deadlines'],
    allowedDataScope: 'Operational metrics, deadlines, staff allocations across all active cases',
    controlsToAdd: [
      'Firmwide workflow stage board',
      'Capacity utilization meters',
      'Statutory deadline countdown calendar'
    ],
    controlsToRemove: [
      'Unmasked client SSNs or sensitive financials',
      'Raw OCR bounding boxes',
      'System provider secrets'
    ],
    reusableComponents: ['DiscrepancyPanel', 'MissingItemsPanel']
  },

  executive: {
    role: 'executive',
    roleTitle: 'Firm Owner / Managing Executive',
    dashboardRoute: '#/executive/dashboard',
    loginRoute: '#/executive/login',
    department: 'Executive Leadership',
    taxGuardCapabilities: [
      'Aggregated practice realization and revenue metrics',
      'Lifecycle completion and throughput trends',
      'Capacity headroom analysis',
      'Strategic practice growth and risk indicators'
    ],
    requiredPermissions: ['exec:kpis', 'exec:realization', 'exec:growth'],
    allowedDataScope: 'Aggregated practice performance, financial realization, firmwide operational health',
    controlsToAdd: [
      'Practice realization charts & KPI cards',
      'Capacity headroom meters',
      'Strategic growth roadmap'
    ],
    controlsToRemove: [
      'Full taxpayer SSNs and confidential personal data',
      'Routine staff document editing tools',
      'Raw OCR verification bounding boxes'
    ],
    reusableComponents: []
  }
};
