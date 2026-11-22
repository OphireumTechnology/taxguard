/**
 * TaxGuard Bookkeeping, General Ledger & Sync API Routes
 * Enterprise REST API for Double-Entry Accounting, Bank Reconciliation,
 * Trial Balance, Financial Statements, Book-to-Tax, and Accounting Sync.
 */

import { projectBookkeeper } from '../bookkeeperDashboardProjection';
import { projectDurableBookkeeper } from '../bookkeeperDurableProjection';
import { LedgerStoreError } from '../taxguard/bookkeeping/sqlLedgerStore';
import { Router, Response } from 'express';
import {
  authenticateToken,
  AuthenticatedRequest,
  blockRecruiterFromTaxRecords,
  resolveAuthorizedClientContext
} from '../auth';
import { db } from '../db';
import { globalBookkeepingEngine } from '../taxguard/bookkeeping/bookkeeping.engine';
import { globalAccountingSyncService } from '../taxguard/bookkeeping/accountingSync.service';
import { registerLedgerDispatch } from './ledgerDispatch.routes';
import { selectLedger } from '../taxguard/bookkeeping/ledgerBackend';
import { explicitTaxYear, hasClientYearAccess, reachableClientIds } from '../staffScopedGrants';

export const bookkeepingRouter = Router();

// Bookkeeper grants are deliberately local; no preparer/reviewer authority is inherited.
bookkeepingRouter.get('/bookkeeper-clients', authenticateToken, (req: AuthenticatedRequest,res)=>{
  res.setHeader('Cache-Control','no-store');
  const user=req.user!;
  if(user.role!=='bookkeeper' || user.status!=='active' || !user.tenantId || (process.env.NODE_ENV==='production' && user.tenantId!==process.env.TAXGUARD_TENANT_ID?.trim()))return res.status(403).json({code:'BOOKKEEPER_SCOPE_DENIED'});
  // Whole-client grants plus clients reachable through an engagement / tax-year scoped grant.
  return res.json({tenantId:user.tenantId,clientIds:reachableClientIds(user)});
});
bookkeepingRouter.get('/bookkeeper-dashboard', authenticateToken, async (req: AuthenticatedRequest, res) => {
  res.setHeader('Cache-Control','no-store');
  const user=req.user!;
  if(user.role!=='bookkeeper' || user.status!=='active') return res.status(403).json({code:'BOOKKEEPER_REQUIRED'});
  const tenant=user.tenantId;
  const client=typeof req.query.clientId==='string'?req.query.clientId:'';
  const year=Number(req.query.taxYear);
  if(!tenant || !client || !hasClientYearAccess(user,client,explicitTaxYear(req)) || (req.query.tenantId && req.query.tenantId!==tenant) || (req.get('x-tenant-id') && req.get('x-tenant-id')!==tenant)) return res.status(403).json({code:'BOOKKEEPER_SCOPE_DENIED'});
  if(process.env.NODE_ENV==='production' && (!process.env.TAXGUARD_TENANT_ID || tenant!==process.env.TAXGUARD_TENANT_ID.trim())) return res.status(403).json({code:'BOOKKEEPER_SCOPE_DENIED'});
  if(!Number.isInteger(year) || year<2022 || year>9999) return res.status(400).json({code:'EXPLICIT_TAX_YEAR_REQUIRED'});
  const period=typeof req.query.periodId==='string'?req.query.periodId:undefined;
  // Durable ledger selected: the same panels read PostgreSQL; the database re-checks the assignment.
  const ledger=selectLedger();
  if(ledger.mode==='durable'){
    try {return res.json(await projectDurableBookkeeper(ledger.store,user.id,tenant,client,year,period));}
    catch(error){
      if(error instanceof LedgerStoreError) return res.status(error.status).json({code:error.code});
      if(error instanceof Error && error.message==='PERIOD_ACCESS_DENIED') return res.status(403).json({code:'PERIOD_ACCESS_DENIED'});
      return res.status(503).json({code:'LEDGER_UNAVAILABLE'});
    }
  }
  // The in-memory accounting engine is volatile. Never substitute it for production PostgreSQL.
  if(process.env.NODE_ENV==='production' || ledger.mode==='unavailable') return res.status(503).json({code:'DURABLE_ACCOUNTING_PROVIDER_REQUIRED'});
  try {return res.json(projectBookkeeper(globalBookkeepingEngine,tenant,client,year,period));}
  catch {return res.status(403).json({code:'PERIOD_ACCESS_DENIED'});}
});

