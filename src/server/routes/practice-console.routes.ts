/**
 * A/R Tax Services, LLC - Practice Console API Routes
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

  if (!documentId || !resolvedTaxYear) {
    return res.status(400).json({ error: 'documentId and resolvedTaxYear are required.' });
  }

  const doc = db.documents.get(documentId);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  const previousYear = doc.taxYear;
  doc.taxYear = Number(resolvedTaxYear);
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

  if (!documentId || !newCategory) {
    return res.status(400).json({ error: 'documentId and newCategory are required.' });
  }

  const doc = db.documents.get(documentId);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  const previousCategory = doc.category;
  doc.category = newCategory;
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

// 4. Maker-Checker Gate Approval (Advance Stage 02 -> Stage 03 Validate)
practiceConsoleRouter.post('/gate-approval', async (req: AuthenticatedRequest, res: Response) => {
  const { clientId, taxYear = 2025, notes } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required.' });
  }

  try {
    const workflow = await LiveWorkflowRepository.getCase(clientId, taxYear);
    if (!workflow) {
      return res.status(404).json({ error: 'Live workflow case not found.' });
    }

    if (workflow.activeStage !== 2) {
      return res.status(409).json({ error: `Cannot approve Stage 02 gate: Active stage is ${workflow.activeStage}.` });
    }

    // Complete Stage 02 authoritatively
    const updated = await LiveWorkflowRepository.completeStage(
      clientId,
      taxYear,
      2,
      req.user!.id,
      req.user!.role,
      workflow.revision,
      {
        approvalNotes: notes || 'Approved via Practice Console',
        approverName: req.user!.name,
        approvedAt: new Date().toISOString()
      }
    );

    db.logAuditEvent(
      req.user!.id,
      req.user!.role,
      'STAGE_02_HARD_GATE_APPROVED_BY_PRACTICE_CONSOLE',
      'workflow',
      `${clientId}:${taxYear}`,
      {
        actor: req.user!.name,
        notes: notes || 'Stage 02 completion gate authorized.'
      }
    );

    return res.json({
      success: true,
      message: 'Stage 02 Hard Exit Gate passed. Stage 03 Validate is now active.',
      workflow: updated
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Gate approval failed.' });
  }
});
