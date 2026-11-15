import React from 'react';

const makeStub = (title: string, description: string): React.FC<any> =>
  ({ children }) => (
    <div className="rounded-xl border border-slate-700/60 bg-[#0D2745] p-5 text-slate-200 space-y-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-[#D4A843]">{title}</h3>
      <p className="text-xs text-slate-300">{description}</p>
      {children}
    </div>
  );

export const SmartFormWorkspace = makeStub('Smart Form Workspace', 'Interactive tax form field mapping and review workspace.');
export const WorkpaperEditor = makeStub('Workpaper Editor', 'Structured book-to-tax workpaper schedules and trial balance links.');
export const MissingItemsPanel = makeStub('Missing Items Tracker', 'Pending taxpayer documents and open client information requests.');
export const DiscrepancyPanel = makeStub('Discrepancy Resolution', 'Variance detection across source transcripts, ledgers, and drafts.');
export const AIResearchAssistant = makeStub('Tax Research Assistant', 'Governed IRC, Treasury Regulation, and state authority lookup.');
export const DraftReturnPreparer = makeStub('Draft Return Preparer', 'Form 1040, 1120-S, 1065, and 1120 draft preparation workbench.');
export const FixedAssetRegister = makeStub('Fixed Asset Register', 'MACRS, Section 179, and bonus depreciation schedules.');
export const EntityRelationshipGraph = makeStub('Entity Structure Graph', 'Multi-entity ownership and K-1 flow-through topology.');
export const IntegrationHealthPanel = makeStub('Integration Health', 'Provider commissioning, webhook status, and connector diagnostics.');
export const UnifiedActionCenter = makeStub('Unified Action Center', 'Cross-practice approvals, escalations, and priority alerts.');
export const AICreditUsageManager = makeStub('AI Usage & Quotas', 'Governed AI execution metering and budget controls.');
export const TaxGuardVoiceAssistant = makeStub('Advisor Briefing Console', 'Structured review summary and status briefing panel.');
export const TaxPlanningScenarioModeler = makeStub('Tax Planning Scenario Modeler', 'Multi-year projection and entity tax optimization modeling.');
export const EstimatedPaymentsCenter = makeStub('Estimated Tax Payments', 'Federal and state quarterly voucher schedule (Form 1040-ES).');
export const DocumentScanner = makeStub('Document Capture', 'Encrypted document capture with SHA-256 integrity hashing.');
export const DocumentUploadQueue = makeStub('Document Upload Queue', 'Active ingestion pipeline and security verification status.');
export const VerificationPanel = makeStub('Verification Queue', 'Source document authenticity and completeness verification.');
export const AuditEventViewer = makeStub('Audit Event Ledger', 'Immutable security and workflow audit trail.');
export const AIGovernancePanel = makeStub('AI Governance Controls', 'Model commissioning, kill switches, and human review enforcement.');
export const TaxResolutionCenter = makeStub('Tax Resolution Center', 'IRS and state notice tracking and representation log.');
export const ClassificationReview = makeStub('Classification Review', 'Document taxonomy verification and routing.');
export const ExtractionReview = makeStub('Extraction Review', 'Field-level OCR provenance and preparer verification.');
export const ProfessionalReviewQueue = makeStub('CPA Review Queue', 'Returns staged for secondary quality control sign-off.');
export const ApprovalGate = makeStub('Approval Gate', 'Maker-checker sign-off controls before client delivery.');
export const SideBySideReviewWorkspace = makeStub('Side-by-Side Review', 'Source document vs. draft return line comparison.');
export const BrandedDeliverablesGenerator = makeStub('Client Deliverables', 'Watermarked client filing packet assembly.');
