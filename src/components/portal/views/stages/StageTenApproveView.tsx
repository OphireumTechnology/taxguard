import React from 'react';

interface StageTenApproveViewProps {
  clientId: string;
  selectedTaxYear: number;
  clientName?: string;
  onNavigateToStageEleven?: () => void;
  onServerWorkflowRefresh?: () => void;
}

/** Approval requires recorded evidence and an authorized server action. */
export const StageTenApproveView: React.FC<StageTenApproveViewProps> = ({ selectedTaxYear }) => (
  <section className="max-w-7xl mx-auto p-6 space-y-4">
    <h1 className="text-xl font-bold">Stage 10 of 18 · Approve</h1>
    <p>Tax Year {selectedTaxYear}</p>
    <p role="status">Return approval is unavailable. No authorized approval service or recorded return package is connected to this view.</p>
    <p>Return figures, preparer verification and taxpayer approval cannot be confirmed here. Approval, electronic signature and filing are separate workflow steps.</p>
    <button type="button" disabled className="px-4 py-2 rounded border disabled:opacity-50">Submit Taxpayer Return Approval</button>
  </section>
);
