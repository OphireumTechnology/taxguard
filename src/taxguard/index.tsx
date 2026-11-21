import React from 'react';
import { ShieldCheck } from 'lucide-react';

export interface TaxGuardModuleProps {
  userRole?: string;
  [key: string]: unknown;
}

function createModulePanel(title: string, subtitle: string): React.FC<TaxGuardModuleProps> {
  const ModulePanel: React.FC<TaxGuardModuleProps> = ({ userRole }) => (
    <section className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-5 space-y-2 text-slate-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#D4A843]" aria-hidden="true" />
          <h3 className="font-semibold text-white text-sm">{title}</h3>
        </div>
        {userRole && (
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#071A2E] text-[#D4A843] border border-[rgba(212,168,67,0.3)]">
            {userRole}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{subtitle}</p>
    </section>
  );
  ModulePanel.displayName = title.replace(/\s+/g, '');
  return ModulePanel;
}

export const SmartFormWorkspace = createModulePanel(
  'Smart Form Workspace',
  'Structured federal and state form field mapping workspace with workpaper traceability.'
);
export const WorkpaperEditor = createModulePanel(
  'Workpaper Editor',
  'Linked tax workpapers, book-to-tax schedules, and source evidence citations.'
);
export const MissingItemsPanel = createModulePanel(
  'Missing Items Panel',
  'Open taxpayer document checklist and pending verification requests.'
);
export const DiscrepancyPanel = createModulePanel(
  'Discrepancy Panel',
  'Cross-document reconciliation alerts awaiting licensed preparer verification.'
);
export const AIResearchAssistant = createModulePanel(
  'Tax Research Assistant',
  'IRC, Treasury Regulation, and revenue ruling lookup workspace with human sign-off.'
);
export const DraftReturnPreparer = createModulePanel(
  'Draft Return Preparer',
  'Draft tax return assembly and schedule verification controls.'
);
export const FixedAssetRegister = createModulePanel(
  'Fixed Asset Register',
  'Depreciation schedules, MACRS recovery classes, and Section 179 tracking.'
);
export const EntityRelationshipGraph = createModulePanel(
  'Entity Relationship Graph',
  'Pass-through ownership structure, K-1 linkages, and related-party mapping.'
);
export const IntegrationHealthPanel = createModulePanel(
  'Integration Health Panel',
  'Operational readiness status across storage, identity, and accounting connectors.'
);
export const UnifiedActionCenter = createModulePanel(
  'Unified Action Center',
  'Prioritized practice approvals, escalations, and operational tasks.'
);
export const AICreditUsageManager = createModulePanel(
  'AI Governance & Usage Manager',
  'Governed workspace quotas, policy controls, and execution audit summaries.'
);
export const TaxGuardVoiceAssistant = createModulePanel(
  'Advisor Voice Notes & Concierge',
  'Structured consultation note capture and taxpayer guidance tools.'
);
export const TaxPlanningScenarioModeler = createModulePanel(
  'Tax Planning Scenario Modeler',
  'Multi-year entity election, deduction timing, and quarterly estimate projections.'
);
export const EstimatedPaymentsCenter = createModulePanel(
  'Estimated Payments Center',
  'Federal and state quarterly estimated tax schedules and safe-harbor tracking.'
);
export const DocumentScanner = createModulePanel(
  'Document Scanner',
  'Secure capture and intake staging for W-2, 1099, K-1, and financial records.'
);
export const DocumentUploadQueue = createModulePanel(
  'Document Upload Queue',
  'Encrypted upload staging queue with malware inspection and classification.'
);
export const VerificationPanel = createModulePanel(
  'Verification Panel',
  'Source document completeness and taxpayer identity verification checklist.'
);
export const AuditEventViewer = createModulePanel(
  'Audit Event Viewer',
  'Append-only chain of custody and security access logs.'
);
export const AIGovernancePanel = createModulePanel(
  'AI Governance Panel',
  'Policy guardrails, human-in-the-loop gates, and model commissioning controls.'
);
export const TaxResolutionCenter = createModulePanel(
  'Tax Resolution Center',
  'IRS and state notice tracking, response deadlines, and representation workpapers.'
);
export const ClassificationReview = createModulePanel(
  'Classification Review',
  'Human review of tax form type classification and tax year attribution.'
);
export const ExtractionReview = createModulePanel(
  'Extraction Review',
  'Field-level review of extracted tax form boxes against source PDFs.'
);
export const ProfessionalReviewQueue = createModulePanel(
  'Professional Review Queue',
  'Senior CPA quality control queue for return sign-off and release.'
);
export const ApprovalGate = createModulePanel(
  'Approval Gate',
  'Mandatory dual-sign-off authorization gate prior to client package delivery.'
);
export const SideBySideReviewWorkspace = createModulePanel(
  'Side-by-Side Review Workspace',
  'Prior-year vs. current-year variance review and source document inspection.'
);
export const BrandedDeliverablesGenerator = createModulePanel(
  'Branded Deliverables Generator',
  'Client-ready executive tax summary and filing instruction package builder.'
);
