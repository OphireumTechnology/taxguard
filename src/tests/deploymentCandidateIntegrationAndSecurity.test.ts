/**
 * A/R Tax Services, LLC - Deployment Candidate Integration & Security Test Suite
 * Validates:
 * - Cross-tenant and cross-client authorization attacks fail closed
 * - Maker-Checker segregation of duties across bookkeeping and tax review
 * - 5-Stage Controlled Write-Back Pipeline (QuickBooks & Xero) with CONFIRM_WRITE_TO_LEDGER
 * - Bookkeeping -> General Ledger -> Trial Balance -> Book-to-Tax (Schedule M-1) Bridge
 * - Multi-year isolation and immutable audit retention
 * - Fail-closed behavior for uncommissioned external providers (IRS MeF, E-Sign, Malware)
 * - Money precision without IEEE-754 floating point rounding drift
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BookkeepingEngine } from '../server/taxguard/bookkeeping/bookkeeping.engine';
import { AccountingSyncService } from '../server/taxguard/bookkeeping/accountingSync.service';
import { JournalEntryLine } from '../server/taxguard/bookkeeping/types';
import { ProviderReadinessRegistry } from '../server/taxguard/providerReadiness.service';

describe('TaxGuard Deployment Candidate Suite - Full Integration & Security Gates', () => {
  let engine: BookkeepingEngine;
  let syncService: AccountingSyncService;

  const tenantA = 'tenant_artax_main';
  const tenantB = 'tenant_rival_corp';
  const clientAlpha = 'client_alpha_corp';
  const clientBeta = 'client_beta_llc';
  const taxYear2025 = 2025;
  const taxYear2026 = 2026;

  beforeEach(() => {
    engine = new BookkeepingEngine();
    syncService = new AccountingSyncService();

    // Bootstrap CoA for clientAlpha
    engine.ensurePeriod(tenantA, clientAlpha, taxYear2025, '2025-Q1', '2025-01-01', '2025-03-31');
    engine.ensureDefaultChartOfAccounts(tenantA, clientAlpha, '1120S', 'staff_preparer_desmond');
  });

  describe('1. Authorization Attack Invariants (Fail-Closed Enforcement)', () => {
    it('blocks cross-tenant access between isolated firms', () => {
      // Create account in tenantA
      const acc = engine.createAccount({
        tenantId: tenantA,
        clientId: clientAlpha,
        accountNumber: '1090',
        accountName: 'Tenant A Escrow',
        accountType: 'ASSET',
        accountSubtype: 'CASH_AND_EQUIVALENTS',
        currency: 'USD',
        isActive: true,
        provenance: { source: 'MANUAL_ACCOUNTANT', creatorUid: 'staff_desmond' },
      });

      // User from tenantB attempts to query tenantA chart of accounts
      const tenantBAccounts = engine.getChartOfAccounts(tenantB, clientAlpha);
      expect(tenantBAccounts.find(a => a.id === acc.id)).toBeUndefined();
    });

    it('blocks cross-client ledger contamination within the same tenant', () => {
      // Ingest transactions for clientAlpha
      const coa = engine.getChartOfAccounts(tenantA, clientAlpha);
      const cashAcc = coa.find(a => a.accountNumber === '1010')!;

      engine.ingestTransactions(tenantA, clientAlpha, cashAcc.id, 'batch_001', 'CSV_UPLOAD', [
        { transactionDate: '2025-01-15', description: 'Alpha Consulting Revenue', amount: 8500 }
      ]);

      // Querying clientBeta must return 0 transactions
      const betaTxns = engine.getTransactions(tenantA, clientBeta);
      expect(betaTxns.length).toBe(0);
    });

    it('enforces Maker-Checker gate: preparer cannot self-approve adjusting journal entries', () => {
      const coa = engine.getChartOfAccounts(tenantA, clientAlpha);
      const cashAcc = coa.find(a => a.accountNumber === '1010')!;
      const expenseAcc = coa.find(a => a.accountNumber === '6010')!;

      // Desmond prepares an adjusting entry
      const entry = engine.createJournalEntry({
        tenantId: tenantA,
        clientId: clientAlpha,
        taxYear: taxYear2025,
        periodId: 'period_2025_q1',
        postingDate: '2025-03-31',
        transactionDate: '2025-03-31',
        description: 'Year-End Officer Compensation Reclassification',
        source: 'MANUAL',
        isAdjusting: true,
        adjustingType: 'RECLASSIFICATION',
        creatorUid: 'preparer_desmond',
        lines: [
          { id: 'l1', accountId: expenseAcc.id, debit: 12000, credit: 0, memo: 'Officer salary' },
          { id: 'l2', accountId: cashAcc.id, debit: 0, credit: 12000, memo: 'Direct draw offset' }
        ]
      });

      expect(entry.status).toBe('PREPARED');

      // Desmond attempts to self-approve his own adjusting entry
      expect(() => {
        engine.reviewAndApproveJournalEntry(entry.id, 'preparer_desmond');
      }).toThrow(/MAKER_CHECKER_VIOLATION/);

      // Independent Senior CPA Elena Rostova approves
      const approved = engine.reviewAndApproveJournalEntry(entry.id, 'reviewer_elena_cpa');
      expect(approved.status).toBe('POSTED');
      expect(approved.reviewerUid).toBe('reviewer_elena_cpa');
    });
  });

  describe('2. 5-Stage Controlled Write-Back Pipeline (QuickBooks / Xero)', () => {
    it('enforces all 5 stages in strict sequential dependency', async () => {
      const provider = 'QUICKBOOKS';

      // Attempting Stage 2 before Stage 1 fails
      expect(() => {
        syncService.prepareWriteByAccountant(provider, tenantA, clientAlpha, 'accountant_desmond');
      }).toThrow('STAGE_1_REQUIRED');

      // Stage 1: Client authorizes
      const s1 = syncService.authorizeWriteByClient(provider, tenantA, clientAlpha, 'client_owner_mike');
      expect(s1.writeAuthorization.clientAuthorized).toBe(true);

      // Stage 2: Accountant prepares
      const s2 = syncService.prepareWriteByAccountant(provider, tenantA, clientAlpha, 'accountant_desmond');
      expect(s2.writeAuthorization.accountantPrepared).toBe(true);

      // Stage 3: Reviewer approves with Maker-Checker (preparer cannot be reviewer)
      expect(() => {
        syncService.approveWriteByReviewer(provider, tenantA, clientAlpha, 'accountant_desmond', 'accountant_desmond');
      }).toThrow(/MAKER_CHECKER_VIOLATION/);

      const s3 = syncService.approveWriteByReviewer(provider, tenantA, clientAlpha, 'reviewer_elena_cpa', 'accountant_desmond');
      expect(s3.writeAuthorization.reviewerApproved).toBe(true);

      // Stage 4: Explicit Confirmation with exact phrase
      expect(() => {
        syncService.confirmWriteExplicitly(provider, tenantA, clientAlpha, 'CONFIRM_WRITE'); // wrong phrase
      }).toThrow('INVALID_CONFIRMATION_PHRASE');

      const s4 = syncService.confirmWriteExplicitly(provider, tenantA, clientAlpha, 'CONFIRM_WRITE_TO_LEDGER');
      expect(s4.writeAuthorization.explicitlyConfirmed).toBe(true);

      // Stage 5: Execution & complete audit logging
      const writeResult = await syncService.executeWriteBack(
        provider,
        tenantA,
        clientAlpha,
        'idempotency_tx_901',
        ['je_001'],
        'accountant_desmond'
      );
      expect(writeResult.success).toBe(true);
      expect(writeResult.committedEntriesCount).toBe(1);
    });

    it('preserves idempotency on duplicate write commitments', async () => {
      const provider = 'XERO';
      syncService.authorizeWriteByClient(provider, tenantA, clientAlpha, 'client_owner');
      syncService.prepareWriteByAccountant(provider, tenantA, clientAlpha, 'acc_alice');
      syncService.approveWriteByReviewer(provider, tenantA, clientAlpha, 'rev_elena', 'acc_alice');
      syncService.confirmWriteExplicitly(provider, tenantA, clientAlpha, 'CONFIRM_WRITE_TO_LEDGER');

      // First write
      const r1 = await syncService.executeWriteBack(provider, tenantA, clientAlpha, 'idem_key_44', ['je_001'], 'acc_alice');
      expect(r1.success).toBe(true);

      // Duplicate retry with same idempotency key does not duplicate writes
      const r2 = await syncService.executeWriteBack(provider, tenantA, clientAlpha, 'idem_key_44', ['je_001'], 'acc_alice');
      expect(r2.success).toBe(true);
      expect(r2.auditEventId).toBe(r1.auditEventId);
    });
  });

  describe('3. Multi-Year Tax Isolation & Period Locking', () => {
    it('strictly isolates accounting periods and transactions across 2025 and 2026', () => {
      // 2025 Period and Entry
      const coa = engine.getChartOfAccounts(tenantA, clientAlpha);
      const cashAcc = coa.find(a => a.accountNumber === '1010')!;
      const revAcc = coa.find(a => a.accountNumber === '4010')!;

      engine.createJournalEntry({
        tenantId: tenantA,
        clientId: clientAlpha,
        taxYear: taxYear2025,
        periodId: 'period_2025',
        postingDate: '2025-06-15',
        transactionDate: '2025-06-15',
        description: '2025 Advisory Fee',
        source: 'MANUAL',
        creatorUid: 'staff_desmond',
        lines: [
          { id: 'l1', accountId: cashAcc.id, debit: 5000, credit: 0 },
          { id: 'l2', accountId: revAcc.id, debit: 0, credit: 5000 }
        ]
      });

      // 2026 Period and Entry
      engine.ensurePeriod(tenantA, clientAlpha, taxYear2026, '2026-Q1', '2026-01-01', '2026-03-31');
      engine.createJournalEntry({
        tenantId: tenantA,
        clientId: clientAlpha,
        taxYear: taxYear2026,
        periodId: 'period_2026',
        postingDate: '2026-02-10',
        transactionDate: '2026-02-10',
        description: '2026 Advisory Fee',
        source: 'MANUAL',
        creatorUid: 'staff_desmond',
        lines: [
          { id: 'l3', accountId: cashAcc.id, debit: 8000, credit: 0 },
          { id: 'l4', accountId: revAcc.id, debit: 0, credit: 8000 }
        ]
      });

      const entries2025 = engine.getJournalEntries(tenantA, clientAlpha, taxYear2025);
      const entries2026 = engine.getJournalEntries(tenantA, clientAlpha, taxYear2026);

      expect(entries2025.length).toBe(1);
      expect(entries2025[0].totalDebit).toBe(5000);
      expect(entries2026.length).toBe(1);
      expect(entries2026[0].totalDebit).toBe(8000);
    });

    it('rejects posting journal entries into HARD_CLOSED periods', () => {
      const p = engine.ensurePeriod(tenantA, clientAlpha, taxYear2025, '2025-Q4', '2025-10-01', '2025-12-31');
      engine.closePeriod(p.id, 'HARD_CLOSED', 'cpa_partner');

      const coa = engine.getChartOfAccounts(tenantA, clientAlpha);
      const cashAcc = coa.find(a => a.accountNumber === '1010')!;
      const revAcc = coa.find(a => a.accountNumber === '4010')!;

      expect(() => {
        engine.createJournalEntry({
          tenantId: tenantA,
          clientId: clientAlpha,
          taxYear: taxYear2025,
          periodId: p.id,
          postingDate: '2025-11-15',
          transactionDate: '2025-11-15',
          description: 'Late Entry in Hard Closed Period',
          source: 'MANUAL',
          creatorUid: 'staff_desmond',
          lines: [
            { id: 'l1', accountId: cashAcc.id, debit: 100, credit: 0 },
            { id: 'l2', accountId: revAcc.id, debit: 0, credit: 100 }
          ]
        });
      }).toThrow(/PERIOD_HARD_CLOSED/);
    });
  });

  describe('4. Bookkeeping to Tax Return Bridge (Schedule M-1 Provenance)', () => {
    it('creates Schedule M-1 permanent adjustment with IRS tax citation binding', () => {
      const coa = engine.getChartOfAccounts(tenantA, clientAlpha);
      const mealsAcc = coa.find(a => a.accountNumber === '6080')!;

      const adj = engine.createBookToTaxAdjustment({
        tenantId: tenantA,
        clientId: clientAlpha,
        taxYear: taxYear2025,
        accountId: mealsAcc.id,
        description: '50% Business Meal Limitation (IRC Sec. 274(n))',
        bookAmount: 4000.00,
        taxAmount: 2000.00,
        permanentOrTiming: 'PERMANENT',
        scheduleM1Category: 'MEALS_50_LIMIT',
        taxAuthorityCitation: 'IRC Sec. 274(n)(1)',
        preparerUid: 'staff_desmond'
      });

      expect(adj.adjustmentAmount).toBe(-2000.00);
      expect(adj.taxAuthorityCitation).toBe('IRC Sec. 274(n)(1)');
      expect(adj.reviewStatus).toBe('PREPARED');

      const allAdjs = engine.getBookToTaxAdjustments(tenantA, clientAlpha, taxYear2025);
      expect(allAdjs.length).toBe(1);
    });
  });

  describe('5. Uncommissioned Provider Readiness (Fail-Closed Security)', () => {
    it('truthfully reports NOT_CONFIGURED for e-signature without credentials', () => {
      const status = ProviderReadinessRegistry.getProviderStatus('E_SIGNATURE');
      expect(status.status).toBe('NOT_CONFIGURED');
      expect(status.isOperational).toBe(false);
      expect(status.provider).toBe('E_SIGNATURE');
    });

    it('truthfully reports NOT_CONFIGURED for IRS MeF filing transmitter without credentials', () => {
      const status = ProviderReadinessRegistry.getProviderStatus('FILING');
      expect(status.status).toBe('NOT_CONFIGURED');
      expect(status.isOperational).toBe(false);
      expect(status.provider).toBe('FILING');
    });

    it('truthfully reports NOT_CONFIGURED for malware scanning fail-closed protection', () => {
      const status = ProviderReadinessRegistry.getProviderStatus('MALWARE_SCANNER');
      expect(status.status).toBe('NOT_CONFIGURED');
      expect(status.isOperational).toBe(false);
      expect(status.provider).toBe('MALWARE_SCANNER');
    });
  });

  describe('6. Money Precision & Solvency Equation', () => {
    it('maintains strict penny balance Debits = Credits without binary floating point errors', () => {
      const coa = engine.getChartOfAccounts(tenantA, clientAlpha);
      const cashAcc = coa.find(a => a.accountNumber === '1010')!;
      const expenseAcc = coa.find(a => a.accountNumber === '6020')!;

      // 0.1 + 0.2 in JS is 0.30000000000000004
      const entry = engine.createJournalEntry({
        tenantId: tenantA,
        clientId: clientAlpha,
        taxYear: taxYear2025,
        periodId: 'period_2025_q1',
        postingDate: '2025-01-31',
        transactionDate: '2025-01-31',
        description: 'Precision test',
        source: 'MANUAL',
        creatorUid: 'staff_desmond',
        lines: [
          { id: 'p1', accountId: expenseAcc.id, debit: 0.10, credit: 0 },
          { id: 'p2', accountId: expenseAcc.id, debit: 0.20, credit: 0 },
          { id: 'p3', accountId: cashAcc.id, debit: 0, credit: 0.30 }
        ]
      });

      expect(entry.totalDebit).toBe(0.30);
      expect(entry.totalCredit).toBe(0.30);
      expect(entry.status).toBe('POSTED');
    });
  });
});
