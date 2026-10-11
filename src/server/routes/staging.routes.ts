/**
 * A/R TAX SERVICES, LLC - Accounting Data Preparation & Staging Routes
 * Manages the extraction-to-ledger workflow:
 * Extracted -> Validated -> Needs Review -> Accountant Approved -> Ready for Posting -> Posted -> Reconciled -> Locked
 */

import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../auth';
import { AccountingStagingRecord } from '../../types/intake';
import { canAccessClientRecord } from '../clientAccess';

export const stagingRouter = Router();

/** Loads a staging record the caller may act on; 404 for both missing and unauthorized records. */
function authorizedRecord(req: AuthenticatedRequest, res: Response): AccountingStagingRecord | null {
  const record = db.accountingStagingRecords.get(req.params.id);
  if (!record || !req.user || !canAccessClientRecord(req.user, record.clientId)) {
    res.status(404).json({ error: 'Staging record not found.' });
    return null;
  }
  return record;
}
const validAmount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12;

// Middleware: restrict ledger posting actions to accountant/administrator
const requireAccountant = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'accountant' && req.user.role !== 'administrator') {
    return res.status(403).json({ error: 'Forbidden. Only certified accounting professionals can approve staging records.' });
  }
  next();
};

// 1. GET /api/staging/records - List staging records
stagingRouter.get('/records', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { clientId, status, recordType } = req.query;

  // Clients see only their own records; staff only clients in their tenant they are assigned to.
  let records = Array.from(db.accountingStagingRecords.values()).filter(r => canAccessClientRecord(req.user!, r.clientId));
  if (clientId && typeof clientId === 'string') {
    records = records.filter(r => r.clientId === clientId);
  }

  if (status && typeof status === 'string') {
    records = records.filter(r => r.status === status);
  }

  if (recordType && typeof recordType === 'string') {
    records = records.filter(r => r.recordType === recordType);
  }

  // Sort by date descending
  records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return res.json({ records });
});

// 2. GET /api/staging/metrics - Summary counts
stagingRouter.get('/metrics', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // Totals cover only records the caller is authorized for (previously all tenants for staff and prospective clients).
  const records = Array.from(db.accountingStagingRecords.values()).filter(r => canAccessClientRecord(req.user!, r.clientId));

  const total = records.length;
  const needsReview = records.filter(r => r.status === 'needs_review').length;
  const approved = records.filter(r => r.status === 'accountant_approved').length;
  const readyForPosting = records.filter(r => r.status === 'ready_for_posting').length;
  const posted = records.filter(r => r.status === 'posted').length;
  const locked = records.filter(r => r.status === 'locked').length;

  const totalDebit = records.reduce((sum, r) => sum + (r.debitAmount || 0), 0);
  const totalCredit = records.reduce((sum, r) => sum + (r.creditAmount || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return res.json({
    total,
    needsReview,
    approved,
    readyForPosting,
    posted,
    locked,
    totalDebit,
    totalCredit,
    isBalanced
  });
});

// 3. PUT /api/staging/records/:id/review - Review & update suggested accounts / notes
stagingRouter.put('/records/:id/review', authenticateToken, requireAccountant, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const record = authorizedRecord(req, res);
  if (!record) return;

  const { suggestedAccountCode, suggestedAccountName, notes, debitAmount, creditAmount } = req.body ?? {};
  if ((debitAmount !== undefined && !validAmount(debitAmount)) || (creditAmount !== undefined && !validAmount(creditAmount))) {
    return res.status(400).json({ error: 'Debit and credit amounts must be finite, non-negative numbers.', code: 'AMOUNT_INVALID' });
  }

  if (suggestedAccountCode && suggestedAccountCode !== record.suggestedAccountCode) {
    record.accountantCorrections = {
      originalAccountCode: record.suggestedAccountCode,
      adjustedAccountCode: suggestedAccountCode,
      notes: notes || 'Account code adjusted by accountant.'
    };
    record.suggestedAccountCode = suggestedAccountCode;
    record.suggestedAccountName = suggestedAccountName || record.suggestedAccountName;
  }

  if (typeof debitAmount === 'number') record.debitAmount = debitAmount;
  if (typeof creditAmount === 'number') record.creditAmount = creditAmount;

  record.auditTrail.push({
    action: 'RECORD_MODIFIED_BY_ACCOUNTANT',
    actor: `${req.user?.name} (${req.user?.role})`,
    timestamp: new Date().toISOString(),
    notes: notes || 'Classification parameters adjusted.'
  });

  db.accountingStagingRecords.set(id, record);

  return res.json({ success: true, record });
});

