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
