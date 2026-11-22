import React from 'react';

export { TaxGuardDiscrepanciesView } from './views/TaxGuardDiscrepanciesView';
export { STAGE_CAPABILITIES, BLOCKED_STAGES, getStageCapability, stageCapability } from './stageCapabilities';
export type { StageCapability } from './stageCapabilities';
export { AIReasoningGateway } from './intelligence/ai/AIReasoningGateway';
export { HumanReviewBridge } from './intelligence/review/HumanReviewBridge';
export { DecisionTraceLedger } from './intelligence/trace/DecisionTraceLedger';
export type * from './intelligence/types';

function makeTaxGuardModule(title: string): React.FC<any> {
  const Component: React.FC<any> = ({ className = '', children }) =>
    React.createElement(
      'section',
      {
        className: `rounded-xl border border-slate-700/70 bg-[#0D2745]/70 p-4 text-sm text-slate-200 ${className}`.trim(),
        'aria-label': title,
      },
      React.createElement('h3', { className: 'font-semibold text-white mb-1' }, title),
      React.createElement(
        'p',
        { className: 'text-xs text-slate-400' },
        'Governed workspace module awaiting live practice authorization.'
      ),
      children || null
    );
  Component.displayName = title.replace(/\s+/g, '');
  return Component;
}

export const SmartFormWorkspace = makeTaxGuardModule('Smart Form Workspace');
export const WorkpaperEditor = makeTaxGuardModule('Workpaper Editor');
export const MissingItemsPanel = makeTaxGuardModule('Missing Items Panel');
export const DiscrepancyPanel = makeTaxGuardModule('Discrepancy Panel');
export const AIResearchAssistant = makeTaxGuardModule('AI Research Assistant');
export const DraftReturnPreparer = makeTaxGuardModule('Draft Return Preparer');
export const FixedAssetRegister = makeTaxGuardModule('Fixed Asset Register');
export const EntityRelationshipGraph = makeTaxGuardModule('Entity Relationship Graph');
export const IntegrationHealthPanel = makeTaxGuardModule('Integration Health Panel');
export const UnifiedActionCenter = makeTaxGuardModule('Unified Action Center');
export const AICreditUsageManager = makeTaxGuardModule('AI Credit Usage Manager');
export const TaxGuardVoiceAssistant = makeTaxGuardModule('TaxGuard Voice Assistant');
export const TaxPlanningScenarioModeler = makeTaxGuardModule('Tax Planning Scenario Modeler');
export const EstimatedPaymentsCenter = makeTaxGuardModule('Estimated Payments Center');
export const DocumentScanner = makeTaxGuardModule('Document Scanner');
export const DocumentUploadQueue = makeTaxGuardModule('Document Upload Queue');
export const VerificationPanel = makeTaxGuardModule('Verification Panel');
export const AuditEventViewer = makeTaxGuardModule('Audit Event Viewer');
export const AIGovernancePanel = makeTaxGuardModule('AI Governance Panel');
export const TaxResolutionCenter = makeTaxGuardModule('Tax Resolution Center');
export const ClassificationReview = makeTaxGuardModule('Classification Review');
export const ExtractionReview = makeTaxGuardModule('Extraction Review');
export const ProfessionalReviewQueue = makeTaxGuardModule('Professional Review Queue');
export const ApprovalGate = makeTaxGuardModule('Approval Gate');
export const SideBySideReviewWorkspace = makeTaxGuardModule('Side-by-Side Review Workspace');
export const BrandedDeliverablesGenerator = makeTaxGuardModule('Branded Deliverables Generator');
