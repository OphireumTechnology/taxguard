import type {BookkeeperSnapshot} from '../../types/bookkeeperDashboard';
export const BOOKKEEPER_MODULES=['Dashboard','Transactions','Reconciliation','Chart of Accounts','Reports','Audit Trail'] as const;
export function bookkeeperKpis(data:BookkeeperSnapshot) {
  return {records:data.transactions.length,uncategorized:data.transactions.filter(t=>!['ACCOUNTANT_APPROVED','POSTED'].includes(t.classification) || t.reconciliation==='UNRECONCILED').length,reconciled:data.transactions.filter(t=>t.reconciliation==='RECONCILED').length,exceptions:data.reconciliations.flatMap(r=>r.exceptions).filter(e=>e.status!=='RESOLVED').length,readyToClose:null};
}
export function transactionMatches(t:BookkeeperSnapshot['transactions'][number],filter:string) {
  return filter==='Needs Classification / Match'? (!['ACCOUNTANT_APPROVED','POSTED'].includes(t.classification) || t.reconciliation==='UNRECONCILED'):filter==='Uncategorized'? !['ACCOUNTANT_APPROVED','POSTED'].includes(t.classification):filter==='Reconciled'?t.reconciliation==='RECONCILED':filter==='Unmatched'?t.reconciliation==='UNRECONCILED':filter==='Exceptions'?t.duplicate!=='NOT_DUPLICATE' || t.classification==='REJECTED':true;
}
