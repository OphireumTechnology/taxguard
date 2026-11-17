/**
 * Engagements, Caseload & Maker-Checker Workflow Routes
 * Implements strict maker-checker controls: preparers CANNOT self-approve
 * restricted deliverables; only senior reviewers or admins can approve.
 */

import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { 
  authenticateToken, 
  AuthenticatedRequest, 
  blockRecruiterFromTaxRecords,
  resolveAuthorizedClientContext
} from '../auth';
import { Engagement, EngagementStatus, JournalEntryDraft } from '../../types';
import { isStaffCurrentlyAssignedToClient } from '../assignment-authorization';

export const engagementsRouter = Router();

// List engagements
engagementsRouter.get('/', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  let list = Array.from(db.engagements.values());

  if (req.user.role === 'client' || req.user.role === 'prospective_client') {
    const context = resolveAuthorizedClientContext(req, res, 'engagement_list', req.query.clientId as string | undefined);
    if (!context) return;
    list = list.filter(e => e.clientId === context.clientId);
  } else if (['accountant', 'senior_reviewer', 'reviewer', 'preparer'].includes(req.user.role)) {
    const user = req.user;
    if (!user.tenantId) return res.status(403).json({ error: 'Authorized tenant context is unavailable.' });
    list = list.filter(engagement => {
      const client = db.users.get(engagement.clientId) ||
        Array.from(db.users.values()).find(candidate =>
          ['client', 'prospective_client'].includes(candidate.role) &&
          candidate.clientId === engagement.clientId
        );
      const authorized = isStaffCurrentlyAssignedToClient({
        userId: user.id,
        tenantId: user.tenantId!,
        clientId: engagement.clientId,
        clientTenantId: client?.tenantId,
        assignments: db.getClientBindings(engagement.clientId),
        authorizedClientIds: user.authorizedClientIds,
        production: process.env.NODE_ENV === 'production',
        engagementId: engagement.id,
        taxYear: engagement.taxYear
      });
      if (!authorized) return false;
      return user.role !== 'senior_reviewer' ||
        engagement.reviewerId === user.id ||
        engagement.status === 'review_needed' ||
        engagement.status === 'under_review';
    });
  } else if (['admin', 'administrator', 'super_admin', 'super_administrator'].includes(req.user.role)) {
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Authorized tenant context is unavailable.' });
    list = list.filter(engagement => {
      const client = db.users.get(engagement.clientId) ||
        Array.from(db.users.values()).find(candidate =>
          ['client', 'prospective_client'].includes(candidate.role) &&
          candidate.clientId === engagement.clientId
        );
      return client?.tenantId === tenantId;
    });
  } else {
    return res.status(403).json({ error: 'Forbidden: Engagement access is not permitted.' });
  }

  return res.json({ engagements: list });
});

// Single engagement
engagementsRouter.get('/:id', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const eng = db.engagements.get(req.params.id);
  if (!eng) return res.status(404).json({ error: 'Engagement not found.' });

  if (!resolveAuthorizedClientContext(req, res, 'engagement', eng.clientId)) return;

  return res.json({ engagement: eng });
});

