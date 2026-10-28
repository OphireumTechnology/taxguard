/**
 * A/R Tax Services, LLC — TaxGuard AI
 * Stage 02: Master Document Intelligence, Recognition & Requirement Reconciliation Engine
 *
 * Implements deterministic reconciliation for Stage 02 (Collect):
 * 1. Loads authoritative taxpayer facts (questionnaire, profile, dossier)
 * 2. Computes applicable requirements dynamically (with source/entity cardinality)
 * 3. Loads authorized documents for the authenticated client & tax year
 * 4. Inspects security & quarantine status (fail-closed uncommissioned scanners)
 * 5. Evaluates document classifications, detected forms, tax years, and taxpayers
 * 6. Matches eligible evidence to requirements (handling multi-employers, corrected forms, duplicates)
 * 7. Isolates wrong-year (e.g. 2024 vs 2025) and wrong-taxpayer evidence
 * 8. Evaluates missing, processing, needs-review, and accepted items
 * 9. Computes authoritative collection progress & readiness metrics
 * 10. Synchronizes all caches (ChecklistRequirement, TaxRequirementManifest, serverCaseRequirements)
 * 11. Produces a single authoritative Stage 02 snapshot model
 */

import { StageOneOnboardingService } from './stageOneOnboardingService';
import {
  TaxDocumentRequirementEngine,
  TaxDiscoveryQuestionnaireAnswers,
  DEFAULT_QUESTIONNAIRE_ANSWERS
} from './taxDocumentRequirementEngine';
import {
  TaxRequirementManifestEngine,
  TaxRequirementManifest,
  TaxRequirementItem,
  StageTwoCollectionException
} from './stageTwoRequirementManifest';
import {
  StageTwoCollectionService,
  ChecklistRequirement,
  StageTwoUploadedDocument,
  CollectionReadinessReport
} from './stageTwoCollectionService';
import {
  StageTwoIntakeSecurityService,
  StagedSecurityDocument
} from './stageTwoIntakeSecurityService';
import {
  StageTwoMatchingEngine,
  DocumentExtractionEnvelope,
  RecognizedDocumentType
} from './stageTwoMatchingEngine';
import { TaxGuardAuditService } from '../taxguard/services/TaxGuardAuditService';

// ============================================================================
// DATA MODELS
// ============================================================================

export type RequirementReconciliationStatus =
  | 'MISSING'
  | 'UPLOADED_PROCESSING'
  | 'NEEDS_REVIEW'
  | 'ACCEPTED'
  | 'RECEIVED'
  | 'NOT_APPLICABLE'
  | 'REJECTED'
  | 'SUPERSEDED';

export interface ReconciledRequirementCard {
  requirementId: string;
  taxYear: number;
  formNumber: string;
  documentType: string;
  title: string;
  expectedSource?: string;
  whyDoWeNeedIt: string;
  whereCanIGetIt: string;
  statutoryBasis: string;
  priority: 'Required' | 'Required if applicable' | 'Recommended' | 'Optional';
  status: RequirementReconciliationStatus;
  statusClientLabel: string;
  matchedDocumentIds: string[];
  matchedDocumentNames: string[];
  matchedDocumentStatus?: string;
  reviewNotes?: string;
  notApplicableReason?: string;
  notApplicableDeclaredAt?: string;
  isActionable: boolean;
  blockingReason?: string;
}

export interface ReconciledCollectionMetrics {
  totalApplicable: number;
  totalRequired: number;
  missingCount: number;
  receivedCount: number;
  acceptedCount: number;
  processingCount: number;
  needsReviewCount: number;
  notApplicableCount: number;
  optionalCount: number;
  collectionProgressPercent: number;
  isReadyForStageThree: boolean;
  exitGateBlockers: string[];
}

export interface StageTwoAuthoritativeSnapshot {
  caseId: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  stage: 'STAGE_02_COLLECT';
  stageStatus: 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'COMPLETED';
  metrics: ReconciledCollectionMetrics;
  missingRequirements: ReconciledRequirementCard[];
  processingRequirements: ReconciledRequirementCard[];
  reviewRequirements: ReconciledRequirementCard[];
  completedRequirements: ReconciledRequirementCard[];
  allRequirements: ReconciledRequirementCard[];
  reconciledRequirements?: ReconciledRequirementCard[];
  uploadedDocuments: StageTwoUploadedDocument[];
  quarantinedDocuments: StagedSecurityDocument[];
  activeExceptions: StageTwoCollectionException[];
  nextRequiredActions: Array<{
    actionType: 'UPLOAD' | 'REVIEW' | 'CONFIRM_NA' | 'ANSWER_QUESTIONS' | 'STAFF_REVIEW';
    title: string;
    description: string;
    requirementId?: string;
  }>;
  reconciledAt: string;
}

// ============================================================================
// MASTER RECONCILIATION SERVICE
// ============================================================================

export class StageTwoReconciliationService {
  private static snapshotCache = new Map<string, StageTwoAuthoritativeSnapshot>();

