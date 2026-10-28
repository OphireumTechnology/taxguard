import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookkeepingEngine } from '../server/taxguard/bookkeeping/bookkeeping.engine';
import { AccountingSyncService } from '../server/taxguard/bookkeeping/accountingSync.service';
import { JournalEntryLine } from '../server/taxguard/bookkeeping/types';

describe('TaxGuard Bookkeeping & General Ledger Engine', () => {
  let engine: BookkeepingEngine;
  let syncService: AccountingSyncService;

  const tenantId = 'tenant_omega';
  const clientId = 'client_biz_101';
  const taxYear = 2025;
  let periodId: string;

  beforeEach(() => {
    engine = new BookkeepingEngine();
    syncService = new AccountingSyncService();

    // Setup active period
    const p = engine.ensurePeriod(tenantId, clientId, taxYear, '2025-Q1', '2025-01-01', '2025-03-31');
    periodId = p.id;

    // Bootstrap standard chart of accounts
    engine.ensureDefaultChartOfAccounts(tenantId, clientId, '1040_SCHED_C', 'accountant_alice');
  });

  describe('1. Chart of Accounts Architecture', () => {
    it('initializes standard GAAP chart of accounts with asset, liability, equity, revenue, and expense accounts', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      expect(coa.length).toBeGreaterThanOrEqual(25);

      const checking = coa.find((a) => a.accountNumber === '1010');
      expect(checking).toBeDefined();
      expect(checking?.accountType).toBe('ASSET');
      expect(checking?.currency).toBe('USD');

      const wages = coa.find((a) => a.accountNumber === '6020');
      expect(wages).toBeDefined();
      expect(wages?.accountType).toBe('EXPENSE');

      const meals = coa.find((a) => a.accountNumber === '6080');
      expect(meals?.taxMapping?.isSubjectToLimitation).toBe(true);
      expect(meals?.taxMapping?.limitationPercentage).toBe(50);
    });

    it('prevents creating duplicate account numbers for the same entity', () => {
      expect(() => {
        engine.createAccount({
          tenantId,
          clientId,
          accountNumber: '1010', // already exists
          accountName: 'Secondary Checking',
          accountType: 'ASSET',
          accountSubtype: 'CASH_AND_EQUIVALENTS',
          currency: 'USD',
          isActive: true,
          provenance: { source: 'MANUAL_ACCOUNTANT', creatorUid: 'accountant_alice' },
        });
      }).toThrow('DUPLICATE_ACCOUNT_NUMBER');
    });

    it('creates custom ledger account with tax mapping metadata', () => {
      const custom = engine.createAccount({
        tenantId,
        clientId,
        accountNumber: '6150',
        accountName: 'Cloud Server Infrastructure',
        accountType: 'EXPENSE',
        accountSubtype: 'OFFICE_SUPPLIES',
        currency: 'USD',
        isActive: true,
        taxMapping: {
          formTarget: '1040_SCHED_C',
          taxLineCode: 'EXP_OTHER',
          taxLineDescription: 'Other Business Expenses',
        },
        provenance: { source: 'MANUAL_ACCOUNTANT', creatorUid: 'accountant_alice' },
      });

      expect(custom.id).toBeDefined();
      expect(custom.accountNumber).toBe('6150');
      expect(engine.getAccount(custom.id)).toBeDefined();
    });
  });

  describe('2. Double-Entry General Ledger Balance', () => {
    it('creates and posts a balanced journal entry satisfying Debits = Credits', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cashAcc = coa.find((a) => a.accountNumber === '1010')!;
      const revenueAcc = coa.find((a) => a.accountNumber === '4010')!;

      const lines: JournalEntryLine[] = [
        {
          id: 'line_1',
          accountId: cashAcc.id,
          accountNumber: cashAcc.accountNumber,
          accountName: cashAcc.accountName,
          debit: 5000,
          credit: 0,
          memo: 'Client Retainer Payment',
        },
        {
          id: 'line_2',
          accountId: revenueAcc.id,
          accountNumber: revenueAcc.accountNumber,
          accountName: revenueAcc.accountName,
          debit: 0,
          credit: 5000,
          memo: 'Consulting Revenue',
        },
      ];

      const entry = engine.createJournalEntry({
        tenantId,
        clientId,
        taxYear,
        periodId,
        postingDate: '2025-01-15',
        transactionDate: '2025-01-15',
        description: 'Initial Consulting Retainer Deposit',
        source: 'MANUAL',
        lines,
        creatorUid: 'accountant_alice',
      });

      expect(entry.status).toBe('POSTED');
      expect(entry.totalDebit).toBe(5000);
      expect(entry.totalCredit).toBe(5000);

      const entries = engine.getJournalEntries(tenantId, clientId, taxYear);
      expect(entries).toHaveLength(1);
    });

    it('rejects unbalanced journal entries with UNBALANCED_JOURNAL_ENTRY', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cashAcc = coa.find((a) => a.accountNumber === '1010')!;
      const revenueAcc = coa.find((a) => a.accountNumber === '4010')!;

      const unbalancedLines: JournalEntryLine[] = [
        { id: 'line_1', accountId: cashAcc.id, debit: 5000, credit: 0 },
        { id: 'line_2', accountId: revenueAcc.id, debit: 0, credit: 4900 }, // $100 off
      ];

      expect(() => {
        engine.createJournalEntry({
          tenantId,
          clientId,
          taxYear,
          periodId,
          postingDate: '2025-01-15',
          transactionDate: '2025-01-15',
          description: 'Unbalanced Attempt',
          source: 'MANUAL',
          lines: unbalancedLines,
          creatorUid: 'accountant_alice',
        });
      }).toThrow('UNBALANCED_JOURNAL_ENTRY');
    });

    it('rejects posting into a HARD_CLOSED accounting period', () => {
      engine.closePeriod(periodId, 'HARD_CLOSED', 'compliance_officer');

      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cashAcc = coa.find((a) => a.accountNumber === '1010')!;
      const revAcc = coa.find((a) => a.accountNumber === '4010')!;

      expect(() => {
        engine.createJournalEntry({
          tenantId,
          clientId,
          taxYear,
          periodId,
          postingDate: '2025-01-15',
          transactionDate: '2025-01-15',
          description: 'Blocked Posting in Locked Period',
          source: 'MANUAL',
          lines: [
            { id: 'l1', accountId: cashAcc.id, debit: 100, credit: 0 },
            { id: 'l2', accountId: revAcc.id, debit: 0, credit: 100 },
          ],
          creatorUid: 'accountant_alice',
        });
      }).toThrow('PERIOD_HARD_CLOSED');
    });

    it('allows posting after authorized period reopening with audit reason', () => {
      engine.closePeriod(periodId, 'HARD_CLOSED', 'compliance_officer');
      engine.reopenPeriod(periodId, 'senior_reviewer', 'Audit discovery requires posting late 1099 transaction.');

      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cashAcc = coa.find((a) => a.accountNumber === '1010')!;
      const revAcc = coa.find((a) => a.accountNumber === '4010')!;

      const entry = engine.createJournalEntry({
        tenantId,
        clientId,
        taxYear,
        periodId,
        postingDate: '2025-01-20',
        transactionDate: '2025-01-20',
        description: 'Late 1099 Client Payment',
        source: 'MANUAL',
        lines: [
          { id: 'l1', accountId: cashAcc.id, debit: 750, credit: 0 },
          { id: 'l2', accountId: revAcc.id, debit: 0, credit: 750 },
        ],
        creatorUid: 'accountant_alice',
      });

      expect(entry.status).toBe('POSTED');
    });
  });

  describe('3. Transaction Ingestion & Duplicate Detection', () => {
    it('ingests bank transactions and flags potential duplicates without silent deletion', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cashAcc = coa.find((a) => a.accountNumber === '1010')!;

      const batch1 = [
        {
          externalTransactionId: 'chase_tx_001',
          transactionDate: '2025-01-10',
          description: 'Gusto Payroll Tax Debit',
          amount: -1850.50,
        },
        {
          externalTransactionId: 'chase_tx_002',
          transactionDate: '2025-01-12',
          description: 'Staples Office Supplies',
          amount: -124.30,
        },
      ];

      const res1 = engine.ingestTransactions(tenantId, clientId, cashAcc.id, 'batch_1', 'CSV_UPLOAD', batch1);
      expect(res1.ingested).toHaveLength(2);
      expect(res1.duplicatesCount).toBe(0);

      // Ingest batch 2 containing an exact duplicate of chase_tx_001
      const batch2 = [
        {
          externalTransactionId: 'chase_tx_001', // duplicate
          transactionDate: '2025-01-10',
          description: 'Gusto Payroll Tax Debit',
          amount: -1850.50,
        },
        {
          externalTransactionId: 'chase_tx_003',
          transactionDate: '2025-01-14',
          description: 'Client Wire Deposit Acme Corp',
          amount: 12000.0,
        },
      ];

      const res2 = engine.ingestTransactions(tenantId, clientId, cashAcc.id, 'batch_2', 'CSV_UPLOAD', batch2);
      expect(res2.ingested).toHaveLength(2);
      expect(res2.duplicatesCount).toBe(1);

      const dupTxn = res2.ingested.find((t) => t.externalTransactionId === 'chase_tx_001');
      expect(dupTxn?.duplicateStatus).toBe('POSSIBLE_DUPLICATE');
      expect(dupTxn?.duplicateCandidateId).toBe(res1.ingested[0].id);
    });

    it('generates non-authoritative AI categorization proposals with explicit governance flags', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cashAcc = coa.find((a) => a.accountNumber === '1010')!;

      const txns = [
        {
          transactionDate: '2025-01-18',
          description: 'Staples Store #1402 Supplies',
          amount: -89.45,
        },
        {
          transactionDate: '2025-01-19',
          description: 'The Capital Grille Client Dinner',
          amount: -245.00,
        },
      ];

      const res = engine.ingestTransactions(tenantId, clientId, cashAcc.id, 'batch_ai', 'CSV_UPLOAD', txns);
      const staplesTxn = res.ingested[0];
      expect(staplesTxn.classificationStatus).toBe('AI_PROPOSED');
      expect(staplesTxn.aiProposal?.isAiProposedOnly).toBe(true);
      expect(staplesTxn.aiProposal?.confidence).toBeGreaterThan(0.9);

      const dinnerTxn = res.ingested[1];
      expect(dinnerTxn.aiProposal?.reasoning).toContain('50% deduction limit');
    });

    it('categorizes transaction and posts balancing double-entry journal entry upon accountant review', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cashAcc = coa.find((a) => a.accountNumber === '1010')!;
      const officeAcc = coa.find((a) => a.accountNumber === '6070')!;

      const res = engine.ingestTransactions(tenantId, clientId, cashAcc.id, 'batch_cat', 'CSV_UPLOAD', [
        {
          transactionDate: '2025-01-22',
          description: 'Adobe Creative Cloud SaaS Subscription',
          amount: -54.99,
        },
      ]);
      const rawTxn = res.ingested[0];

      const result = engine.categorizeAndPostTransaction({
        transactionId: rawTxn.id,
        assignedAccountId: officeAcc.id,
        assignedTaxCategory: 'EXP_OFFICE',
        accountantUid: 'accountant_alice',
        periodId,
        taxYear,
      });

      expect(result.transaction.classificationStatus).toBe('POSTED');
      expect(result.journalEntry.totalDebit).toBe(54.99);
      expect(result.journalEntry.totalCredit).toBe(54.99);

      // Verify the journal lines balance: Debit Office Expense, Credit Cash
      const debitLine = result.journalEntry.lines.find((l) => l.debit > 0);
      const creditLine = result.journalEntry.lines.find((l) => l.credit > 0);
      expect(debitLine?.accountId).toBe(officeAcc.id);
      expect(creditLine?.accountId).toBe(cashAcc.id);
    });

    it('links verified document to transaction with provenance tracking', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cashAcc = coa.find((a) => a.accountNumber === '1010')!;

      const res = engine.ingestTransactions(tenantId, clientId, cashAcc.id, 'batch_doc', 'CSV_UPLOAD', [
        {
          transactionDate: '2025-01-25',
          description: 'Dell Precision 5570 Laptop',
          amount: -2349.00,
        },
      ]);
      const txn = res.ingested[0];

      const updated = engine.matchDocumentToTransaction(txn.id, 'doc_receipt_dell_001', 'accountant_alice');
      expect(updated.matchedDocumentIds).toContain('doc_receipt_dell_001');
    });
  });

  describe('4. Bank & Credit Card Reconciliation Engine', () => {
    it('executes reconciliation, balances cleared items, and finalizes with zero variance', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cashAcc = coa.find((a) => a.accountNumber === '1010')!;

      // Ingest transactions totaling Net +$3,000
      const res = engine.ingestTransactions(tenantId, clientId, cashAcc.id, 'batch_recon', 'CSV_UPLOAD', [
        { transactionDate: '2025-01-05', description: 'Client Deposit A', amount: 5000 },
        { transactionDate: '2025-01-15', description: 'Vendor Payout B', amount: -2000 },
      ]);

      // Statement: Beginning $10,000, Ending $13,000
      const recon = engine.startReconciliation({
        tenantId,
        clientId,
        accountId: cashAcc.id,
        taxYear,
        statementPeriodStart: '2025-01-01',
        statementPeriodEnd: '2025-01-31',
        statementBeginningBalance: 10000,
        statementEndingBalance: 13000,
        tolerance: 0.0,
      });

      expect(recon.status).toBe('IN_PROGRESS');

      // Clear both transactions
      engine.clearTransaction(recon.id, res.ingested[0].id, true);
      const updatedRecon = engine.clearTransaction(recon.id, res.ingested[1].id, true);

      expect(updatedRecon.clearedBalance).toBe(13000);
      expect(updatedRecon.variance).toBe(0.0);
      expect(updatedRecon.status).toBe('BALANCED');

      const finalized = engine.finalizeReconciliation(recon.id, 'accountant_alice');
      expect(finalized.status).toBe('CLOSED');
      expect(finalized.completedByUid).toBe('accountant_alice');

      // Verify transactions are marked RECONCILED
      const txns = engine.getTransactions(tenantId, clientId, cashAcc.id);
      expect(txns.every((t) => t.reconciliationStatus === 'RECONCILED')).toBe(true);
    });

    it('blocks finalization and creates reviewable exception when reconciliation has unresolved variance', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cashAcc = coa.find((a) => a.accountNumber === '1010')!;

      // Only $1,000 cleared, but ending balance expects $13,000 (starting at $10,000)
      const res = engine.ingestTransactions(tenantId, clientId, cashAcc.id, 'batch_var', 'CSV_UPLOAD', [
        { transactionDate: '2025-01-05', description: 'Partial Deposit', amount: 1000 },
      ]);

      const recon = engine.startReconciliation({
        tenantId,
        clientId,
        accountId: cashAcc.id,
        taxYear,
        statementPeriodStart: '2025-01-01',
        statementPeriodEnd: '2025-01-31',
        statementBeginningBalance: 10000,
        statementEndingBalance: 13000,
        tolerance: 0.0,
      });

      engine.clearTransaction(recon.id, res.ingested[0].id, true);

      // Attempting to finalize with $2,000 variance throws error and creates exception
      expect(() => {
        engine.finalizeReconciliation(recon.id, 'accountant_alice');
      }).toThrow('RECONCILIATION_VARIANCE_UNRESOLVED');

      expect(recon.exceptions.length).toBeGreaterThan(0);
      expect(recon.exceptions[0].type).toBe('UNEXPLAINED_VARIANCE');
      expect(recon.status).toBe('IN_PROGRESS');
    });
  });

  describe('5. Adjusting Entries & Maker-Checker Segregation', () => {
    it('creates adjusting journal entry and enforces independent reviewer approval', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const depExp = coa.find((a) => a.accountNumber === '6090')!;
      const accumDep = coa.find((a) => a.accountNumber === '1590')!;

      const lines: JournalEntryLine[] = [
        { id: 'l1', accountId: depExp.id, debit: 1250, credit: 0, memo: 'Q1 Equipment Depreciation' },
        { id: 'l2', accountId: accumDep.id, debit: 0, credit: 1250, memo: 'Accumulated Depreciation' },
      ];

      const adjEntry = engine.createAdjustingJournalEntry({
        tenantId,
        clientId,
        taxYear,
        periodId,
        postingDate: '2025-03-31',
        description: 'Q1 Depreciation Adjustment',
        adjustingType: 'DEPRECIATION',
        lines,
        preparerUid: 'preparer_bob',
      });

      expect(adjEntry.isAdjusting).toBe(true);
      expect(adjEntry.creatorUid).toBe('preparer_bob');

      // Maker-Checker: preparer_bob cannot approve their own adjusting entry
      expect(() => {
        engine.reviewAndApproveJournalEntry(adjEntry.id, 'preparer_bob');
      }).toThrow('MAKER_CHECKER_VIOLATION');

      // Independent reviewer approves
      const approved = engine.reviewAndApproveJournalEntry(adjEntry.id, 'reviewer_charlie');
      expect(approved.reviewerUid).toBe('reviewer_charlie');
    });
  });

  describe('6. Trial Balance & Financial Statements', () => {
    beforeEach(() => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cash = coa.find((a) => a.accountNumber === '1010')!;
      const rev = coa.find((a) => a.accountNumber === '4010')!;
      const rent = coa.find((a) => a.accountNumber === '6030')!;

      // Post Revenue: Cash $10,000, Revenue $10,000
      engine.createJournalEntry({
        tenantId,
        clientId,
        taxYear,
        periodId,
        postingDate: '2025-01-10',
        transactionDate: '2025-01-10',
        description: 'Revenue Entry',
        source: 'MANUAL',
        lines: [
          { id: 'l1', accountId: cash.id, debit: 10000, credit: 0 },
          { id: 'l2', accountId: rev.id, debit: 0, credit: 10000 },
        ],
        creatorUid: 'accountant_alice',
      });

      // Post Rent Expense: Rent $2,500, Cash $2,500
      engine.createJournalEntry({
        tenantId,
        clientId,
        taxYear,
        periodId,
        postingDate: '2025-01-15',
        transactionDate: '2025-01-15',
        description: 'Rent Entry',
        source: 'MANUAL',
        lines: [
          { id: 'l3', accountId: rent.id, debit: 2500, credit: 0 },
          { id: 'l4', accountId: cash.id, debit: 0, credit: 2500 },
        ],
        creatorUid: 'accountant_alice',
      });
    });

    it('generates a balanced Trial Balance where Total Debits equal Total Credits', () => {
      const tb = engine.generateTrialBalance(tenantId, clientId, taxYear);
      expect(tb.isBalanced).toBe(true);
      expect(tb.totalEndingDebit).toBe(tb.totalEndingCredit);
      expect(tb.totalEndingDebit).toBe(10000); // Cash $7,500 + Rent $2,500 = $10,000
    });

    it('generates Profit & Loss and Balance Sheet fulfilling the fundamental accounting equation', () => {
      const statements = engine.generateFinancialStatements(tenantId, clientId, taxYear);

      // P&L: Revenue $10,000, Rent $2,500 -> Net Income $7,500
      expect(statements.profitAndLoss.grossRevenue).toBe(10000);
      expect(statements.profitAndLoss.totalOperatingExpenses).toBe(2500);
      expect(statements.profitAndLoss.netIncome).toBe(7500);

      // Balance Sheet: Assets (Cash $7,500) = Liabilities ($0) + Equity ($7,500 Net Income)
      expect(statements.balanceSheet.assets.totalAssets).toBe(7500);
      expect(statements.balanceSheet.liabilities.totalLiabilities).toBe(0);
      expect(statements.balanceSheet.equity.totalEquity).toBe(7500);
      expect(statements.balanceSheet.isBalanced).toBe(true);
    });
  });

  describe('7. Book-to-Tax Adjustments (Schedule M-1 Bridge)', () => {
    it('creates book-to-tax differences without mutating original accounting ledger values', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const mealsAcc = coa.find((a) => a.accountNumber === '6080')!;

      const adj = engine.createBookToTaxAdjustment({
        tenantId,
        clientId,
        taxYear,
        accountId: mealsAcc.id,
        description: 'IRC Sec. 274(n) 50% Non-Deductible Business Meals Disallowance',
        bookAmount: 3000,
        taxAmount: 1500,
        permanentOrTiming: 'PERMANENT',
        scheduleM1Category: 'MEALS_50_LIMIT',
        taxAuthorityCitation: '26 U.S. Code § 274(n)(1)',
        preparerUid: 'preparer_bob',
      });

      expect(adj.bookAmount).toBe(3000);
      expect(adj.taxAmount).toBe(1500);
      expect(adj.adjustmentAmount).toBe(-1500); // -$1,500 reduction in allowable tax deductions
      expect(adj.permanentOrTiming).toBe('PERMANENT');

      const allAdj = engine.getBookToTaxAdjustments(tenantId, clientId, taxYear);
      expect(allAdj).toHaveLength(1);
    });
  });

  describe('8. Controlled QuickBooks & Xero Synchronization', () => {
    it('defaults to Read-Only mode and preserves verified evidence', async () => {
      const qbState = syncService.getSyncState('QUICKBOOKS', tenantId, clientId);
      expect(qbState.isReadOnly).toBe(true);

      const xeroState = syncService.getSyncState('XERO', tenantId, clientId);
      expect(xeroState.isReadOnly).toBe(true);
    });

    it('enforces all 5 security stages before allowing write-back to remote accounting ledgers', async () => {
      const idempotencyKey = 'sync_write_idemp_001';

      // Attempting write-back without client authorization fails at Stage 1
      expect(() => {
        syncService.prepareWriteByAccountant('QUICKBOOKS', tenantId, clientId, 'accountant_alice');
      }).toThrow('STAGE_1_REQUIRED');

      // Stage 1: Client authorizes
      syncService.authorizeWriteByClient('QUICKBOOKS', tenantId, clientId, 'client_owner');

      // Stage 2: Accountant prepares
      syncService.prepareWriteByAccountant('QUICKBOOKS', tenantId, clientId, 'accountant_alice');

      // Stage 3: Reviewer approves with maker-checker (accountant cannot self-approve)
      expect(() => {
        syncService.approveWriteByReviewer('QUICKBOOKS', tenantId, clientId, 'accountant_alice', 'accountant_alice');
      }).toThrow('MAKER_CHECKER_VIOLATION');

      syncService.approveWriteByReviewer('QUICKBOOKS', tenantId, clientId, 'reviewer_charlie', 'accountant_alice');

      // Stage 4: Explicit confirmation phrase required
      expect(() => {
        syncService.confirmWriteExplicitly('QUICKBOOKS', tenantId, clientId, 'YES_WRITE');
      }).toThrow('INVALID_CONFIRMATION_PHRASE');

      syncService.confirmWriteExplicitly('QUICKBOOKS', tenantId, clientId, 'CONFIRM_WRITE_TO_LEDGER');

      // Stage 5: Commit write-back succeeds
      const commitRes = await syncService.executeWriteBack(
        'QUICKBOOKS',
        tenantId,
        clientId,
        idempotencyKey,
        ['je_001', 'je_002'],
        'accountant_alice'
      );

      expect(commitRes.success).toBe(true);
      expect(commitRes.committedEntriesCount).toBe(2);
      expect(commitRes.auditStatus).toBe('AUDIT_RECORDED');
    });

    it('detects synchronization conflicts between TaxGuard and external provider', () => {
      const lastSync = '2025-01-10T00:00:00Z';

      // Both changed after sync
      const bothChanged = syncService.detectConflict(
        '2025-01-12T10:00:00Z',
        '2025-01-13T12:00:00Z',
        lastSync
      );
      expect(bothChanged).toBe('BOTH_CHANGED');

      // Only TaxGuard changed
      const tgChanged = syncService.detectConflict(
        '2025-01-12T10:00:00Z',
        '2025-01-08T00:00:00Z',
        lastSync
      );
      expect(tgChanged).toBe('TAXGUARD_CHANGED');

      // Neither changed
      const noConflict = syncService.detectConflict(
        '2025-01-05T00:00:00Z',
        '2025-01-05T00:00:00Z',
        lastSync
      );
      expect(noConflict).toBe('NO_CONFLICT');
    });
  });

  describe('9. Upstream Change Invalidation', () => {
    it('notifies invalidation listeners when new journal entries or adjustments are recorded', () => {
      const invalidationSpy = vi.fn();
      engine.registerInvalidationListener(invalidationSpy);

      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cash = coa.find((a) => a.accountNumber === '1010')!;
      const rev = coa.find((a) => a.accountNumber === '4010')!;

      engine.createJournalEntry({
        tenantId,
        clientId,
        taxYear,
        periodId,
        postingDate: '2025-02-01',
        transactionDate: '2025-02-01',
        description: 'New Upstream Revenue',
        source: 'MANUAL',
        lines: [
          { id: 'l1', accountId: cash.id, debit: 2000, credit: 0 },
          { id: 'l2', accountId: rev.id, debit: 0, credit: 2000 },
        ],
        creatorUid: 'accountant_alice',
      });

      expect(invalidationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          clientId,
          taxYear,
        })
      );
    });
  });
});