bookkeepingRouter.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const configured = (process.env.TAXGUARD_TENANT_ID || '').trim();
    if (!configured) {
      return res.status(500).json({
        code: 'PRODUCTION_TENANT_REQUIRED',
        error: 'PRODUCTION_TENANT_REQUIRED: Missing authoritative production TAXGUARD_TENANT_ID.',
      });
    }
    const headerTenant = ((req.headers['x-tenant-id'] as string) || '').trim();
    if (headerTenant && headerTenant !== configured) {
      return res.status(403).json({
        code: 'CROSS_TENANT_ACCESS_DENIED',
        error: 'CROSS_TENANT_ACCESS_DENIED: Request tenant does not match authoritative production tenant.',
      });
    }
  }
  next();
});

bookkeepingRouter.use(authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res, next) => {
  if(req.user?.role==='bookkeeper') {
    // Bookkeepers use the durable ledger only: explicit client grant, deployment tenant, and the
    // database re-checks the assignment and forces their postings into independent review.
    if (selectLedger().mode !== 'durable') return res.status(403).json({code:'BOOKKEEPER_OPERATION_NOT_RELEASED'});
    const user = req.user;
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : typeof req.body?.clientId === 'string' ? req.body.clientId : '';
    const configured = (process.env.TAXGUARD_TENANT_ID || '').trim();
    // A whole-client grant, or an engagement / tax-year scoped grant for exactly the requested tax year.
    if (user.status !== 'active' || !user.tenantId || !clientId || !hasClientYearAccess(user, clientId, explicitTaxYear(req))
      || (process.env.NODE_ENV === 'production' && user.tenantId !== configured)) return res.status(403).json({code:'BOOKKEEPER_SCOPE_DENIED'});
    req.authorizedClientContext = { authUserId: user.id, clientId, tenantId: user.tenantId, role: user.role } as any;
    return next();
  }
  const requestedClientId =
    typeof req.query.clientId === 'string'
      ? req.query.clientId
      : typeof req.body?.clientId === 'string'
        ? req.body.clientId
        : undefined;
  // Durable ledger: staff staffed for one engagement and tax year reach that client for that year only (scoped
  // grant from the durable session; owner decision 2026-10-19). The database re-checks the assignment on every
  // call. Everything else (whole-client staff, administrators, local sessions) uses the shared resolver below.
  const scopedUser = req.user;
  const scopedYear = explicitTaxYear(req);
  if (selectLedger().mode === 'durable' && scopedUser && scopedUser.status === 'active' && scopedUser.tenantId && requestedClientId
      && !['client', 'prospective_client'].includes(scopedUser.role) && scopedYear !== undefined
      && !scopedUser.authorizedClientIds?.includes(requestedClientId) && hasClientYearAccess(scopedUser, requestedClientId, scopedYear)
      && (process.env.NODE_ENV !== 'production' || scopedUser.tenantId === (process.env.TAXGUARD_TENANT_ID || '').trim())) {
    req.authorizedClientContext = { authUserId: scopedUser.id, clientId: requestedClientId, tenantId: scopedUser.tenantId, role: scopedUser.role } as any;
    return next();
  }
  const context = resolveAuthorizedClientContext(req, res, 'bookkeeping', requestedClientId);
  if (!context) return;
  const configuredTenant = (process.env.TAXGUARD_TENANT_ID || '').trim();
  if (process.env.NODE_ENV === 'production' && context.tenantId !== configuredTenant) {
    return res.status(403).json({ error: 'Client tenant context is not authorized.', code: 'CLIENT_ACCESS_DENIED' });
  }
  req.authorizedClientContext = context;
  next();
});

