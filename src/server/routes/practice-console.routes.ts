/**
 * DESTRIA TAX SERVICES LLC - Practice Console API Routes
 * Administrative Practice Console Queues & Workflow Engine (Directive 24)
 *
 * Exclusively accessible to authorized staff: Accountant, Senior Reviewer, Admin, Super Admin.
 * Provides real persisted queues for:
 * 1. Profile Amendment Requests
 * 2. Document Review Queue
 * 3. Questionable Classification Queue
 * 4. Unresolved Tax Year Queue
 * 5. Duplicates Queue
 * 6. Rejected / Security-Blocked Documents Queue
 * 7. Missing Documents Queue
 * 8. Client RFIs
 * 9. Extraction Exceptions
 * 10. Stage 02 Readiness & Gate Approvals
 */

import { Router, Response } from 'express';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../auth';
import { canAccessStaffClient } from '../clientAccess';
import { LiveWorkflowRepository } from '../taxguard/liveWorkflow.repository';

export const practiceConsoleRouter = Router();

practiceConsoleRouter.use(authenticateToken);
practiceConsoleRouter.use(requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'));

// 1. Get all 10 Practice Console Queues & Metrics
practiceConsoleRouter.get('/queues', async (req: AuthenticatedRequest, res: Response) => {
  const allDocs = Array.from(db.documents.values());
  const allAmendments = Array.from(db.profileAmendments.values());
  const allWithdrawals = Array.from(db.documentWithdrawals.values());
  const allSecurityEvents = db.securityEvents;

  // 1. Profile Amendments Queue
  const pendingAmendments = allAmendments.filter(a => a.status === 'PENDING_REVIEW' || a.status === 'INFO_REQUESTED');

  // 2. Document Review Queue
  const documentReviewQueue = allDocs.filter(d =>
    d.status === 'pending_review' ||
    d.status === 'uploaded' ||
    d.status === 'needs_correction'
  ).map(d => ({
    id: d.id,
    fileName: d.fileName,
    clientId: d.clientId,
    clientName: d.clientName,
    taxYear: d.taxYear,
    category: d.category,
    status: d.status,
    uploadedAt: d.uploadedAt,
    ocrConfidence: d.ocrConfidence,
    extractedData: d.extractedData
  }));

  // 3. Questionable Classification Queue
  const questionableClassificationQueue = allDocs.filter(d =>
    d.category === 'other' ||
    (d.ocrConfidence !== undefined && d.ocrConfidence < 75)
  );

  // 4. Unresolved Tax Year Queue
  const unresolvedTaxYearQueue = allDocs.filter(d =>
    !d.taxYear || (d as any).taxYear === 'TAX_YEAR_UNRESOLVED' || isNaN(Number(d.taxYear))
  );

  // 5. Duplicates Queue
  // Detect duplicate hashes or identical filenames across clients
  const duplicatesMap = new Map<string, string[]>();
  allDocs.forEach(d => {
    const key = `${d.clientId}:${d.fileName}`;
    const list = duplicatesMap.get(key) || [];
    list.push(d.id);
    duplicatesMap.set(key, list);
  });
  const duplicateIds = new Set<string>();
  for (const [, ids] of duplicatesMap.entries()) {
    if (ids.length > 1) {
      ids.slice(1).forEach(id => duplicateIds.add(id));
    }
  }
  const duplicatesQueue = allDocs.filter(d => duplicateIds.has(d.id) || d.status === 'duplicate' as any);

  // 6. Rejected / Security-Blocked Queue
  const securityBlockedQueue = [
    ...allDocs.filter(d => d.status === 'rejected' || (d as any).securityCheckStatus === 'Quarantined'),
    ...allWithdrawals.filter(w => w.lifecycleStatus === 'REJECTED' || w.reason === 'IRRELEVANT')
  ];

  // 7. Missing Documents Queue
  const missingDocumentsQueue = Array.from(db.documentRequests.values())
    .filter(r => r.status === 'pending' || r.status === 'overdue');

  // 8. Client RFIs
  const clientRfis = Array.from(db.messages.values())
    .filter(m => m.subject?.toLowerCase().includes('rfi') || m.subject?.toLowerCase().includes('request for information'));

  // 9. Extraction Exceptions
  const extractionExceptions = allDocs.filter(d =>
    d.isAiProcessed && (d.extractedData === undefined || (Array.isArray(d.extractedData) && d.extractedData.length === 0))
  );

  // 10. Stage 02 Readiness & Gate Approvals
  const users = Array.from(db.users.values()).filter(u => u.role === 'client');
  const stageTwoReadinessList = [];

  for (const client of users) {
    if (!client.clientId) continue;
    try {
      const wf = await LiveWorkflowRepository.getCase(client.clientId, 2025);
      if (wf && wf.activeStage === 2) {
        stageTwoReadinessList.push({
          clientId: client.clientId,
          clientName: client.name,
          email: client.email,
          taxYear: 2025,
          activeStage: 2,
          stage1Status: wf.stage1.status,
          stage2Status: wf.stage2.status,
          readyForGateReview: (wf.stage2.status as string) === 'READY_FOR_REVIEW' || (wf.stage2.status as string) === 'ACTIVE' || wf.stage2.status === 'IN_PROGRESS'
        });
      }
    } catch {
      // ignore
    }
  }

  return res.json({
    summary: {
      profileAmendmentsCount: pendingAmendments.length,
      documentReviewCount: documentReviewQueue.length,
      questionableClassificationCount: questionableClassificationQueue.length,
      unresolvedTaxYearCount: unresolvedTaxYearQueue.length,
      duplicatesCount: duplicatesQueue.length,
      securityBlockedCount: securityBlockedQueue.length,
      missingDocumentsCount: missingDocumentsQueue.length,
      clientRfisCount: clientRfis.length,
      extractionExceptionsCount: extractionExceptions.length,
      stageTwoReadinessCount: stageTwoReadinessList.length
    },
    queues: {
      profileAmendments: pendingAmendments,
      documentReview: documentReviewQueue,
      questionableClassification: questionableClassificationQueue,
      unresolvedTaxYear: unresolvedTaxYearQueue,
      duplicates: duplicatesQueue,
      securityBlocked: securityBlockedQueue,
      missingDocuments: missingDocumentsQueue,
      clientRfis,
      extractionExceptions,
      stageTwoReadiness: stageTwoReadinessList
    }
  });
});

// 2. Resolve Unresolved Tax Year
practiceConsoleRouter.post('/resolve-tax-year', (req: AuthenticatedRequest, res: Response) => {
  const { documentId, resolvedTaxYear, reason } = req.body;

  const year = Number(resolvedTaxYear);
  if (!documentId || !Number.isInteger(year) || year < 2000 || year > new Date().getUTCFullYear() + 1) {
    return res.status(400).json({ error: 'documentId and a valid resolvedTaxYear are required.' });
  }

  const doc = db.documents.get(documentId);
  if (!doc || !canAccessStaffClient(req.user!, doc.clientId)) return res.status(404).json({ error: 'Document not found.' });

  const previousYear = doc.taxYear;
  doc.taxYear = year;
  db.documents.set(doc.id, doc);

  db.logAuditEvent(
    req.user!.id,
    req.user!.role,
    'TAX_YEAR_CLASSIFICATION_RESOLVED',
    'document',
    doc.id,
    {
      previousYear,
      resolvedTaxYear,
      reason: reason || 'Verified by Practice Console CPA'
    }
  );

  return res.json({
    message: `Document ${doc.fileName} tax year resolved to ${resolvedTaxYear}.`,
    document: doc
  });
});

// 3. Resolve Questionable Document Classification
practiceConsoleRouter.post('/resolve-classification', (req: AuthenticatedRequest, res: Response) => {
  const { documentId, newCategory, reason } = req.body;

  if (!documentId || typeof newCategory !== 'string' || !/^[a-z0-9_]{1,64}$/.test(newCategory)) {
    return res.status(400).json({ error: 'documentId and a valid newCategory are required.' });
  }

  const doc = db.documents.get(documentId);
  if (!doc || !canAccessStaffClient(req.user!, doc.clientId)) return res.status(404).json({ error: 'Document not found.' });

  const previousCategory = doc.category;
  doc.category = newCategory as typeof doc.category;
  doc.status = 'verified';
  doc.reviewedBy = req.user!.name;
  doc.reviewedAt = new Date().toISOString();
  db.documents.set(doc.id, doc);

  db.logAuditEvent(
    req.user!.id,
    req.user!.role,
    'DOCUMENT_CLASSIFICATION_CORRECTED',
    'document',
    doc.id,
    {
      previousCategory,
      newCategory,
      reason: reason || 'Reclassified by Practice Console Reviewer'
    }
  );

  return res.json({
    message: `Document classification updated to ${newCategory}.`,
    document: doc
  });
});

// 4. Stage 02 gate approval: RETIRED (D1, Issue #65). It completed Stage 02 for any clientId in the body with no
// client assignment check, no requirement evaluation and no independent reviewer. Retired in every environment; it
// processes nothing. Stage 02 is a HUMAN_ATTESTED stage of the durable workflow: the case's independent reviewer
// attests through POST /api/cases/:caseId/advance (taxguard_case_advance), which also computes the document-request
// evidence for the stage.
export const PRACTICE_CONSOLE_GATE_APPROVAL_RETIRED = Object.freeze({ code: 'STAGE_VERDICT_ROUTE_RETIRED', replacement: '/api/cases/:caseId/advance' });
practiceConsoleRouter.post('/gate-approval', (_req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({ ...PRACTICE_CONSOLE_GATE_APPROVAL_RETIRED });
});
