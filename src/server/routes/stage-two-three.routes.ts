/**
 * A/R Tax Services, LLC — TaxGuard AI
 * Stage 02 (Collect) & Stage 03 (Validate) Server Routes
 *
 * Exposes:
 * - Tax Questionnaire (28+ facts, tax-year aware, server-persisted)
 * - Dynamic Requirements Engine (Not-applicable workflow with reason & audit)
 * - Secure Document Intake & Lifecycle (quarantine, fail-closed uncommissioned scanners)
 * - Client Requests Loop (Two-way accountant <-> client communication)
 * - Dedicated Stage 03 Accountant Document Review Workspace API
 * - Maker-Checker authorization & Optimistic Concurrency control
 * - Stage 02 and Stage 03 Server Gate evaluations
 */

import { Router, Response } from 'express';
import { randomUUID, createHash } from 'node:crypto';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest
} from '../auth';
import {
  TaxQuestionnaireEngine,
  TaxQuestionnaireAnswers,
  serverCaseRequirements
} from '../taxguard/taxQuestionnaire';
import {
  AccountantDocumentReviewService,
  serverClientRequestsStore,
  serverDocumentReviewStore
} from '../taxguard/accountantDocumentReview.service';
import { evaluateStageTwoServerGate } from '../taxguard/stageTwoServerGate';
import { evaluateStageThreeServerGate } from '../taxguard/stageThreeServerGate';
import { AuthorityError } from '../taxguard/authority.repository';
import { StageTwoReconciliationService } from '../../services/stageTwoReconciliationService';
import { db } from '../db';

export const stageTwoThreeRouter = Router();

stageTwoThreeRouter.use(authenticateToken);

function resolveTenantId(): string {
  const configured = (process.env.TAXGUARD_TENANT_ID || '').trim();
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new AuthorityError('PRODUCTION_TENANT_REQUIRED: Missing authoritative production TAXGUARD_TENANT_ID.', 500);
    }
    return 'tenantA';
  }
  return configured;
}

// ============================================================================
// 1. TAX QUESTIONNAIRE ENDPOINTS
// ============================================================================

stageTwoThreeRouter.get('/questionnaire/:taxYear', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const tenantId = resolveTenantId();
    const taxYear = Number(req.params.taxYear) || 2025;
    const clientId = req.user.role === 'client' ? (req.user.clientId || req.user.id) : (req.query.clientId as string || req.user.clientId || req.user.id);

    const record = TaxQuestionnaireEngine.getQuestionnaire(tenantId, clientId, taxYear);
    return res.json({
      tenantId,
      clientId,
      taxYear,
      hasQuestionnaire: Boolean(record),
      questionnaire: record
    });
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

stageTwoThreeRouter.post('/questionnaire/:taxYear', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const tenantId = resolveTenantId();
    const taxYear = Number(req.params.taxYear) || 2025;
    const clientId = req.user.role === 'client' ? (req.user.clientId || req.user.id) : (req.body.clientId || req.user.clientId || req.user.id);
    const answers: TaxQuestionnaireAnswers = req.body.answers;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'answers object is required.' });
    }

    const result = TaxQuestionnaireEngine.saveQuestionnaire({
      tenantId,
      clientId,
      taxYear,
      answers,
      actorId: req.user.id,
      actorRole: req.user.role || 'client'
    });

    return res.json({
      success: true,
      message: 'Questionnaire saved and document requirements dynamically computed.',
      questionnaire: result.questionnaire,
      requirements: result.requirements
    });
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

// ============================================================================
// 2. DYNAMIC REQUIREMENTS & NOT APPLICABLE WORKFLOW
// ============================================================================