// Durable / memory ledger persistence dispatch (see ledgerDispatch.routes.ts).
registerLedgerDispatch(bookkeepingRouter);

// Helper to resolve tenant and client IDs safely
function resolveScope(req: AuthenticatedRequest) {
  const user = req.user!;
  const context = req.authorizedClientContext!;
  const tenantId = context.tenantId;
  const clientId = context.clientId;
  const taxYear = Number(req.query.taxYear || req.body.taxYear) || 2025;

  return { tenantId, clientId, taxYear, user };
}

const CLIENT_ROLES = ['client', 'prospective_client'];
const LEDGER_REVIEWER_ROLES = ['reviewer', 'senior_reviewer', 'admin', 'super_admin'];
/** Records outside the authorized scope are reported as not found; maker-checker refusals as 403. */
function ledgerError(res: Response, err: any, fallback: string) {
  const message = typeof err?.message === 'string' ? err.message : fallback;
  const code = /^[A-Z_]+/.exec(message)?.[0];
  const status = code?.endsWith('_NOT_FOUND') ? 404 : code === 'MAKER_CHECKER_VIOLATION' ? 403 : 400;
  return res.status(status).json({ error: message, ...(code ? { code } : {}) });
}
function ledgerAudit(req: AuthenticatedRequest, action: string, resource: string, details: string) {
  const user = req.user!;
  db.logAudit({ userId: user.id, userName: user.name, userRole: user.role, action, resource, details, ipAddress: req.ip || 'unknown', severity: 'info' });
}

// ============================================================
// 1. CHART OF ACCOUNTS
// ============================================================

bookkeepingRouter.get('/chart-of-accounts', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  globalBookkeepingEngine.ensureDefaultChartOfAccounts(tenantId, clientId, '1040_SCHED_C', user.id);
  const accounts = globalBookkeepingEngine.getChartOfAccounts(tenantId, clientId);
  return res.json({ accounts });
});

bookkeepingRouter.post('/chart-of-accounts', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  if (['client', 'prospective_client'].includes(user.role)) {
    return res.status(403).json({ error: 'Only accountants and practice admins may create accounts in the chart of accounts.' });
  }

  try {
    const account = globalBookkeepingEngine.createAccount({
      tenantId,
      clientId,
      accountNumber: req.body.accountNumber,
      accountName: req.body.accountName,
      accountType: req.body.accountType,
      accountSubtype: req.body.accountSubtype,
      parentAccountId: req.body.parentAccountId,
      currency: 'USD',
      isActive: true,
      taxMapping: req.body.taxMapping,
      provenance: {
        source: 'MANUAL_ACCOUNTANT',
        creatorUid: user.id,
      },
    });

    db.logAudit({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'CHART_OF_ACCOUNTS_CREATED',
      resource: `Account #${account.accountNumber} (${account.accountName})`,
      details: `Added new ${account.accountType} account to client ledger.`,
      ipAddress: req.ip || 'unknown',
      severity: 'info',
    });

    return res.status(201).json({ account });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed to create chart of account.' });
  }
});

// ============================================================
// 2. JOURNAL ENTRIES
// ============================================================

bookkeepingRouter.get('/journal-entries', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, taxYear } = resolveScope(req);
  const entries = globalBookkeepingEngine.getJournalEntries(tenantId, clientId, taxYear);
  return res.json({ entries });
});

