import { selectLedger } from './taxguard/bookkeeping/ledgerBackend';

// New roles receive no legacy tax or administrative authority by default.
const BASE_GET = ['/api/bookkeeping/bookkeeper-clients', '/api/bookkeeping/bookkeeper-dashboard', '/api/auth/me', '/api/auth/session'];
// Durable ledger work a bookkeeper may perform. Everything they post is forced into independent
// review by the database; approvals, period close / reopen, account status, sync and
// book-to-tax are deliberately absent.
const LEDGER_GET = /^\/api\/bookkeeping\/(work-queue|chart-of-accounts|journal-entries|periods|transactions|reconciliations|trial-balance|financial-statements|general-ledger|history)$/;
const LEDGER_POST = /^\/api\/bookkeeping\/(chart-of-accounts\/standard|journal-entries|journal-entries\/[^/]+\/reverse|periods|transactions\/ingest|transactions\/[^/]+\/categorize|reconciliations\/start|reconciliations\/[^/]+\/(clear|finalize))$/;

export function bookkeeperRequestAllowed(role:string,method:string,url:string):boolean {
  if(role!=='bookkeeper')return true;
  const path=url.split('?')[0];
  if ((method==='GET' && BASE_GET.includes(path)) || (method==='POST' && path==='/api/auth/logout')) return true;
  if (selectLedger().mode !== 'durable') return false;
  return (method === 'GET' && LEDGER_GET.test(path)) || (method === 'POST' && LEDGER_POST.test(path));
}
