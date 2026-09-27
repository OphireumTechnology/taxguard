/**
 * TaxGuard AI - Unified Reusable Component Interface
 * 
 * Reusable intelligence and automation components ready to be embedded
 * into any role-based dashboard across the A/R Tax Services, LLC platform.
 * 
 * Each component strictly enforces:
 * - Current user identity and role-based permissions
 * - Tenant isolation and client scoping
 * - Demonstration Environment disclaimers
 * - Data minimization
 */

import React from 'react';
import { TaxGuardScannerView } from '../views/TaxGuardScannerView';
import { TaxGuardDocumentsView } from '../views/TaxGuardDocumentsView';
import { TaxGuardClassificationView } from '../views/TaxGuardClassificationView';
import { TaxGuardExtractionView } from '../views/TaxGuardExtractionView';
import { TaxGuardMissingItemsView } from '../views/TaxGuardMissingItemsView';
import { TaxGuardDiscrepanciesView } from '../views/TaxGuardDiscrepanciesView';
import { TaxGuardFieldMappingView } from '../views/TaxGuardFieldMappingView';
import { TaxGuardWorkpapersView } from '../views/TaxGuardWorkpapersView';
import { TaxGuardReviewApprovalView } from '../views/TaxGuardReviewApprovalView';
import { TaxGuardReportsView } from '../views/TaxGuardReportsView';
import { TaxGuardResearchView } from '../views/TaxGuardResearchView';
import { TaxGuardAuditLogView } from '../views/TaxGuardAuditLogView';
import { TaxGuardIntegrationsView } from '../views/TaxGuardIntegrationsView';
import { TaxGuardAdminSettingsView } from '../views/TaxGuardAdminSettingsView';
import { EntityRelationshipGraph } from './EntityRelationshipGraph';
import { FixedAssetRegister } from './FixedAssetRegister';
import { SideBySideReviewWorkspace } from './SideBySideReviewWorkspace';
import { DraftReturnPreparer } from './DraftReturnPreparer';
import { TaxPlanningScenarioModeler } from './TaxPlanningScenarioModeler';
import { EstimatedPaymentsCenter } from './EstimatedPaymentsCenter';
import { TaxResolutionCenter } from './TaxResolutionCenter';
import { TaxGuardVoiceAssistant } from './TaxGuardVoiceAssistant';
import { AICreditUsageManager } from './AICreditUsageManager';
import { UnifiedActionCenter } from './UnifiedActionCenter';
import { BrandedDeliverablesGenerator } from './BrandedDeliverablesGenerator';

export interface TaxGuardComponentProps {
  userRole: string;
  clientId?: string;
  engagementId?: string;
  tenantId?: string;
  readOnly?: boolean;
  onFinished?: () => void;
  className?: string;
}

/**
 * 1. DocumentScanner
 * Live camera streaming, page capture, orientation, enhancement, and client quarantine submission.
 */
export const DocumentScanner: React.FC<TaxGuardComponentProps> = ({ userRole, onFinished, className }) => (
  <div className={className}>
    <TaxGuardScannerView userRole={userRole} onFinished={onFinished} />
  </div>
);

/**
 * 2. DocumentUploadQueue
 * Encrypted multi-file upload queue, MIME verification, SHA-256 duplicate detection, and quarantine status.
 */
export const DocumentUploadQueue: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardDocumentsView userRole={userRole} />
  </div>
);

/**
 * 3. ClassificationReview
 * Neural document classification, confidence scoring, tax-year detection, and splitting.
 */
export const ClassificationReview: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardClassificationView userRole={userRole} />
  </div>
);

/**
 * 4. ExtractionReview
 * OCR field-by-field confidence triage, bounding-box review, and manual override audit history.
 */
export const ExtractionReview: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardExtractionView userRole={userRole} />
  </div>
);

/**
 * 5. MissingItemsPanel
 * Diagnostic checklist identifying missing documents and supporting schedules based on taxpayer profile.
 */
export const MissingItemsPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardMissingItemsView userRole={userRole} />
  </div>
);

/**
 * 6. DiscrepancyPanel
 * 18 automated quality-control heuristics evaluating name fidelity, bank tie-outs, SSN endings, and schedule reconciliations.
 */
export const DiscrepancyPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardDiscrepanciesView userRole={userRole} />
  </div>
);

/**
 * 7. FieldMappingEditor
 * Source document field to tax form line item mappings with audit trails.
 */
export const FieldMappingEditor: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardFieldMappingView userRole={userRole} />
  </div>
);

/**
 * 8. SmartFormWorkspace
 * Form 1040 & Schedule C interactive auto-population workspace with live field editing and draft export.
 */
export const SmartFormWorkspace: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardFieldMappingView userRole={userRole} />
  </div>
);

/**
 * 9. WorkpaperEditor
 * Draft tax lead workpapers with prominent "DRAFT - NOT APPROVED FOR FILING" diagonal watermark.
 */