bookkeepingRouter.post('/journal-entries', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, taxYear, user } = resolveScope(req);
  if (['client', 'prospective_client'].includes(user.role)) {
    return res.status(403).json({ error: 'Only professional accountants and reviewers may post journal entries.' });
  }

  try {
    const entry = globalBookkeepingEngine.createJournalEntry({
      tenantId,
      clientId,
      taxYear,
      periodId: req.body.periodId || `period_${tenantId}_${clientId}_${taxYear}`,
      postingDate: req.body.postingDate || new Date().toISOString().split('T')[0],
      transactionDate: req.body.transactionDate || new Date().toISOString().split('T')[0],
      description: req.body.description,
      reference: req.body.reference,
      source: req.body.source || 'MANUAL',
      isAdjusting: req.body.isAdjusting,
      adjustingType: req.body.adjustingType,
      lines: req.body.lines,
      creatorUid: user.id,
      documentProvenanceIds: req.body.documentProvenanceIds,
    });

    db.logAudit({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'JOURNAL_ENTRY_POSTED',
      resource: `Journal Entry #${entry.entryNumber}`,
      details: `Posted balancing double-entry journal ($${entry.totalDebit.toFixed(2)} debits/credits).`,
      ipAddress: req.ip || 'unknown',
      severity: 'info',
    });

    return res.status(201).json({ entry });
  } catch (err: any) {
    return ledgerError(res, err, 'Failed to post journal entry.');
  }
});

// Review and approve adjusting journal entry (Maker-Checker enforced)
bookkeepingRouter.post('/journal-entries/:id/approve', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { user } = resolveScope(req);
  if (!['reviewer', 'senior_reviewer', 'admin', 'super_admin'].includes(user.role)) {
    return res.status(403).json({ error: 'Independent reviewer approval required for adjusting journal entries.' });
  }

  try {
    const { tenantId, clientId } = resolveScope(req);
    const approved = globalBookkeepingEngine.reviewAndApproveJournalEntry(req.params.id, user.id, { tenantId, clientId });

    db.logAudit({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'ADJUSTING_JOURNAL_ENTRY_APPROVED',
      resource: `Journal Entry #${approved.entryNumber}`,
      details: `Independent maker-checker review approved by ${user.name} (${user.role}). Entry status changed from PREPARED to POSTED.`,
      ipAddress: req.ip || 'unknown',
      severity: 'info',
    });

    return res.json({ message: 'Journal entry successfully approved by reviewer.', entry: approved });
  } catch (err: any) {
    return ledgerError(res, err, 'Failed to approve journal entry.');
  }
});

// Corrections: prepare a reversing entry for independent approval (posted entries are never edited)
bookkeepingRouter.post('/journal-entries/:id/reverse', (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  if (CLIENT_ROLES.includes(user.role)) return res.status(403).json({ error: 'Only practice staff may prepare reversing entries.' });
  try {
    const reversal = globalBookkeepingEngine.reverseJournalEntry({ entryId: req.params.id, postingDate: req.body?.postingDate, reason: req.body?.reason,
      periodId: typeof req.body?.periodId === 'string' ? req.body.periodId : undefined, preparerUid: user.id, scope: { tenantId, clientId } });
    ledgerAudit(req, 'JOURNAL_ENTRY_REVERSAL_PREPARED', `Journal Entry #${reversal.reference}`, `Reversing entry #${reversal.entryNumber} prepared; independent approval required.`);
    return res.status(201).json({ entry: reversal });
  } catch (err: any) { return ledgerError(res, err, 'Failed to prepare reversing entry.'); }
});

