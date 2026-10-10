export interface ClientServiceCase {id:string;clientId:string;engagementId:string;taxYear:number;stage:number;status:string;documents:Record<string,number>}
export interface ClientServiceRequest {id:string;caseKey:string;type:string;status:string;priority:string;createdAt?:string;dueDate?:string}
export interface ClientServiceThread {id:string;caseKey:string;category:string;status:string;lastMessageAt?:string;messageCount:number;unread:number}
export interface ClientServiceFollowUp {id:string;caseKey:string;type:string;status:string;priority:string;createdAt?:string;dueDate?:string;owner?:string}
export interface ClientServiceEscalation {id:string;caseKey:string;category:string;status:string;level:number;dueDate:string;createdAt?:string}
export interface ClientServiceSnapshot {tenantId:string;cases:ClientServiceCase[];requests:ClientServiceRequest[];threads:ClientServiceThread[];followUps:ClientServiceFollowUp[];escalations:ClientServiceEscalation[];capabilities:{appointments:false;mutations:false;sla:false;ai:false;privateDocuments:false}}
export interface ClientServiceConversation {tenantId:string;caseKey:string;threadId:string;messages:Array<{id:string;role:string;content:string;read:boolean;createdAt:string}>}
export interface ClientServiceRequestDetail {tenantId:string;caseKey:string;requestId:string;title:string;description?:string;status:string}
