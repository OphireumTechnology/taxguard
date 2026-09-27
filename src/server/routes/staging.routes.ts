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

export const stagingRouter = Router();

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

  let records = Array.from(db.accountingStagingRecords.values());

  // Clients can only view their own records
  if (req.user.role === 'client' || req.user.role === 'prospective_client') {
    records = records.filter(r => r.clientId === req.user?.id);
  } else if (clientId && typeof clientId === 'string') {
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

  let records = Array.from(db.accountingStagingRecords.values());
  if (req.user.role === 'client') {
    records = records.filter(r => r.clientId === req.user?.id);
  }

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
  const record = db.accountingStagingRecords.get(id);
  if (!record) return res.status(404).json({ error: 'Staging record not found.' });

  const { suggestedAccountCode, suggestedAccountName, notes, debitAmount, creditAmount } = req.body;

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
  const record = db.accountingStagingRecords.get(id);
  if (!record) return res.status(404).json({ error: 'Staging record not found.' });

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
  const record = db.accountingStagingRecords.get(id);
  if (!record) return res.status(404).json({ error: 'Staging record not found.' });

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
  const record = db.accountingStagingRecords.get(id);
  if (!record) return res.status(404).json({ error: 'Staging record not found.' });

  if (record.status === 'locked') {
    return res.status(400).json({ error: 'Cannot rollback a record in a closed and locked accounting period.' });
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
