/**
 * DESTRIA TAX SERVICES LLC — TaxGuard Stages 09–18 Authorized Express API Router
 *
 * Mount point: /api/stages-09-18
 * Security:
 * - Every route requires verified authentication (`authenticateToken`)
 * - Strict tenant isolation (`requireTenantIsolation`)
 * - Recruiter segregation (`blockRecruiterFromTaxRecords`)
 * - Server-derived ActorSessionContext including server-verified MFA AAL2 assurance
 * - Explicit scope validation (tenantId, clientId, engagementId, caseId, taxYear)
 * - Fail-closed provider boundaries (no fabricated signatures, filings, or transcripts)
 */

import { Router, Response, NextFunction } from 'express';
import {
  authenticateToken,
  AuthenticatedRequest,
  blockRecruiterFromTaxRecords,
  requireTenantIsolation,
} from '../auth';
import { sessionAssuranceLevel } from '../staffMfa';
import { db } from '../db';
import {
  Stages09To18Orchestrator,
  stages09To18Orchestrator,
} from '../taxguard/stages09to18/stages09to18.orchestrator';
import {
  ActorSessionContext,
  GovernanceRole,
  ScopedCaseContext,
  Stage09To18Number,
  TaxGuardStageError,
} from '../taxguard/stages09to18/types';
import { BoundedAiAdvisoryShield } from '../taxguard/stages09to18/providerBoundary';

function extractActor(req: AuthenticatedRequest): ActorSessionContext {
  const user = req.user;
  if (!user) {
    throw new TaxGuardStageError(401, 'AUTH_REQUIRED', 'Authentication required.');
  }
  const tenantId = (user as any).tenantId || process.env.TAXGUARD_TENANT_ID || 'tenantA';
  const session = req.token ? db.sessions.get(req.token) : undefined;
  const mfaLevel = sessionAssuranceLevel(user) === 'aal2' ? 'aal2' : 'aal1';
  const assignedClientIds =
    user.authorizedClientIds && user.authorizedClientIds.length > 0
      ? user.authorizedClientIds
      : undefined;

  return {
    userId: user.id,
    email: user.email,
    name: user.name || user.email,
    role: user.role as GovernanceRole,
    tenantId,
    clientId: user.clientId,
    assignedClientIds,
    mfaAssuranceLevel: mfaLevel,
    sessionExpiresAt: session?.expiresAt ?? Date.now() + 60 * 60 * 1000,
    accountStatus: user.status === 'active' ? 'active' : (user.status as 'suspended' | 'disabled'),
  };
}

function extractScope(req: AuthenticatedRequest, actor: ActorSessionContext): ScopedCaseContext {
  const source = req.method === 'GET' ? req.query : req.body;
  const tenantId = String(source?.tenantId || req.headers['x-tenant-id'] || actor.tenantId).trim();
  const clientId = String(source?.clientId || req.params.clientId || '').trim();
  const engagementId = String(source?.engagementId || '').trim();
  const caseId = String(source?.caseId || req.params.caseId || '').trim();
  const taxYear = Number(source?.taxYear);

  if (!tenantId || !clientId || !engagementId || !caseId || !Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
    throw new TaxGuardStageError(
      400,
      'INVALID_CASE_SCOPE',
      'Explicit tenantId, clientId, engagementId, caseId, and valid taxYear are required.'
    );
  }

  return { tenantId, clientId, engagementId, caseId, taxYear };
}

