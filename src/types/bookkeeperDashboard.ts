export interface BookkeeperSnapshot {
  scope: {tenantId: string; clientId: string; taxYear: number; periodId?: string};
  transactions: Array<{id:string; date:string; description:string; amount:number; category?:string; source:string; classification:string; reconciliation:string; duplicate:string; documentCount:number; journalEntryId?:string; ai?:{account:string; confidence:number; reasoning:string}}>;
  accounts: Array<{id:string; number:string; name:string; type:string; active:boolean}>;
  journals: Array<{id:string; number:string; date:string; description:string; debit:number; credit:number; status:string; adjusting:boolean; creator:string; reviewer?:string; source:string; documentCount:number}>;
  reconciliations: Array<{id:string; start:string; end:string; status:string; variance:number; matched:number; exceptions:Array<{id:string; type:string; amount:number; status:string; notes?:string; resolution?:string}>}>;
  periods: Array<{id:string; name:string; start:string; end:string; status:string}>;
  capabilities: {mutations:false; periodClose:false; privateDocumentPreview:false};
}