// Accounting periods: creation, close (soft / hard) and reopen with justification
bookkeepingRouter.get('/periods', (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, taxYear } = resolveScope(req);
  return res.json({ periods: globalBookkeepingEngine.getPeriods(tenantId, clientId, taxYear) });
});
bookkeepingRouter.post('/periods', (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, taxYear, user } = resolveScope(req);
  if (CLIENT_ROLES.includes(user.role)) return res.status(403).json({ error: 'Only practice staff may define accounting periods.' });
  try {
    const period = globalBookkeepingEngine.openPeriod({ tenantId, clientId }, taxYear, req.body?.periodName, req.body?.startDate, req.body?.endDate);
    ledgerAudit(req, 'ACCOUNTING_PERIOD_OPENED', `Accounting period ${period.periodName}`, `Period ${period.startDate} to ${period.endDate} defined.`);
    return res.status(201).json({ period });
  } catch (err: any) { return ledgerError(res, err, 'Failed to define accounting period.'); }
});
bookkeepingRouter.post('/periods/:id/close', (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  if (!LEDGER_REVIEWER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Closing an accounting period requires reviewer authority.' });
  const status = req.body?.status;
  if (status !== 'SOFT_CLOSED' && status !== 'HARD_CLOSED') return res.status(400).json({ error: 'status must be SOFT_CLOSED or HARD_CLOSED.', code: 'PERIOD_STATUS_TRANSITION_INVALID' });
  try {
    const period = globalBookkeepingEngine.closePeriod(req.params.id, status, user.id, { tenantId, clientId });
    ledgerAudit(req, 'ACCOUNTING_PERIOD_CLOSED', `Accounting period ${period.periodName}`, `Period set to ${status}.`);
    return res.json({ period });
  } catch (err: any) { return ledgerError(res, err, 'Failed to close accounting period.'); }
});
bookkeepingRouter.post('/periods/:id/reopen', (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  if (!LEDGER_REVIEWER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Reopening an accounting period requires reviewer authority.' });
  try {
    const period = globalBookkeepingEngine.reopenPeriod(req.params.id, user.id, req.body?.reason, { tenantId, clientId });
    ledgerAudit(req, 'ACCOUNTING_PERIOD_REOPENED', `Accounting period ${period.periodName}`, 'Period reopened with recorded justification.');
    return res.json({ period });
  } catch (err: any) { return ledgerError(res, err, 'Failed to reopen accounting period.'); }
});

// ============================================================
// 3. TRANSACTIONS & INGESTION
// ============================================================

bookkeepingRouter.get('/transactions', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId } = resolveScope(req);
  const accountId = req.query.accountId as string | undefined;
  const transactions = globalBookkeepingEngine.getTransactions(tenantId, clientId, accountId);
  return res.json({ transactions });
});

bookkeepingRouter.post('/transactions/ingest', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  const { accountId, rawTransactions, provider } = req.body;

  if (!accountId || !Array.isArray(rawTransactions)) {
    return res.status(400).json({ error: 'accountId and rawTransactions array are required.' });
  }

  const batchId = `batch_${Date.now()}`;
  const result = globalBookkeepingEngine.ingestTransactions(
    tenantId,
    clientId,
    accountId,
    batchId,
    provider || 'CSV_UPLOAD',
    rawTransactions
  );

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'BANK_TRANSACTIONS_INGESTED',
    resource: `Batch #${batchId}`,
    details: `Ingested ${result.ingested.length} transactions (${result.duplicatesCount} potential duplicates flagged).`,
    ipAddress: req.ip || 'unknown',
    severity: 'info',
  });

  return res.status(201).json(result);
});

bookkeepingRouter.post('/transactions/:id/categorize', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, taxYear, user } = resolveScope(req);
  if (['client', 'prospective_client'].includes(user.role)) {
    return res.status(403).json({ error: 'Only accountants and reviewers can finalize transaction categorization.' });
  }

  try {
    const result = globalBookkeepingEngine.categorizeAndPostTransaction({
      transactionId: req.params.id,
      assignedAccountId: req.body.assignedAccountId,
      assignedTaxCategory: req.body.assignedTaxCategory,
      accountantUid: user.id,
      periodId: req.body.periodId || `period_default`,
      taxYear,
      notes: req.body.notes,
      scope: { tenantId, clientId },
    });

    return res.json(result);
  } catch (err: any) {
    return ledgerError(res, err, 'Failed to categorize transaction.');
  }
});