// 4. POST /api/staging/records/:id/approve - Accountant approves record
stagingRouter.post('/records/:id/approve', authenticateToken, requireAccountant, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const record = authorizedRecord(req, res);
  if (!record) return;

  const { notes } = req.body;

  record.status = 'accountant_approved';
  record.reviewedBy = req.user?.name;
  record.reviewedAt = new Date().toISOString();

  record.auditTrail.push({
    action: 'ACCOUNTANT_APPROVED',
    actor: `${req.user?.name} (${req.user?.role})`,
    timestamp: new Date().toISOString(),
    notes: notes || 'Verified against source document. Approved for general ledger posting.'
  });

  db.accountingStagingRecords.set(id, record);

  // Log in central audit log
  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'STAGING_RECORD_APPROVED',
    resource: `Staging Record #${record.id}`,
    details: `Approved ${record.recordType} of $${record.amount} for client ${record.clientName}`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({ success: true, message: 'Record approved for posting.', record });
});

// 5. POST /api/staging/records/:id/post - Post to General Ledger
stagingRouter.post('/records/:id/post', authenticateToken, requireAccountant, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const record = authorizedRecord(req, res);
  if (!record) return;

  if (record.status !== 'accountant_approved' && record.status !== 'ready_for_posting') {
    return res.status(400).json({ error: 'Only accountant-approved records can be posted to the authoritative ledger.' });
  }

  // Create BookkeepingTransaction in authoritative ledger
  const txId = `tx_${randomUUID().slice(0, 8)}`;
  db.bookkeepingTransactions.set(txId, {
    id: txId,
    clientId: record.clientId,
    date: record.date,
    description: record.description,
    amount: record.amount,
    type: record.debitAmount > 0 ? 'debit' : 'credit',
    suggestedAccountCode: record.suggestedAccountCode,
    suggestedAccountName: record.suggestedAccountName,
    category: record.suggestedAccountName,
    confidence: record.confidenceScore,
    status: 'confirmed',
    vendorOrPayee: record.description,
    matchedRule: `AI Staging Pipeline (${record.aiModelVersion}) -> Approved by ${req.user?.name}`,
    source: 'document_extraction',
    reviewerNotes: `Posted from Staging Record #${record.id} sourced from ${record.sourceDocumentName}`
  });

  record.status = 'posted';
  record.postedTransactionId = txId;
  record.auditTrail.push({
    action: 'POSTED_TO_LEDGER',
    actor: `${req.user?.name} (${req.user?.role})`,
    timestamp: new Date().toISOString(),
    notes: `Created Ledger Transaction #${txId}.`
  });

  db.accountingStagingRecords.set(id, record);

  // Audit
  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'STAGING_RECORD_POSTED_TO_LEDGER',
    resource: `Ledger Tx #${txId}`,
    details: `Transferred staged record #${record.id} to general ledger.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({
    success: true,
    message: `Record successfully posted to general ledger under transaction ID #${txId}.`,
    transactionId: txId,
    record
  });
});

// 6. POST /api/staging/records/:id/rollback - Rollback posted record (if not locked)
stagingRouter.post('/records/:id/rollback', authenticateToken, requireAccountant, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const record = authorizedRecord(req, res);
  if (!record) return;

  if (record.status === 'locked') {
    return res.status(400).json({ error: 'Cannot rollback a record in a closed and locked accounting period.' });
  }
  // A posted record already created a ledger transaction. Resetting it to review would leave
  // that transaction in place and a re-post would duplicate it; a reversing entry is required.
  if (record.status === 'posted' || record.status === 'reconciled') {
    return res.status(409).json({ error: 'Posted records cannot be rolled back; request a reversing entry via /records/:id/reversal/request.', code: 'ROLLBACK_REQUIRES_REVERSAL' });
  }

  const previousStatus = record.status;
  record.status = 'needs_review';

  record.auditTrail.push({
    action: 'RECORD_ROLLED_BACK',
    actor: `${req.user?.name} (${req.user?.role})`,
    timestamp: new Date().toISOString(),
    notes: `Rolled back from ${previousStatus} to needs_review.`
  });

  db.accountingStagingRecords.set(id, record);

  return res.json({ success: true, message: 'Record rolled back to review status.', record });
});

// -------------------------------------------------------------
// CONTROLLED REVERSING-ENTRY WORKFLOW (posted records)
// The original ledger transaction is never modified or deleted: approval creates an
// offsetting transaction linked to it. Requester and approver must be different people.
// -------------------------------------------------------------