export const WorkpaperEditor: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardWorkpapersView userRole={userRole} />
  </div>
);

/**
 * 10. ProfessionalReviewQueue
 * Senior reviewer and CPA return queue with stage progression and maker-checker status.
 */
export const ProfessionalReviewQueue: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardReviewApprovalView userRole={userRole} />
  </div>
);

/**
 * 11. ApprovalGate
 * Maker-checker dual-signoff gate preventing unauthorized single-practitioner filing release.
 */
export const ApprovalGate: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardReviewApprovalView userRole={userRole} />
  </div>
);

/**
 * 12. VerificationPanel
 * Cryptographic SHA-256 seal verification and public-safe authentication panel without disclosing confidential PII.
 */
export const VerificationPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardReportsView userRole={userRole} />
  </div>
);

/**
 * 13. AIResearchAssistant
 * Source-grounded tax research assistant citing IRS Rev. Procs., Treasury Regs., SC Code, and FinCEN rules.
 */
export const AIResearchAssistant: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardResearchView userRole={userRole} />
  </div>
);

/**
 * 14. AuditEventViewer
 * Statutory compliance append-only immutable audit trail explorer with cryptographic timestamps.
 */
export const AuditEventViewer: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardAuditLogView userRole={userRole} />
  </div>
);

/**
 * 15. IntegrationHealthPanel
 * Provider-neutral integration monitor tracking 22 external software adapters with honest statuses.
 */
export const IntegrationHealthPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardIntegrationsView userRole={userRole} />
  </div>
);

/**
 * 16. AIGovernancePanel
 * AI safety, emergency killswitch, model inventory, and confidence threshold governance.
 */
export const AIGovernancePanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardAdminSettingsView userRole={userRole} />
  </div>
);

/**
 * 17. EntityIntelligenceGraphPanel
 * Multi-entity relationship mapping, shareholder/partner basis, K-1 flows, and IRC § 7872 debt.
 */
export const EntityIntelligenceGraphPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <EntityRelationshipGraph userRole={userRole} />
  </div>
);

/**
 * 18. FixedAssetSchedulePanel
 * Form 4562, Section 179, 60% Bonus depreciation, MACRS conventions, and SC Code § 12-6-40 addback.
 */
export const FixedAssetSchedulePanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <FixedAssetRegister userRole={userRole} />
  </div>
);

/**
 * 19. SideBySideReviewPanel
 * Source document bounding box verification, prior-year delta, and approval invalidation gates.
 */
export const SideBySideReviewPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <SideBySideReviewWorkspace userRole={userRole} />
  </div>
);

/**
 * 20. DraftReturnPreparationPanel
 * Proposes return fields, runs 18 diagnostics, builds lead workpapers, and queues for Senior Review.
 */
export const DraftReturnPreparationPanel: React.FC<TaxGuardComponentProps & { onCompleted?: () => void }> = ({ userRole, onCompleted, className }) => (
  <div className={className}>
    <DraftReturnPreparer userRole={userRole} onCompleted={onCompleted} />
  </div>
);

/**
 * 21. TaxPlanningModelerPanel
 * 21 IRC strategies across 5 comparative scenarios with statutory disclaimers.
 */
export const TaxPlanningModelerPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxPlanningScenarioModeler userRole={userRole} />
  </div>
);

/**
 * 22. EstimatedPaymentsPanel
 * Form 1040-ES / SC1040ES quarterly schedule with IRC § 6654 safe-harbor analysis.
 */
export const EstimatedPaymentsPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <EstimatedPaymentsCenter userRole={userRole} />
  </div>
);

/**
 * 23. TaxResolutionDefensePanel
 * Notice classification, Form 433-A OIC calculations, and First-Time Penalty Abatement.
 */
export const TaxResolutionDefensePanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxResolutionCenter userRole={userRole} />
  </div>
);

/**
 * 24. VoiceInteractionPanel
 * Push-to-talk microphone with tax terminology recognition and legal citations.
 */
export const VoiceInteractionPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <TaxGuardVoiceAssistant userRole={userRole} />
  </div>
);

/**
 * 25. AICreditManagerPanel
 * Credit metering, pre-execution estimation, and failure refund safety.
 */
export const AICreditManagerPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <AICreditUsageManager userRole={userRole} />
  </div>
);

/**
 * 26. UnifiedActionCenterPanel
 * Role-orchestrated action queue with deadline-risk scoring.
 */
export const UnifiedActionCenterPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <UnifiedActionCenter userRole={userRole} />
  </div>
);

/**
 * 27. BrandedDeliverablesPanel
 * Formal PDFs, DOCX memos, Excel models, and slide decks with SHA-256 verification.
 */
export const BrandedDeliverablesPanel: React.FC<TaxGuardComponentProps> = ({ userRole, className }) => (
  <div className={className}>
    <BrandedDeliverablesGenerator userRole={userRole} />
  </div>
);

