import { BookkeepingEngine } from './taxguard/bookkeeping/bookkeeping.engine';
import type { BookkeeperSnapshot } from '../types/bookkeeperDashboard';
export function projectBookkeeper(engine: BookkeepingEngine, tenantId:string, clientId:string, taxYear:number, periodId?:string):BookkeeperSnapshot {
  const periods=engine.getPeriods(tenantId,clientId,taxYear);
  const period=periodId?periods.find(p=>p.id===periodId):undefined;
  if(periodId && !period) throw new Error('PERIOD_ACCESS_DENIED');
  const inDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date) && Number(date.slice(0,4))===taxYear && (!period || (date>=period.startDate && date<=period.endDate));
  const accounts=engine.getChartOfAccounts(tenantId,clientId);
  const accountName=(id?:string)=>accounts.find(a=>a.id===id)?.accountName;
  const journals=engine.getJournalEntries(tenantId,clientId,taxYear).filter(j=>!period || j.periodId===period.id);
  return {
    scope:{tenantId,clientId,taxYear,periodId},
    accounts:accounts.map(a=>({id:a.id,number:a.accountNumber,name:a.accountName,type:a.accountType,active:a.isActive})),
    periods:periods.map(p=>({id:p.id,name:p.periodName,start:p.startDate,end:p.endDate,status:p.status})),
    transactions:engine.getTransactions(tenantId,clientId).filter(t=>inDate(t.transactionDate)).map(t=>({id:t.id,date:t.transactionDate,description:t.description,amount:t.amount,category:accountName(t.assignedAccountId),source:t.provider,classification:t.classificationStatus,reconciliation:t.reconciliationStatus,duplicate:t.duplicateStatus,documentCount:t.matchedDocumentIds.length,journalEntryId:journals.some(j=>j.id===t.journalEntryId)?t.journalEntryId:undefined,ai:t.aiProposal?{account:accountName(t.aiProposal.suggestedAccountId)||'Account unavailable',confidence:t.aiProposal.confidence,reasoning:t.aiProposal.reasoning}:undefined})),
    journals:journals.map(j=>({id:j.id,number:j.entryNumber,date:j.transactionDate,description:j.description,debit:j.totalDebit,credit:j.totalCredit,status:j.status,adjusting:j.isAdjusting,creator:j.creatorUid,reviewer:j.reviewerUid,source:j.source,documentCount:j.documentProvenanceIds.length})),
    reconciliations:engine.getReconciliations(tenantId,clientId,taxYear).filter(r=>!period || (r.statementPeriodStart>=period.startDate && r.statementPeriodEnd<=period.endDate)).map(r=>({id:r.id,start:r.statementPeriodStart,end:r.statementPeriodEnd,status:r.status,variance:r.variance,matched:r.clearedTransactionsCount,exceptions:r.exceptions.map(e=>({id:e.id,type:e.type,amount:e.amount,status:e.status,notes:e.notes,resolution:e.resolutionExplanation}))})),
    capabilities:{mutations:false,periodClose:false,privateDocumentPreview:false},
  };
}
