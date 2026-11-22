import React from 'react';

interface GenericPanelProps {
  title?: string;
  [key: string]: any;
}

const createTaxGuardPanel = (defaultTitle: string): React.FC<GenericPanelProps> => {
  const Panel: React.FC<GenericPanelProps> = ({ title = defaultTitle }) => (
    <div className="rounded-xl border border-slate-700/50 bg-[#0D2745] p-5 text-slate-100">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-300">
        {title} is connected to the Destria TaxGuard workflow layer.
      </p>
    </div>
  );
  Panel.displayName = defaultTitle.replace(/\s+/g, '');
  return Panel;
};

export const SmartFormWorkspace = createTaxGuardPanel('Smart Form Workspace');
export const WorkpaperEditor = createTaxGuardPanel('Workpaper Editor');
export const MissingItemsPanel = createTaxGuardPanel('Missing Items');
export const DiscrepancyPanel = createTaxGuardPanel('Discrepancy Panel');
export const AIResearchAssistant = createTaxGuardPanel('AI Research Assistant');
export const DraftReturnPreparer = createTaxGuardPanel('Draft Return Preparer');
export const FixedAssetRegister = createTaxGuardPanel('Fixed Asset Register');
export const EntityRelationshipGraph = createTaxGuardPanel('Entity Relationship Graph');
export const IntegrationHealthPanel = createTaxGuardPanel('Integration Health');
export const UnifiedActionCenter = createTaxGuardPanel('Unified Action Center');
export const AICreditUsageManager = createTaxGuardPanel('AI Usage & Controls');
export const TaxGuardVoiceAssistant = createTaxGuardPanel('TaxGuard Assistant');
export const TaxPlanningScenarioModeler = createTaxGuardPanel('Tax Planning Scenario Modeler');
export const EstimatedPaymentsCenter = createTaxGuardPanel('Estimated Payments Center');
export const DocumentScanner = createTaxGuardPanel('Document Scanner');
export const DocumentUploadQueue = createTaxGuardPanel('Document Upload Queue');
export const VerificationPanel = createTaxGuardPanel('Verification Panel');
export const AuditEventViewer = createTaxGuardPanel('Audit Event Viewer');
export const AIGovernancePanel = createTaxGuardPanel('AI Governance Panel');
export const TaxResolutionCenter = createTaxGuardPanel('Tax Resolution Center');
export const ClassificationReview = createTaxGuardPanel('Classification Review');
export const ExtractionReview = createTaxGuardPanel('Extraction Review');
export const ProfessionalReviewQueue = createTaxGuardPanel('Professional Review Queue');
export const ApprovalGate = createTaxGuardPanel('Approval Gate');
export const SideBySideReviewWorkspace = createTaxGuardPanel('Side-by-Side Review Workspace');
export const BrandedDeliverablesGenerator = createTaxGuardPanel('Branded Deliverables');
