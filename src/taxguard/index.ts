/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

const createStubComponent = (name: string): React.FC<any> => {
  const Component: React.FC<any> = () => {
    return React.createElement(
      'div',
      { className: 'p-4 rounded-xl border border-slate-700 bg-[#0D2745] text-slate-200' },
      React.createElement('h3', { className: 'font-semibold text-white mb-2' }, name),
      React.createElement('p', { className: 'text-xs text-slate-400' }, 'Component active in demonstration mode.')
    );
  };
  Component.displayName = name;
  return Component;
};

export const SmartFormWorkspace = createStubComponent('SmartFormWorkspace');
export const WorkpaperEditor = createStubComponent('WorkpaperEditor');
export const MissingItemsPanel = createStubComponent('MissingItemsPanel');
export const DiscrepancyPanel = createStubComponent('DiscrepancyPanel');
export const AIResearchAssistant = createStubComponent('AIResearchAssistant');
export const DraftReturnPreparer = createStubComponent('DraftReturnPreparer');
export const FixedAssetRegister = createStubComponent('FixedAssetRegister');
export const EntityRelationshipGraph = createStubComponent('EntityRelationshipGraph');

export const ProfessionalReviewQueue = createStubComponent('ProfessionalReviewQueue');
export const ApprovalGate = createStubComponent('ApprovalGate');
export const SideBySideReviewWorkspace = createStubComponent('SideBySideReviewWorkspace');
export const BrandedDeliverablesGenerator = createStubComponent('BrandedDeliverablesGenerator');

export const IntegrationHealthPanel = createStubComponent('IntegrationHealthPanel');
export const UnifiedActionCenter = createStubComponent('UnifiedActionCenter');
export const AICreditUsageManager = createStubComponent('AICreditUsageManager');
export const TaxGuardVoiceAssistant = createStubComponent('TaxGuardVoiceAssistant');
export const TaxPlanningScenarioModeler = createStubComponent('TaxPlanningScenarioModeler');
export const EstimatedPaymentsCenter = createStubComponent('EstimatedPaymentsCenter');
export const DocumentScanner = createStubComponent('DocumentScanner');
export const DocumentUploadQueue = createStubComponent('DocumentUploadQueue');
export const VerificationPanel = createStubComponent('VerificationPanel');
export const AuditEventViewer = createStubComponent('AuditEventViewer');
export const AIGovernancePanel = createStubComponent('AIGovernancePanel');
export const TaxResolutionCenter = createStubComponent('TaxResolutionCenter');
export const ClassificationReview = createStubComponent('ClassificationReview');
export const ExtractionReview = createStubComponent('ExtractionReview');