const REVERSAL_APPROVER_ROLES = new Set(['administrator', 'senior_reviewer']);

/** The ledger transaction created when this record was posted (explicit link, or legacy audit-trail note). */
function originalTransactionFor(record: AccountingStagingRecord) {
  let txId = record.postedTransactionId;
  if (!txId) {
    const posted = [...record.auditTrail].reverse().find(entry => entry.action === 'POSTED_TO_LEDGER');
    txId = posted?.notes?.match(/#(tx_[A-Za-z0-9_-]+)/)?.[1];
  }
  const tx = txId ? db.bookkeepingTransactions.get(txId) : undefined;
  return tx && tx.clientId === record.clientId && !tx.reversesTransactionId ? tx : undefined;
}

function reversalBlocker(record: AccountingStagingRecord): { status: number; code: string; error: string } | null {
  if (record.status === 'locked') return { status: 400, code: 'PERIOD_LOCKED', error: 'Cannot reverse a record in a closed and locked accounting period.' };
  if (record.status === 'reconciled') return { status: 409, code: 'RECONCILED_RECORD', error: 'Reconciled records must be unreconciled before a reversal.' };
  if (record.status !== 'posted') return { status: 409, code: 'NOT_POSTED', error: 'Only posted records can be reversed.' };
  return null;
}

// 7. POST /api/staging/records/:id/reversal/request - Accountant requests a reversing entry
stagingRouter.post('/records/:id/reversal/request', authenticateToken, requireAccountant, (req: AuthenticatedRequest, res: Response) => {
  const record = authorizedRecord(req, res);
  if (!record) return;
  const { reason } = req.body ?? {};
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 1000) {
    return res.status(400).json({ error: 'A reversal reason of 10 to 1,000 characters is required.', code: 'REVERSAL_REASON_INVALID' });
  }
  const blocker = reversalBlocker(record);
  if (blocker) return res.status(blocker.status).json({ error: blocker.error, code: blocker.code });
  if (record.reversalRequest) return res.status(409).json({ error: 'A reversal request is already pending.', code: 'REVERSAL_ALREADY_PENDING' });
  const original = originalTransactionFor(record);
  if (!original) return res.status(409).json({ error: 'The original ledger transaction cannot be identified; reverse it manually through the general ledger.', code: 'ORIGINAL_TRANSACTION_UNRESOLVED' });
  if (original.reversedByTransactionId) return res.status(409).json({ error: 'The original transaction has already been reversed.', code: 'ALREADY_REVERSED' });

  record.reversalRequest = { originalTransactionId: original.id, requestedBy: req.user!.id, requestedByName: req.user!.name, requestedAt: new Date().toISOString(), reason: reason.trim() };
  record.auditTrail.push({ action: 'REVERSAL_REQUESTED', actor: `${req.user!.name} (${req.user!.role})`, timestamp: record.reversalRequest.requestedAt, notes: `Reversal of ledger transaction #${original.id} requested.` });
  db.accountingStagingRecords.set(record.id, record);

  db.logAudit({
    userId: req.user!.id, userName: req.user!.name, userRole: req.user!.role,
    action: 'LEDGER_REVERSAL_REQUESTED', resource: `Staging Record #${record.id}`,
    details: `Reversal of ledger transaction #${original.id} requested; awaiting independent approval.`,
    ipAddress: req.ip || 'unknown', severity: 'warning'
  });

  return res.status(202).json({ success: true, message: 'Reversal requested; independent approval is required.', reversalRequest: record.reversalRequest });
});

/** Loads a record with a pending request for an independent approver; responds and returns null on failure. */
function reviewableReversal(req: AuthenticatedRequest, res: Response): AccountingStagingRecord | null {
  if (!req.user || !REVERSAL_APPROVER_ROLES.has(req.user.role)) {
    res.status(403).json({ error: 'Only Senior Reviewers or Administrators can decide reversal requests.', code: 'REVERSAL_APPROVER_ROLE_REQUIRED' });
    return null;
  }
  const record = authorizedRecord(req, res);
  if (!record) return null;
  if (!record.reversalRequest) { res.status(409).json({ error: 'No reversal request is pending.', code: 'NO_PENDING_REVERSAL' }); return null; }
  if (record.reversalRequest.requestedBy === req.user.id) {
    res.status(403).json({ error: 'Maker-Checker Violation: the requester cannot decide their own reversal request.', code: 'MAKER_CHECKER_VIOLATION' });
    return null;
  }
  return record;
}

