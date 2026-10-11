import React from 'react';

const unavailableStages: Readonly<Record<string, { number: number; name: string; reason: string }>> = {
  stage_04: { number: 4, name: 'Record', reason: 'A scoped reviewed-record provider is required.' },
  stage_05: { number: 5, name: 'Reconcile', reason: 'A scoped reconciliation provider is required.' },
  stage_06: { number: 6, name: 'Review', reason: 'Recorded review evidence and professional decisions are required.' },
  stage_07: { number: 7, name: 'Report', reason: 'A scoped reporting provider is required.' },
  stage_08: { number: 8, name: 'Plan', reason: 'Reviewed facts and authorized professional planning evidence are required.' },
  stage_09: { number: 9, name: 'Prepare Taxes', reason: 'An authorized engagement scope and recorded calculation package are required.' },
  stage_14: { number: 14, name: 'Resolve', reason: 'A scoped agency-notice provider is required; exception counts are unknown.' },
  stage_15: { number: 15, name: 'Monitor', reason: 'Recorded monitoring events and verified applicable deadlines are required.' },
  stage_16: { number: 16, name: 'Archive', reason: 'A scoped archive provider and approved retention policy are required.' },
  stage_18: { number: 18, name: 'Repeat', reason: 'Authorized engagement and annual carryforward records are required.' },
};

/** Do not infer tenant/engagement scope or use sample authority in live routes. */
export function unavailableClientStage(nav: string) {
  const canonical = nav === 'review' ? 'stage_06' : nav === 'tax_prep' ? 'stage_09' : nav === 'completed' ? 'stage_15' : nav;
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