  /**
   * Main entrypoint: Reconciles all Stage 02 collection state deterministically.
   */
  public static reconcileStageTwoCollection(params: {
    clientId: string;
    taxYear: number;
    engagementId?: string;
    tenantId?: string;
    forceRefresh?: boolean;
    uploads?: StageTwoUploadedDocument[];
    questionnaire?: TaxDiscoveryQuestionnaireAnswers;
    clientName?: string;
    expectedTaxpayerName?: string;
  }): StageTwoAuthoritativeSnapshot {
    const { clientId, taxYear } = params;
    const engagementId = params.engagementId || `ENG-${taxYear}-${clientId}`;
    const cacheKey = `${clientId}_${taxYear}`;

    // 1. Save / Load Questionnaire FIRST
    if (params.questionnaire) {
      TaxDocumentRequirementEngine.saveQuestionnaire(clientId, taxYear, params.questionnaire);
    }
    const questionnaire: TaxDiscoveryQuestionnaireAnswers =
      params.questionnaire || TaxDocumentRequirementEngine.getQuestionnaire(clientId, taxYear);

    // 2. Load Persisted Uploads & Staged Documents for THIS Client & Tax Year
    if (params.uploads) {
      StageTwoCollectionService.setUploadedDocuments(clientId, taxYear, params.uploads);
    }
    const uploads = params.uploads || StageTwoCollectionService.getUploadedDocuments(clientId, taxYear);
    const stagedDocs = StageTwoIntakeSecurityService.getStagedDocuments(clientId, taxYear);

    // 3. Load Authoritative Taxpayer Facts
    const dossier = StageOneOnboardingService.getDossier(clientId);
    const clientName = params.clientName || dossier?.legalName || uploads[0]?.uploadedBy || 'David Robert Anderson';
    const primaryJurisdiction = dossier?.residentialOrPrincipalAddress?.state || questionnaire.residentState || 'SC';

    // 4. Retrieve / Initialize Manifest
    const manifest = TaxRequirementManifestEngine.getOrCreateManifest(clientId, taxYear, engagementId);

    if (!manifest.taxpayerName) {
      manifest.taxpayerName = clientName;
    }
    if (!manifest.primaryJurisdiction) {
      manifest.primaryJurisdiction = primaryJurisdiction;
    }

    // 4. Compute Dynamic Applicable Requirements
    const candidateReqs = this.computeApplicableRequirements({
      clientId,
      taxYear,
      engagementId,
      clientName,
      primaryJurisdiction,
      questionnaire,
      dossier
    });

    // Merge existing manifest requirements if any (e.g. baseline or discovered requirements)
    if (manifest.requirements && manifest.requirements.length > 0) {
      for (const mReq of manifest.requirements) {
        if (!candidateReqs.some(c => c.requirementId === mReq.requirementId || (c.documentType === mReq.documentType && c.documentType.startsWith('1099-')))) {
          candidateReqs.push({
            requirementId: mReq.requirementId,
            taxYear: mReq.taxYear || taxYear,
            formNumber: mReq.formNumber || mReq.documentType,
            documentType: mReq.documentType as any,
            title: mReq.title,
            expectedSource: mReq.expectedSource,
            whyDoWeNeedIt: mReq.description || mReq.title,
            whereCanIGetIt: 'From issuing entity or employer',
            statutoryBasis: mReq.reasonRequired,
            priority: (mReq.priority as any) || 'Required'
          });
        }
      }
    }

    // 5. Filter Documents for Security, Wrong-Year, Wrong-Taxpayer & Duplicates
    const evaluatedDocs = this.evaluateUploadedDocuments({
      clientId,
      taxYear,
      clientName,
      uploads,
      stagedDocs,
      expectedTaxpayerName: manifest.taxpayerName || clientName
    });

    // 6. Match Evaluated Evidence to Requirements
    const reconciledCards: ReconciledRequirementCard[] = [];
    const usedDocumentIds = new Set<string>();

    for (const req of candidateReqs) {
      // Check if client previously declared Not Applicable
      const isNa = TaxDocumentRequirementEngine.isNotApplicable(clientId, taxYear, req.requirementId);
      if (isNa) {
        reconciledCards.push({
          ...req,
          status: 'NOT_APPLICABLE',
          statusClientLabel: 'Confirmed Not Applicable',
          matchedDocumentIds: [],
          matchedDocumentNames: [],
          isActionable: false
        });
        continue;
      }

      // Find matching eligible documents (handling multi-employer, form type, category)
      const matchingDocs = evaluatedDocs.filter(d => {
        if (usedDocumentIds.has(d.doc.documentId) && !req.expectedSource) {
          // Prevent same document from satisfying multiple generic requirements
          return false;
        }

        // Must match tax year (strict isolation: 2024 W-2 cannot satisfy 2025 requirement)
        if (d.detectedTaxYear && d.detectedTaxYear !== taxYear && !req.documentType.includes('Prior-Year')) {
          return false;
        }

        // Wrong taxpayer documents cannot satisfy
        if (d.isWrongTaxpayer) {
          return false;
        }

        // Quarantined / Infected / Invalid MIME cannot satisfy
        if (d.isSecurityBlocked) {
          return false;
        }

        // Rejected documents cannot satisfy
        if (d.doc.processingStatus === 'Rejected') {
          return false;
        }

        // Explicitly matched by orchestrator or manifest
        if (d.doc.associatedRequirementId === req.requirementId) {
          return true;
        }
        const manifestItem = manifest.requirements?.find(r => r.requirementId === req.requirementId);
        if (manifestItem && manifestItem.matchedDocumentIds?.includes(d.doc.documentId)) {
          return true;
        }

        // Check employer / source match if requirement expects a specific source
        if (req.expectedSource && d.detectedEmployerOrSource) {
          const reqSrc = req.expectedSource.toLowerCase();
          const docSrc = d.detectedEmployerOrSource.toLowerCase();
          if (docSrc.includes(reqSrc) || reqSrc.includes(docSrc)) {
            return true;
          }
          // If document specifies a DIFFERENT employer, it cannot satisfy this requirement
          if (d.detectedEmployerOrSource.length > 3 && !docSrc.includes('unknown') && !docSrc.includes('client')) {
            return false;
          }
        }

        // Form type & category match
        return this.isDocumentCompatibleWithRequirement(d.detectedType, d.doc.originalFileName, req);
      });

      if (matchingDocs.length === 0) {
        // Check if there is an unclassified or wrong-year doc uploaded
        const wrongYearDoc = evaluatedDocs.find(d =>
          d.detectedTaxYear && d.detectedTaxYear !== taxYear &&
          this.isDocumentCompatibleWithRequirement(d.detectedType, d.doc.originalFileName, req)
        );

        const wrongTaxpayerDoc = evaluatedDocs.find(d =>
          d.isWrongTaxpayer &&
          this.isDocumentCompatibleWithRequirement(d.detectedType, d.doc.originalFileName, req)
        );

        const quarantinedDoc = evaluatedDocs.find(d =>
          d.isSecurityBlocked &&
          this.isDocumentCompatibleWithRequirement(d.detectedType, d.doc.originalFileName, req)
        );

        if (quarantinedDoc) {
          reconciledCards.push({
            ...req,
            status: 'MISSING',
            statusClientLabel: 'Missing — Security Verification Blocked',
            matchedDocumentIds: [],
            matchedDocumentNames: [quarantinedDoc.doc.originalFileName],
            matchedDocumentStatus: 'Security Verification Blocked',
            isActionable: true,
            blockingReason: 'Security Verification Blocked: The uploaded document failed automated security checks.'
          });
        } else if (wrongYearDoc) {
          reconciledCards.push({
            ...req,
            status: 'MISSING',
            statusClientLabel: `Missing — Uploaded Document is for Tax Year ${wrongYearDoc.detectedTaxYear}`,
            matchedDocumentIds: [],
            matchedDocumentNames: [wrongYearDoc.doc.originalFileName],
            matchedDocumentStatus: `Tax Year Mismatch (${wrongYearDoc.detectedTaxYear})`,
            isActionable: true,
            blockingReason: `This document appears to be for tax year ${wrongYearDoc.detectedTaxYear}. Please provide tax year ${taxYear} document.`
          });
        } else if (wrongTaxpayerDoc) {
          reconciledCards.push({
            ...req,
            status: 'MISSING',
            statusClientLabel: 'Missing — Document Issued to Different Taxpayer',
            matchedDocumentIds: [],
            matchedDocumentNames: [wrongTaxpayerDoc.doc.originalFileName],
            matchedDocumentStatus: 'Taxpayer Identity Mismatch',
            isActionable: true,
            blockingReason: 'The uploaded document does not match the primary taxpayer name on this engagement.'
          });
        } else {
          reconciledCards.push({
            ...req,
            status: 'MISSING',
            statusClientLabel: 'Missing',
            matchedDocumentIds: [],
            matchedDocumentNames: [],
            isActionable: true
          });
        }
      } else {
        // Document(s) found! Use the most relevant/newest
        const primaryMatch = matchingDocs[0];
        usedDocumentIds.add(primaryMatch.doc.documentId);

        let finalStatus: RequirementReconciliationStatus = 'RECEIVED';
        let statusLabel = 'Received — Verified';

        if (primaryMatch.isNeedsReview || primaryMatch.classificationConfidence < 0.65) {
          finalStatus = 'NEEDS_REVIEW';
          statusLabel = 'Under Review by Accountant';
        } else if (primaryMatch.isAccepted || primaryMatch.doc.processingStatus === 'Accepted') {
          finalStatus = 'ACCEPTED';
          statusLabel = 'Accepted';
        } else if (primaryMatch.doc.processingStatus === 'Processing') {
          finalStatus = 'UPLOADED_PROCESSING';
          statusLabel = 'Processing Document Recognition';
        } else {
          finalStatus = 'RECEIVED';
          statusLabel = 'Received';
        }

        const existingManifestReq = manifest.requirements?.find(r => r.requirementId === req.requirementId);
        const resolvedMatchedDocIds = (existingManifestReq && existingManifestReq.matchedDocumentIds?.length > 0)
          ? existingManifestReq.matchedDocumentIds
          : [primaryMatch.doc.documentId];

        reconciledCards.push({
          ...req,
          status: finalStatus,
          statusClientLabel: statusLabel,
          matchedDocumentIds: resolvedMatchedDocIds,
          matchedDocumentNames: matchingDocs.map(m => m.doc.originalFileName),
          matchedDocumentStatus: primaryMatch.doc.processingStatus,
          isActionable: finalStatus === 'NEEDS_REVIEW'
        });
      }
    }

    // 7. Calculate Authoritative Collection Metrics
    const activeRequired = reconciledCards.filter(r => r.priority === 'Required');
    const totalRequired = Math.max(1, activeRequired.length);
    const totalApplicable = reconciledCards.length;

    const acceptedCount = activeRequired.filter(r => r.status === 'ACCEPTED').length;
    const receivedCount = activeRequired.filter(r => ['RECEIVED', 'ACCEPTED', 'NEEDS_REVIEW', 'UPLOADED_PROCESSING'].includes(r.status)).length;
    const processingCount = activeRequired.filter(r => r.status === 'UPLOADED_PROCESSING').length;
    const needsReviewCount = activeRequired.filter(r => r.status === 'NEEDS_REVIEW').length;
    const missingCount = activeRequired.filter(r => r.status === 'MISSING').length;
    const notApplicableCount = reconciledCards.filter(r => r.status === 'NOT_APPLICABLE').length;
    const optionalCount = reconciledCards.filter(r => r.priority === 'Optional' || r.priority === 'Recommended').length;

    const collectionProgressPercent = Math.min(100, Math.round((receivedCount / totalRequired) * 100));

    const exitGateBlockers: string[] = [];
    if (missingCount > 0) exitGateBlockers.push(`${missingCount} required document(s) still missing.`);
    if (needsReviewCount > 0) exitGateBlockers.push(`${needsReviewCount} document(s) require professional review.`);
    if (processingCount > 0) exitGateBlockers.push(`${processingCount} document(s) still undergoing verification.`);

    const isReadyForStageThree = missingCount === 0 && needsReviewCount === 0 && processingCount === 0 && (acceptedCount + notApplicableCount) >= totalRequired;

    // 8. Categorize Requirements for Client Presentation
    const missingRequirements = reconciledCards.filter(r => r.status === 'MISSING');
    const processingRequirements = reconciledCards.filter(r => r.status === 'UPLOADED_PROCESSING');
    const reviewRequirements = reconciledCards.filter(r => r.status === 'NEEDS_REVIEW');
    const completedRequirements = reconciledCards.filter(r => r.status === 'RECEIVED' || r.status === 'ACCEPTED' || r.status === 'NOT_APPLICABLE');

    // 9. Synchronize ChecklistRequirements Cache in StageTwoCollectionService
    this.synchronizeChecklistCache(clientId, taxYear, reconciledCards);

    // 10. Synchronize Manifest in TaxRequirementManifestEngine
    this.synchronizeManifest(manifest, reconciledCards, isReadyForStageThree, exitGateBlockers);

    // 11. Formulate Next Required Actions
    const nextActions: StageTwoAuthoritativeSnapshot['nextRequiredActions'] = [];
    if (missingRequirements.length > 0) {
      const firstMissing = missingRequirements[0];
      nextActions.push({
        actionType: 'UPLOAD',
        title: `Upload ${firstMissing.formNumber || firstMissing.title}`,
        description: `We still need your ${firstMissing.title} (${firstMissing.expectedSource || 'all sources'}) for tax year ${taxYear}.`,
        requirementId: firstMissing.requirementId
      });
    } else if (reviewRequirements.length > 0) {
      nextActions.push({
        actionType: 'REVIEW',
        title: 'Document Under Review',
        description: 'One or more of your documents requires accountant confirmation. You will be notified if changes are needed.'
      });
    } else if (isReadyForStageThree) {
      nextActions.push({
        actionType: 'STAFF_REVIEW',
        title: 'Stage 02 Collection Complete',
        description: 'All required tax records have been received and verified. Your return is ready for Stage 03 validation.'
      });
    }

    const snapshot: StageTwoAuthoritativeSnapshot = {
      caseId: engagementId,
      clientId,
      clientName,
      taxYear,
      stage: 'STAGE_02_COLLECT',
      stageStatus: isReadyForStageThree ? 'READY_FOR_REVIEW' : 'IN_PROGRESS',
      metrics: {
        totalApplicable,
        totalRequired,
        missingCount,
        receivedCount,
        acceptedCount,
        processingCount,
        needsReviewCount,
        notApplicableCount,
        optionalCount,
        collectionProgressPercent,
        isReadyForStageThree,
        exitGateBlockers
      },
      missingRequirements,
      processingRequirements,
      reviewRequirements,
      completedRequirements,
      allRequirements: reconciledCards,
      reconciledRequirements: reconciledCards,
      uploadedDocuments: uploads,
      quarantinedDocuments: stagedDocs.filter(s => s.quarantineStatus === 'QUARANTINED'),
      activeExceptions: manifest.exceptions.filter(e => e.status === 'OPEN'),
      nextRequiredActions: nextActions,
      reconciledAt: new Date().toISOString()
    };

    this.snapshotCache.set(cacheKey, snapshot);
    return snapshot;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private static computeApplicableRequirements(params: {
    clientId: string;
    taxYear: number;
    engagementId: string;
    clientName: string;
    primaryJurisdiction: string;
    questionnaire: TaxDiscoveryQuestionnaireAnswers;
    dossier: any;
  }): Array<Omit<ReconciledRequirementCard, 'status' | 'statusClientLabel' | 'matchedDocumentIds' | 'matchedDocumentNames' | 'isActionable'>> {
    const { taxYear, clientName, primaryJurisdiction, questionnaire, dossier } = params;
    const reqs: Array<Omit<ReconciledRequirementCard, 'status' | 'statusClientLabel' | 'matchedDocumentIds' | 'matchedDocumentNames' | 'isActionable'>> = [];

    const isEntity = dossier?.taxpayerType === 'entity';
    const classification = dossier?.entityClassification;

    if (isEntity && classification === 'scorp') {
      reqs.push({
        requirementId: `REQ-${taxYear}-SCORP-PY`,
        taxYear,
        formNumber: 'Form 1120-S (PY)',
        documentType: 'Prior-Year Return',
        title: 'Prior Year Form 1120-S Corporate Return',
        expectedSource: clientName,
        whyDoWeNeedIt: 'Prior year corporate return is needed to verify beginning balance sheet, depreciation schedules, and AAA balances.',
        whereCanIGetIt: 'Your previous tax preparer or corporate files.',
        statutoryBasis: 'Treas. Reg. § 1.6037-1',
        priority: 'Required'
      });
      reqs.push({
        requirementId: `REQ-${taxYear}-SCORP-TB-GL`,
        taxYear,
        formNumber: 'Trial Balance / GL',
        documentType: 'Trial Balance',
        title: 'Year-End Adjusted Trial Balance & General Ledger',
        expectedSource: clientName,
        whyDoWeNeedIt: 'Adjusted trial balance is required to reconcile corporate revenues, cost of goods sold, and operating deductions.',
        whereCanIGetIt: 'Exported from QuickBooks, Xero, or your bookkeeping software.',
        statutoryBasis: 'IRC § 446',
        priority: 'Required'
      });
      return reqs;
    }

    // Individual (Form 1040) Requirements:
    // 1. Employment (W-2) — supports multiple employers
    if (questionnaire.hasW2Employment) {
      const employers = questionnaire.employerNames && questionnaire.employerNames.length > 0
        ? questionnaire.employerNames
        : ['Primary Employer'];

      employers.forEach((emp, idx) => {
        const empSlug = emp.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
        reqs.push({
          requirementId: `REQ-${taxYear}-W2-${empSlug || idx + 1}`,
          taxYear,
          formNumber: 'Form W-2',
          documentType: 'W-2',
          title: `Form W-2 — ${emp}`,
          expectedSource: emp,
          whyDoWeNeedIt: `You reported wage employment with ${emp}. W-2 compensation and withholdings must be reported on Form 1040 line 1a.`,
          whereCanIGetIt: `From ${emp} human resources, payroll department, or payroll portal (ADP, Gusto, Workday).`,
          statutoryBasis: 'IRC § 6051 / Rev. Proc. 2024-40',
          priority: 'Required'
        });
      });

      // Spouse W-2 where applicable
      if (questionnaire.spouseHasW2 && (questionnaire.filingStatus === 'married_filing_jointly' || questionnaire.filingStatus === 'married_filing_separately')) {
        const spouseEmployers = questionnaire.spouseEmployerNames && questionnaire.spouseEmployerNames.length > 0
          ? questionnaire.spouseEmployerNames
          : ['Spouse Primary Employer'];

        spouseEmployers.forEach((emp, idx) => {
          const empSlug = emp.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
          reqs.push({
            requirementId: `REQ-${taxYear}-W2-SPOUSE-${empSlug || idx + 1}`,
            taxYear,
            formNumber: 'Form W-2',
            documentType: 'W-2',
            title: `Form W-2 — ${emp} (Spouse)`,
            expectedSource: emp,
            whyDoWeNeedIt: `Spouse wage compensation with ${emp} must be reported on joint return under IRC § 6013.`,
            whereCanIGetIt: `From spouse's employer payroll department or online portal.`,
            statutoryBasis: 'IRC § 6051',
            priority: 'Required'
          });
        });
      }
    }

    // 2. Bank Interest (1099-INT)
    if (questionnaire.hasBankInterest) {
      const institutions = questionnaire.interestInstitutions && questionnaire.interestInstitutions.length > 0
        ? questionnaire.interestInstitutions
        : ['Banking Institution'];

      institutions.forEach((inst, idx) => {
        const instSlug = inst.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
        reqs.push({
          requirementId: institutions.length === 1 ? `REQ-${taxYear}-1099INT` : `REQ-${taxYear}-1099INT-${instSlug || idx + 1}`,
          taxYear,
          formNumber: 'Form 1099-INT',
          documentType: '1099-INT',
          title: `Form 1099-INT — ${inst}`,
          expectedSource: inst,
          whyDoWeNeedIt: 'Interest income exceeding $10 must be reported and substantiated on Form 1040 Schedule B.',
          whereCanIGetIt: 'Downloaded from your online banking portal or year-end statement.',
          statutoryBasis: 'IRC § 6049',
          priority: 'Required'
        });
      });
    }

    // 3. Dividends (1099-DIV)
    if (questionnaire.hasDividends) {
      const institutions = questionnaire.dividendInstitutions && questionnaire.dividendInstitutions.length > 0
        ? questionnaire.dividendInstitutions
        : ['Brokerage Firm'];

      institutions.forEach((inst, idx) => {
        const instSlug = inst.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
        reqs.push({
          requirementId: institutions.length === 1 ? `REQ-${taxYear}-1099DIV` : `REQ-${taxYear}-1099DIV-${instSlug || idx + 1}`,
          taxYear,
          formNumber: 'Form 1099-DIV',
          documentType: '1099-DIV',
          title: `Form 1099-DIV — ${inst}`,
          expectedSource: inst,
          whyDoWeNeedIt: 'Ordinary and qualified dividend distributions must be declared on Schedule B.',
          whereCanIGetIt: 'Available from your brokerage or investment portal (e.g. Fidelity, Schwab, Vanguard).',
          statutoryBasis: 'IRC § 6042',
          priority: 'Required'
        });
      });
    }

    // 4. Brokerage / Securities (1099-B)
    if (questionnaire.hasStockSalesBrokerage) {
      const brokerages = questionnaire.brokerageInstitutions && questionnaire.brokerageInstitutions.length > 0
        ? questionnaire.brokerageInstitutions
        : ['Brokerage Firm'];

      brokerages.forEach((brk, idx) => {
        const brkSlug = brk.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
        reqs.push({
          requirementId: brokerages.length === 1 ? `REQ-${taxYear}-1099B` : `REQ-${taxYear}-1099B-${brkSlug || idx + 1}`,
          taxYear,
          formNumber: 'Form 1099-B',
          documentType: '1099-B',
          title: `Form 1099-B / Brokerage Statement — ${brk}`,
          expectedSource: brk,
          whyDoWeNeedIt: 'Gross proceeds and cost basis from stock/capital sales must be reconciled on Form 8949 and Schedule D.',
          whereCanIGetIt: 'Consolidated 1099 tax package from your brokerage firm.',
          statutoryBasis: 'IRC § 6045',
          priority: 'Required'
        });
      });
    }

    // 5. Self-Employment / 1099-NEC (Schedule C)
    if (questionnaire.hasSelfEmployment || questionnaire.has1099NEC) {
      reqs.push({
        requirementId: `REQ-${taxYear}-1099NEC`,
        taxYear,
        formNumber: 'Form 1099-NEC',
        documentType: '1099-NEC',
        title: 'Form 1099-NEC — Nonemployee Compensation',
        expectedSource: questionnaire.businessName || 'Contract Clients / Payers',
        whyDoWeNeedIt: 'Nonemployee compensation reported to the IRS must match Schedule C gross receipts.',
        whereCanIGetIt: 'From clients or companies that paid you over $600 for services.',
        statutoryBasis: 'IRC § 6041A',
        priority: 'Required'
      });

      reqs.push({
        requirementId: `REQ-${taxYear}-SCH-C-PL`,
        taxYear,
        formNumber: 'Schedule C Detail',
        documentType: 'Profit and Loss',
        title: 'Business Profit & Loss / Expense Summary',
        expectedSource: questionnaire.businessName || 'Business Bookkeeping',
        whyDoWeNeedIt: 'Categorized business revenues, supplies, advertising, and operating expenses to substantiate Schedule C deductions under IRC § 162.',
        whereCanIGetIt: 'Your bookkeeping software or an itemized summary spreadsheet.',
        statutoryBasis: 'IRC § 162',
        priority: 'Required'
      });

      if (questionnaire.hasBusinessVehicle) {
        reqs.push({
          requirementId: `REQ-${taxYear}-BIZ-MILEAGE`,
          taxYear,
          formNumber: 'Form 4562 Vehicle Detail',
          documentType: 'Mileage Log',
          title: 'Business Vehicle Mileage Log & Records',
          expectedSource: 'Mileage Tracking App / Logbook',
          whyDoWeNeedIt: 'Contemporaneous log of business miles driven required under IRC § 274(d).',
          whereCanIGetIt: 'MileIQ, Everlance, or written mileage tracking log.',
          statutoryBasis: 'IRC § 274(d)',
          priority: 'Required'
        });
      }
    }

    // 6. Rental Property (Schedule E)
    if (questionnaire.ownsRentalProperty) {
      const properties = questionnaire.rentalPropertyAddresses && questionnaire.rentalPropertyAddresses.length > 0
        ? questionnaire.rentalPropertyAddresses
        : ['Rental Property'];

      properties.forEach((prop, idx) => {
        const propSlug = prop.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
        reqs.push({
          requirementId: `REQ-${taxYear}-RENTAL-${propSlug || idx + 1}`,
          taxYear,
          formNumber: 'Schedule E Records',
          documentType: 'Rental Records',
          title: `Rental Property Income & Expense Summary — ${prop}`,
          expectedSource: prop,
          whyDoWeNeedIt: 'Gross rental income, property management fees, repairs, taxes, and mortgage interest are required for Schedule E.',
          whereCanIGetIt: 'Annual statement from property manager or your rental bookkeeping ledger.',
          statutoryBasis: 'IRC § 212 / IRC § 469',
          priority: 'Required'
        });
      });
    }

    // 7. Mortgage Interest (Form 1098)
    if (questionnaire.ownsHomeWithMortgage) {
      reqs.push({
        requirementId: `REQ-${taxYear}-1098`,
        taxYear,
        formNumber: 'Form 1098',
        documentType: '1098',
        title: 'Form 1098 — Mortgage Interest Statement',
        expectedSource: 'Mortgage Lender',
        whyDoWeNeedIt: 'Home mortgage interest, points, and escrowed property taxes are deductible on Schedule A.',
        whereCanIGetIt: 'From your mortgage servicer or annual tax statement portal.',
        statutoryBasis: 'IRC § 6050H',
        priority: 'Required'
      });
    }

    // 8. Higher Education Tuition (Form 1098-T)
    if (questionnaire.paidHigherEducationTuition) {
      reqs.push({
        requirementId: `REQ-${taxYear}-1098T`,
        taxYear,
        formNumber: 'Form 1098-T',
        documentType: '1098-T',
        title: 'Form 1098-T — Tuition Statement',
        expectedSource: 'Higher Education Institution',
        whyDoWeNeedIt: 'Required for claiming the American Opportunity Tax Credit or Lifetime Learning Credit.',
        whereCanIGetIt: 'From the student financial aid or bursar portal of the college or university.',
        statutoryBasis: 'IRC § 25A',
        priority: 'Required'
      });
    }

    // 9. Marketplace Health Insurance (Form 1095-A)
    if (questionnaire.hasMarketplaceHealthInsurance) {
      reqs.push({
        requirementId: `REQ-${taxYear}-1095A`,
        taxYear,
        formNumber: 'Form 1095-A',
        documentType: '1095-A',
        title: 'Form 1095-A — Health Insurance Marketplace Statement',
        expectedSource: 'Healthcare.gov / State Exchange',
        whyDoWeNeedIt: 'Mandatory under federal law to reconcile the Premium Tax Credit on Form 8962.',
        whereCanIGetIt: 'Downloaded from HealthCare.gov or your state marketplace account.',
        statutoryBasis: 'IRC § 36B',
        priority: 'Required'
      });
    }

    // 10. Retirement Distributions (Form 1099-R)
    if (questionnaire.hasRetirementDistributions) {
      reqs.push({
        requirementId: `REQ-${taxYear}-1099R`,
        taxYear,
        formNumber: 'Form 1099-R',
        documentType: '1099-R',
        title: 'Form 1099-R — Distributions From Pensions, Annuities, Retirement, IRAs',
        expectedSource: 'Retirement Plan Custodian',
        whyDoWeNeedIt: 'Taxable retirement distributions are reportable under IRC §§ 408, 72, and 6047.',
        whereCanIGetIt: 'From your pension administrator, 401(k) provider, or IRA custodian.',
        statutoryBasis: 'IRC §§ 72, 408, 6047',
        priority: 'Required'
      });
    }

    // 11. Social Security (Form SSA-1099)
    if (questionnaire.hasSocialSecurity) {
      reqs.push({
        requirementId: `REQ-${taxYear}-SSA1099`,
        taxYear,
        formNumber: 'Form SSA-1099',
        documentType: 'SSA-1099',
        title: 'Form SSA-1099 — Social Security Benefit Statement',
        expectedSource: 'Social Security Administration',
        whyDoWeNeedIt: 'Determines the taxable portion of Social Security benefits under IRC § 86.',
        whereCanIGetIt: 'Social Security Administration portal at ssa.gov/myaccount.',
        statutoryBasis: 'IRC § 86',
        priority: 'Required'
      });
    }

    // 12. Pass-Through Pass-Through Earnings (Schedule K-1)
    if (questionnaire.hasPassThrough) {
      const entities = questionnaire.k1EntityNames && questionnaire.k1EntityNames.length > 0
        ? questionnaire.k1EntityNames
        : ['Pass-Through Entity'];

      entities.forEach((ent, idx) => {
        const entSlug = ent.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
        reqs.push({
          requirementId: `REQ-${taxYear}-K1-${entSlug || idx + 1}`,
          taxYear,
          formNumber: 'Schedule K-1',
          documentType: 'Schedule K-1',
          title: `Schedule K-1 — ${ent}`,
          expectedSource: ent,
          whyDoWeNeedIt: 'Pass-through distributive share from partnerships, S-corporations, or trusts under IRC §§ 702 and 1366.',
          whereCanIGetIt: 'From the managing partner, general partner, or corporate CPA.',
          statutoryBasis: 'IRC §§ 702, 1366',
          priority: 'Required'
        });
      });
    }

    // 13. Child & Dependent Care (Form 2441)
    if (questionnaire.hasChildCareExpenses) {
      reqs.push({
        requirementId: `REQ-${taxYear}-CHILDCARE`,
        taxYear,
        formNumber: 'Form 2441 Records',
        documentType: 'Childcare Statement',
        title: 'Form 2441 — Child & Dependent Care Provider Statements & Receipts',
        expectedSource: 'Childcare / Daycare Provider',
        whyDoWeNeedIt: 'Provider name, address, EIN/SSN, and payment summary to claim Child and Dependent Care Credit under IRC § 21.',
        whereCanIGetIt: 'Year-end statement from licensed daycare or childcare provider.',
        statutoryBasis: 'IRC § 21',
        priority: 'Required'
      });
    }

    // 14. Quarterly Estimated Tax Payments
    if (questionnaire.madeEstimatedTaxPayments) {
      reqs.push({
        requirementId: `REQ-${taxYear}-EST-PAYMENTS`,
        taxYear,
        formNumber: 'Form 1040-ES / State Vouchers',
        documentType: 'Estimated Tax Confirmation',
        title: 'Quarterly Estimated Tax Payment Records (Federal & State)',
        expectedSource: 'IRS EFTPS / State Revenue',
        whyDoWeNeedIt: 'Payment confirmations to credit estimated tax payments under IRC § 6654.',
        whereCanIGetIt: 'EFTPS or state tax portal payment history receipts.',
        statutoryBasis: 'IRC § 6654',
        priority: 'Required'
      });
    }

    // 15. Digital Assets / Cryptocurrency
    if (questionnaire.hasDigitalAssetsCrypto) {
      reqs.push({
        requirementId: `REQ-${taxYear}-CRYPTO`,
        taxYear,
        formNumber: 'Form 8949 Detail / 1099-DA',
        documentType: 'Crypto Report',
        title: 'Digital Asset / Cryptocurrency Tax Report & Form 1099-DA',
        expectedSource: 'Crypto Exchange / Tax Ledger',
        whyDoWeNeedIt: 'Mandatory digital asset transaction reporting under IRS Notice 2014-21.',
        whereCanIGetIt: 'CoinTracker, Koinly, or exchange tax reporting center.',
        statutoryBasis: 'IRS Notice 2014-21',
        priority: 'Required'
      });
    }

    // 16. Student Loan Interest (1098-E)
    if (questionnaire.paidStudentLoanInterest) {
      reqs.push({
        requirementId: `REQ-${taxYear}-1098E`,
        taxYear,
        formNumber: 'Form 1098-E',
        documentType: '1098-E',
        title: 'Form 1098-E — Student Loan Interest Statement',
        expectedSource: 'Student Loan Servicer',
        whyDoWeNeedIt: 'Above-the-line deduction up to $2,500 under IRC § 221.',
        whereCanIGetIt: 'From student loan servicer online portal.',
        statutoryBasis: 'IRC § 221',
        priority: 'Required'
      });
    }

    // 17. Health Savings Account (1099-SA)
    if (questionnaire.hasHsaAccount) {
      reqs.push({
        requirementId: `REQ-${taxYear}-1099SA`,
        taxYear,
        formNumber: 'Form 1099-SA / 5498-SA',
        documentType: '1099-SA',
        title: 'Form 1099-SA & 5498-SA — HSA Distributions & Contributions',
        expectedSource: 'HSA Custodian Bank',
        whyDoWeNeedIt: 'Substantiates HSA contributions and distributions under IRC § 223.',
        whereCanIGetIt: 'From HSA custodian online banking portal.',
        statutoryBasis: 'IRC § 223',
        priority: 'Required'
      });
    }

    // 18. Prior-Year Return (when required)
    if (questionnaire.hasPriorYearTaxReturn) {
      reqs.push({
        requirementId: `REQ-${taxYear}-PRIOR-RETURN`,
        taxYear,
        formNumber: 'Prior Form 1040',
        documentType: 'Prior-Year Return',
        title: `Prior Year (${taxYear - 1}) Federal Tax Return`,
        expectedSource: clientName,
        whyDoWeNeedIt: 'Needed to verify prior-year adjusted gross income (AGI) for electronic filing signature and carryforward calculations.',
        whereCanIGetIt: 'Your copy of last year’s filed return or previous tax preparer.',
        statutoryBasis: 'Treas. Reg. § 1.6011-1',
        priority: 'Required'
      });
    }

    return reqs;
  }

  private static evaluateUploadedDocuments(params: {
    clientId: string;
    taxYear: number;
    clientName: string;
    uploads: StageTwoUploadedDocument[];
    stagedDocs: StagedSecurityDocument[];
    expectedTaxpayerName?: string;
  }): Array<{
    doc: StageTwoUploadedDocument;
    detectedType: RecognizedDocumentType;
    detectedTaxYear: number;
    detectedEmployerOrSource?: string;
    isWrongTaxpayer: boolean;
    isSecurityBlocked: boolean;
    isNeedsReview: boolean;
    isAccepted: boolean;
    classificationConfidence: number;
  }> {
    const { taxYear, clientName, uploads, stagedDocs, expectedTaxpayerName } = params;
    const effectiveExpectedName = expectedTaxpayerName || clientName;

    return uploads.map(doc => {
      const staged = stagedDocs.find(s => s.documentId === doc.documentId) || doc.stagedSecurityDoc;

      // Security check
      const isSecurityBlocked =
        staged?.quarantineStatus === 'QUARANTINED' ||
        staged?.quarantineStatus === 'SECURITY_REVIEW' ||
        staged?.quarantineStatus === 'REJECTED' ||
        staged?.malwareScanStatus === 'INFECTED' ||
        staged?.signatureValidation?.validationResult === 'SUSPICIOUS' ||
        staged?.signatureValidation?.validationResult === 'MISMATCH';

      // Extraction envelope
      const rawText = doc.notes || doc.originalFileName;
      const extraction = StageTwoMatchingEngine.recognizeAndExtract({
        documentId: doc.documentId,
        originalFileName: doc.originalFileName,
        sha256Hash: doc.sha256Hash,
        rawText,
        activeTaxYear: taxYear,
        expectedTaxpayerName: effectiveExpectedName
      });

      const detectedYear = (doc as any).detectedTaxYear || extraction.detectedTaxYear || taxYear;
      const detectedEmployerOrSource = (doc as any).detectedEmployer || extraction.employerName || extraction.payerName;
      const detectedTaxpayer = (doc as any).detectedTaxpayer || extraction.taxpayerName;

      // Taxpayer mismatch check
      const expectedNames = [
        clientName,
        effectiveExpectedName,
        doc.uploadedBy
      ].filter(Boolean).map(n => n.toLowerCase());

      const isWrongTaxpayer = Boolean(
        detectedTaxpayer &&
        detectedTaxpayer.length > 4 &&
        !expectedNames.some(exp => exp.includes(detectedTaxpayer.toLowerCase()) || detectedTaxpayer.toLowerCase().includes(exp.split(' ')[0])) &&
        detectedTaxpayer.toLowerCase() !== 'valued client' &&
        detectedTaxpayer.toLowerCase() !== 'primary taxpayer'
      );

      const isNeedsReview =
        isWrongTaxpayer ||
        doc.processingStatus === 'Under Review' ||
        extraction.classificationConfidence < 0.65;

      const isAccepted = doc.processingStatus === 'Accepted' || doc.isVerified;

      return {
        doc,
        detectedType: extraction.detectedType,
        detectedTaxYear: detectedYear,
        detectedEmployerOrSource,
        isWrongTaxpayer,
        isSecurityBlocked,
        isNeedsReview,
        isAccepted,
        classificationConfidence: extraction.classificationConfidence
      };
    });
  }

  private static isDocumentCompatibleWithRequirement(
    detectedType: RecognizedDocumentType,
    fileName: string,
    req: { formNumber: string; documentType: string; title: string }
  ): boolean {
    const fnLower = fileName.toLowerCase();
    const reqFormLower = req.formNumber.toLowerCase();
    const reqTypeLower = req.documentType.toLowerCase();
    const reqTitleLower = req.title.toLowerCase();

    // W-2
    if (reqTypeLower.includes('w-2') || reqFormLower.includes('w-2') || reqTitleLower.includes('w-2')) {
      if (detectedType === 'W-2' || detectedType === 'W-2C') return true;
      if (fnLower.includes('w2') || fnLower.includes('w-2')) return true;
    }

    // 1099-INT
    if (reqTypeLower.includes('1099-int') || reqFormLower.includes('1099-int') || reqTitleLower.includes('interest')) {
      if (detectedType === '1099-INT') return true;
      if (fnLower.includes('1099int') || fnLower.includes('1099-int') || fnLower.includes('interest')) return true;
    }

    // 1099-DIV
    if (reqTypeLower.includes('1099-div') || reqFormLower.includes('1099-div') || reqTitleLower.includes('dividend')) {
      if (detectedType === '1099-DIV') return true;
      if (fnLower.includes('1099div') || fnLower.includes('1099-div') || fnLower.includes('dividend')) return true;
    }

    // 1099-B / Brokerage
    if (reqTypeLower.includes('1099-b') || reqFormLower.includes('1099-b') || reqTitleLower.includes('brokerage')) {
      if (detectedType === '1099-B') return true;
      if (fnLower.includes('1099b') || fnLower.includes('1099-b') || fnLower.includes('brokerage')) return true;
    }

    // 1099-NEC
    if (reqTypeLower.includes('1099-nec') || reqFormLower.includes('1099-nec') || reqTitleLower.includes('nonemployee')) {
      if (detectedType === '1099-NEC' || detectedType === '1099-MISC') return true;
      if (fnLower.includes('1099nec') || fnLower.includes('1099-nec') || fnLower.includes('1099misc')) return true;
    }

    // 1098 Mortgage
    if (reqTypeLower.includes('1098') || reqFormLower.includes('1098') || reqTitleLower.includes('mortgage')) {
      if (detectedType === '1098') return true;
      if (fnLower.includes('1098') || fnLower.includes('mortgage')) return true;
    }

    // 1098-T Tuition
    if (reqTypeLower.includes('1098-t') || reqFormLower.includes('1098-t') || reqTitleLower.includes('tuition')) {
      if (detectedType === '1098-T') return true;
      if (fnLower.includes('1098t') || fnLower.includes('1098-t') || fnLower.includes('tuition')) return true;
    }

    // 1095-A Marketplace
    if (reqTypeLower.includes('1095-a') || reqFormLower.includes('1095-a') || reqTitleLower.includes('marketplace')) {
      if (fnLower.includes('1095a') || fnLower.includes('1095-a') || fnLower.includes('marketplace')) return true;
    }

    // Prior-Year Return
    if (reqTypeLower.includes('prior') || reqTitleLower.includes('prior year')) {
      if (detectedType === 'Prior-Year Return') return true;
      if (fnLower.includes('prior') || fnLower.includes('2024') || fnLower.includes('1040')) return true;
    }

    // Trial Balance
    if (reqTypeLower.includes('trial') || reqTitleLower.includes('trial balance')) {
      if (detectedType === 'Trial Balance' || fnLower.includes('trial') || fnLower.includes('tb')) return true;
    }

    // 1099-R / Retirement
    if (reqTypeLower.includes('1099-r') || reqFormLower.includes('1099-r') || reqTitleLower.includes('retirement') || reqTitleLower.includes('pension')) {
      if (detectedType === '1099-R') return true;
      if (fnLower.includes('1099r') || fnLower.includes('1099-r') || fnLower.includes('retirement') || fnLower.includes('pension') || fnLower.includes('401k')) return true;
    }

    // SSA-1099 / Social Security
    if (reqTypeLower.includes('ssa-1099') || reqFormLower.includes('ssa-1099') || reqTitleLower.includes('social security')) {
      if (detectedType === 'SSA-1099') return true;
      if (fnLower.includes('ssa') || fnLower.includes('social security') || fnLower.includes('ssa-1099') || fnLower.includes('ssa1099')) return true;
    }

    // Schedule K-1
    if (reqTypeLower.includes('k-1') || reqFormLower.includes('k-1') || reqTitleLower.includes('schedule k-1') || reqTitleLower.includes('pass-through')) {
      if (detectedType === 'Schedule K-1') return true;
      if (fnLower.includes('k-1') || fnLower.includes('k1') || fnLower.includes('schedule k-1') || fnLower.includes('1065') || fnLower.includes('1120s') || fnLower.includes('1120-s')) return true;
    }

    // Rental Real Estate / Schedule E
    if (reqTypeLower.includes('rental') || reqTitleLower.includes('rental') || reqFormLower.includes('schedule e')) {
      if (detectedType === 'Profit and Loss' || detectedType === 'Bank Statement') return true;
      if (fnLower.includes('rental') || fnLower.includes('schedule e') || fnLower.includes('property management') || fnLower.includes('lease') || fnLower.includes('tenant')) return true;
    }

    // 1099-SA / 5498-SA / HSA
    if (reqTypeLower.includes('1099-sa') || reqFormLower.includes('1099-sa') || reqTitleLower.includes('hsa')) {
      if (detectedType === '1099-SA') return true;
      if (fnLower.includes('1099sa') || fnLower.includes('1099-sa') || fnLower.includes('5498sa') || fnLower.includes('hsa')) return true;
    }

    // 1098-E Student Loan Interest
    if (reqTypeLower.includes('1098-e') || reqFormLower.includes('1098-e') || reqTitleLower.includes('student loan')) {
      if (detectedType === '1098-E') return true;
      if (fnLower.includes('1098e') || fnLower.includes('1098-e') || fnLower.includes('student loan')) return true;
    }

    // 1099-S Real Estate Sale
    if (reqTypeLower.includes('1099-s') || reqFormLower.includes('1099-s') || reqTitleLower.includes('real estate closing') || reqTitleLower.includes('settlement statement')) {
      if (fnLower.includes('1099s') || fnLower.includes('1099-s') || fnLower.includes('closing') || fnLower.includes('alta') || fnLower.includes('hud-1') || fnLower.includes('settlement')) return true;
    }

    // 1099-K Merchant Processing
    if (reqTypeLower.includes('1099-k') || reqFormLower.includes('1099-k') || reqTitleLower.includes('merchant')) {
      if (detectedType === '1099-K') return true;
      if (fnLower.includes('1099k') || fnLower.includes('1099-k') || fnLower.includes('stripe') || fnLower.includes('square') || fnLower.includes('paypal')) return true;
    }

    // Digital Assets / Crypto
    if (reqTypeLower.includes('crypto') || reqTitleLower.includes('cryptocurrency') || reqTitleLower.includes('digital asset') || reqFormLower.includes('1099-da')) {
      if (fnLower.includes('crypto') || fnLower.includes('bitcoin') || fnLower.includes('cointracker') || fnLower.includes('koinly') || fnLower.includes('taxbit') || fnLower.includes('1099da') || fnLower.includes('1099-da')) return true;
    }

    // Childcare / Form 2441
    if (reqTypeLower.includes('childcare') || reqTitleLower.includes('child care') || reqTitleLower.includes('dependent care') || reqFormLower.includes('2441')) {
      if (fnLower.includes('childcare') || fnLower.includes('child care') || fnLower.includes('daycare') || fnLower.includes('2441')) return true;
    }

    // Charitable Contributions
    if (reqTypeLower.includes('charit') || reqTitleLower.includes('charitable') || reqTitleLower.includes('donation')) {
      if (fnLower.includes('donation') || fnLower.includes('charity') || fnLower.includes('charitable') || fnLower.includes('acknowledgment') || fnLower.includes('goodwill')) return true;
    }

    // Estimated Tax Payments
    if (reqTypeLower.includes('estimated') || reqTitleLower.includes('estimated tax') || reqFormLower.includes('1040-es')) {
      if (fnLower.includes('estimated') || fnLower.includes('1040es') || fnLower.includes('1040-es') || fnLower.includes('voucher') || fnLower.includes('eftps')) return true;
    }

    // Identity Protection PIN
    if (reqTypeLower.includes('ip pin') || reqTitleLower.includes('identity protection') || reqFormLower.includes('cp01a')) {
      if (fnLower.includes('ip pin') || fnLower.includes('ippin') || fnLower.includes('cp01a') || fnLower.includes('identity protection')) return true;
    }

    // Bank Statement
    if (reqTypeLower.includes('bank') || reqTitleLower.includes('bank statement')) {
      if (detectedType === 'Bank Statement' || fnLower.includes('bank') || fnLower.includes('statement') || fnLower.includes('checking')) return true;
    }

    // General Ledger / P&L
    if (reqTypeLower.includes('general ledger') || reqTitleLower.includes('general ledger') || reqTypeLower.includes('profit and loss') || reqTitleLower.includes('profit & loss')) {
      if (detectedType === 'General Ledger' || detectedType === 'Profit and Loss' || fnLower.includes('ledger') || fnLower.includes('p&l') || fnLower.includes('profit and loss')) return true;
    }

    // Form 941 Payroll
    if (reqTypeLower.includes('941') || reqTitleLower.includes('payroll')) {
      if (fnLower.includes('941') || fnLower.includes('940') || fnLower.includes('payroll') || fnLower.includes('w-3') || fnLower.includes('w3')) return true;
    }

    // Partner Capital / Shareholder Basis
    if (reqTypeLower.includes('capital') || reqTitleLower.includes('shareholder basis') || reqFormLower.includes('7203') || reqFormLower.includes('m-2')) {
      if (fnLower.includes('basis') || fnLower.includes('7203') || fnLower.includes('capital') || fnLower.includes('m-2') || fnLower.includes('m2')) return true;
    }

    // State Tax Requirements / Withholding (satisfied by state withholding on W-2, estimated payments, or state vouchers)
    if (reqTypeLower.includes('state') || reqTitleLower.includes('state')) {
      if (detectedType === 'W-2' || fnLower.includes('w2') || fnLower.includes('state') || fnLower.includes('withholding') || fnLower.includes('voucher') || fnLower.includes('estimated')) return true;
    }

    return false;
  }

  private static synchronizeChecklistCache(
    clientId: string,
    taxYear: number,
    reconciledCards: ReconciledRequirementCard[]
  ): void {
    const list: ChecklistRequirement[] = reconciledCards.map(c => ({
      requirementId: c.requirementId,
      clientId,
      taxYear,
      entityType: 'individual',
      title: c.title,
      formNumber: c.formNumber,
      category: c.documentType,
      jurisdiction: 'Federal',
      description: c.whyDoWeNeedIt,
      priority: c.priority,
      status: c.status === 'ACCEPTED' ? 'Accepted'
        : c.status === 'RECEIVED' ? 'Received'
        : c.status === 'UPLOADED_PROCESSING' ? 'Processing'
        : c.status === 'NEEDS_REVIEW' ? 'Under Review'
        : c.status === 'NOT_APPLICABLE' ? 'Not Applicable'
        : 'Required',
      associatedDocumentId: c.matchedDocumentIds[0],
      notes: c.statusClientLabel,
      lastUpdated: new Date().toISOString()
    }));

    StageTwoCollectionService.saveRequirements(clientId, taxYear, list);
  }

  private static synchronizeManifest(
    manifest: TaxRequirementManifest,
    reconciledCards: ReconciledRequirementCard[],
    isReadyForExitGate: boolean,
    blockers: string[]
  ): void {
    reconciledCards.forEach(c => {
      let mReq = manifest.requirements.find(r => r.requirementId === c.requirementId);
      if (!mReq) {
        mReq = manifest.requirements.find(r => r.formNumber === c.formNumber || r.documentType === c.documentType);
      }
      if (mReq) {
        if (c.status === 'MISSING' && (mReq.status === 'RECEIVED' || mReq.status === 'COLLECTION_ACCEPTED') && mReq.matchedDocumentIds?.length > 0) {
          // Preserve valid prior orchestrator match
          return;
        }
        mReq.status = c.status === 'ACCEPTED' ? 'COLLECTION_ACCEPTED'
          : c.status === 'RECEIVED' ? 'RECEIVED'
          : c.status === 'UPLOADED_PROCESSING' ? 'PROCESSING'
          : c.status === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW'
          : c.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE'
          : 'MISSING';
        if (c.matchedDocumentIds?.length > 0 || c.status === 'NOT_APPLICABLE' || (c.status === 'MISSING' && (!mReq.matchedDocumentIds || mReq.matchedDocumentIds.length === 0))) {
          mReq.matchedDocumentIds = c.matchedDocumentIds;
        }
        mReq.updatedAt = new Date().toISOString();
      }
    });

    TaxRequirementManifestEngine.saveManifest(manifest);
  }
}
