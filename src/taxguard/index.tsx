import React from 'react';

interface PanelProps {
  userRole?: string;
  [key: string]: any;
}

const makePanel = (title: string, description: string): React.FC<PanelProps> =>
  ({ userRole }) => (
    <div className="rounded-xl border border-slate-700/60 bg-[#0D2745] p-5 space-y-2 text-sm text-slate-200">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">{title}</h3>
        {userRole && <span className="text-[11px] uppercase tracking-wider text-[#D4A843]">{userRole}</span>}
      </div>
      <p className="text-xs text-slate-300">{description}</p>
    </div>
  );

export const IntegrationHealthPanel = makePanel(
  'Integration Health',
  'Connected accounting, document intake, and security verification channels are operational.',
);
export const UnifiedActionCenter = makePanel(
  'Unified Action Center',
  'Centralized review actions, pending client sign-offs, and compliance escalations.',
);
export const AICreditUsageManager = makePanel(
  'AI Governance & Usage Controls',
  'Tracks governed AI proposal credits and policy limits across workspaces.',
);
export const TaxGuardVoiceAssistant = makePanel(
  'TaxGuard Concierge Assistant',
  'Guided navigation and workflow status support within authorized workspace boundaries.',
);
export const TaxPlanningScenarioModeler = makePanel(
  'Tax Planning Scenario Modeler',
  'Compare entity elections, retirement contributions, and multi-year tax projections.',
);
export const EntityRelationshipGraph = makePanel(
  'Entity Relationship Graph',
  'Visualizes ownership structure, pass-through K-1 flows, and filing jurisdictions.',
);
export const EstimatedPaymentsCenter = makePanel(
  'Estimated Payments Center',
  'Quarterly federal and state safe-harbor installment schedule and payment tracking.',
);
export const AuditEventViewer = makePanel(
  'Audit Event Viewer',
  'Immutable trail of document custody, review decisions, and access events.',
);
export const AIGovernancePanel = makePanel(
  'AI Governance Panel',
  'Enforces human-in-the-loop sign-off and deterministic calculation authority.',
);
export const TaxResolutionCenter = makePanel(
  'Tax Resolution Center',
  'Tracks IRS/state notices, response deadlines, and power-of-attorney filings.',
);
export const SmartFormWorkspace = makePanel(
  'Smart Form Workspace',
  'Structured IRS and state form field mapping with lineage traceability.',
);
export const WorkpaperEditor = makePanel(
  'Workpaper Editor',
  'Preparer and reviewer workpaper schedules with audit trails.',
);
export const MissingItemsPanel = makePanel(
  'Missing Items Panel',
  'Tracks outstanding client documents and open preparation requests.',
);
export const DiscrepancyPanel = makePanel(
  'Discrepancy Panel',
  'Flags cross-document mismatches and variance checks for human resolution.',
);
export const AIResearchAssistant = makePanel(
  'AI Research Assistant',
  'Surfaces statutory citations and internal guidance proposals for CPA verification.',
);
export const DraftReturnPreparer = makePanel(
  'Draft Return Preparer',
  'Compiles verified workpapers and form mappings into draft return schedules.',
);
export const FixedAssetRegister = makePanel(
  'Fixed Asset Register',
  'Maintains MACRS, Section 179, and bonus depreciation schedules.',
);
export const DocumentScanner = makePanel(
  'Document Scanner',
  'Secure intake scanner for W-2, 1099, K-1, and supporting tax records.',
);
export const DocumentUploadQueue = makePanel(
  'Document Upload Queue',
  'Displays uploaded files, malware scan status, and classification progress.',
);
export const VerificationPanel = makePanel(
  'Verification Panel',
  'Confirms source completeness and identity verification gates.',
);
export const ClassificationReview = makePanel(
  'Classification Review',
  'Reviews automated document categorization before posting to workpapers.',
);
export const ExtractionReview = makePanel(
  'Extraction Review',
  'Side-by-side verification of extracted tax form fields.',
);
export const ProfessionalReviewQueue = makePanel(
  'Professional Review Queue',
  'Prioritized queue of returns and workpapers awaiting CPA sign-off.',
);
export const ApprovalGate = makePanel(
  'Approval Gate',
  'Enforces dual-control maker-checker authorization prior to release.',
);
export const SideBySideReviewWorkspace = makePanel(
  'Side-by-Side Review Workspace',
  'Compares source evidence, workpapers, and draft return lines simultaneously.',
);
export const BrandedDeliverablesGenerator = makePanel(
  'Branded Deliverables Generator',
  'Prepares client-ready tax summary packages and authorization packets.',
);
