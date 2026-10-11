import React from 'react';
import type { ReportedProvider } from '../../hooks/useAdminProviderReadiness';

const unavailable: Record<string, [string, string]> = {
  users: ['Practice Staff & Roles', 'Verified tenant staff, role and assignment records are unavailable in this workspace. No example users, MFA claims or workload counts are substituted.'],
  workload: ['Caseload & Tasks', 'Durable authorized caseload and task integration is unavailable. Use your existing authorized role workspace for recorded case information.'],
  billing: ['Catalog & Invoicing', 'Authorized invoice, payment and balance integration is unavailable in this workspace. No payment or refund action is released.'],
  jobs: ['Durable Job Queue', 'Verified queue, worker leases and dead-letter records are unavailable in this workspace. No worker activity or completed jobs are inferred.'],
  search: ['Global Practice Search', 'Authorized multi-entity search is unavailable in this workspace. No taxpayer, document or invoice dataset is substituted.'],
  retention: ['Retention & Rollover', 'Verified retention policy, legal hold and archive records are unavailable in this workspace. No compliance certification, deletion eligibility or rollover action is inferred.'],
  audit: ['Compliance Audit Log', 'Durable tenant-scoped audit events are unavailable in this workspace. No consent, approval, hash seal or stage-transition event is generated for display.'],
};

export function AdminOperationalPanel({ tab, status, providers, onRefresh }: {tab: string; status: 'loading' | 'ready' | 'error'; providers: ReportedProvider[]; onRefresh: () => void}) {
  if (tab !== 'providers') {
    const [title, description] = unavailable[tab] || ['Administration', 'This integration is unavailable.'];
    return <section className="space-y-4 text-slate-300"><h1 className="text-xl font-bold text-white">{title}</h1><p role="status">{description}</p></section>;
  }
  return <section className="space-y-4 text-slate-300"><div className="flex flex-wrap justify-between gap-3"><h1 className="text-xl font-bold text-white">Reported Provider Configuration</h1>
    <button type="button" onClick={onRefresh} disabled={status === 'loading'} className="p-2 rounded-lg border border-slate-500">Refresh provider report</button></div>
    <p>Reported configuration does not prove connectivity, schema readiness, production commissioning or permission to execute. Existing server gates remain controlling.</p>
    {status === 'loading' ? <p role="status">Loading the provider report...</p> : status === 'error' ? <p role="alert">Provider report unavailable. Retry to restore access.</p> : !providers.length ? <p role="status">No provider records were returned. Readiness is unknown.</p> :
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="text-left py-2">Configuration reported by the existing provider registry</caption><thead><tr><th scope="col" className="p-3">Provider</th><th scope="col" className="p-3">Reported status</th><th scope="col" className="p-3">Registry description</th><th scope="col" className="p-3">Reported at</th></tr></thead><tbody>{providers.map(provider => <tr key={provider.provider} className="border-t border-slate-700"><td className="p-3">{provider.provider}</td><td className="p-3">{provider.status}</td><td className="p-3">{provider.description}</td><td className="p-3"><time dateTime={provider.lastChecked}>{provider.lastChecked}</time></td></tr>)}</tbody></table></div>}
  </section>;
}
