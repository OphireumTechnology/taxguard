import { Router } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getFirebaseAdminDb } from '../firebase-admin';
import { AuthorityError, TaxGuardAuthorityRepository, type CaseScope } from '../taxguard/authority.repository';
import { proposeDurableOpenAIReview } from '../ai/TaxGuardOpenAIService';

export const caseAuthorityRouter = Router();
caseAuthorityRouter.use(authenticateToken);
caseAuthorityRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
const base = '/:tenantId/:clientId/:engagementId/:taxYear';
function handler(action: (repo: TaxGuardAuthorityRepository, scope: CaseScope, uid: string, req: AuthenticatedRequest) => Promise<unknown>) {
  return async (req: AuthenticatedRequest, res: any) => {
    try {
      const scope = { tenantId: req.params.tenantId, clientId: req.params.clientId, engagementId: req.params.engagementId, taxYear: Number(req.params.taxYear) };
      const result = await action(new TaxGuardAuthorityRepository(getFirebaseAdminDb()), scope, req.user!.id, req);
      res.json(result);
    } catch (error) {
      res.status(error instanceof AuthorityError ? error.status : 503).json({
        error: error instanceof AuthorityError ? error.code : 'AUTHORITY_OPERATION_UNAVAILABLE',
        requiresHumanReview: true, externalSubmissionAllowed: false,
      });
    }
  };
}
caseAuthorityRouter.get(base, handler((repo, scope, uid) => repo.getCase(scope, uid)));
caseAuthorityRouter.get(base + '/evidence/:id', handler((repo, scope, uid, req) => repo.getEvidence(scope, uid, req.params.id)));
caseAuthorityRouter.get(base + '/artifacts/:kind/:id', handler((repo, scope, uid, req) => repo.getArtifact(scope, uid, req.params.kind, req.params.id)));
caseAuthorityRouter.post(base + '/evidence', handler((repo, scope, uid, req) => repo.recordEvidence(scope, uid, req.body?.revision, req.body?.operationId, req.body?.evidence)));
caseAuthorityRouter.post(base + '/reviews', handler((repo, scope, uid, req) => repo.recordReview(scope, uid, req.body?.revision, req.body?.operationId, req.body?.evidenceId, req.body?.outcome)));
caseAuthorityRouter.post(base + '/exceptions', handler((repo, scope, uid, req) => repo.recordException(scope, uid, req.body?.revision, req.body?.operationId, req.body?.code)));
caseAuthorityRouter.post(base + '/exceptions/:id/resolve', handler((repo, scope, uid, req) => repo.resolveException(scope, uid, req.body?.revision, req.body?.operationId, req.params.id)));
caseAuthorityRouter.post(base + '/ai-review', handler((repo, scope, uid, req) => {
  if (process.env.TAXGUARD_OPENAI_CASES_ENABLED !== 'true') throw new AuthorityError('AI_CASE_REVIEW_DISABLED', 503);
  return proposeDurableOpenAIReview(repo, scope, uid, req.body || {});
}));
// No endpoint accepts caller-supplied gate results or writes arbitrary assignments/authority.
