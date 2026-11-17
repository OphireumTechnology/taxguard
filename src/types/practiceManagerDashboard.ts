export interface PracticeManagerCase {
 id:string; clientId:string; engagementId:string; taxYear:number; stage:number; status:string; updatedAt?:string;
 owners:string[]; waiting:boolean; review:boolean; dueDates:string[];
}
export interface PracticeManagerSnapshot {
 tenantId:string; cases:PracticeManagerCase[];
 deadlines:Array<{id:string;caseId:string;clientId:string;taxYear:number;dueDate:string;category:string;authority:string;status:string;escalation:number;createdAt?:string;owner?:string}>;
 staff:Array<{id:string;role:string}>;
 capabilities:{managementMutations:false;capacity:false;slaPolicy:false;completionTrends:false;aiAnalysis:false};
}
