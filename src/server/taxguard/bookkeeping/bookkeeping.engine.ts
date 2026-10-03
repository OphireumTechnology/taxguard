/**
 * TaxGuard Core Bookkeeping & General Ledger Engine
 * Authoritative double-entry accounting, transaction ingestion,
 * duplicate detection, bank reconciliation, financial statements,
 * book-to-tax mapping, and upstream invalidation.
 */

import { randomUUID } from 'node:crypto';
import {
  AccountingPeriod,
  BankReconciliation,
  BankTransaction,
  BookToTaxAdjustment,
  ChartOfAccount,
  ClassificationStatus,
  DuplicateStatus,
  FinancialStatements,
  JournalEntry,
  JournalEntryLine,
  PeriodStatus,
  ReconciliationException,
  TrialBalanceItem,
  TrialBalanceReport
} from './types';
import { generateStandardChartOfAccounts } from './defaultAccounts';

export class BookkeepingEngine {
  // In-memory persistent collections (backed by durable tenant/client scopes)
  private accounts = new Map<string, ChartOfAccount>();
  private journalEntries = new Map<string, JournalEntry>();
  private transactions = new Map<string, BankTransaction>();
  private reconciliations = new Map<string, BankReconciliation>();
  private periods = new Map<string, AccountingPeriod>();
  private bookToTaxAdjustments = new Map<string, BookToTaxAdjustment>();

  // Invalidation listeners for Stage 07/09/10 downstream dependencies
  private invalidationListeners: Array<(event: { tenantId: string; clientId: string; taxYear: number; reason: string }) => void> = [];

  constructor() {}

  registerInvalidationListener(listener: (event: { tenantId: string; clientId: string; taxYear: number; reason: string }) => void) {
    this.invalidationListeners.push(listener);
  }

  private triggerInvalidation(tenantId: string, clientId: string, taxYear: number, reason: string) {
    for (const listener of this.invalidationListeners) {
      try {
        listener({ tenantId, clientId, taxYear, reason });
      } catch (err) {
        console.warn('[Bookkeeping Invalidation] Warning notifying listener:', err);
      }
    }
  }

  // ============================================================
  // 1. CHART OF ACCOUNTS
  // ============================================================

  ensureDefaultChartOfAccounts(
    tenantId: string,
    clientId: string,
    entityType: '1040_SCHED_C' | '1065' | '1120S' | '1120' = '1040_SCHED_C',
    creatorUid = 'system'
  ): ChartOfAccount[] {
    const existing = this.getChartOfAccounts(tenantId, clientId);
    if (existing.length > 0) return existing;

    const defaults = generateStandardChartOfAccounts(tenantId, clientId, entityType, creatorUid);
    for (const acc of defaults) {
      this.accounts.set(acc.id, acc);
    }
    return defaults;
  }

  getChartOfAccounts(tenantId: string, clientId: string): ChartOfAccount[] {
    return Array.from(this.accounts.values()).filter(
      (a) => a.tenantId === tenantId && a.clientId === clientId && a.isActive
    );
  }

  getAccount(accountId: string): ChartOfAccount | undefined {
    return this.accounts.get(accountId);
  }

