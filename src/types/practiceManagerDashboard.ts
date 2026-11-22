export interface PracticeManagerCase {
  id: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  stage: number;
  status: string;
  updatedAt?: string;
  owners: string[];
  waiting: boolean;
  review: boolean;
  dueDates: string[];
  [key: string]: any;
}

export interface PracticeManagerSnapshot {
  tenantId: string;
  cases: PracticeManagerCase[];
  deadlines: Array<{
    id: string;
    caseId: string;
    clientId: string;
    taxYear: number;
    dueDate: string;
    category: string;
    authority?: string;
    owner?: string;
    status: string;
    escalation: number;
    createdAt?: string;
  }>;
  staff: Array<{
    id: string;
    role: string;
  }>;
  capabilities: {
    managementMutations: boolean;
    capacity: boolean;
    slaPolicy: boolean;
    completionTrends: boolean;
    aiAnalysis: boolean;
  };
  [key: string]: any;
}