stageTwoThreeRouter.get('/requirements/:taxYear', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const tenantId = resolveTenantId();
    const taxYear = Number(req.params.taxYear) || 2025;
    const clientId = req.user.role === 'client' ? (req.user.clientId || req.user.id) : (req.query.clientId as string || req.user.clientId || req.user.id);

    const key = `${tenantId}:${clientId}:${taxYear}`;
    let reqs = serverCaseRequirements.get(key);

    if (!reqs) {
      // Derive baseline requirements if questionnaire not yet submitted
      const q = TaxQuestionnaireEngine.getQuestionnaire(tenantId, clientId, taxYear);
      const defaultAnswers: TaxQuestionnaireAnswers = q?.answers || {
        filingStatus: 'single',
        hasDependents: false,
        hasW2Employment: true,
        hasSelfEmployment: false,
        hasInterestIncome: false,
        hasDividendIncome: false,
        hasSecuritiesTrades: false,
        hasCapitalGainsOrLosses: false,
        hasDigitalAssetsOrCrypto: false,
        hasRetirementDistributions: false,
        hasSocialSecurityBenefits: false,
        hasMarketplaceInsurance: false,
        hasHSA: false,
        hasEducationExpenses: false,
        hasMortgageOrRealEstateTaxes: false,
        hasItemizedDeductions: false,
        hasEstimatedTaxPayments: false,
        hasPriorYearFederalReturn: true,
        hasPriorYearStateReturn: false,
        hasForeignIncomeOrAssets: false,
        hasForeignBankAccounts: false,
        hasMultiStateIncome: false,
        hasPartYearResidency: false,
        stateOfResidency: 'SC'
      };
      reqs = TaxQuestionnaireEngine.generateRequirementsFromQuestionnaire(tenantId, clientId, taxYear, defaultAnswers);
      serverCaseRequirements.set(key, reqs);
    }

    return res.json({
      tenantId,
      clientId,
      taxYear,
      requirements: reqs
    });
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

stageTwoThreeRouter.post('/requirements/:taxYear/:reqCode/not-applicable', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const tenantId = resolveTenantId();
    const taxYear = Number(req.params.taxYear) || 2025;
    const reqCode = req.params.reqCode;
    const clientId = req.user.role === 'client' ? (req.user.clientId || req.user.id) : (req.body.clientId || req.user.clientId || req.user.id);
    const { reason } = req.body;

    const evaluation = TaxQuestionnaireEngine.evaluateNotApplicableClaim({
      tenantId,
      clientId,
      taxYear,
      requirementCode: reqCode,
      clientReason: reason,
      actorId: req.user.id
    });

    if (!evaluation.permitted) {
      return res.status(400).json({ error: evaluation.conflictReason });
    }

    const key = `${tenantId}:${clientId}:${taxYear}`;
    const reqs = serverCaseRequirements.get(key) || [];
    const item = reqs.find(r => r.requirementCode === reqCode || r.id.endsWith(reqCode));

    if (item) {
      item.status = 'Not Applicable';
      item.notApplicableReason = reason;
      item.notApplicableReportedAt = new Date().toISOString();
      if (evaluation.requiresProfessionalReview) {
        item.reviewStatus = 'EXCEPTION_FLAGGED';
      }
      serverCaseRequirements.set(key, reqs);
    }

    db.logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role || 'client',
      action: 'REQUIREMENT_NOT_APPLICABLE_CLAIMED',
      resource: `Req ${reqCode} (${taxYear})`,
      details: `Client marked requirement ${reqCode} as Not Applicable. Reason: ${reason}. Conflict flag: ${evaluation.requiresProfessionalReview}.`,
      severity: evaluation.requiresProfessionalReview ? 'warning' : 'info',
      ipAddress: '127.0.0.1'
    });

    return res.json({
      success: true,
      requiresProfessionalReview: evaluation.requiresProfessionalReview,
      conflictReason: evaluation.conflictReason,
      requirement: item
    });
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

