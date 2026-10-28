/**
 * TaxGuard AI — Full Lifecycle Integration & Failure-Path Verification Suite
 * Tests end-to-end logical progression from Onboarding through Bookkeeping,
 * General Ledger, Reconciliation, Financial Statements, Tax Preparation,
 * Reviewer Approval, and Fail-Closed Provider Gateways.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookkeepingEngine } from '../server/taxguard/bookkeeping/bookkeeping.engine';
import { AccountingSyncService } from '../server/taxguard/bookkeeping/accountingSync.service';
import { TaxDecimal } from '../taxguard/calculation/TaxDecimal';
import {
  Federal1040AgiCalculationEngine,
  type Federal1040AgiInput
} from '../taxguard/calculation/Federal1040AgiCalculation';

describe('TaxGuard Full Lifecycle & Failure-Path Suite', () => {
  let engine: BookkeepingEngine;
  let syncService: AccountingSyncService;

  const tenantId = 'ar-tax-services';
  const clientId = 'client_synthetic_corp';
  const taxYear = 2025;
  let periodId: string;

  beforeEach(() => {
    engine = new BookkeepingEngine();
    syncService = new AccountingSyncService();

    const period = engine.ensurePeriod(tenantId, clientId, taxYear, '2025-Q1', '2025-01-01', '2025-03-31');
    periodId = period.id;

    engine.ensureDefaultChartOfAccounts(tenantId, clientId, '1040_SCHED_C', 'accountant_alice');
  });

  describe('Part 1: End-to-End Bookkeeping through Tax Preparation Data Path', () => {
    it('executes full pipeline: Ingestion -> Categorization -> Ledger -> Reconciliation -> Trial Balance -> Tax Prep', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cashAcc = coa.find((a) => a.accountNumber === '1010')!;
      const revAcc = coa.find((a) => a.accountNumber === '4010')!;
      const rentAcc = coa.find((a) => a.accountNumber === '6030')!;
      const mealsAcc = coa.find((a) => a.accountNumber === '6080')!;

      // 1. Ingest Bank Transactions
      const rawTxns = [
        { transactionDate: '2025-01-10', description: 'Acme Corp Consulting Retainer', amount: 25000.0 },
        { transactionDate: '2025-01-15', description: 'Executive Office Suites Rent', amount: -4000.0 },
        { transactionDate: '2025-01-20', description: 'Ruth Chris Client Dinner', amount: -600.0 },
      ];

      const ingestionResult = engine.ingestTransactions(
        tenantId,
        clientId,
        cashAcc.id,
        'batch_e2e_001',
        'CSV_UPLOAD',
        rawTxns
      );
      expect(ingestionResult.ingested).toHaveLength(3);
      expect(ingestionResult.duplicatesCount).toBe(0);

      // 2. Categorize & Post to Double-Entry General Ledger
      const [depTxn, rentTxn, mealTxn] = ingestionResult.ingested;

      engine.categorizeAndPostTransaction({
        transactionId: depTxn.id,
        assignedAccountId: revAcc.id,
        assignedTaxCategory: 'GROSS_RECEIPTS',
        accountantUid: 'accountant_alice',
        periodId,
        taxYear,
      });

      engine.categorizeAndPostTransaction({
        transactionId: rentTxn.id,
        assignedAccountId: rentAcc.id,
        assignedTaxCategory: 'EXP_RENT',
        accountantUid: 'accountant_alice',
        periodId,
        taxYear,
      });

      engine.categorizeAndPostTransaction({
        transactionId: mealTxn.id,
        assignedAccountId: mealsAcc.id,
        assignedTaxCategory: 'EXP_MEALS_50',
        accountantUid: 'accountant_alice',
        periodId,
        taxYear,
      });

      // 3. Match Verified Source Document
      engine.matchDocumentToTransaction(rentTxn.id, 'doc_verified_lease_001', 'accountant_alice');
      const updatedRentTxn = engine.getTransactions(tenantId, clientId).find((t) => t.id === rentTxn.id);
      expect(updatedRentTxn?.matchedDocumentIds).toContain('doc_verified_lease_001');

      // 4. Zero-Variance Bank Reconciliation
      // Beginning: $5,000, Inflows: $25,000, Outflows: $4,600 -> Net Cleared: $20,400 -> Ending: $25,400
      const recon = engine.startReconciliation({
        tenantId,
        clientId,
        accountId: cashAcc.id,
        taxYear,
        statementPeriodStart: '2025-01-01',
        statementPeriodEnd: '2025-01-31',
        statementBeginningBalance: 5000,
        statementEndingBalance: 25400,
        tolerance: 0.0,
      });

      engine.clearTransaction(recon.id, depTxn.id, true);
      engine.clearTransaction(recon.id, rentTxn.id, true);
      engine.clearTransaction(recon.id, mealTxn.id, true);

      const finalizedRecon = engine.finalizeReconciliation(recon.id, 'accountant_alice');
      expect(finalizedRecon.status).toBe('CLOSED');
      expect(finalizedRecon.variance).toBe(0.0);

      // 5. Generate Trial Balance (Debits = Credits)
      const tb = engine.generateTrialBalance(tenantId, clientId, taxYear);
      expect(tb.isBalanced).toBe(true);
      expect(tb.totalEndingDebit).toBe(tb.totalEndingCredit);

      // 6. Generate GAAP Financial Statements
      const fin = engine.generateFinancialStatements(tenantId, clientId, taxYear);
      expect(fin.profitAndLoss.grossRevenue).toBe(25000);
      expect(fin.profitAndLoss.totalOperatingExpenses).toBe(4600);
      expect(fin.profitAndLoss.netIncome).toBe(20400);
      expect(fin.balanceSheet.isBalanced).toBe(true);
      expect(fin.balanceSheet.assets.totalAssets).toBe(20400);

      // 7. Schedule M-1 Book-to-Tax Adjustment (50% Meals disallowance)
      const b2t = engine.createBookToTaxAdjustment({
        tenantId,
        clientId,
        taxYear,
        accountId: mealsAcc.id,
        description: 'IRC § 274(n) 50% Non-Deductible Business Meals Limitation',
        bookAmount: 600,
        taxAmount: 300,
        permanentOrTiming: 'PERMANENT',
        scheduleM1Category: 'MEALS_50_LIMIT',
        taxAuthorityCitation: '26 U.S. Code § 274(n)(1)',
        preparerUid: 'accountant_alice',
      });
      expect(b2t.adjustmentAmount).toBe(-300); // reduces allowable deduction by $300, increasing taxable income

      // 8. Taxable Net Schedule C Profit Calculation
      // Book Net Income: $20,400 + Disallowed Meals: $300 = $20,700 Taxable Business Income
      const taxableScheduleCProfit = fin.profitAndLoss.netIncome - b2t.adjustmentAmount; // 20400 - (-300) = 20700
      expect(taxableScheduleCProfit).toBe(20700);

      // 9. Deterministic Form 1040 Calculation Bridge
      const agiContext = {
        calculationId: 'CALC-AGI-E2E-001',
        calculationType: 'FEDERAL_1040_AGI_CALCULATION',
        clientId,
        engagementId: 'ENG-2025-E2E',
        taxYear: 2025,
        jurisdiction: 'federal' as const,
        ruleIds: ['RULE-IRC-61', 'RULE-IRC-62'],
        authorityIds: ['AUTH-IRC-61', 'AUTH-IRC-62'],
        evidencePackageIds: ['EVP-BOOKKEEPING-001'],
        correlationId: 'CORR-E2E-001',
        roundingMode: 'HALF_UP' as const,
        riskLevel: 'routine' as const,
      };

      const agiInputs: Federal1040AgiInput[] = [
        {
          inputId: 'INCOME-SCHED-C-001',
          factPath: 'federal1040.scheduleC.netProfit',
          inputType: 'GROSS_INCOME',
          value: TaxDecimal.parse(taxableScheduleCProfit.toFixed(2), 2),
          evidenceIds: ['EV-GL-001', 'EV-B2T-001'],
          sourceDocumentIds: ['doc_verified_lease_001'],
          validated: true,
        },
      ];

      const agiResult = Federal1040AgiCalculationEngine.calculate(agiContext, agiInputs);

      expect(agiResult.value.toFixed()).toBe('20700.00');
      expect(agiResult.breakdown.grossIncome.toFixed()).toBe('20700.00');
      expect(agiResult.breakdown.adjustedGrossIncome.toFixed()).toBe('20700.00');
    });
  });

  describe('Part 2: Failure-Path & Security Hardening Tests', () => {
    it('fails closed when posting unbalanced journal entry', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cash = coa.find((a) => a.accountNumber === '1010')!;
      const rev = coa.find((a) => a.accountNumber === '4010')!;

      expect(() => {
        engine.createJournalEntry({
          tenantId,
          clientId,
          taxYear,
          periodId,
          postingDate: '2025-01-20',
          transactionDate: '2025-01-20',
          description: 'Malformed entry',
          source: 'MANUAL',
          lines: [
            { id: '1', accountId: cash.id, debit: 1000, credit: 0 },
            { id: '2', accountId: rev.id, debit: 0, credit: 950 }, // $50 off
          ],
          creatorUid: 'accountant_alice',
        });
      }).toThrow('UNBALANCED_JOURNAL_ENTRY');
    });

    it('fails closed when attempting to finalize a reconciliation with unverified variance', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cash = coa.find((a) => a.accountNumber === '1010')!;

      const recon = engine.startReconciliation({
        tenantId,
        clientId,
        accountId: cash.id,
        taxYear,
        statementPeriodStart: '2025-01-01',
        statementPeriodEnd: '2025-01-31',
        statementBeginningBalance: 1000,
        statementEndingBalance: 2000, // expects $1,000 cleared
        tolerance: 0.0,
      });

      // No transactions cleared, variance is $1,000
      expect(() => {
        engine.finalizeReconciliation(recon.id, 'accountant_alice');
      }).toThrow('RECONCILIATION_VARIANCE_UNRESOLVED');
    });

    it('fails closed when preparer attempts to self-approve adjusting journal entry (Maker-Checker violation)', () => {
      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const rent = coa.find((a) => a.accountNumber === '6030')!;
      const cash = coa.find((a) => a.accountNumber === '1010')!;

      const adj = engine.createAdjustingJournalEntry({
        tenantId,
        clientId,
        taxYear,
        periodId,
        postingDate: '2025-01-31',
        description: 'Year-end Rent Accrual',
        adjustingType: 'ACCRUAL',
        lines: [
          { id: 'l1', accountId: rent.id, debit: 1500, credit: 0 },
          { id: 'l2', accountId: cash.id, debit: 0, credit: 1500 },
        ],
        preparerUid: 'preparer_bob',
      });

      expect(() => {
        engine.reviewAndApproveJournalEntry(adj.id, 'preparer_bob'); // self-approval
      }).toThrow('MAKER_CHECKER_VIOLATION');
    });

    it('fails closed when attempting remote provider write without the exact confirmation phrase', () => {
      syncService.authorizeWriteByClient('QUICKBOOKS', tenantId, clientId, 'client_user');
      syncService.prepareWriteByAccountant('QUICKBOOKS', tenantId, clientId, 'accountant_alice');
      syncService.approveWriteByReviewer('QUICKBOOKS', tenantId, clientId, 'reviewer_charlie', 'accountant_alice');

      // Invalid confirmation phrase
      expect(() => {
        syncService.confirmWriteExplicitly('QUICKBOOKS', tenantId, clientId, 'CONFIRM');
      }).toThrow('INVALID_CONFIRMATION_PHRASE');

      // Valid confirmation phrase satisfies Stage 4
      const confirmed = syncService.confirmWriteExplicitly('QUICKBOOKS', tenantId, clientId, 'CONFIRM_WRITE_TO_LEDGER');
      expect(confirmed.writeAuthorization.explicitlyConfirmed).toBe(true);
    });

    it('dispatches upstream invalidation event whenever ledger entries are created', () => {
      const listenerSpy = vi.fn();
      engine.registerInvalidationListener(listenerSpy);

      const coa = engine.getChartOfAccounts(tenantId, clientId);
      const cash = coa.find((a) => a.accountNumber === '1010')!;
      const rev = coa.find((a) => a.accountNumber === '4010')!;

      engine.createJournalEntry({
        tenantId,
        clientId,
        taxYear,
        periodId,
        postingDate: '2025-01-25',
        transactionDate: '2025-01-25',
        description: 'New Transaction Triggering Invalidation',
        source: 'MANUAL',
        lines: [
          { id: '1', accountId: cash.id, debit: 1200, credit: 0 },
          { id: '2', accountId: rev.id, debit: 0, credit: 1200 },
        ],
        creatorUid: 'accountant_alice',
      });

      expect(listenerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          clientId,
          taxYear,
          reason: expect.stringContaining('Journal Entry'),
        })
      );
    });
  });
});