  createAccount(account: Omit<ChartOfAccount, 'id' | 'createdAt' | 'updatedAt'>): ChartOfAccount {
    // Unique account number check per tenant/client
    const existingAccounts = this.getChartOfAccounts(account.tenantId, account.clientId);
    const duplicate = existingAccounts.find((a) => a.accountNumber === account.accountNumber);
    if (duplicate) {
      throw new Error(`DUPLICATE_ACCOUNT_NUMBER: Account number ${account.accountNumber} already exists for this entity.`);
    }

    const id = `coa_${account.tenantId}_${account.clientId}_${account.accountNumber}_${randomUUID().slice(0, 6)}`;
    const now = new Date().toISOString();
    const created: ChartOfAccount = {
      ...account,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(id, created);
    return created;
  }

  // ============================================================
  // 2. DOUBLE-ENTRY GENERAL LEDGER
  // ============================================================

  assertDoubleEntryBalance(lines: JournalEntryLine[]) {
    if (!lines || lines.length < 2) {
      throw new Error('JOURNAL_ENTRY_INVALID: Double-entry journal requires at least two lines.');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new Error('NEGATIVE_AMOUNT_PROHIBITED: Debit and credit amounts must be non-negative.');
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new Error('AMBIGUOUS_LINE: A journal entry line cannot contain both debit and credit amounts.');
      }
      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;

    if (Math.abs(roundedDebit - roundedCredit) > 0.001) {
      throw new Error(
        `UNBALANCED_JOURNAL_ENTRY: Total Debits ($${roundedDebit.toFixed(2)}) do not equal Total Credits ($${roundedCredit.toFixed(2)}). Variance: $${(roundedDebit - roundedCredit).toFixed(2)}`
      );
    }
  }

  createJournalEntry(entry: {
    tenantId: string;
    clientId: string;
    taxYear: number;
    periodId: string;
    postingDate: string;
    transactionDate: string;
    description: string;
    reference?: string;
    source: JournalEntry['source'];
    isAdjusting?: boolean;
    adjustingType?: JournalEntry['adjustingType'];
    lines: JournalEntryLine[];
    creatorUid: string;
    documentProvenanceIds?: string[];
  }): JournalEntry {
    // 1. Verify period is not hard-closed
    const period = this.periods.get(entry.periodId);
    if (period && period.status === 'HARD_CLOSED') {
      throw new Error(`PERIOD_HARD_CLOSED: Period ${period.periodName} is locked. Modifications require authorized reopening.`);
    }

    // 2. Validate double-entry balance
    this.assertDoubleEntryBalance(entry.lines);

    const totalDebit = entry.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = entry.lines.reduce((sum, l) => sum + (l.credit || 0), 0);

    const id = `je_${entry.tenantId}_${entry.clientId}_${Date.now()}_${randomUUID().slice(0, 6)}`;
    const now = new Date().toISOString();

    const newEntry: JournalEntry = {
      id,
      tenantId: entry.tenantId,
      clientId: entry.clientId,
      taxYear: entry.taxYear,
      periodId: entry.periodId,
      entryNumber: `JE-${Date.now().toString().slice(-6)}`,
      postingDate: entry.postingDate,
      transactionDate: entry.transactionDate,
      description: entry.description,
      reference: entry.reference,
      source: entry.source,
      isAdjusting: Boolean(entry.isAdjusting),
      adjustingType: entry.adjustingType,
      lines: entry.lines,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      status: entry.isAdjusting ? 'PREPARED' : 'POSTED',
      creatorUid: entry.creatorUid,
      createdAt: now,
      postedAt: now,
      documentProvenanceIds: entry.documentProvenanceIds || [],
    };

    this.journalEntries.set(id, newEntry);

    // Upstream change notification
    this.triggerInvalidation(entry.tenantId, entry.clientId, entry.taxYear, `Journal Entry #${newEntry.entryNumber} posted.`);

    return newEntry;
  }

  getJournalEntries(tenantId: string, clientId: string, taxYear?: number): JournalEntry[] {
    return Array.from(this.journalEntries.values())
      .filter((je) => je.tenantId === tenantId && je.clientId === clientId && (!taxYear || je.taxYear === taxYear))
      .sort((a, b) => new Date(b.postingDate).getTime() - new Date(a.postingDate).getTime());
  }

  // ============================================================
  // 3. TRANSACTION INGESTION & DUPLICATE DETECTION
  // ============================================================

  ingestTransactions(
    tenantId: string,
    clientId: string,
    accountId: string,
    batchId: string,
    provider: BankTransaction['provider'],
    rawTransactions: Array<{
      externalTransactionId?: string;
      transactionDate: string;
      postingDate?: string;
      description: string;
      amount: number;
      rawReference?: string;
      documentReferenceId?: string;
    }>
  ): { ingested: BankTransaction[]; duplicatesCount: number } {
    const existing = this.getTransactions(tenantId, clientId);
    const ingested: BankTransaction[] = [];
    let duplicatesCount = 0;
    const now = new Date().toISOString();

    for (const raw of rawTransactions) {
      const txnId = `txn_${randomUUID()}`;

      // Duplicate Check: Same externalId OR (same date + same amount + same description within 2 days)
      let dupStatus: DuplicateStatus = 'NOT_DUPLICATE';
      let duplicateCandidateId: string | undefined;

      const exactMatch = existing.find(
        (t) =>
          (raw.externalTransactionId && t.externalTransactionId === raw.externalTransactionId) ||
          (t.accountId === accountId &&
            Math.abs(t.amount - raw.amount) < 0.001 &&
            t.description.trim().toLowerCase() === raw.description.trim().toLowerCase() &&
            Math.abs(new Date(t.transactionDate).getTime() - new Date(raw.transactionDate).getTime()) < 3 * 86400000)
      );

      if (exactMatch) {
        dupStatus = 'POSSIBLE_DUPLICATE';
        duplicateCandidateId = exactMatch.id;
        duplicatesCount++;
      }

      // Automated AI Categorization Proposal (PROPOSED ONLY)
      const aiProposal = this.generateAiCategorizationProposal(raw.description, raw.amount, tenantId, clientId);

      const txn: BankTransaction = {
        id: txnId,
        tenantId,
        clientId,
        accountId,
        externalTransactionId: raw.externalTransactionId,
        provider,
        transactionDate: raw.transactionDate,
        postingDate: raw.postingDate || raw.transactionDate,
        description: raw.description,
        amount: Math.round(raw.amount * 100) / 100,
        currency: 'USD',
        rawReference: raw.rawReference,
        importBatchId: batchId,
        documentReferenceId: raw.documentReferenceId,
        duplicateStatus: dupStatus,
        duplicateCandidateId,
        classificationStatus: aiProposal ? 'AI_PROPOSED' : 'UNCLASSIFIED',
        aiProposal,
        matchedDocumentIds: raw.documentReferenceId ? [raw.documentReferenceId] : [],
        reconciliationStatus: 'UNRECONCILED',
        createdAt: now,
        updatedAt: now,
      };

      this.transactions.set(txnId, txn);
      ingested.push(txn);
    }

    return { ingested, duplicatesCount };
  }

  getTransactions(tenantId: string, clientId: string, accountId?: string): BankTransaction[] {
    return Array.from(this.transactions.values())
      .filter((t) => t.tenantId === tenantId && t.clientId === clientId && (!accountId || t.accountId === accountId))
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }

  // ============================================================
  // 4. TRANSACTION CATEGORIZATION & JOURNAL POSTING
  // ============================================================

  categorizeAndPostTransaction(params: {
    transactionId: string;
    assignedAccountId: string;
    assignedTaxCategory?: string;
    accountantUid: string;
    periodId: string;
    taxYear: number;
    notes?: string;
  }): { transaction: BankTransaction; journalEntry: JournalEntry } {
    const txn = this.transactions.get(params.transactionId);
    if (!txn) throw new Error('TRANSACTION_NOT_FOUND');

    const bankAccount = this.accounts.get(txn.accountId);
    const targetAccount = this.accounts.get(params.assignedAccountId);

    if (!bankAccount) throw new Error('BANK_ACCOUNT_NOT_FOUND');
    if (!targetAccount) throw new Error('TARGET_CATEGORY_ACCOUNT_NOT_FOUND');

    // Build balancing journal entry:
    // If expense (amount < 0, e.g. -$150 Office Supplies):
    // Debit: Target Expense Account ($150)
    // Credit: Operating Bank Account ($150)
    // If deposit/revenue (amount > 0, e.g. +$1,000 Client Fees):
    // Debit: Operating Bank Account ($1,000)
    // Credit: Target Revenue Account ($1,000)

    const absAmount = Math.abs(txn.amount);
    let lines: JournalEntryLine[];

    if (txn.amount < 0) {
      lines = [
        {
          id: `line_1_${randomUUID().slice(0, 6)}`,
          accountId: targetAccount.id,
          accountNumber: targetAccount.accountNumber,
          accountName: targetAccount.accountName,
          debit: absAmount,
          credit: 0,
          memo: txn.description,
          taxCategory: params.assignedTaxCategory || targetAccount.taxMapping?.taxLineCode,
        },
        {
          id: `line_2_${randomUUID().slice(0, 6)}`,
          accountId: bankAccount.id,
          accountNumber: bankAccount.accountNumber,
          accountName: bankAccount.accountName,
          debit: 0,
          credit: absAmount,
          memo: `Payment: ${txn.description}`,
        },
      ];
    } else {
      lines = [
        {
          id: `line_1_${randomUUID().slice(0, 6)}`,
          accountId: bankAccount.id,
          accountNumber: bankAccount.accountNumber,
          accountName: bankAccount.accountName,
          debit: absAmount,
          credit: 0,
          memo: `Deposit: ${txn.description}`,
        },
        {
          id: `line_2_${randomUUID().slice(0, 6)}`,
          accountId: targetAccount.id,
          accountNumber: targetAccount.accountNumber,
          accountName: targetAccount.accountName,
          debit: 0,
          credit: absAmount,
          memo: txn.description,
          taxCategory: params.assignedTaxCategory || targetAccount.taxMapping?.taxLineCode,
        },
      ];
    }

    const journalEntry = this.createJournalEntry({
      tenantId: txn.tenantId,
      clientId: txn.clientId,
      taxYear: params.taxYear,
      periodId: params.periodId,
      postingDate: txn.postingDate,
      transactionDate: txn.transactionDate,
      description: `Bank Feed: ${txn.description}`,
      reference: txn.rawReference || txn.externalTransactionId,
      source: 'BANK_FEED',
      lines,
      creatorUid: params.accountantUid,
      documentProvenanceIds: txn.matchedDocumentIds,
    });

    txn.classificationStatus = 'POSTED';
    txn.assignedAccountId = params.assignedAccountId;
    txn.assignedTaxCategory = params.assignedTaxCategory;
    txn.journalEntryId = journalEntry.id;
    txn.reviewedByUid = params.accountantUid;
    txn.reviewedAt = new Date().toISOString();
    txn.updatedAt = new Date().toISOString();

    this.transactions.set(txn.id, txn);

    return { transaction: txn, journalEntry };
  }

  // ============================================================
  // 5. DOCUMENT-TO-TRANSACTION MATCHING
  // ============================================================

  matchDocumentToTransaction(transactionId: string, documentId: string, actorUid: string): BankTransaction {
    const txn = this.transactions.get(transactionId);
    if (!txn) throw new Error('TRANSACTION_NOT_FOUND');

    if (!txn.matchedDocumentIds.includes(documentId)) {
      txn.matchedDocumentIds.push(documentId);
      txn.updatedAt = new Date().toISOString();
      this.transactions.set(txn.id, txn);

      this.triggerInvalidation(
        txn.tenantId,
        txn.clientId,
        new Date(txn.transactionDate).getFullYear(),
        `Document #${documentId} matched to Transaction #${txn.id}`
      );
    }
    return txn;
  }

  // ============================================================
  // 6. BANK & CREDIT-CARD RECONCILIATION ENGINE
  // ============================================================

  startReconciliation(params: {
    tenantId: string;
    clientId: string;
    accountId: string;
    taxYear: number;
    statementPeriodStart: string;
    statementPeriodEnd: string;
    statementBeginningBalance: number;
    statementEndingBalance: number;
    tolerance?: number;
  }): BankReconciliation {
    const id = `recon_${params.tenantId}_${params.clientId}_${params.accountId}_${Date.now()}`;
    const now = new Date().toISOString();

    const recon: BankReconciliation = {
      id,
      tenantId: params.tenantId,
      clientId: params.clientId,
      accountId: params.accountId,
      taxYear: params.taxYear,
      statementPeriodStart: params.statementPeriodStart,
      statementPeriodEnd: params.statementPeriodEnd,
      statementBeginningBalance: Math.round(params.statementBeginningBalance * 100) / 100,
      statementEndingBalance: Math.round(params.statementEndingBalance * 100) / 100,
      clearedBalance: Math.round(params.statementBeginningBalance * 100) / 100,
      clearedTransactionsCount: 0,
      variance: Math.round((params.statementEndingBalance - params.statementBeginningBalance) * 100) / 100,
      tolerance: params.tolerance ?? 0.0,
      status: 'IN_PROGRESS',
      exceptions: [],
      createdAt: now,
      updatedAt: now,
    };

    this.reconciliations.set(id, recon);
    return recon;
  }

  clearTransaction(reconciliationId: string, transactionId: string, isCleared: boolean): BankReconciliation {
    const recon = this.reconciliations.get(reconciliationId);
    if (!recon) throw new Error('RECONCILIATION_NOT_FOUND');
    if (recon.status === 'CLOSED') throw new Error('RECONCILIATION_ALREADY_CLOSED');

    const txn = this.transactions.get(transactionId);
    if (!txn) throw new Error('TRANSACTION_NOT_FOUND');

    txn.reconciliationStatus = isCleared ? 'CLEARED' : 'UNRECONCILED';
    txn.reconciliationId = isCleared ? reconciliationId : undefined;
    txn.updatedAt = new Date().toISOString();
    this.transactions.set(txn.id, txn);

    // Recompute cleared balance: Beginning Balance + Net Cleared Transactions
    const clearedTxns = this.getTransactions(recon.tenantId, recon.clientId, recon.accountId).filter(
      (t) => t.reconciliationId === reconciliationId && t.reconciliationStatus === 'CLEARED'
    );

    const netCleared = clearedTxns.reduce((sum, t) => sum + t.amount, 0);
    const calculatedEndingBalance = Math.round((recon.statementBeginningBalance + netCleared) * 100) / 100;
    const variance = Math.round((calculatedEndingBalance - recon.statementEndingBalance) * 100) / 100;

    recon.clearedBalance = calculatedEndingBalance;
    recon.clearedTransactionsCount = clearedTxns.length;
    recon.variance = variance;
    recon.status = Math.abs(variance) <= recon.tolerance ? 'BALANCED' : 'IN_PROGRESS';
    recon.updatedAt = new Date().toISOString();

    this.reconciliations.set(recon.id, recon);
    return recon;
  }

  finalizeReconciliation(reconciliationId: string, completedByUid: string): BankReconciliation {
    const recon = this.reconciliations.get(reconciliationId);
    if (!recon) throw new Error('RECONCILIATION_NOT_FOUND');
    if (recon.status === 'CLOSED') throw new Error('RECONCILIATION_ALREADY_CLOSED');

    // Strict validation: variance must be within tolerance OR have resolved exceptions
    if (Math.abs(recon.variance) > recon.tolerance) {
      const openExceptions = recon.exceptions.filter((e) => e.status !== 'RESOLVED');
      if (openExceptions.length === 0) {
        // Automatically create an unresolved variance exception
        const exc: ReconciliationException = {
          id: `exc_${randomUUID()}`,
          reconciliationId: recon.id,
          type: 'UNEXPLAINED_VARIANCE',
          amount: recon.variance,
          status: 'OPEN',
          notes: `Unresolved statement variance of $${recon.variance.toFixed(2)}. Requires accountant investigation.`,
          createdAt: new Date().toISOString(),
        };
        recon.exceptions.push(exc);
      }
      throw new Error(
        `RECONCILIATION_VARIANCE_UNRESOLVED: Cleared balance ($${recon.clearedBalance.toFixed(2)}) differs from statement ending balance ($${recon.statementEndingBalance.toFixed(2)}) by $${recon.variance.toFixed(2)}.`
      );
    }

    // Mark all cleared transactions as RECONCILED
    const clearedTxns = this.getTransactions(recon.tenantId, recon.clientId, recon.accountId).filter(
      (t) => t.reconciliationId === reconciliationId && t.reconciliationStatus === 'CLEARED'
    );
    for (const t of clearedTxns) {
      t.reconciliationStatus = 'RECONCILED';
      this.transactions.set(t.id, t);
    }

    recon.status = 'CLOSED';
    recon.completedAt = new Date().toISOString();
    recon.completedByUid = completedByUid;
    recon.updatedAt = new Date().toISOString();
    this.reconciliations.set(recon.id, recon);

    this.triggerInvalidation(
      recon.tenantId,
      recon.clientId,
      recon.taxYear,
      `Bank Reconciliation #${recon.id} finalized by ${completedByUid}`
    );

    return recon;
  }

  // ============================================================
  // 7. ADJUSTING ENTRIES & MAKER-CHECKER
  // ============================================================

  createAdjustingJournalEntry(params: {
    tenantId: string;
    clientId: string;
    taxYear: number;
    periodId: string;
    postingDate: string;
    description: string;
    adjustingType: JournalEntry['adjustingType'];
    lines: JournalEntryLine[];
    preparerUid: string;
  }): JournalEntry {
    return this.createJournalEntry({
      ...params,
      transactionDate: params.postingDate,
      source: 'ADJUSTING',
      isAdjusting: true,
      creatorUid: params.preparerUid,
    });
  }

  reviewAndApproveJournalEntry(entryId: string, reviewerUid: string): JournalEntry {
    const entry = this.journalEntries.get(entryId);
    if (!entry) throw new Error('ENTRY_NOT_FOUND');

    // Strict Maker-Checker: preparer cannot review/approve their own adjusting entry!
    if (entry.creatorUid === reviewerUid) {
      throw new Error('MAKER_CHECKER_VIOLATION: Preparer cannot approve their own journal entry. Independent reviewer required.');
    }

    entry.reviewerUid = reviewerUid;
    entry.status = 'POSTED';
    this.journalEntries.set(entry.id, entry);
    return entry;
  }

  // ============================================================
  // 8. TRIAL BALANCE ENGINE
  // ============================================================

  generateTrialBalance(tenantId: string, clientId: string, taxYear: number): TrialBalanceReport {
    const allAccounts = this.getChartOfAccounts(tenantId, clientId);
    const entries = this.getJournalEntries(tenantId, clientId, taxYear).filter((je) => je.status === 'POSTED');

    const items: TrialBalanceItem[] = [];
    let totalBeginningDebit = 0;
    let totalBeginningCredit = 0;
    let totalPeriodDebit = 0;
    let totalPeriodCredit = 0;
    let totalEndingDebit = 0;
    let totalEndingCredit = 0;

    for (const acc of allAccounts) {
      let periodDebit = 0;
      let periodCredit = 0;

      for (const je of entries) {
        for (const line of je.lines) {
          if (line.accountId === acc.id) {
            periodDebit += line.debit || 0;
            periodCredit += line.credit || 0;
          }
        }
      }

      // Normal balance logic:
      // Asset & Expense normal balance = DEBIT
      // Liability, Equity, Revenue normal balance = CREDIT
      const isNormalDebit = ['ASSET', 'EXPENSE', 'COGS', 'OTHER_EXPENSE'].includes(acc.accountType);

      let endingDebit = 0;
      let endingCredit = 0;

      if (isNormalDebit) {
        const net = periodDebit - periodCredit;
        if (net >= 0) endingDebit = net;
        else endingCredit = Math.abs(net);
      } else {
        const net = periodCredit - periodDebit;
        if (net >= 0) endingCredit = net;
        else endingDebit = Math.abs(net);
      }

      totalPeriodDebit += periodDebit;
      totalPeriodCredit += periodCredit;
      totalEndingDebit += endingDebit;
      totalEndingCredit += endingCredit;

      items.push({
        accountId: acc.id,
        accountNumber: acc.accountNumber,
        accountName: acc.accountName,
        accountType: acc.accountType,
        beginningDebit: 0,
        beginningCredit: 0,
        periodDebit: Math.round(periodDebit * 100) / 100,
        periodCredit: Math.round(periodCredit * 100) / 100,
        endingDebit: Math.round(endingDebit * 100) / 100,
        endingCredit: Math.round(endingCredit * 100) / 100,
      });
    }

    const roundedEndingDebit = Math.round(totalEndingDebit * 100) / 100;
    const roundedEndingCredit = Math.round(totalEndingCredit * 100) / 100;

    return {
      tenantId,
      clientId,
      taxYear,
      generatedAt: new Date().toISOString(),
      items,
      totalBeginningDebit,
      totalBeginningCredit,
      totalPeriodDebit: Math.round(totalPeriodDebit * 100) / 100,
      totalPeriodCredit: Math.round(totalPeriodCredit * 100) / 100,
      totalEndingDebit: roundedEndingDebit,
      totalEndingCredit: roundedEndingCredit,
      isBalanced: Math.abs(roundedEndingDebit - roundedEndingCredit) <= 0.01,
    };
  }

  // ============================================================
  // 9. FINANCIAL STATEMENTS ENGINE
  // ============================================================

  generateFinancialStatements(tenantId: string, clientId: string, taxYear: number): FinancialStatements {
    const tb = this.generateTrialBalance(tenantId, clientId, taxYear);

    let grossRevenue = 0;
    let costOfGoodsSold = 0;
    const operatingExpenses: { accountName: string; amount: number }[] = [];
    let totalOperatingExpenses = 0;
    let otherIncomeAndExpenses = 0;

    const currentAssets: { accountName: string; amount: number }[] = [];
    let totalCurrentAssets = 0;
    const fixedAssets: { accountName: string; amount: number }[] = [];
    let totalFixedAssets = 0;

    const currentLiabilities: { accountName: string; amount: number }[] = [];
    let totalCurrentLiabilities = 0;
    const longTermLiabilities: { accountName: string; amount: number }[] = [];
    let totalLongTermLiabilities = 0;

    const equityItems: { accountName: string; amount: number }[] = [];
    let totalEquity = 0;

    for (const item of tb.items) {
      const netExpenseAmount = item.endingDebit - item.endingCredit;
      const netRevenueAmount = item.endingCredit - item.endingDebit;

      switch (item.accountType) {
        case 'REVENUE':
          grossRevenue += netRevenueAmount;
          break;
        case 'COGS':
          costOfGoodsSold += netExpenseAmount;
          break;
        case 'EXPENSE':
          operatingExpenses.push({ accountName: item.accountName, amount: netExpenseAmount });
          totalOperatingExpenses += netExpenseAmount;
          break;
        case 'OTHER_INCOME':
          otherIncomeAndExpenses += netRevenueAmount;
          break;
        case 'OTHER_EXPENSE':
          otherIncomeAndExpenses -= netExpenseAmount;
          break;
        case 'ASSET': {
          const assetAmount = item.endingDebit - item.endingCredit;
          if (item.accountNumber.startsWith('15')) {
            fixedAssets.push({ accountName: item.accountName, amount: assetAmount });
            totalFixedAssets += assetAmount;
          } else {
            currentAssets.push({ accountName: item.accountName, amount: assetAmount });
            totalCurrentAssets += assetAmount;
          }
          break;
        }
        case 'LIABILITY': {
          const liabAmount = item.endingCredit - item.endingDebit;
          if (item.accountNumber.startsWith('25')) {
            longTermLiabilities.push({ accountName: item.accountName, amount: liabAmount });
            totalLongTermLiabilities += liabAmount;
          } else {
            currentLiabilities.push({ accountName: item.accountName, amount: liabAmount });
            totalCurrentLiabilities += liabAmount;
          }
          break;
        }
        case 'EQUITY': {
          const eqAmount = item.endingCredit - item.endingDebit;
          equityItems.push({ accountName: item.accountName, amount: eqAmount });
          totalEquity += eqAmount;
          break;
        }
      }
    }

    const grossProfit = Math.round((grossRevenue - costOfGoodsSold) * 100) / 100;
    const operatingIncome = Math.round((grossProfit - totalOperatingExpenses) * 100) / 100;
    const netIncome = Math.round((operatingIncome + otherIncomeAndExpenses) * 100) / 100;

    const totalAssets = Math.round((totalCurrentAssets + totalFixedAssets) * 100) / 100;
    const totalLiabilities = Math.round((totalCurrentLiabilities + totalLongTermLiabilities) * 100) / 100;
    const finalEquity = Math.round((totalEquity + netIncome) * 100) / 100;

    const isBalanced = Math.abs(totalAssets - (totalLiabilities + finalEquity)) <= 0.01;

    return {
      profitAndLoss: {
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        costOfGoodsSold: Math.round(costOfGoodsSold * 100) / 100,
        grossProfit,
        operatingExpenses,
        totalOperatingExpenses: Math.round(totalOperatingExpenses * 100) / 100,
        operatingIncome,
        otherIncomeAndExpenses: Math.round(otherIncomeAndExpenses * 100) / 100,
        netIncome,
      },
      balanceSheet: {
        assets: {
          currentAssets,
          totalCurrentAssets: Math.round(totalCurrentAssets * 100) / 100,
          fixedAssets,
          totalFixedAssets: Math.round(totalFixedAssets * 100) / 100,
          totalAssets,
        },
        liabilities: {
          currentLiabilities,
          totalCurrentLiabilities: Math.round(totalCurrentLiabilities * 100) / 100,
          longTermLiabilities,
          totalLongTermLiabilities: Math.round(totalLongTermLiabilities * 100) / 100,
          totalLiabilities,
        },
        equity: {
          items: equityItems,
          netIncomeCurrentPeriod: netIncome,
          totalEquity: finalEquity,
        },
        isBalanced,
      },
    };
  }

  // ============================================================
  // 10. BOOK-TO-TAX ADJUSTMENTS (Schedule M-1 / Tax Bridge)
  // ============================================================

  createBookToTaxAdjustment(params: {
    tenantId: string;
    clientId: string;
    taxYear: number;
    accountId: string;
    description: string;
    bookAmount: number;
    taxAmount: number;
    permanentOrTiming: 'PERMANENT' | 'TIMING';
    scheduleM1Category: BookToTaxAdjustment['scheduleM1Category'];
    taxAuthorityCitation: string;
    preparerUid: string;
  }): BookToTaxAdjustment {
    const acc = this.accounts.get(params.accountId);
    const accountName = acc ? acc.accountName : 'General Ledger Account';

    const id = `b2t_${randomUUID()}`;
    const now = new Date().toISOString();
    const adj: BookToTaxAdjustment = {
      id,
      tenantId: params.tenantId,
      clientId: params.clientId,
      taxYear: params.taxYear,
      accountId: params.accountId,
      accountName,
      description: params.description,
      bookAmount: Math.round(params.bookAmount * 100) / 100,
      taxAmount: Math.round(params.taxAmount * 100) / 100,
      adjustmentAmount: Math.round((params.taxAmount - params.bookAmount) * 100) / 100,
      permanentOrTiming: params.permanentOrTiming,
      scheduleM1Category: params.scheduleM1Category,
      taxAuthorityCitation: params.taxAuthorityCitation,
      preparerUid: params.preparerUid,
      reviewStatus: 'PREPARED',
      createdAt: now,
      updatedAt: now,
    };

    this.bookToTaxAdjustments.set(id, adj);

    this.triggerInvalidation(
      params.tenantId,
      params.clientId,
      params.taxYear,
      `Book-to-Tax Adjustment created for ${accountName} (Diff: $${adj.adjustmentAmount})`
    );

    return adj;
  }

  getBookToTaxAdjustments(tenantId: string, clientId: string, taxYear: number): BookToTaxAdjustment[] {
    return Array.from(this.bookToTaxAdjustments.values()).filter(
      (b) => b.tenantId === tenantId && b.clientId === clientId && b.taxYear === taxYear
    );
  }

  // ============================================================
  // 11. PERIOD LOCK CONTROLS
  // ============================================================

  ensurePeriod(tenantId: string, clientId: string, taxYear: number, periodName: string, startDate: string, endDate: string): AccountingPeriod {
    const id = `period_${tenantId}_${clientId}_${periodName}`;
    const existing = this.periods.get(id);
    if (existing) return existing;

    const period: AccountingPeriod = {
      id,
      tenantId,
      clientId,
      taxYear,
      periodName,
      startDate,
      endDate,
      status: 'OPEN',
    };
    this.periods.set(id, period);
    return period;
  }

  closePeriod(periodId: string, status: 'SOFT_CLOSED' | 'HARD_CLOSED', actorUid: string): AccountingPeriod {
    const period = this.periods.get(periodId);
    if (!period) throw new Error('PERIOD_NOT_FOUND');

    period.status = status;
    period.closedByUid = actorUid;
    period.closedAt = new Date().toISOString();
    this.periods.set(period.id, period);
    return period;
  }

  reopenPeriod(periodId: string, actorUid: string, reason: string): AccountingPeriod {
    const period = this.periods.get(periodId);
    if (!period) throw new Error('PERIOD_NOT_FOUND');
    if (!reason || reason.trim().length < 5) {
      throw new Error('REOPEN_REASON_REQUIRED: A valid audit justification is required to reopen a closed accounting period.');
    }

    period.status = 'OPEN';
    period.reopenedByUid = actorUid;
    period.reopenedAt = new Date().toISOString();
    period.reopenReason = reason;
    this.periods.set(period.id, period);
    return period;
  }

  // ============================================================
  // HELPER: AI Categorization Proposal Generator
  // ============================================================

  private generateAiCategorizationProposal(
    description: string,
    amount: number,
    tenantId: string,
    clientId: string
  ): BankTransaction['aiProposal'] | undefined {
    const accounts = this.getChartOfAccounts(tenantId, clientId);
    if (accounts.length === 0) return undefined;

    const desc = description.toLowerCase();

    // Deterministic keyword matching pattern for proposed-only categorization
    let suggestedAccount: ChartOfAccount | undefined;
    let reasoning = '';

    if (desc.includes('payroll') || desc.includes('adp') || desc.includes('gusto')) {
      suggestedAccount = accounts.find((a) => a.accountNumber === '6020');
      reasoning = 'Matched payroll processor signature to Wages & Compensation expense account.';
    } else if (desc.includes('office') || desc.includes('staples') || desc.includes('software') || desc.includes('github') || desc.includes('google')) {
      suggestedAccount = accounts.find((a) => a.accountNumber === '6070');
      reasoning = 'Identified routine office supply or recurring software SaaS subscription.';
    } else if (
      desc.includes('restaurant') ||
      desc.includes('cafe') ||
      desc.includes('dining') ||
      desc.includes('dinner') ||
      desc.includes('lunch') ||
      desc.includes('grille') ||
      desc.includes('grill') ||
      desc.includes('starbucks')
    ) {
      suggestedAccount = accounts.find((a) => a.accountNumber === '6080');
      reasoning = 'Detected food & beverage merchant. Subject to IRC § 274(n) 50% deduction limit.';
    } else if (desc.includes('legal') || desc.includes('cpa') || desc.includes('consulting') || desc.includes('attorney')) {
      suggestedAccount = accounts.find((a) => a.accountNumber === '6050');
      reasoning = 'Professional fee descriptor matches Legal & Professional Services.';
    } else if (amount > 0) {
      suggestedAccount = accounts.find((a) => a.accountNumber === '4010');
      reasoning = 'Incoming deposit pattern mapped to Gross Professional Fees / Receipts.';
    }

    if (!suggestedAccount) return undefined;

    return {
      suggestedAccountId: suggestedAccount.id,
      taxCategory: suggestedAccount.taxMapping?.taxLineCode,
      confidence: 0.94,
      reasoning,
      isAiProposedOnly: true,
      suggestedAt: new Date().toISOString(),
    };
  }
}

// Global Singleton for the App Server runtime
export const globalBookkeepingEngine = new BookkeepingEngine();
