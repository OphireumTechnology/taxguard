import React, { useState } from 'react';
import { PracticeRequestError, practiceService, type PracticeSearch } from '../../services/practiceService';
import { ENTITY_LABELS } from '../workspace/PracticeOperationsPanel';

const UNAVAILABLE = 'Authorized multi-entity search is unavailable in this workspace. No taxpayer, document or invoice dataset is substituted.';

/**
 * Practice-wide search for administrators over the durable records (proposal 20261019280000): clients, cases, tasks and
 * document requests. Administrators see the whole practice by the same rule as practice managers. Invoices are not
 * searched. Falls back to the unavailable notice when the durable practice store is not enabled.
 */
export function AdminPracticeSearchPanel() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'off' | 'error'; data?: PracticeSearch }>({ status: 'idle' });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) { setState({ status: 'error' }); return; }
    setState({ status: 'loading' });
    try { setState({ status: 'ready', data: await practiceService.search(query.trim(), 50) }); }
    catch (e) { setState({ status: e instanceof PracticeRequestError && e.status === 503 ? 'off' : 'error' }); }
  };
  return <section aria-labelledby="admin-search-heading" className="space-y-4 text-slate-300">
    <h1 id="admin-search-heading" className="text-xl font-bold text-white">Global Practice Search</h1>
    {state.status === 'off' ? <p role="status">{UNAVAILABLE}</p> : <>
      <form onSubmit={submit} role="search" aria-label="Search the practice" className="flex flex-wrap gap-2 items-end">
        <label htmlFor="admin-search-input">Search clients, cases, tasks and document requests</label>
        <input id="admin-search-input" value={query} minLength={2} maxLength={100} onChange={e => setQuery(e.target.value)} className="text-slate-900" />
        <button type="submit" className="p-2 rounded-lg border border-slate-500">Search</button>
      </form>
      <p className="text-xs">Invoices are not searched here.</p>
      {state.status === 'loading' && <p role="status">Searching…</p>}
      {state.status === 'error' && <p role="alert">Enter at least two characters. If you did, the search could not be completed.</p>}
      {state.data && (state.data.matches.length === 0 ? <p role="status">No records match “{state.data.query}”.</p> :
        <div className="overflow-x-auto"><table className="w-full text-left text-xs">
          <caption className="text-left py-2">{state.data.totalMatches} match{state.data.totalMatches === 1 ? '' : 'es'}{state.data.totalMatches > state.data.matches.length ? `, showing ${state.data.matches.length}` : ''}</caption>
          <thead><tr>{['Type', 'Record', 'Client', 'Tax year', 'Status'].map(h => <th key={h} scope="col" className="p-2">{h}</th>)}</tr></thead>
          <tbody>{state.data.matches.map(m => <tr key={m.entityType + m.id} className="border-t border-slate-700"><td className="p-2">{ENTITY_LABELS[m.entityType]}</td>
            <td className="p-2">{m.label}</td><td className="p-2">{m.clientId}</td><td className="p-2">{m.taxYear ?? '—'}</td><td className="p-2">{m.status}</td></tr>)}</tbody></table></div>)}
    </>}
  </section>;
}
