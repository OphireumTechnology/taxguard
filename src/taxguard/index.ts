import React from 'react';

export * from './stageCapabilities';

const createStubComponent = (name: string): React.FC<any> => {
  const Component: React.FC<any> = (props) => {
    return React.createElement(
      'div',
      { className: 'p-4 rounded-xl border border-slate-700 bg-[#0B1E36] text-slate-200' },
      React.createElement(
        'div',
        { className: 'flex items-center justify-between mb-2' },
        React.createElement('h4', { className: 'font-semibold text-white' }, name),
        React.createElement('span', { className: 'text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50' }, 'Operational')
      ),
      React.createElement('p', { className: 'text-xs text-slate-400' }, 'Integrated module active in demonstration mode.'),
      props.children
    );
  };
  Component.displayName = name;
  return Component;
};

export const EstimatedPaymentsCenter = createStubComponent('EstimatedPaymentsCenter');
export const AICreditUsageManager = createStubComponent('AICreditUsageManager');
export const IntegrationHealthPanel = createStubComponent('IntegrationHealthPanel');
export const UnifiedActionCenter = createStubComponent('UnifiedActionCenter');
export const TaxGuardVoiceAssistant = createStubComponent('TaxGuardVoiceAssistant');
export const AuditEventViewer = createStubComponent('AuditEventViewer');
export const AIGovernancePanel = createStubComponent('AIGovernancePanel');
export const TaxResolutionCenter = createStubComponent('TaxResolutionCenter');
export const TaxPlanningScenarioModeler = createStubComponent('TaxPlanningScenarioModeler');
export const EntityRelationshipGraph = createStubComponent('EntityRelationshipGraph');
export const VerificationPanel = createStubComponent('VerificationPanel');
export const ClassificationReview = createStubComponent('ClassificationReview');
export const ExtractionReview = createStubComponent('ExtractionReview');
export const DiscrepancyPanel = createStubComponent('DiscrepancyPanel');
export const AIResearchAssistant = createStubComponent('AIResearchAssistant');
export const DocumentScanner = createStubComponent('DocumentScanner');
export const DocumentUploadQueue = createStubComponent('DocumentUploadQueue');
export const MissingItemsPanel = createStubComponent('MissingItemsPanel');
export const SmartFormWorkspace = createStubComponent('SmartFormWorkspace');
export const WorkpaperEditor = createStubComponent('WorkpaperEditor');
export const DraftReturnPreparer = createStubComponent('DraftReturnPreparer');
export const FixedAssetRegister = createStubComponent('FixedAssetRegister');
export const ProfessionalReviewQueue = createStubComponent('ProfessionalReviewQueue');
export const ApprovalGate = createStubComponent('ApprovalGate');
export const SideBySideReviewWorkspace = createStubComponent('SideBySideReviewWorkspace');
export const BrandedDeliverablesGenerator = createStubComponent('BrandedDeliverablesGenerator');
