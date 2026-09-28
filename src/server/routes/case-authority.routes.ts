import { Router } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getFirebaseAdminDb } from '../firebase-admin';
import { AuthorityError, TaxGuardAuthorityRepository, type CaseScope } from '../taxguard/authority.repository';
import { proposeDurableOpenAIReview } from '../ai/TaxGuardOpenAIService';
import { ProviderReadinessRegistry } from '../taxguard/providerReadiness.service';
import { StageNumber } from '../taxguard/persistence.types';

export const caseAuthorityRouter = Router();

// Provider readiness route (unscoped or global)
caseAuthorityRouter.get('/provider-readiness', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    providers: ProviderReadinessRegistry.getAllProviderStatuses(),
  });
});

caseAuthorityRouter.use(authenticateToken);
caseAuthorityRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const base = '/:tenantId/:clientId/:engagementId/:taxYear';

function handler(action: (repo: TaxGuardAuthorityRepository, scope: CaseScope, uid: string, req: AuthenticatedRequest) => Promise<unknown>) {
  return async (req: AuthenticatedRequest, res: any) => {
    try {
      const scope = {
        tenantId: req.params.tenantId,
        clientId: req.params.clientId,
        engagementId: req.params.engagementId,
        taxYear: Number(req.params.taxYear),
      };
      const result = await action(new TaxGuardAuthorityRepository(getFirebaseAdminDb()), scope, req.user!.id, req);
      res.json(result);
    } catch (error) {
      res.status(error instanceof AuthorityError ? error.status : 503).json({
        error: error instanceof AuthorityError ? error.code : 'AUTHORITY_OPERATION_UNAVAILABLE',
        code: error instanceof AuthorityError ? error.code : 'AUTHORITY_OPERATION_UNAVAILABLE',
        requiresHumanReview: true,
        externalSubmissionAllowed: false,
      });
    }
  };
}

// Canonical Tax Case operations (M18.4)
caseAuthorityRouter.get('/:tenantId/:clientId/:engagementId/cases', async (req: AuthenticatedRequest, res: any) => {
  try {
    const scope = {
      tenantId: req.params.tenantId,
      clientId: req.params.clientId,
      engagementId: req.params.engagementId,
    };
    const repo = new TaxGuardAuthorityRepository(getFirebaseAdminDb());
    const result = await repo.listCases(scope, req.user!.id);
    res.json(result);
  } catch (error) {
    res.status(error instanceof AuthorityError ? error.status : 503).json({
      error: error instanceof AuthorityError ? error.code : 'AUTHORITY_OPERATION_UNAVAILABLE',
      code: error instanceof AuthorityError ? error.code : 'AUTHORITY_OPERATION_UNAVAILABLE',
    });
  }
});
caseAuthorityRouter.get(base, handler((repo, scope, uid) => repo.getCase(scope, uid)));
caseAuthorityRouter.patch(base, handler((repo, scope, uid, req) =>
  repo.updateCase(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.body?.patch || {})
));
caseAuthorityRouter.post(base + '/activate', handler((repo, scope, uid, req) =>
  repo.activateCase(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId)
));
caseAuthorityRouter.post(base + '/block', handler((repo, scope, uid, req) =>
  repo.blockCase(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.body?.reason || 'Case blocked by authority')
));
caseAuthorityRouter.post(base + '/reopen', handler((repo, scope, uid, req) =>
  repo.reopenCase(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId)
));
caseAuthorityRouter.post(base + '/archive', handler((repo, scope, uid, req) =>
  repo.archiveCase(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId)
));

