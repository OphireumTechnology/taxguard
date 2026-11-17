import { beforeAll, expect, it } from 'vitest';
import type { SqlLedgerStore } from '../../server/taxguard/bookkeeping/sqlLedgerStore';
import { generalLedger as boundedGeneralLedger } from '../../server/taxguard/bookkeeping/ledgerReports';

export const phase15IsolationSeed = `
  INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid) VALUES('tenantB','clientA','foreign-owner') ON CONFLICT DO NOTHING;
  INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES
    ('tenantA','phase15-admin','admin','active'),('tenantB','phase15-admin','admin','active') ON CONFLICT DO NOTHING;`;

export function registerPhase15Reporting(getStore: () => SqlLedgerStore) {
let store: SqlLedgerStore;
const scope = { tenantId: 'tenantA', clientId: 'clientA' };
beforeAll(async () => {
  store = getStore();
  await store.createAccounts(scope, 'preparer', [
    { id: 'p15-cash', accountNumber: '1010', accountName: 'Cash', accountType: 'ASSET', accountSubtype: 'CASH_AND_EQUIVALENTS' },
    { id: 'p15-income', accountNumber: '4010', accountName: 'Income', accountType: 'REVENUE', accountSubtype: 'SERVICE_REVENUE' },
  ]);
}, 60000);
it('reconciles 499, 500, 501 and 1001 posted entries against complete trial balance', async () => {
  for (let n = 1; n <= 1001; n++) {
    await store.postEntry(scope, 'preparer', { idempotencyKey: `phase15-${n}`, taxYear: 2025, postingDate: '2025-02-10', description: 'Synthetic one dollar',
      lines: [{ accountId: 'p15-cash', debit: 1, credit: 0 }, { accountId: 'p15-income', debit: 0, credit: 1 }] });
    if (![499, 500, 501, 1001].includes(n)) continue;
    const bounded = await store.read(scope, 'preparer', 2025, { status: 'POSTED', limit: 500, accountId: 'p15-cash' });
    const legacy = boundedGeneralLedger(bounded.accounts.map(a => ({ accountId: a.id, accountNumber: a.accountNumber,
      accountName: a.accountName, accountType: a.accountType })), bounded.rawEntries.map(e => ({ ...e,
      lines: e.lines.map((l: any) => ({ ...l, debitCents: Number(l.debitCents), creditCents: Number(l.creditCents) })) })), 'p15-cash')[0];
    const gl = (await store.generalLedger(scope, 'preparer', 2025, 'p15-cash'))[0];
    const tb = (await store.trialBalance(scope, 'preparer', 2025)).items.find(a => a.accountId === 'p15-cash')!;
    console.log(JSON.stringify({ entries: n, legacyBalance: legacy.endingBalance, detailLines: gl.lines.length, generalLedger: gl.endingBalance, trialBalance: tb.endingDebit }));
    expect.soft(legacy.endingBalance).toBe(Math.min(n, 500));
    expect.soft(gl.endingBalance).toBe(n);
    expect.soft(gl.endingBalance).toBe(tb.endingDebit);
    expect.soft(gl.lines.length).toBe(Math.min(n, 500));
    expect.soft(gl.totalLineCount).toBe(n);
    expect.soft(gl.detailTruncated).toBe(n > 500);
    expect.soft(gl.lines.at(-1)!.runningBalance).toBe(n);
  }
}, 60000);

it('keeps opening balances, cutoffs, approved reversals and display limits independent', async () => {
  const post = (key: string, postingDate: string, amount: number) => store.postEntry(scope, 'preparer', {
    idempotencyKey: key, taxYear: Number(postingDate.slice(0, 4)), postingDate, description: 'Synthetic period fixture',
    lines: [{ accountId: 'p15-cash', debit: amount, credit: 0 }, { accountId: 'p15-income', debit: 0, credit: amount }] });
  await post('phase15-prior', '2023-12-31', 12.34);
  const original = await post('phase15-original', '2024-01-10', 3.21);
  await post('phase15-february', '2024-02-10', 1.11);
  const reversal = await store.reverseEntry(scope, 'preparer', { idempotencyKey: 'phase15-reversal', entryId: original.id,
    postingDate: '2024-03-01', reason: 'Synthetic approved reversal' });
  const report = async (toDate: string, limit = 500, fromDate?: string) =>
    (await store.generalLedger(scope, 'preparer', 2024, 'p15-cash', { toDate, limit, ...(fromDate ? { fromDate } : {}) }))[0];
  expect((await report('2024-03-31')).endingBalance).toBe(16.66);
  await store.reviewEntry(scope, 'reviewer', reversal.id, 'approve', reversal.version);
  const january = await report('2024-01-31');
  expect(january).toMatchObject({ openingBalance: 12.34, endingBalance: 15.55, totalLineCount: 1 });
  expect((await report('2024-02-29')).endingBalance).toBe(16.66);
  const march = await report('2024-03-31', 1);
  expect(march).toMatchObject({ openingBalance: 12.34, endingBalance: 13.45, totalLineCount: 3, detailTruncated: true });
  expect(march.lines[0]).toMatchObject({ credit: 3.21, runningBalance: 13.45 });
  expect((await report('2024-03-31', 500, '2024-02-01')).openingBalance).toBe(15.55);
  for (const limit of [1, 2, 500]) {
    const gl = await report('2024-03-31', limit);
    const tb = (await store.trialBalance(scope, 'preparer', 2024, '2024-03-31')).items.find(a => a.accountId === 'p15-cash')!;
    expect(gl.endingBalance).toBe(tb.endingDebit - tb.endingCredit);
    expect(gl.lines.at(-1)!.runningBalance).toBe(gl.endingBalance);
  }
  const all = await store.generalLedger(scope, 'preparer', 2024);
  expect(all.map(a => a.endingBalance)).toEqual([13.45, 13.45]);
  console.log(JSON.stringify({ january: january.endingBalance, beforeReversal: 16.66, march: march.endingBalance,
    opening: march.openingBalance, limitedLines: march.lines.length }));
  for (const [tenantId, clientId] of [['tenantA', 'clientB'], ['tenantB', 'clientA']]) {
    await expect(store.generalLedger({ tenantId, clientId }, 'preparer', 2024)).rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED' });
  }
  await expect(store.generalLedger(scope, 'nobody', 2024)).rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED' });
  for (const filter of [{ limit: 0 }, { limit: 501 }, { fromDate: '2023-12-31' }, { toDate: 'invalid' }, { fromDate: '2024-04-01', toDate: '2024-03-31' }]) {
    await expect(store.generalLedger(scope, 'preparer', 2024, undefined, filter)).rejects.toMatchObject({ code: 'LEDGER_INPUT_INVALID' });
  }
});

it('isolates real foreign balances and orders repeated account lines deterministically', async () => {
  for (const [index, foreign] of [{ tenantId: 'tenantA', clientId: 'clientB' }, { tenantId: 'tenantB', clientId: 'clientA' }].entries()) {
    await store.createAccounts(foreign, 'phase15-admin', [
      { id: `foreign-cash-${index}`, accountNumber: '1010', accountName: 'Foreign Cash', accountType: 'ASSET', accountSubtype: 'CASH_AND_EQUIVALENTS' },
      { id: `foreign-income-${index}`, accountNumber: '4010', accountName: 'Foreign Income', accountType: 'REVENUE', accountSubtype: 'SERVICE_REVENUE' },
    ]);
    await store.postEntry(foreign, 'phase15-admin', { idempotencyKey: 'foreign-fixture', taxYear: 2022, postingDate: '2022-01-01', description: 'Foreign balance',
      lines: [{ accountId: `foreign-cash-${index}`, debit: 999, credit: 0 }, { accountId: `foreign-income-${index}`, debit: 0, credit: 999 }] });
    expect((await store.generalLedger(foreign, 'phase15-admin', 2022))[0].endingBalance).toBe(999);
    expect(await store.generalLedger(scope, 'preparer', 2022, `foreign-cash-${index}`)).toEqual([]);
  }
  await store.postEntry(scope, 'preparer', { idempotencyKey: 'repeated-lines', taxYear: 2022, postingDate: '2022-01-01', description: 'Repeated account',
    lines: [{ accountId: 'p15-cash', debit: 1.01, credit: 0 }, { accountId: 'p15-cash', debit: 2.02, credit: 0 }, { accountId: 'p15-income', debit: 0, credit: 3.03 }] });
  const all = await store.generalLedger(scope, 'preparer', 2022);
  expect(all.map(a => a.endingBalance)).toEqual([3.03, 3.03]);
  expect(all[0].lines.map(l => l.runningBalance)).toEqual([1.01, 3.03]);
  const limited = await store.generalLedger(scope, 'preparer', 2022, 'p15-cash', { limit: 1 });
  expect(limited[0]).toMatchObject({ endingBalance: 3.03, totalLineCount: 2, detailTruncated: true });
  expect(limited[0].lines).toEqual(all[0].lines.slice(-1));
  expect(await store.generalLedger(scope, 'preparer', 2022, 'p15-cash', { limit: 1 })).toEqual(limited);
});
}
