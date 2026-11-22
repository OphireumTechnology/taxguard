export interface TaxGuardDiscrepancy {
  id: string;
  clientId?: string;
  ruleCode: string;
  title: string;
  taxYear: number;
  neutralDescription: string;
  status: 'open' | 'under_review' | 'resolved';
  severity?: 'low' | 'medium' | 'high';
  affectedDocuments: string[];
  recommendedAction: string;
  reviewerNotes?: string;
  reviewedBy?: string;
  resolvedAt?: string;
}
