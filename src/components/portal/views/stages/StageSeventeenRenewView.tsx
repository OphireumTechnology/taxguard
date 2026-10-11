import React from 'react';

interface StageSeventeenRenewViewProps {
  clientId: string;
  selectedTaxYear: number;
  clientName?: string;
  onCommissionNewTaxYear?: (nextYear: number) => void;
}

/** Prior-year records do not authorize a new engagement or consent. */
export const StageSeventeenRenewView: React.FC<StageSeventeenRenewViewProps> = ({ selectedTaxYear }) => (
  <section className="max-w-7xl mx-auto p-6 space-y-4">
    <h1 className="text-xl font-bold">Stage 17 of 18 · Renew</h1>
    <p>Selected Tax Year {selectedTaxYear}</p>
    <p role="status">Engagement renewal is unavailable. An authorized renewal service and new-year engagement records are required.</p>
    <p>No new tax year has been commissioned here. Prior-year documents and consent do not establish new-year authorization.</p>
    <button type="button" disabled className="px-4 py-2 rounded border disabled:opacity-50">Commission New Tax Year Engagement</button>
  </section>
);