function handleRoute(
  fn: (req: AuthenticatedRequest, res: Response) => void | Promise<void>
) {
  return async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err: unknown) {
      if (err instanceof TaxGuardStageError) {
        res.status(err.status).json({
          code: err.code,
          error: err.message,
          ...(err.details ? { details: err.details } : {}),
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'Unexpected server error';
      res.status(500).json({
        code: 'STAGES_09_18_INTERNAL_ERROR',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
      });
    }
  };
}

export function createStages09To18Router(
  orchestrator: Stages09To18Orchestrator = stages09To18Orchestrator
): Router {
  const router = Router();

  // Fail-closed baseline middleware on all Stages 09–18 routes
  router.use(authenticateToken);
  router.use(requireTenantIsolation);
  router.use(blockRecruiterFromTaxRecords);

  // Readiness Scorecard & Provider Commissioning Matrix (Staff Only)
  router.get(
    '/readiness-scorecard',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      if (actor.role === 'client' || actor.role === 'prospective_client') {
        throw new TaxGuardStageError(403, 'STAFF_ROLE_REQUIRED', 'Staff role required to inspect readiness scorecard.');
      }
      res.json(orchestrator.getReadinessScorecard());
    })
  );

  // Full Scoped Case Snapshot across Stages 09–18
  router.get(
    '/snapshot',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      res.json(orchestrator.getCaseSnapshot(actor, scope));
    })
  );

  // Controlled Stage Advancement
  router.post(
    '/advance-stage',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      const targetStage = Number(req.body?.targetStage) as Stage09To18Number;
      if (!Number.isInteger(targetStage) || targetStage < 9 || targetStage > 18) {
        throw new TaxGuardStageError(400, 'INVALID_STAGE', 'targetStage must be an integer between 9 and 18.');
      }
      res.json(orchestrator.advanceStage(actor, scope, targetStage));
    })
  );

  // =========================================================================
  // STAGE 09 — PREPARE TAXES
  // =========================================================================

  router.get(
    '/stage-09/forms',
    handleRoute((req, res) => {
      extractActor(req);
      const taxYear = Number(req.query.taxYear) || 2025;
      res.json({ taxYear, forms: orchestrator.stage09.getFormsRegistry(taxYear) });
    })
  );

  router.post(
    '/stage-09/profile',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'UPSERT_TAXPAYER_PROFILE' });
      const profile = orchestrator.stage09.upsertTaxpayerProfile(scope, actor, req.body);
      orchestrator.appendAudit({
        stage: 9,
        action: 'UPSERT_TAXPAYER_PROFILE',
        actorId: actor.userId,
        actorRole: actor.role,
        scope,
        outcome: 'ALLOWED',
        code: 'PROFILE_SAVED',
        entityType: 'TaxpayerProfile',
        entityId: profile.id,
      });
      res.status(200).json(profile);
    })
  );

  router.post(
    '/stage-09/rule-packs',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'DRAFT_RULE_PACK' });
      const pack = orchestrator.stage09.draftRulePack(actor, req.body);
      res.status(201).json(pack);
    })
  );

  router.post(
    '/stage-09/rule-packs/:rulePackId/approve',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'APPROVE_RULE_PACK' });
      const pack = orchestrator.stage09.approveRulePack(actor, req.params.rulePackId);
      res.json(pack);
    })
  );

  router.post(
    '/stage-09/evidence',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'RECORD_SOURCE_EVIDENCE' });
      const ev = orchestrator.stage09.recordSourceEvidence(scope, actor, req.body);
      res.status(201).json(ev);
    })
  );

  router.post(
    '/stage-09/book-to-tax/adjustments',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'RECORD_B2T_ADJUSTMENT' });
      const adj = orchestrator.stage09.recordBookToTaxAdjustment(scope, actor, req.body);
      res.status(201).json(adj);
    })
  );

  router.post(
    '/stage-09/book-to-tax/adjustments/:adjustmentId/approve',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'APPROVE_B2T_ADJUSTMENT' });
      const adj = orchestrator.stage09.approveBookToTaxAdjustment(scope, actor, req.params.adjustmentId);
      res.json(adj);
    })
  );

  router.post(
    '/stage-09/book-to-tax/reconcile',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'RECONCILE_BOOK_TO_TAX' });
      const summary = orchestrator.stage09.computeBookToTaxReconciliation(
        scope,
        String(req.body?.bookNetIncome ?? '0.00'),
        req.body?.targetTaxableIncome ? String(req.body.targetTaxableIncome) : undefined
      );
      res.json(summary);
    })
  );

  router.post(
    '/stage-09/calculate',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'RUN_DETERMINISTIC_CALCULATION' });
      const run = orchestrator.stage09.runDeterministicCalculation(scope, actor, req.body);
      orchestrator.appendAudit({
        stage: 9,
        action: 'RUN_DETERMINISTIC_CALCULATION',
        actorId: actor.userId,
        actorRole: actor.role,
        scope,
        outcome: 'ALLOWED',
        code: 'CALCULATION_COMPLETED',
        entityType: 'TaxCalculationRun',
        entityId: run.calculationRunId,
        metadata: { calculationSha256: run.calculationSha256, rulePackId: run.rulePackId },
      });
      res.status(201).json(run);
    })
  );

  router.post(
    '/stage-09/returns',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'ASSEMBLE_RETURN_VERSION' });
      const ret = orchestrator.stage09.assembleReturnVersion(scope, actor, req.body);
      res.status(201).json(ret);
    })
  );

  router.post(
    '/stage-09/returns/:returnVersionId/submit',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'SUBMIT_RETURN_FOR_REVIEW' });
      const ret = orchestrator.stage09.submitReturnForStage10Review(
        scope,
        actor,
        req.params.returnVersionId,
        req.body?.expectedOptimisticVersion
      );
      res.json(ret);
    })
  );

  router.post(
    '/stage-09/returns/:returnVersionId/modify',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'MODIFY_RETURN_FIELD' });
      const ret = orchestrator.stage09.materiallyModifyReturnField(scope, actor, {
        returnVersionId: req.params.returnVersionId,
        lineKey: String(req.body?.lineKey || ''),
        newValue: String(req.body?.newValue || ''),
        expectedOptimisticVersion: Number(req.body?.expectedOptimisticVersion),
      });
      res.json(ret);
    })
  );

  router.post(
    '/stage-09/advisory',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 9, action: 'REQUEST_AI_ADVISORY' });
      const output = BoundedAiAdvisoryShield.generateAdvisory({
        agentCode: 'A14_PREPARATION_ADVISOR',
        untrustedInput: String(req.body?.prompt || ''),
        contextLabel: `Stage 09 Case ${scope.caseId} TY${scope.taxYear}`,
      });
      res.json(output);
    })
  );

  // =========================================================================
  // STAGE 10 — APPROVE
  // =========================================================================

  router.post(
    '/stage-10/findings',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 10, action: 'RAISE_REVIEW_FINDING' });
      const finding = orchestrator.stage10.raiseReviewFinding(scope, actor, req.body);
      res.status(201).json(finding);
    })
  );

  router.post(
    '/stage-10/qc-gates',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 10, action: 'RECORD_QC_GATES' });
      const gates = orchestrator.stage10.recordQcGateChecks(
        scope,
        actor,
        String(req.body?.returnVersionId || ''),
        Array.isArray(req.body?.checks) ? req.body.checks : []
      );
      res.json({ gates });
    })
  );

  router.post(
    '/stage-10/approve',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 10, action: 'APPROVE_RETURN_VERSION' });
      const approval = orchestrator.stage10.approveReturnVersion(scope, actor, req.body);
      orchestrator.appendAudit({
        stage: 10,
        action: 'APPROVE_RETURN_VERSION',
        actorId: actor.userId,
        actorRole: actor.role,
        scope,
        outcome: 'ALLOWED',
        code: 'RETURN_APPROVED',
        entityType: 'ReturnApproval',
        entityId: approval.approvalId,
        metadata: { returnVersionId: approval.returnVersionId, returnContentSha256: approval.returnContentSha256 },
      });
      res.status(201).json(approval);
    })
  );

  router.post(
    '/stage-10/return-for-correction',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 10, action: 'RETURN_FOR_CORRECTION' });
      const result = orchestrator.stage10.returnForCorrection(scope, actor, req.body);
      res.status(201).json(result);
    })
  );

  // =========================================================================
  // STAGE 11 — SIGN
  // =========================================================================

  router.post(
    '/stage-11/envelopes',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 11, action: 'CREATE_SIGNATURE_ENVELOPE' });
      const env = orchestrator.lifecycle.createSignatureEnvelope(scope, actor, req.body);
      res.status(201).json(env);
    })
  );

  router.post(
    '/stage-11/envelopes/:envelopeId/dispatch',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 11, action: 'DISPATCH_SIGNATURE_ENVELOPE' });
      const env = orchestrator.lifecycle.dispatchSignatureEnvelope(scope, req.params.envelopeId);
      res.json(env);
    })
  );

  // =========================================================================
  // STAGE 12 — FILE
  // =========================================================================

  router.post(
    '/stage-12/readiness',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 12, action: 'EVALUATE_FILING_READINESS' });
      const report = orchestrator.lifecycle.evaluateFilingReadiness(scope, req.body);
      res.json(report);
    })
  );

  router.post(
    '/stage-12/transmit',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 12, action: 'TRANSMIT_FILING' });
      const filing = orchestrator.lifecycle.authorizeAndTransmitFiling(scope, actor, req.body);
      res.status(201).json(filing);
    })
  );

  // =========================================================================
  // STAGE 13 — GOVERNMENT FEEDBACK
  // =========================================================================

  router.post(
    '/stage-13/notices',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 13, action: 'REGISTER_GOV_NOTICE' });
      const result = orchestrator.lifecycle.registerGovernmentNotice(scope, actor, req.body);
      res.status(201).json(result);
    })
  );

  router.post(
    '/stage-13/transcripts',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 13, action: 'REQUEST_TRANSCRIPT' });
      orchestrator.lifecycle.requestGovernmentTranscript(scope, actor, req.body);
    })
  );

  // =========================================================================
  // STAGE 14 — RESOLVE
  // =========================================================================

  router.post(
    '/stage-14/resolutions',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 14, action: 'OPEN_RESOLUTION_CASE' });
      const rec = orchestrator.lifecycle.openResolutionCase(scope, actor, req.body);
      res.status(201).json(rec);
    })
  );

  router.post(
    '/stage-14/resolutions/:resolutionId/transition',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 14, action: 'TRANSITION_RESOLUTION_CASE' });
      const rec = orchestrator.lifecycle.transitionResolutionCase(scope, actor, {
        resolutionId: req.params.resolutionId,
        toState: req.body?.toState,
        note: String(req.body?.note || ''),
        governmentConfirmationReceived: Boolean(req.body?.governmentConfirmationReceived),
        expectedVersion: req.body?.expectedVersion,
      });
      res.json(rec);
    })
  );

  router.post(
    '/stage-14/amendments',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 14, action: 'CREATE_AMENDMENT' });
      const result = orchestrator.lifecycle.createLinkedAmendment(scope, actor, req.body);
      res.status(201).json(result);
    })
  );

  // =========================================================================
  // STAGE 15 — MONITOR
  // =========================================================================

  router.post(
    '/stage-15/obligations',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 15, action: 'SCHEDULE_OBLIGATION' });
      const obl = orchestrator.lifecycle.scheduleComplianceObligation(scope, req.body);
      res.status(201).json(obl);
    })
  );

  router.post(
    '/stage-15/notifications',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 15, action: 'ENQUEUE_NOTIFICATION' });
      const notif = orchestrator.lifecycle.enqueueNotification(scope, req.body);
      res.status(201).json(notif);
    })
  );

  // =========================================================================
  // STAGE 16 — ARCHIVE & LEGAL HOLD
  // =========================================================================

  router.post(
    '/stage-16/retention-policies',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 16, action: 'DEFINE_RETENTION_POLICY' });
      const policy = orchestrator.lifecycle.defineRetentionPolicy({
        tenantId: scope.tenantId,
        documentClass: String(req.body?.documentClass || 'TAX_RETURN'),
        jurisdictionCode: String(req.body?.jurisdictionCode || 'US'),
        engagementType: String(req.body?.engagementType || 'INDIVIDUAL'),
        retentionYears: Number(req.body?.retentionYears || 7),
        policyAuthority: String(req.body?.policyAuthority || 'IRS IRC §6501 / Destria Firm Retention Standard'),
      });
      res.status(201).json(policy);
    })
  );

  router.post(
    '/stage-16/archives',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 16, action: 'SEAL_ARCHIVE_PACKAGE' });
      const audit = orchestrator.getAuditTrail(scope);
      const pkg = orchestrator.lifecycle.sealArchivePackage(scope, actor, {
        retentionPolicyId: String(req.body?.retentionPolicyId || ''),
        auditEventCount: audit.entries.length,
        auditDigestSha256: audit.digestSha256,
      });
      res.status(201).json(pkg);
    })
  );

  router.post(
    '/stage-16/legal-holds',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 16, action: 'PLACE_LEGAL_HOLD' });
      const hold = orchestrator.lifecycle.placeLegalHold(scope, actor, req.body);
      res.status(201).json(hold);
    })
  );

  router.post(
    '/stage-16/archives/:archiveId/dispose',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 16, action: 'ATTEMPT_ARCHIVE_DISPOSITION' });
      const pkg = orchestrator.lifecycle.attemptArchiveDisposition(scope, req.params.archiveId);
      res.json(pkg);
    })
  );

  // =========================================================================
  // STAGE 17 — RENEW
  // =========================================================================

  router.post(
    '/stage-17/renewals',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 17, action: 'CREATE_RENEWAL_PROPOSAL' });
      const renewal = orchestrator.lifecycle.createRenewalProposal(scope, actor, req.body);
      res.status(201).json(renewal);
    })
  );

  router.post(
    '/stage-17/renewals/:renewalId/activate',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 17, action: 'ACTIVATE_RENEWAL' });
      const renewal = orchestrator.lifecycle.activateRenewal(scope, actor, req.params.renewalId);
      res.json(renewal);
    })
  );

  // =========================================================================
  // STAGE 18 — REPEAT
  // =========================================================================

  router.post(
    '/stage-18/carryforwards',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 18, action: 'REGISTER_CARRYFORWARD' });
      const cf = orchestrator.lifecycle.registerCarryforwardCandidate(scope, req.body);
      res.status(201).json(cf);
    })
  );

  router.post(
    '/stage-18/carryforwards/:carryforwardId/review',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 18, action: 'REVIEW_CARRYFORWARD' });
      const cf = orchestrator.lifecycle.reviewCarryforwardItem(scope, actor, {
        carryforwardId: req.params.carryforwardId,
        decision: req.body?.decision,
      });
      res.json(cf);
    })
  );

  router.post(
    '/stage-18/generate-next-cycle',
    handleRoute((req, res) => {
      const actor = extractActor(req);
      const scope = extractScope(req, actor);
      orchestrator.assertAuthorizedAccess(actor, scope, { requireStaff: true, stage: 18, action: 'GENERATE_NEXT_CYCLE' });
      const gen = orchestrator.lifecycle.generateNextTaxYearCycle(scope, actor, req.body);
      res.status(201).json(gen);
    })
  );

  return router;
}
