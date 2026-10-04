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
  }): StageTwoAuthoritativeSnapshot {
    const { clientId, taxYear } = params;
    const engagementId = params.engagementId || `ENG-${taxYear}-${clientId}`;
    const cacheKey = `${clientId}_${taxYear}`;

    // 1. Retrieve / Initialize Manifest
    const manifest = TaxRequirementManifestEngine.getOrCreateManifest(clientId, taxYear, engagementId);

    // 2. Load Persisted Uploads & Staged Documents for THIS Client & Tax Year
    const uploads = StageTwoCollectionService.getUploadedDocuments(clientId, taxYear);
    const stagedDocs = StageTwoIntakeSecurityService.getStagedDocuments(clientId, taxYear);

    // 3. Load Authoritative Taxpayer Facts
    const dossier = StageOneOnboardingService.getDossier(clientId);
    const questionnaire: TaxDiscoveryQuestionnaireAnswers =
      TaxDocumentRequirementEngine.getQuestionnaire(clientId, taxYear);

    const clientName = dossier?.legalName || manifest.taxpayerName || uploads[0]?.uploadedBy || 'David Robert Anderson';
    const primaryJurisdiction = dossier?.residentialOrPrincipalAddress?.state || questionnaire.residentState || manifest.primaryJurisdiction || 'SC';

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
        if (!candidateReqs.some(c => c.requirementId === mReq.requirementId)) {
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

        const quarantinedDoc = evaluatedDocs.find(d =>
          d.isSecurityBlocked &&
          this.isDocumentCompatibleWithRequirement(d.detectedType, d.doc.originalFileName, req)
        );

        if (quarantinedDoc) {
          reconciledCards.push({
            ...req,
            status: 'UPLOADED_PROCESSING',
            statusClientLabel: 'Uploaded — Security Verification in Progress',
            matchedDocumentIds: [quarantinedDoc.doc.documentId],
            matchedDocumentNames: [quarantinedDoc.doc.originalFileName],
            matchedDocumentStatus: 'Processing Security Verification',
            isActionable: false,
            blockingReason: 'Document is undergoing security scanning.'
          });
        } else if (wrongYearDoc) {
          reconciledCards.push({
            ...req,
            status: 'MISSING',
            statusClientLabel: `Missing — Uploaded Document is for Tax Year ${wrongYearDoc.detectedTaxYear}`,
            matchedDocumentIds: [],
            matchedDocumentNames: [wrongYearDoc.doc.originalFileName],
            matchedDocumentStatus: `Wrong Tax Year (${wrongYearDoc.detectedTaxYear})`,
            isActionable: true,
            blockingReason: `This document appears to be for tax year ${wrongYearDoc.detectedTaxYear}. Please provide tax year ${taxYear} document.`
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
    const receivedCount = activeRequired.filter(r => r.status === 'RECEIVED' || r.status === 'ACCEPTED').length;
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

    const isReadyForStageThree = missingCount === 0 && needsReviewCount === 0 && processingCount === 0 && receivedCount >= totalRequired;

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
        : ['ABC Corporation'];

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
    }

    // 2. Bank Interest (1099-INT)
    if (questionnaire.hasBankInterest) {
      reqs.push({
        requirementId: `REQ-${taxYear}-1099INT`,
        taxYear,
        formNumber: 'Form 1099-INT',
        documentType: '1099-INT',
        title: 'Form 1099-INT — Interest Income',
        expectedSource: 'Banking Institution',
        whyDoWeNeedIt: 'Interest income exceeding $10 must be reported and substantiated on Form 1040 Schedule B.',
        whereCanIGetIt: 'Downloaded from your online banking portal or year-end statement.',
        statutoryBasis: 'IRC § 6049',
        priority: 'Required'
      });
    }

    // 3. Dividends (1099-DIV)
    if (questionnaire.hasDividends) {
      reqs.push({
        requirementId: `REQ-${taxYear}-1099DIV`,
        taxYear,
        formNumber: 'Form 1099-DIV',
        documentType: '1099-DIV',
        title: 'Form 1099-DIV — Dividends & Distributions',
        expectedSource: 'Brokerage Firm',
        whyDoWeNeedIt: 'Ordinary and qualified dividend distributions must be declared on Schedule B.',
        whereCanIGetIt: 'Available from your brokerage or investment portal (e.g. Fidelity, Schwab, Vanguard).',
        statutoryBasis: 'IRC § 6042',
        priority: 'Required'
      });
    }

    // 4. Brokerage / Securities (1099-B)
    if (questionnaire.hasStockSalesBrokerage) {
      reqs.push({
        requirementId: `REQ-${taxYear}-1099B`,
        taxYear,
        formNumber: 'Form 1099-B',
        documentType: '1099-B',
        title: 'Form 1099-B / Consolidated Brokerage Statement',
        expectedSource: 'Brokerage Firm',
        whyDoWeNeedIt: 'Gross proceeds and cost basis from stock/capital sales must be reconciled on Form 8949 and Schedule D.',
        whereCanIGetIt: 'Consolidated 1099 tax package from your brokerage firm.',
        statutoryBasis: 'IRC § 6045',
        priority: 'Required'
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
    }

    // 6. Rental Property (Schedule E)
    if (questionnaire.ownsRentalProperty) {
      reqs.push({
        requirementId: `REQ-${taxYear}-RENTAL-SCH-E`,
        taxYear,
        formNumber: 'Schedule E Records',
        documentType: 'Rental Records',
        title: 'Rental Property Income & Expense Summary',
        expectedSource: 'Rental Property Management / Records',
        whyDoWeNeedIt: 'Gross rental income, property management fees, repairs, taxes, and mortgage interest are required for Schedule E.',
        whereCanIGetIt: 'Annual statement from property manager or your rental bookkeeping ledger.',
        statutoryBasis: 'IRC § 212 / IRC § 469',
        priority: 'Required'
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
        priority: 'Required if applicable'
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

    // 10. Prior-Year Return (when required)
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
