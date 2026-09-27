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
  blockRecruiterFromTaxRecords 
} from '../auth';
import { Engagement, EngagementStatus, JournalEntryDraft } from '../../types';

export const engagementsRouter = Router();

// List engagements
engagementsRouter.get('/', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  let list = Array.from(db.engagements.values());

  if (req.user.role === 'client' || req.user.role === 'prospective_client') {
    list = list.filter(e => e.clientId === req.user!.id);
  } else if (req.user.role === 'accountant') {
    // Assigned accountant only
    list = list.filter(e => e.assignedAccountantId === req.user!.id);
  } else if (req.user.role === 'senior_reviewer') {
    // Reviewers can see items assigned to them or needing review
    list = list.filter(e => e.reviewerId === req.user!.id || e.status === 'review_needed' || e.status === 'under_review');
  }

  return res.json({ engagements: list });
});

// Single engagement
engagementsRouter.get('/:id', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const eng = db.engagements.get(req.params.id);
  if (!eng) return res.status(404).json({ error: 'Engagement not found.' });

  // Client isolation check
  if (req.user?.role === 'client' && eng.clientId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden: You cannot view other clients\' engagements.' });
  }

  // Accountant assignment check
  if (req.user?.role === 'accountant' && eng.assignedAccountantId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden: You are not assigned to this engagement.' });
  }

  return res.json({ engagement: eng });
});

// Update engagement status & progress
engagementsRouter.patch('/:id/status', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const eng = db.engagements.get(req.params.id);
  if (!eng) return res.status(404).json({ error: 'Engagement not found.' });

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
  const entries = Array.from(db.journalEntries.values()).filter(j => j.clientId === req.params.clientId);
  return res.json({ journalEntries: entries });
});

engagementsRouter.post('/journal-entries', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['accountant', 'senior_reviewer', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized to draft journal entries.' });
  }

  const { engagementId, clientId, memo, lines, reference } = req.body;
  const newEntry: JournalEntryDraft = {
    id: `je_${randomUUID()}`,
    engagementId: engagementId || 'eng_2025_001',
    clientId,
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