stageTwoThreeRouter.get('/snapshot/:taxYear', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const tenantId = resolveTenantId();
    const taxYear = Number(req.params.taxYear) || 2025;
    const clientId = req.user.role === 'client' ? (req.user.clientId || req.user.id) : (req.query.clientId as string || req.user.clientId || req.user.id);

    const snapshot = StageTwoReconciliationService.reconcileStageTwoCollection({
      clientId,
      taxYear,
      tenantId,
      engagementId: `eng_${taxYear}_${clientId}`
    });

    return res.json({
      success: true,
      snapshot
    });
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

stageTwoThreeRouter.post('/reconcile/:taxYear', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const tenantId = resolveTenantId();
    const taxYear = Number(req.params.taxYear) || 2025;
    const clientId = req.user.role === 'client' ? (req.user.clientId || req.user.id) : (req.body.clientId || req.user.clientId || req.user.id);

    const snapshot = StageTwoReconciliationService.reconcileStageTwoCollection({
      clientId,
      taxYear,
      tenantId,
      engagementId: `eng_${taxYear}_${clientId}`,
      forceRefresh: true
    });

    return res.json({
      success: true,
      snapshot
    });
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

// ============================================================================
// 3. CLIENT CASE REQUESTS LOOP
// ============================================================================

stageTwoThreeRouter.get('/requests/:taxYear', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const tenantId = resolveTenantId();
    const taxYear = Number(req.params.taxYear) || 2025;
    const clientId = req.user.role === 'client' ? (req.user.clientId || req.user.id) : (req.query.clientId as string || req.user.clientId || req.user.id);

    const allRequests = Array.from(serverClientRequestsStore.values()).filter(
      r => r.tenantId === tenantId && r.clientId === clientId && r.taxYear === taxYear
    );

    return res.json({
      tenantId,
      clientId,
      taxYear,
      requests: allRequests
    });
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

stageTwoThreeRouter.post('/requests/:taxYear/:requestId/respond', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const clientId = req.user.role === 'client' ? (req.user.clientId || req.user.id) : req.user.id;
    const { message, uploadedDocumentId } = req.body;

    if (!message || message.trim().length < 2) {
      return res.status(400).json({ error: 'Response message is required.' });
    }

    const updated = AccountantDocumentReviewService.handleClientRequestResponse({
      requestId: req.params.requestId,
      clientId,
      responseMessage: message,
      uploadedDocumentId
    });

    return res.json({ success: true, request: updated });
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

// ============================================================================
// 4. ACCOUNTANT DOCUMENT REVIEW WORKSPACE ENDPOINTS (STAFF ONLY)
// ============================================================================

stageTwoThreeRouter.get('/accountant/review-queue', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const tenantId = resolveTenantId();

    const items = AccountantDocumentReviewService.getReviewQueue(
      { id: req.user.id, role: req.user.role, tenantId },
      {
        tenantId,
        clientId: req.query.clientId as string,
        taxYear: req.query.taxYear ? Number(req.query.taxYear) : undefined,
        category: req.query.category as string,
        reviewStatus: req.query.reviewStatus as any
      }
    );

    return res.json({ count: items.length, items });
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

stageTwoThreeRouter.get('/accountant/review-item/:documentId', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const item = AccountantDocumentReviewService.getReviewItem(req.params.documentId, {
      id: req.user.id,
      role: req.user.role
    });
    return res.json({ item });
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

stageTwoThreeRouter.post('/accountant/review-action', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const tenantId = resolveTenantId();
    const {
      documentId,
      expectedVersion,
      action,
      fieldId,
      correctedValue,
      justification,
      newCategory,
      duplicateOfDocId
    } = req.body;

    if (!documentId || expectedVersion === undefined || !action) {
      return res.status(400).json({ error: 'documentId, expectedVersion, and action are required.' });
    }

    const result = AccountantDocumentReviewService.executeReviewAction({
      documentId,
      expectedVersion: Number(expectedVersion),
      action,
      fieldId,
      correctedValue,
      justification,
      newCategory,
      duplicateOfDocId,
      actor: {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role,
        tenantId
      }
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

stageTwoThreeRouter.post('/accountant/verify-evidence', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const tenantId = resolveTenantId();
    const { clientId, engagementId, taxYear, documentId } = req.body;

    const result = AccountantDocumentReviewService.verifyEvidenceAndInvalidateDownstream({
      tenantId,
      clientId,
      engagementId: engagementId || `eng_${taxYear}`,
      taxYear: Number(taxYear) || 2025,
      documentId,
      actor: {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role
      }
    });

    return res.json({
      success: true,
      evidenceRecords: result.evidenceRecords,
      invalidatedStages: result.invalidatedStages
    });
  } catch (err: any) {
    return res.status(err instanceof AuthorityError ? err.status : 500).json({ error: err.message });
  }
});

// ============================================================================
// 5. SERVER GATE EVALUATIONS
// ============================================================================

stageTwoThreeRouter.post('/gates/stage-2/evaluate', (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = req.body.snapshot || {};
    const decision = evaluateStageTwoServerGate({
      completenessPassed: Boolean(snapshot.completenessPassed),
      unresolvedBlockingExceptions: Number(snapshot.unresolvedBlockingExceptions || 0),
      reconciliationPassed: Boolean(snapshot.reconciliationPassed),
      professionalCertificationPassed: Boolean(snapshot.professionalCertificationPassed),
      hardExitGatePassed: snapshot.hardExitGatePassed !== undefined ? Boolean(snapshot.hardExitGatePassed) : true,
      blockingReasons: snapshot.blockingReasons
    });
    return res.json({ decision });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

stageTwoThreeRouter.post('/gates/stage-3/evaluate', (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = req.body.snapshot || {};
    const decision = evaluateStageThreeServerGate({
      validationComplete: Boolean(snapshot.validationComplete),
      provenanceComplete: Boolean(snapshot.provenanceComplete),
      unresolvedBlockingExceptions: Number(snapshot.unresolvedBlockingExceptions || 0),
      humanReviewRequired: snapshot.humanReviewRequired !== undefined ? Boolean(snapshot.humanReviewRequired) : true,
      humanReviewApproved: Boolean(snapshot.humanReviewApproved),
      hardExitGatePassed: snapshot.hardExitGatePassed !== undefined ? Boolean(snapshot.hardExitGatePassed) : true,
      aiOnlyDecision: snapshot.aiOnlyDecision === true,
      blockingReasons: snapshot.blockingReasons
    });
    return res.json({ decision });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