// Persistent Stage Engine operations (M18.4)
caseAuthorityRouter.get(base + '/stages', handler((repo, scope, uid) => repo.getCaseStageStates(scope, uid)));
caseAuthorityRouter.get(base + '/stages/history', handler((repo, scope, uid) => repo.getStageHistory(scope, uid)));
caseAuthorityRouter.get(base + '/stages/:stage', handler((repo, scope, uid, req) =>
  repo.getStageState(scope, uid, Number(req.params.stage) as StageNumber)
));
caseAuthorityRouter.post(base + '/stages/:stage/evaluate', handler((repo, scope, uid, req) =>
  repo.evaluateStage(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, Number(req.params.stage) as StageNumber, req.body?.snapshot)
));
caseAuthorityRouter.post(base + '/stages/:stage/transition', handler((repo, scope, uid, req) => {
  const fromStage = Number(req.params.stage) as StageNumber;
  const toStage = (req.body?.toStage ?? fromStage + 1) as StageNumber;
  if (req.body?.approvalId) {
    return repo.approveStageTransition(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, fromStage, toStage, req.body.approvalId);
  }
  return repo.requestStageTransition(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, fromStage, toStage);
}));
caseAuthorityRouter.post(base + '/stages/:stage/block', handler((repo, scope, uid, req) =>
  repo.blockStage(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, Number(req.params.stage) as StageNumber, req.body?.reason || 'Stage blocked')
));
caseAuthorityRouter.post(base + '/stages/:stage/reopen', handler((repo, scope, uid, req) =>
  repo.reopenStage(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, Number(req.params.stage) as StageNumber)
));
caseAuthorityRouter.post(base + '/stages/:stage/invalidate', handler((repo, scope, uid, req) =>
  repo.invalidateDownstreamStages(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, Number(req.params.stage) as StageNumber, req.body?.reason || 'Upstream change')
));

// Secure Document Pipeline operations (M18.5)
caseAuthorityRouter.get(base + '/documents', handler((repo, scope, uid) => repo.listDocuments(scope, uid)));
caseAuthorityRouter.post(base + '/documents', handler((repo, scope, uid, req) =>
  repo.registerDocument(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.body?.document)
));
caseAuthorityRouter.get(base + '/documents/:id', handler((repo, scope, uid, req) => repo.getDocument(scope, uid, req.params.id)));
caseAuthorityRouter.post(base + '/documents/:id/scan', handler((repo, scope, uid, req) =>
  repo.scanDocument(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.params.id)
));
caseAuthorityRouter.post(base + '/documents/:id/release', handler((repo, scope, uid, req) =>
  repo.releaseDocument(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.params.id)
));

// Production OCR & Human Review operations (M18.6)
caseAuthorityRouter.post(base + '/documents/:id/ocr', handler((repo, scope, uid, req) =>
  repo.submitOcrJob(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.params.id)
));
caseAuthorityRouter.get(base + '/ocr/:fieldId', handler((repo, scope, uid, req) => repo.getExtractedField(scope, uid, req.params.fieldId)));
caseAuthorityRouter.post(base + '/ocr/:fieldId/review', handler((repo, scope, uid, req) =>
  repo.reviewOcrField(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.params.fieldId, req.body?.decision)
));

// Preserved Evidence, Review & Artifact operations
caseAuthorityRouter.get(base + '/evidence/:id', handler((repo, scope, uid, req) => repo.getEvidence(scope, uid, req.params.id)));
caseAuthorityRouter.get(base + '/artifacts/:kind/:id', handler((repo, scope, uid, req) => repo.getArtifact(scope, uid, req.params.kind, req.params.id)));
caseAuthorityRouter.post(base + '/evidence', handler((repo, scope, uid, req) => repo.recordEvidence(scope, uid, req.body?.revision ?? req.body?.version, req.body?.operationId, req.body?.evidence)));
caseAuthorityRouter.post(base + '/reviews', handler((repo, scope, uid, req) => repo.recordReview(scope, uid, req.body?.revision ?? req.body?.version, req.body?.operationId, req.body?.evidenceId, req.body?.outcome)));
caseAuthorityRouter.post(base + '/exceptions', handler((repo, scope, uid, req) => repo.recordException(scope, uid, req.body?.revision ?? req.body?.version, req.body?.operationId, req.body?.code)));
caseAuthorityRouter.post(base + '/exceptions/:id/resolve', handler((repo, scope, uid, req) => repo.resolveException(scope, uid, req.body?.revision ?? req.body?.version, req.body?.operationId, req.params.id)));
caseAuthorityRouter.post(base + '/ai-review', handler((repo, scope, uid, req) => {
  if (process.env.TAXGUARD_OPENAI_CASES_ENABLED !== 'true') throw new AuthorityError('AI_CASE_REVIEW_DISABLED', 503);
  return proposeDurableOpenAIReview(repo, scope, uid, req.body || {});
}));

