import React from 'react';
import { TeamWorkloadPanel } from '../workspace/TeamWorkloadPanel';

const UNAVAILABLE = 'Durable authorized caseload and task integration is unavailable. Use your existing authorized role workspace for recorded case information.';

/** The administrator's Caseload & Tasks tab: the durable team workload (Block 84), or the unavailable notice without the durable store. */
export function AdminWorkloadPanel() {
  return <section aria-labelledby="admin-workload-heading" className="space-y-4 text-slate-300">
    <h1 id="admin-workload-heading" className="text-xl font-bold text-white">Caseload &amp; Tasks</h1>
    <TeamWorkloadPanel unavailableText={UNAVAILABLE} />
  </section>;
}