// Update engagement status & progress
engagementsRouter.patch('/:id/status', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['accountant', 'senior_reviewer', 'admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: Staff access required.' });
  }

  const eng = db.engagements.get(req.params.id);
  if (!eng) return res.status(404).json({ error: 'Engagement not found.' });
  if (!resolveAuthorizedClientContext(req, res, 'engagement_status', eng.clientId)) return;

  const { status, progressPercent, notes } = req.body;

  // MAKER-CHECKER SECURITY CONSTRAINT:
  // An accountant who prepared or is assigned to the return CANNOT APPROVE IT!
  if (status === 'approved' || status === 'ready_for_delivery') {
    if (req.user.role === 'accountant' && eng.assignedAccountantId === req.user.id) {
      db.logSecurityEvent({
        eventType: 'MAKER_CHECKER_SELF_APPROVAL_VIOLATION',
        ipAddress: req.ip || 'unknown',
        userId: req.user.id,
        details: `Accountant ${req.user.name} attempted to self-approve their own engagement #${eng.id}. Maker-checker policy blocked operation.`,
        severity: 'critical'
      });

      return res.status(403).json({
        error: 'Maker-Checker Violation: Preparers are strictly forbidden from approving their own work. Approval must be conducted by an independent Senior Reviewer or Compliance Admin.',
        code: 'SELF_APPROVAL_FORBIDDEN'
      });
    }

    if (req.user.role !== 'senior_reviewer' && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Forbidden: Only designated Senior Reviewers or Compliance Admins can approve tax returns.',
        code: 'REVIEWER_ROLE_REQUIRED'
      });
    }
  }

  eng.status = status as EngagementStatus;
  if (progressPercent !== undefined) eng.progressPercent = progressPercent;
  if (notes) eng.internalNotes = notes;
  eng.updatedAt = new Date().toISOString();

  db.engagements.set(eng.id, eng);

  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: `ENGAGEMENT_STATUS_${status.toUpperCase()}`,
    resource: `Engagement #${eng.id}`,
    details: `Status shifted to ${status} (${eng.progressPercent}%). Performed by ${req.user.role}.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({ message: 'Engagement updated.', engagement: eng });
});

// Dispatch Form 8879 E-File Authorization to Client
engagementsRouter.post('/:id/dispatch-8879', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['accountant', 'senior_reviewer', 'admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized to dispatch Form 8879.' });
  }

  const eng = db.engagements.get(req.params.id);
  if (!eng) return res.status(404).json({ error: 'Engagement not found.' });
  if (!resolveAuthorizedClientContext(req, res, 'engagement_dispatch', eng.clientId)) return;

  eng.status = 'ready_for_signature';
  eng.progressPercent = 90;
  eng.updatedAt = new Date().toISOString();

  // Create Form 8879 deliverable in document vault
  const deliverableId = `doc_8879_${randomUUID()}`;
  db.documents.set(deliverableId, {
    id: deliverableId,
    clientId: eng.clientId,
    clientName: eng.clientName,
    fileName: `IRS_Form_8879_${eng.taxYear}_Signature_Request.pdf`,
    fileSize: '640 KB',
    fileType: 'application/pdf',
    category: 'deliverable_tax_return',
    taxYear: eng.taxYear,
    status: 'needs_review',
    uploadedAt: new Date().toISOString(),
    uploadedBy: req.user.name,
    version: 1,
    description: `IRS e-File Signature Authorization dispatched for ${eng.clientName}`,
    isEncrypted: true
  });

  db.engagements.set(eng.id, eng);

  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'FORM_8879_DISPATCHED',
    resource: `Engagement #${eng.id}`,
    details: `Dispatched IRS Form 8879 to client ${eng.clientName}. Ready for client e-signature.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({
    message: `IRS Form 8879 successfully dispatched to ${eng.clientName}.`,
    engagement: eng,
    deliverableDocumentId: deliverableId
  });
});

// Journal Entry Drafts for reconciliation
engagementsRouter.get('/journal-entries/:clientId', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const context = resolveAuthorizedClientContext(req, res, 'journal_entries', req.params.clientId);
  if (!context) return;
  const entries = Array.from(db.journalEntries.values()).filter(j => j.clientId === context.clientId);
  return res.json({ journalEntries: entries });
});

engagementsRouter.post('/journal-entries', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['accountant', 'senior_reviewer', 'admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized to draft journal entries.' });
  }

  const { engagementId, clientId, memo, lines, reference } = req.body;
  const context = resolveAuthorizedClientContext(req, res, 'journal_entry_create', clientId);
  if (!context) return;
  const engagement = typeof engagementId === 'string' ? db.engagements.get(engagementId) : undefined;
  if (!engagement || engagement.clientId !== context.clientId) {
    return res.status(404).json({ error: 'Authorized engagement not found.' });
  }
  const newEntry: JournalEntryDraft = {
    id: `je_${randomUUID()}`,
    engagementId,
    clientId: context.clientId,
    date: new Date().toISOString().split('T')[0],
    reference: reference || `ADJ-${Date.now().toString().slice(-4)}`,
    memo: memo || 'Reconciliation Adjustment',
    lines: lines || [],
    status: 'prepared',
    preparedBy: req.user.id,
    preparedByName: req.user.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.journalEntries.set(newEntry.id, newEntry);

  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'JOURNAL_ENTRY_PREPARED',
    resource: `Journal #${newEntry.id}`,
    details: `Drafted journal entry "${newEntry.memo}". Awaiting reviewer approval.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.status(201).json({ journalEntry: newEntry });
});

// Approve journal entry (Reviewer only, cannot be the preparer)
engagementsRouter.patch('/journal-entries/:id/approve', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['senior_reviewer', 'admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: Only Senior Reviewers can approve journal entries.' });
  }

  const je = db.journalEntries.get(req.params.id);
  if (!je) return res.status(404).json({ error: 'Journal entry not found.' });
  if (!resolveAuthorizedClientContext(req, res, 'journal_entry_approval', je.clientId)) return;

  // Maker-checker rule:
  if (je.preparedBy === req.user.id) {
    db.logSecurityEvent({
      eventType: 'MAKER_CHECKER_JOURNAL_SELF_APPROVAL_BLOCKED',
      ipAddress: req.ip || 'unknown',
      userId: req.user.id,
      details: `User ${req.user.name} attempted to approve journal entry #${je.id} which they personally prepared.`,
      severity: 'critical'
    });
    return res.status(403).json({
      error: 'Maker-Checker Violation: Preparer cannot approve their own journal entry.',
      code: 'SELF_APPROVAL_FORBIDDEN'
    });
  }

  je.status = 'approved';
  je.reviewedBy = req.user.id;
  je.reviewedByName = req.user.name;
  je.updatedAt = new Date().toISOString();
  db.journalEntries.set(je.id, je);

  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'JOURNAL_ENTRY_APPROVED',
    resource: `Journal #${je.id}`,
    details: `Approved by senior reviewer ${req.user.name}.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({ message: 'Journal entry approved and ready to post.', journalEntry: je });
});
