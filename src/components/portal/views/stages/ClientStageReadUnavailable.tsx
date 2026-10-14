import React from 'react';

const unavailableStages: Readonly<Record<string, { number: number; name: string; reason: string }>> = {
  stage_04: { number: 4, name: 'Record', reason: 'A scoped reviewed-record provider is required.' },
  stage_05: { number: 5, name: 'Reconcile', reason: 'A scoped reconciliation provider is required.' },
  stage_06: { number: 6, name: 'Review', reason: 'Recorded review evidence and professional decisions are required.' },
  stage_07: { number: 7, name: 'Report', reason: 'A scoped reporting provider is required.' },
  stage_08: { number: 8, name: 'Plan', reason: 'Reviewed facts and authorized professional planning evidence are required.' },
};

/** Do not infer tenant/engagement scope or use sample authority in live routes. */
export function unavailableClientStage(nav: string) {
  // Stages 09-18 use TaxStageStatusView (canonical stage capabilities).
  const canonical = nav === 'review' ? 'stage_06' : nav;
  return unavailableStages[canonical];
}

export const ClientStageReadUnavailable: React.FC<{ nav: string; taxYear: number }> = ({ nav, taxYear }) => {
  const stage = unavailableClientStage(nav);
  if (!stage) return null;
  return <section className="max-w-7xl mx-auto p-6 space-y-4">
    <h1 className="text-xl font-bold">Stage {stage.number} of 18 · {stage.name}</h1>
    <p>Selected Tax Year {taxYear}</p>
    <p role="status">This stage workspace is unavailable. {stage.reason}</p>
    <p>No sample records, completion status or professional certification are substituted.</p>
  </section>;
};
