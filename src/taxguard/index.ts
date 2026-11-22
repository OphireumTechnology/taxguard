import React from 'react';

interface LegacyDemoPanelProps {
  userRole?: string;
  [key: string]: unknown;
}

function createDemoPanel(title: string, description: string): React.FC<LegacyDemoPanelProps> {
  return function TaxGuardDemoPanel({ userRole }: LegacyDemoPanelProps) {
    return React.createElement(
      'div',
      { className: 'rounded-xl border border-slate-700/60 bg-[#0D2745]/90 p-5 space-y-2 text-sm text-slate-200' },
      React.createElement(
        'div',
        { className: 'flex items-center justify-between' },
        React.createElement('h3', { className: 'font-semibold text-white' }, title),
        userRole
          ? React.createElement(
              'span',
              { className: 'text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-[#D4A843] font-mono' },
              userRole
            )
          : null
      ),
      React.createElement('p', { className: 'text-xs text-slate-300' }, description)
    );
  };
}

export const SmartFormWorkspace = createDemoPanel('Smart Form Workspace', 'Interactive IRS & state form mapping workspace.');
export const WorkpaperEditor = createDemoPanel('Workpaper Editor', 'Structured book-to-tax workpaper schedules and tie-outs.');
export const MissingItemsPanel = createDemoPanel('Missing Items Center', 'Tracks missing source documents and client action items.');
export const DiscrepancyPanel = createDemoPanel('Discrepancy Resolution Panel', 'Cross-document variance detection and reconciliation.');
export const AIResearchAssistant = createDemoPanel('TaxGuard AI Research Assistant', 'Authoritative IRC, Treasury Regulation, and revenue ruling citations.');
export const DraftReturnPreparer = createDemoPanel('Draft Return Preparer', 'Draft tax return assembly from verified workpapers.');
export const FixedAssetRegister = createDemoPanel('Fixed Asset & Depreciation Register', 'MACRS, Section 179, and bonus depreciation schedules.');
export const EntityRelationshipGraph = createDemoPanel('Entity Relationship Graph', 'Multi-entity ownership, K-1 flow-through, and related-party map.');
export const IntegrationHealthPanel = createDemoPanel('Integration Health Monitor', 'Provider readiness, ledger connectors, and security telemetry.');
export const UnifiedActionCenter = createDemoPanel('Unified Practice Action Center', 'Prioritized operational queue across engagements and reviews.');
export const AICreditUsageManager = createDemoPanel('AI Governance & Quota Manager', 'Monitored AI inference allocations and audit trails.');
export const TaxGuardVoiceAssistant = createDemoPanel('TaxGuard Voice Briefing', 'Executive audio summary of tax readiness and open items.');
export const TaxPlanningScenarioModeler = createDemoPanel('Tax Planning Scenario Modeler', 'Multi-year projection and entity election comparison.');
export const EstimatedPaymentsCenter = createDemoPanel('Estimated Tax Payments Center', 'Federal and state quarterly voucher schedule (Form 1040-ES).');
export const DocumentScanner = createDemoPanel('Secure Document Scanner', 'High-resolution capture and SHA-256 integrity hashing.');
export const DocumentUploadQueue = createDemoPanel('Document Upload Queue', 'Quarantine scan and classification pipeline status.');
export const VerificationPanel = createDemoPanel('Document Verification Panel', 'Human-verified field extraction and source cross-checks.');
export const AuditEventViewer = createDemoPanel('Immutable Audit Event Viewer', 'Tamper-evident chronological activity and access log.');
export const AIGovernancePanel = createDemoPanel('AI Governance & Safety Controls', 'Policy boundaries, kill switches, and human review gates.');
export const TaxResolutionCenter = createDemoPanel('Tax Notice & Resolution Center', 'IRS / state correspondence tracking and response workflows.');
export const ClassificationReview = createDemoPanel('Document Classification Review', 'Verify AI-proposed form types and tax year assignments.');
export const ExtractionReview = createDemoPanel('Field Extraction Review', 'Inspect OCR-extracted line items against source PDFs.');
export const ProfessionalReviewQueue = createDemoPanel('Professional Review Queue', 'Independent CPA review and sign-off queue.');
export const ApprovalGate = createDemoPanel('Partner Approval Gate', 'Dual-control authorization before signature release.');
export const SideBySideReviewWorkspace = createDemoPanel('Side-by-Side Review Workspace', 'Compare prior-year returns, workpapers, and draft schedules.');
export const BrandedDeliverablesGenerator = createDemoPanel('Branded Client Deliverables', 'Generate client-ready tax packages and executive summaries.');