// 8. POST /api/staging/records/:id/reversal/approve - Independent approval creates the reversing entry
stagingRouter.post('/records/:id/reversal/approve', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const record = reviewableReversal(req, res);
  if (!record) return;
  const request = record.reversalRequest!;
  // Re-check state at approval time; anything may have changed since the request.
  const blocker = reversalBlocker(record);
  if (blocker) return res.status(blocker.status).json({ error: blocker.error, code: blocker.code });
  const original = db.bookkeepingTransactions.get(request.originalTransactionId);
  if (!original || original.clientId !== record.clientId) return res.status(409).json({ error: 'The original ledger transaction no longer exists.', code: 'ORIGINAL_TRANSACTION_UNRESOLVED' });
  if (original.reversedByTransactionId) return res.status(409).json({ error: 'The original transaction has already been reversed.', code: 'ALREADY_REVERSED' });

  const now = new Date().toISOString();
  const reversingId = `tx_rev_${randomUUID().slice(0, 8)}`;
  db.bookkeepingTransactions.set(reversingId, {
    id: reversingId,
    clientId: original.clientId,
    date: now.slice(0, 10),
    description: `REVERSAL of #${original.id}: ${original.description}`,
    amount: original.amount,
    type: original.type === 'debit' ? 'credit' : 'debit',
    suggestedAccountCode: original.suggestedAccountCode,
    suggestedAccountName: original.suggestedAccountName,
    category: original.category,
    confidence: 100,
    status: 'confirmed',
    vendorOrPayee: original.vendorOrPayee,
    matchedRule: `Reversing entry requested by ${request.requestedByName}, approved by ${req.user!.name}`,
    source: 'manual',
    sourceDocumentId: original.sourceDocumentId,
    reviewerNotes: `Reason: ${request.reason}`,
    reversesTransactionId: original.id
  });
  // Link only: the original's amount, type, date and status are preserved.
  original.reversedByTransactionId = reversingId;
  db.bookkeepingTransactions.set(original.id, original);

  record.reversals = [...(record.reversals || []), { originalTransactionId: original.id, reversingTransactionId: reversingId, requestedBy: request.requestedBy, approvedBy: req.user!.id, reason: request.reason, approvedAt: now }];
  record.reversalRequest = undefined;
  record.postedTransactionId = undefined;
  record.status = 'needs_review';
  record.auditTrail.push({ action: 'REVERSAL_APPROVED', actor: `${req.user!.name} (${req.user!.role})`, timestamp: now, notes: `Reversing transaction #${reversingId} offsets #${original.id}. Record returned to review.` });
  db.accountingStagingRecords.set(record.id, record);

  db.logAudit({
    userId: req.user!.id, userName: req.user!.name, userRole: req.user!.role,
    action: 'LEDGER_REVERSAL_APPROVED', resource: `Ledger Tx #${reversingId}`,
    details: `Reversing entry #${reversingId} created for #${original.id} (requested by ${request.requestedByName}).`,
    ipAddress: req.ip || 'unknown', severity: 'warning'
  });

  return res.json({ success: true, message: 'Reversal approved; reversing entry recorded and the record returned to review.', reversingTransactionId: reversingId, record });
});

// 9. POST /api/staging/records/:id/reversal/reject - Independent reviewer rejects the request
stagingRouter.post('/records/:id/reversal/reject', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const record = reviewableReversal(req, res);
  if (!record) return;
  const { notes } = req.body ?? {};
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 1000)) {
    return res.status(400).json({ error: 'notes must be text of at most 1,000 characters.', code: 'REVERSAL_NOTES_INVALID' });
  }
  const request = record.reversalRequest!;
  record.reversalRequest = undefined;
  record.auditTrail.push({ action: 'REVERSAL_REJECTED', actor: `${req.user!.name} (${req.user!.role})`, timestamp: new Date().toISOString(), notes: notes || `Reversal of #${request.originalTransactionId} rejected.` });
  db.accountingStagingRecords.set(record.id, record);

  db.logAudit({
    userId: req.user!.id, userName: req.user!.name, userRole: req.user!.role,
    action: 'LEDGER_REVERSAL_REJECTED', resource: `Staging Record #${record.id}`,
    details: `Reversal request for #${request.originalTransactionId} rejected.`,
    ipAddress: req.ip || 'unknown', severity: 'info'
  });

  return res.json({ success: true, message: 'Reversal request rejected; the posted record is unchanged.', record });
});