bookkeepingRouter.post('/transactions/:id/match-document', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  const { documentId } = req.body;
  if (typeof documentId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(documentId)) return res.status(400).json({ error: 'documentId is required.' });

  try {
    const txn = globalBookkeepingEngine.matchDocumentToTransaction(req.params.id, documentId, user.id, { tenantId, clientId });
    return res.json({ transaction: txn });
  } catch (err: any) {
    return ledgerError(res, err, 'Failed to match document.');
  }
});

// ============================================================
// 4. BANK RECONCILIATION
// ============================================================

bookkeepingRouter.post('/reconciliations/start', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, taxYear } = resolveScope(req);
  const { accountId, statementPeriodStart, statementPeriodEnd, statementBeginningBalance, statementEndingBalance, tolerance } = req.body;

  if (!accountId || statementBeginningBalance === undefined || statementEndingBalance === undefined) {
    return res.status(400).json({ error: 'accountId, beginning balance, and ending balance are required.' });
  }

  const recon = globalBookkeepingEngine.startReconciliation({
    tenantId,
    clientId,
    accountId,
    taxYear,
    statementPeriodStart: statementPeriodStart || new Date().toISOString().split('T')[0],
    statementPeriodEnd: statementPeriodEnd || new Date().toISOString().split('T')[0],
    statementBeginningBalance: Number(statementBeginningBalance),
    statementEndingBalance: Number(statementEndingBalance),
    tolerance: tolerance !== undefined ? Number(tolerance) : 0.0,
  });

  return res.status(201).json({ reconciliation: recon });
});

bookkeepingRouter.post('/reconciliations/:id/clear', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  if (CLIENT_ROLES.includes(user.role)) return res.status(403).json({ error: 'Reconciliation work requires accountant or reviewer credentials.' });
  const { transactionId, isCleared } = req.body;
  if (!transactionId) return res.status(400).json({ error: 'transactionId is required.' });

  try {
    const updated = globalBookkeepingEngine.clearTransaction(req.params.id, transactionId, Boolean(isCleared), { tenantId, clientId });
    return res.json({ reconciliation: updated });
  } catch (err: any) {
    return ledgerError(res, err, 'Failed to clear transaction.');
  }
});

bookkeepingRouter.post('/reconciliations/:id/finalize', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { user } = resolveScope(req);
  if (['client', 'prospective_client'].includes(user.role)) {
    return res.status(403).json({ error: 'Reconciliation finalization requires accountant or reviewer credentials.' });
  }

  try {
    const { tenantId, clientId } = resolveScope(req);
    const finalized = globalBookkeepingEngine.finalizeReconciliation(req.params.id, user.id, { tenantId, clientId });
    return res.json({ message: 'Reconciliation completed and locked.', reconciliation: finalized });
  } catch (err: any) {
    return ledgerError(res, err, 'Failed to finalize reconciliation.');
  }
});

// ============================================================
// 5. TRIAL BALANCE & FINANCIAL STATEMENTS
// ============================================================

bookkeepingRouter.get('/trial-balance', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, taxYear } = resolveScope(req);
  const tb = globalBookkeepingEngine.generateTrialBalance(tenantId, clientId, taxYear);
  return res.json({ trialBalance: tb });
});

bookkeepingRouter.get('/financial-statements', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, taxYear } = resolveScope(req);
  const statements = globalBookkeepingEngine.generateFinancialStatements(tenantId, clientId, taxYear);
  return res.json({ statements });
});

// ============================================================
// 6. BOOK-TO-TAX ADJUSTMENTS
// ============================================================

bookkeepingRouter.get('/book-to-tax', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, taxYear } = resolveScope(req);
  const adjustments = globalBookkeepingEngine.getBookToTaxAdjustments(tenantId, clientId, taxYear);
  return res.json({ adjustments });
});

