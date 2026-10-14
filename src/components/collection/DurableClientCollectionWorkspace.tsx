import React, { useEffect, useId, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api, getStoredToken } from '../../services/api';
import { vaultService } from '../../services/vaultService';
import { submitWaiverClaim } from '../../services/collectionClient';
import { ClientDocumentVaultPanel } from '../documents/ClientDocumentVaultPanel';
import { TaxQuestionnaireModal } from './TaxQuestionnaireModal';

/** Server limits (proposals 053 / 054): applicability claim reason 5–500, reply 2–4000 characters. */
export const CLAIM_LIMITS = { min: 5, max: 500 } as const;
export const REPLY_LIMITS = { min: 2, max: 4000 } as const;

type Compose = { kind: 'claim' | 'reply'; id: string; title: string; target: any };
const button = 'px-3 py-1.5 rounded-lg border border-slate-600 text-xs font-bold hover:border-[#D4A843] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4A843] disabled:opacity-50';

/** No browser checklist, demonstration facts or local workflow completion authority. */
export function DurableClientCollectionWorkspace({ clientId, taxYear }: { clientId: string; taxYear: number }) {
  const { currentUser, authLifecycleState } = useApp();
  const token = getStoredToken();
  const allowed = authLifecycleState === 'AUTHENTICATED' && !!token && currentUser?.status === 'active' && ['client', 'prospective_client'].includes(currentUser.role)
    && currentUser.clientId === clientId && !!currentUser.tenantId;
  const key = JSON.stringify([currentUser?.id, currentUser?.tenantId, clientId, taxYear, token, allowed]);
  const [targets, setTargets] = useState<{ key: string; items: Array<{ engagementId: string; title: string; taxYear: number }> }>({ key: '', items: [] });
  const [engagement, setEngagement] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [compose, setCompose] = useState<Compose | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{ key: string; engagement: string; state: 'loading' | 'ready' | 'error'; value?: any; requests?: any[] }>({ key: '', engagement: '', state: 'loading' });
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();

  useEffect(() => {
    let active = true;
    setEngagement(''); setModal(false); setNotice(null); setCompose(null); setTargets({ key, items: [] });
    if (allowed) void vaultService.uploadTargets(clientId).then(result => {
      if (!active) return;
      const items = result.items.filter(t => t.taxYear === taxYear);
      setTargets({ key, items });
      if (items.length === 1) setEngagement(items[0].engagementId);
    }).catch(() => { if (active) setData({ key, engagement: '', state: 'error' }); });
    return () => { active = false; };
  }, [key]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setData({ key, engagement, state: 'loading' });
    if (allowed && engagement) void Promise.all([
      api.clientDashboard.read<any>('questionnaire', clientId, taxYear, controller.signal, engagement),
      api.clientDashboard.read<any>('requests', clientId, taxYear, controller.signal, engagement),
    ]).then(([value, requests]) => {
      // Every record must belong to this session's tenant, client, year and engagement.
      if (value?.tenantId !== currentUser!.tenantId || value.clientId !== clientId || value.taxYear !== taxYear || value.engagementId !== engagement
        || requests?.tenantId !== currentUser!.tenantId || requests.clientId !== clientId || requests.taxYear !== taxYear || !Array.isArray(requests.requests)) throw new Error('COLLECTION_SCOPE_REQUIRED');
      if (active) setData({ key, engagement, state: 'ready', value, requests: requests.requests });
    }).catch(() => { if (active) setData({ key, engagement, state: 'error' }); });
    return () => { active = false; controller.abort(); };
  }, [key, engagement, refresh]);

  useEffect(() => { if (compose) textRef.current?.focus(); }, [compose]);

  if (!allowed) return <p role="alert">Collection access requires your active client session.</p>;
  const current = data.key === key && data.engagement === engagement ? data : undefined;
  const limits = compose?.kind === 'claim' ? CLAIM_LIMITS : REPLY_LIMITS;
  const trimmed = text.trim();
  const invalid = trimmed.length < limits.min || trimmed.length > limits.max;

  const open = (next: Compose) => { setCompose(next); setText(''); setNotice(null); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compose || busy || invalid) return;
    const sessionToken = token;
    setBusy(true);
    try {
      if (compose.kind === 'claim') await submitWaiverClaim(clientId, taxYear, compose.target.id, trimmed, engagement);
      else await api.clientDashboard.respond(taxYear, compose.target.requestId, trimmed, engagement);
      // A session change during the request means this result belongs to another session: show nothing.
      if (getStoredToken() !== sessionToken) return;
      setNotice({ error: false, text: compose.kind === 'claim' ? 'Claim recorded for professional review. The requirement remains open.' : 'Reply recorded.' });
      setCompose(null); setText(''); setRefresh(v => v + 1);
    } catch {
      if (getStoredToken() === sessionToken) setNotice({ error: true, text: compose.kind === 'claim' ? 'The server did not confirm this claim. Your text is kept; retry or refresh.' : 'The server did not confirm this reply. Your text is kept; retry or refresh.' });
    } finally { setBusy(false); }
  };

  return <section className="space-y-4 p-4 text-slate-200" aria-label="Document collection">
    <h2 className="text-lg font-bold text-white">Document collection · {taxYear}</h2>
    <p>Your questionnaire is a draft of client-reported facts. Your tax team must verify facts and requirements before advancing the case.</p>
    <label className="flex flex-col gap-1 max-w-md">Engagement
      <select value={engagement} onChange={e => { setEngagement(e.target.value); setNotice(null); setCompose(null); }} className="bg-slate-800 rounded-lg border border-slate-600 px-2 py-1.5">
        <option value="">Select an engagement</option>
        {(targets.key === key ? targets.items : []).map(t => <option key={t.engagementId} value={t.engagementId}>{t.title}</option>)}
      </select>
    </label>
    {!engagement && <p role="status">Select an open engagement for this year. If none is available, contact your practice team.</p>}
    {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-red-300' : 'text-emerald-300'}>{notice.text}</p>}
    {engagement && (!current || current.state === 'loading') && <p role="status">Loading collection records…</p>}
    {current?.state === 'error' && <p role="alert">Collection records are unavailable. <button type="button" className={button} onClick={() => setRefresh(v => v + 1)}>Retry</button></p>}
    {current?.state === 'ready' && <>
      <button type="button" className={button} onClick={() => setModal(true)}>{current.value.hasQuestionnaire ? 'Edit questionnaire draft' : 'Start questionnaire draft'}</button>
      <h3 className="font-bold text-white">Document requirements</h3>
      {!current.value.requirements?.length && <p>No requirements recorded yet. Complete the questionnaire draft for professional review.</p>}
      <ul className="space-y-2">{(current.value.requirements || []).map((r: any) => <li key={r.requirementCode} className="flex flex-wrap items-center gap-2">
        <span>{r.title || r.requirementCode} · {r.status}</span>
        <button type="button" className={button} disabled={busy} onClick={() => open({ kind: 'claim', id: 'claim:' + r.requirementCode, title: r.title || r.requirementCode, target: r })}
          aria-label={'Request applicability review for ' + (r.title || r.requirementCode)}>Request applicability review</button>
      </li>)}</ul>
      <h3 className="font-bold text-white">Practice clarification requests</h3>
      {!current.requests?.length && <p>No clarification requests.</p>}
      <ul className="space-y-3">{current.requests?.map(r => <li key={r.requestId} className="rounded-xl border border-slate-700 p-3">
        <p className="font-semibold">{r.title} · {r.status}</p><p>{r.message}</p>
        {r.clientResponse && <p>Your reply: {r.clientResponse}</p>}
        {!['RESOLVED', 'CLOSED'].includes(r.status) && <button type="button" className={button} disabled={busy}
          onClick={() => open({ kind: 'reply', id: 'reply:' + r.requestId, title: r.title, target: r })}>Reply</button>}
      </li>)}</ul>
      {compose && <form onSubmit={submit} aria-label={compose.kind === 'claim' ? 'Applicability review request' : 'Reply to practice request'} className="space-y-2 rounded-xl border border-[#D4A843]/50 p-3">
        <label htmlFor={fieldId} className="font-semibold">{compose.kind === 'claim'
          ? `Why may "${compose.title}" not apply? Your tax team must review the claim.`
          : `Your reply to "${compose.title}"`}</label>
        <textarea id={fieldId} ref={textRef} value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={limits.max} required
          aria-describedby={fieldId + '-hint'} aria-invalid={text.length > 0 && invalid} className="w-full rounded-lg border border-slate-600 bg-[#06182B] p-2" />
        <p id={fieldId + '-hint'} className="text-xs text-slate-400">{limits.min}–{limits.max} characters ({trimmed.length} entered).</p>
        <div className="flex gap-2">
          <button type="submit" className={button} disabled={busy || invalid}>{busy ? 'Sending…' : compose.kind === 'claim' ? 'Submit for review' : 'Send reply'}</button>
          <button type="button" className={button} disabled={busy} onClick={() => { setCompose(null); setText(''); }}>Cancel</button>
        </div>
      </form>}
    </>}
    <ClientDocumentVaultPanel key={key} clientId={clientId} />
    {modal && engagement && <TaxQuestionnaireModal isOpen onClose={() => setModal(false)} clientId={clientId} taxYear={taxYear} engagementId={engagement} onSaved={() => { setModal(false); setRefresh(v => v + 1); }} />}
  </section>;
}
