import { describe, it, expect } from 'vitest';
import { bookkeepingService, BookkeepingRequestError } from '../src/services/bookkeepingService';
import { bookToTaxApi, centsText, newB2tKey, BookToTaxRequestError } from '../src/services/bookToTaxService';
import { jobService, jobActions, JobRequestError } from '../src/services/jobService';
import { clientPortalContracts, portalErrorMessage } from '../src/services/clientPortalContracts';
import { collectionClient, submitWaiverClaim } from '../src/services/collectionClient';
import { billingApiService, billingApi, newBillingKey, BillingRequestError } from '../src/services/billingApiService';

describe('Bookkeeping Service Module', () => {
  it('generates unique idempotency keys with proper prefix', () => {
    const key1 = bookkeepingService.newIdempotencyKey();
    const key2 = bookkeepingService.newIdempotencyKey();
    expect(key1).toMatch(/^idem_\d+_\d+_[a-z0-9]+$/);
    expect(key1).not.toBe(key2);
  });

  it('fetches chart of accounts with active accounts and correct balances', async () => {
    const res = await bookkeepingService.getChartOfAccounts('client_1', 2025);
    expect(res.accounts).toBeDefined();
    expect(res.accounts.length).toBeGreaterThan(0);
    const operatingCash = res.accounts.find(a => a.accountNumber === '1010');
    expect(operatingCash).toBeDefined();
    expect(operatingCash?.accountType).toBe('ASSET');
    expect(operatingCash?.isActive).toBe(true);
  });

  it('loads work queue with categorizations and periods', async () => {
    const queue = await bookkeepingService.getWorkQueue('client_1', 2025);
    expect(queue.periods.length).toBeGreaterThan(0);
    expect(queue.periods[0].periodName).toBe('2025-Q1');
    expect(queue.uncategorized.length).toBeGreaterThan(0);
  });

  it('provides balanced trial balance records', async () => {
    const tb = await bookkeepingService.getTrialBalance('client_1', 2025);
    expect(tb.trialBalance.isBalanced).toBe(true);
    expect(tb.trialBalance.totalDebit).toBe(tb.trialBalance.totalCredit);
  });

  it('handles period lifecycle operations cleanly', async () => {
    const newPeriod = await bookkeepingService.openPeriod('client_1', 2025, '2025-Q3', '2025-07-01', '2025-09-30');
    expect(newPeriod.periodName).toBe('2025-Q3');
    expect(newPeriod.status).toBe('OPEN');

    const closeRes = await bookkeepingService.closePeriod('client_1', 2025, newPeriod.id, 'SOFT_CLOSED');
    expect(closeRes.success).toBe(true);

    const reopenRes = await bookkeepingService.reopenPeriod('client_1', 2025, newPeriod.id, 'Prior period adjustment justification');
    expect(reopenRes.success).toBe(true);
  });

  it('instantiates BookkeepingRequestError with status and code', () => {
    const err = new BookkeepingRequestError('Maker-checker violation', 403, 'MAKER_CHECKER_VIOLATION');
    expect(err.name).toBe('BookkeepingRequestError');
    expect(err.status).toBe(403);
    expect(err.code).toBe('MAKER_CHECKER_VIOLATION');
  });
});

describe('Book-to-Tax Service Module', () => {
  it('formats cents values into localized currency strings', () => {
    expect(centsText(1540000)).toBe('$15,400.00');
    expect(centsText(-250000)).toBe('-$2,500.00');
    expect(centsText(0)).toBe('$0.00');
  });

  it('generates unique b2t idempotency keys', () => {
    const k1 = newB2tKey();
    const k2 = newB2tKey();
    expect(k1).toMatch(/^b2t_\d+_\d+_[a-z0-9]+$/);
    expect(k1).not.toBe(k2);
  });

  it('loads return family categories for tax classification', async () => {
    const cats = await bookToTaxApi.categories('1120S');
    expect(cats.items.length).toBeGreaterThan(0);
    const meals = cats.items.find(c => c.categoryCode === 'EXP_MEALS');
    expect(meals).toBeDefined();
    expect(meals?.label).toContain('Business Meals');
  });

  it('loads overview with approved mapping sets and workpaper reconciliation', async () => {
    const overview = await bookToTaxApi.overview('client_1', 2025, '1120S');
    expect(overview.mappingSets.length).toBeGreaterThan(0);
    expect(overview.workpapers.length).toBeGreaterThan(0);
    expect(overview.workpapers[0].reconciled).toBe(true);
  });
});

describe('Durable Job Queue Service Module', () => {
  it('correctly maps job actions according to lifecycle status', () => {
    expect(jobActions('FAILED')).toEqual({ retry: true, cancel: false });
    expect(jobActions('DEAD_LETTER')).toEqual({ retry: true, cancel: false });
    expect(jobActions('QUEUED')).toEqual({ retry: false, cancel: true });
    expect(jobActions('RUNNING')).toEqual({ retry: false, cancel: true });
    expect(jobActions('COMPLETED')).toEqual({ retry: false, cancel: false });
  });

  it('lists recorded jobs with filtering support', async () => {
    const res = await jobService.list();
    expect(res.total).toBeGreaterThan(0);
    expect(res.jobs.length).toBeGreaterThan(0);
    expect(res.jobs[0].id).toBeDefined();
    expect(res.jobs[0].jobType).toBeDefined();
  });
});

describe('Client Portal Contracts Module', () => {
  it('retrieves active client engagements for specified tax year', async () => {
    const res = await clientPortalContracts.engagements('client_1');
    expect(res.items.length).toBeGreaterThan(0);
    const active = res.items.find(e => e.taxYear === 2025);
    expect(active).toBeDefined();
    expect(active?.status).toBe('ACTIVE');
  });

  it('returns structured case stages and system checks', async () => {
    const stages = await clientPortalContracts.caseStages('client_1', 'eng_2025_01', 2025);
    expect(stages.caseStatus).toBe('ACTIVE');
    expect(stages.stages.length).toBe(8);
    const stage4 = stages.stages.find(s => s.stageNumber === 4);
    expect(stage4).toBeDefined();
    expect(stage4?.checks?.length).toBeGreaterThan(0);
  });

  it('formats portal error messages gracefully', () => {
    expect(portalErrorMessage(new Error('Network request failed'))).toBe('Network request failed');
    expect(portalErrorMessage(null)).toBe('The client portal service encountered an unexpected error.');
  });
});

describe('Document Collection Client Module', () => {
  it('exposes collection client status and submission hooks', async () => {
    const status = await collectionClient.getCollectionStatus('client_1');
    expect(status.completed).toBe(true);
  });

  it('handles waiver claim submissions cleanly', async () => {
    const res = await submitWaiverClaim('client_1', 2025, 'req_1099_div', 'Taxpayer does not hold dividend brokerage accounts in 2025');
    expect(res.success).toBe(true);
    expect(res.claimId).toBeDefined();
  });
});

describe('Billing API Service Module', () => {
  it('generates unique billing transaction keys', () => {
    const k1 = newBillingKey();
    const k2 = newBillingKey();
    expect(k1).toMatch(/^bill_key_/);
    expect(k1).not.toBe(k2);
  });

  it('retrieves client invoices and accounts receivable aging', async () => {
    const aging = await billingApiService.aging();
    expect(aging.rows.length).toBeGreaterThan(0);
    expect(aging.rows[0].clientName).toBeDefined();

    const invs = await billingApi.invoices('c1');
    expect(invs.items.length).toBeGreaterThan(0);
    expect(invs.items[0].invoiceNumber).toBeDefined();
  });
});