bookkeepingRouter.post('/book-to-tax', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, taxYear, user } = resolveScope(req);
  if (['client', 'prospective_client'].includes(user.role)) {
    return res.status(403).json({ error: 'Only tax professionals may record book-to-tax adjustments.' });
  }

  try {
    const adj = globalBookkeepingEngine.createBookToTaxAdjustment({
      tenantId,
      clientId,
      taxYear,
      accountId: req.body.accountId,
      description: req.body.description,
      bookAmount: Number(req.body.bookAmount),
      taxAmount: Number(req.body.taxAmount),
      permanentOrTiming: req.body.permanentOrTiming || 'PERMANENT',
      scheduleM1Category: req.body.scheduleM1Category || 'MEALS_50_LIMIT',
      taxAuthorityCitation: req.body.taxAuthorityCitation || 'IRC Sec. 274(n)',
      preparerUid: user.id,
    });

    return res.status(201).json({ adjustment: adj });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed to create book-to-tax adjustment.' });
  }
});

// ============================================================
// 7. ACCOUNTING SYNC (QUICKBOOKS / XERO)
// ============================================================

bookkeepingRouter.get('/sync/state', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId } = resolveScope(req);
  const provider = (req.query.provider as 'QUICKBOOKS' | 'XERO') || 'QUICKBOOKS';
  const state = globalAccountingSyncService.getSyncState(provider, tenantId, clientId);
  return res.json({ state });
});

bookkeepingRouter.post('/sync/read-only', authenticateToken, blockRecruiterFromTaxRecords, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId } = resolveScope(req);
  const provider = req.body.provider || 'QUICKBOOKS';
  const idempotencyKey = req.body.idempotencyKey || `sync_${Date.now()}`;

  const result = await globalAccountingSyncService.executeReadOnlySync(provider, tenantId, clientId, idempotencyKey);
  return res.json(result);
});

bookkeepingRouter.post('/sync/write-authorize/client', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  const provider = req.body.provider || 'QUICKBOOKS';
  const state = globalAccountingSyncService.authorizeWriteByClient(provider, tenantId, clientId, user.id);
  return res.json({ message: 'Stage 1 client write authorization recorded.', state });
});

bookkeepingRouter.post('/sync/write-authorize/accountant', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  const provider = req.body.provider || 'QUICKBOOKS';
  try {
    const state = globalAccountingSyncService.prepareWriteByAccountant(provider, tenantId, clientId, user.id);
    return res.json({ message: 'Stage 2 accountant preparation verified.', state });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed Stage 2 accountant preparation.' });
  }
});

bookkeepingRouter.post('/sync/write-authorize/reviewer', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  const provider = req.body.provider || 'QUICKBOOKS';
  const accountantUid = req.body.accountantUid;

  if (!['reviewer', 'senior_reviewer', 'admin', 'super_admin'].includes(user.role)) {
    return res.status(403).json({ error: 'Reviewer credentials required for Stage 3 write approval.' });
  }

  try {
    const state = globalAccountingSyncService.approveWriteByReviewer(provider, tenantId, clientId, user.id, accountantUid);
    return res.json({ message: 'Stage 3 reviewer approval granted with maker-checker enforcement.', state });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed Stage 3 reviewer approval.' });
  }
});

bookkeepingRouter.post('/sync/write-authorize/confirm', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId } = resolveScope(req);
  const provider = req.body.provider || 'QUICKBOOKS';
  const phrase = req.body.confirmationPhrase;

  try {
    const state = globalAccountingSyncService.confirmWriteExplicitly(provider, tenantId, clientId, phrase);
    return res.json({ message: 'Stage 4 explicit write confirmation verified.', state });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed Stage 4 explicit confirmation.' });
  }
});

bookkeepingRouter.post('/sync/write-commit', authenticateToken, blockRecruiterFromTaxRecords, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, clientId, user } = resolveScope(req);
  const provider = req.body.provider || 'QUICKBOOKS';
  const idempotencyKey = req.body.idempotencyKey || `commit_${Date.now()}`;
  const entryIds = req.body.journalEntryIds || [];

  try {
    const result = await globalAccountingSyncService.executeWriteBack(provider, tenantId, clientId, idempotencyKey, entryIds, user.id);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed to commit write to remote accounting provider.' });
  }
});