// ============================================================================
// STAGE 04 — RECORD ROUTES (M18.7)
// ============================================================================
caseAuthorityRouter.post(base + '/records', handler((repo, scope, uid, req) =>
  repo.createTaxRecord(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.body?.record)
));
caseAuthorityRouter.get(base + '/records', handler((repo, scope, uid, req) =>
  repo.listTaxRecords(scope, uid, { category: req.query.category as string | undefined })
));
caseAuthorityRouter.get(base + '/records/:id', handler((repo, scope, uid, req) =>
  repo.getTaxRecord(scope, uid, req.params.id)
));
caseAuthorityRouter.post(base + '/records/:id/resolve-duplicate', handler((repo, scope, uid, req) =>
  repo.resolveRecordDuplicate(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.params.id, req.body?.resolution)
));

// ============================================================================
// STAGE 05 — RECONCILE ROUTES (M18.7)
// ============================================================================
caseAuthorityRouter.post(base + '/reconciliations/run', handler((repo, scope, uid, req) =>
  repo.runReconciliation(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.body?.category, req.body?.tolerance)
));
caseAuthorityRouter.get(base + '/reconciliations', handler((repo, scope, uid) =>
  repo.listReconciliations(scope, uid)
));
caseAuthorityRouter.get(base + '/reconciliations/:id', handler((repo, scope, uid, req) =>
  repo.getReconciliation(scope, uid, req.params.id)
));
caseAuthorityRouter.post(base + '/reconciliations/:id/resolve', handler((repo, scope, uid, req) =>
  repo.resolveReconciliationVariance(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.params.id, req.body?.reason)
));

// ============================================================================
// STAGE 06 — REVIEW ROUTES (M18.7)
// ============================================================================
caseAuthorityRouter.post(base + '/workpapers', handler((repo, scope, uid, req) =>
  repo.createWorkpaper(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.body?.workpaper)
));
caseAuthorityRouter.get(base + '/workpapers', handler((repo, scope, uid) =>
  repo.listWorkpapers(scope, uid)
));
caseAuthorityRouter.get(base + '/workpapers/:id', handler((repo, scope, uid, req) =>
  repo.getWorkpaper(scope, uid, req.params.id)
));
caseAuthorityRouter.post(base + '/reviews/action', handler((repo, scope, uid, req) =>
  repo.performReviewAction(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.body?.target, req.body?.action, req.body?.notes)
));

// ============================================================================
// STAGE 07 — REPORT ROUTES (M18.7)
// ============================================================================
caseAuthorityRouter.post(base + '/reports/generate', handler((repo, scope, uid, req) =>
  repo.generateReport(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.body?.reportType)
));
caseAuthorityRouter.get(base + '/reports', handler((repo, scope, uid) =>
  repo.listReports(scope, uid)
));
caseAuthorityRouter.get(base + '/reports/:id', handler((repo, scope, uid, req) =>
  repo.getReport(scope, uid, req.params.id)
));

// ============================================================================
// STAGE 08 — PLAN ROUTES (M18.7)
// ============================================================================
caseAuthorityRouter.post(base + '/planning', handler((repo, scope, uid, req) =>
  repo.createPlanningScenario(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.body?.scenario)
));
caseAuthorityRouter.get(base + '/planning', handler((repo, scope, uid) =>
  repo.listPlanningScenarios(scope, uid)
));
caseAuthorityRouter.get(base + '/planning/:id', handler((repo, scope, uid, req) =>
  repo.getPlanningScenario(scope, uid, req.params.id)
));

// ============================================================================
// STAGE 09 — PREPARE TAXES ROUTES (M18.7)
// ============================================================================
caseAuthorityRouter.post(base + '/returns/generate', handler((repo, scope, uid, req) =>
  repo.generateDraftReturn(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.body?.returnType, req.body?.jurisdiction)
));
caseAuthorityRouter.get(base + '/returns', handler((repo, scope, uid) =>
  repo.listDraftReturns(scope, uid)
));
caseAuthorityRouter.get(base + '/returns/:id', handler((repo, scope, uid, req) =>
  repo.getDraftReturn(scope, uid, req.params.id)
));
caseAuthorityRouter.post(base + '/returns/:id/certify', handler((repo, scope, uid, req) =>
  repo.certifyDraftReturn(scope, uid, req.body?.version ?? req.body?.revision, req.body?.operationId, req.params.id)
));

