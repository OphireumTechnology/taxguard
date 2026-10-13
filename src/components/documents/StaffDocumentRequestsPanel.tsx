import React, { useCallback, useEffect, useState } from 'react';
import { DOCUMENT_CATEGORIES, vaultService } from '../../services/vaultService';
import { documentRequestService, requestMessage, requestStatusText, type ChecklistTemplate, type DocumentRequestItem } from '../../services/documentRequestService';

const label = (v: string) => v.replace(/_/g, ' ');
type Target = { engagementId: string; title: string; taxYear: number };

/** Staff: missing-document tracking, per-client requests, firm checklists. The database enforces every authority rule. */
export function StaffDocumentRequestsPanel() {
  const [missing, setMissing] = useState<Awaited<ReturnType<typeof documentRequestService.missing>> | null>(null);
  const [filter, setFilter] = useState({ taxYear: '', overdueOnly: false });
  const [clientInput, setClientInput] = useState('');
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<DocumentRequestItem[] | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [form, setForm] = useState({ target: '', title: '', category: 'income', required: true, dueDate: '', instructions: '' });
  const [apply, setApply] = useState({ templateId: '', target: '', dueDate: '' });
  const [reason, setReason] = useState('');
  const [tpl, setTpl] = useState({ templateId: '', name: '', lines: '' });
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMissing = useCallback(() => {
    documentRequestService.missing(filter.taxYear ? Number(filter.taxYear) : undefined, filter.overdueOnly).then(setMissing).catch(e => setNotice({ error: true, text: requestMessage(e) }));
  }, [filter]);
  const loadClient = useCallback((id: string) => {
    if (!id) return;
    documentRequestService.list(id).then(r => setItems(r.items)).catch(e => { setItems(null); setNotice({ error: true, text: requestMessage(e) }); });
    vaultService.uploadTargets(id).then(r => setTargets(r.items)).catch(() => setTargets([]));
  }, []);
  useEffect(() => { loadMissing(); }, [loadMissing]);
  useEffect(() => { documentRequestService.templates().then(r => setTemplates(r.items)).catch(() => setTemplates([])); }, []);
  const run = async (op: () => Promise<unknown>, text: string) => {
    if (busy) return; setBusy(true); setNotice(null);
    try { await op(); setNotice({ error: false, text }); loadMissing(); loadClient(clientId); return true; }
    catch (e) { setNotice({ error: true, text: requestMessage(e) }); return false; } finally { setBusy(false); }
  };
  const target = (v: string) => { const [engagementId, year] = v.split('|'); return { engagementId, taxYear: Number(year) }; };
  const targetOptions = targets.map(t => <option key={t.engagementId + t.taxYear} value={`${t.engagementId}|${t.taxYear}`}>{t.title} — {t.taxYear}</option>);

  return <section aria-labelledby="doc-requests-heading" className="tg-manager-card">
    <h2 id="doc-requests-heading">Document Requests</h2>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}

    <h3>Missing documents</h3>
    <form className="tg-manager-controls" onSubmit={e => { e.preventDefault(); loadMissing(); }}>
      <label>Tax year<input type="number" min={2000} max={2100} value={filter.taxYear} onChange={e => setFilter({ ...filter, taxYear: e.target.value })} /></label>
      <label><input type="checkbox" checked={filter.overdueOnly} onChange={e => setFilter({ ...filter, overdueOnly: e.target.checked })} /> Overdue only</label>
      <button>Refresh</button>
    </form>
    {missing && missing.items.length === 0 && <p>No outstanding requests for the clients you can see.</p>}
    {missing && missing.items.length > 0 && <table><caption className="sr-only">Outstanding document requests</caption>
      <thead><tr>{['Client', 'Document', 'Year', 'Due', 'Status', ''].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{missing.items.map(q => <tr key={q.requestId}><td>{q.clientName || q.clientId}</td><td>{q.title}{q.required ? '' : ' (optional)'}</td><td>{q.taxYear}</td>
        <td>{q.dueDate ?? '—'}{q.overdue ? ' · overdue' : ''}</td><td>{requestStatusText(q.status)}</td>
        <td><button type="button" disabled={busy} onClick={() => run(() => documentRequestService.remind(q.clientId, q.requestId), 'Reminder recorded in the client portal.')}>Remind</button></td></tr>)}</tbody></table>}

    <h3>Client requests</h3>
    <form className="tg-manager-controls" onSubmit={e => { e.preventDefault(); setClientId(clientInput.trim()); loadClient(clientInput.trim()); }}>
      <label>Client identifier<input required maxLength={64} value={clientInput} onChange={e => setClientInput(e.target.value)} /></label>
      <button>Open client requests</button>
    </form>
    {clientId && items && <>
      {items.length === 0 ? <p>No requests for {clientId}.</p> : <table><caption className="sr-only">Requests for {clientId}</caption>
        <thead><tr>{['Document', 'Year', 'Category', 'Due', 'Status', 'Files', 'Actions'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{items.map(q => <tr key={q.requestId}><td>{q.title}{q.required ? '' : ' (optional)'}</td><td>{q.taxYear}</td><td>{label(q.category)}</td><td>{q.dueDate ?? '—'}</td>
          <td>{requestStatusText(q.status)}{q.resolutionReason ? ` — ${q.resolutionReason}` : ''}</td><td>{q.documents.length}</td>
          <td>{['OPEN', 'SUBMITTED'].includes(q.status) && <>
            <button type="button" disabled={busy || reason.trim().length < 10} onClick={() => run(() => documentRequestService.resolve(clientId, q.requestId, 'waive', reason, q.rowVersion), 'Request waived.')}>Waive</button>
            <button type="button" disabled={busy || reason.trim().length < 10} onClick={() => run(() => documentRequestService.resolve(clientId, q.requestId, 'cancel', reason, q.rowVersion), 'Request withdrawn.')}>Withdraw</button>
          </>}</td></tr>)}</tbody></table>}
      <label>Reason for waiver or withdrawal (recorded, at least 10 characters)<input maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>

      <form onSubmit={e => { e.preventDefault(); if (!form.target) return; void run(() => documentRequestService.create(clientId, { ...target(form.target), title: form.title, category: form.category,
          required: form.required, dueDate: form.dueDate || undefined, instructions: form.instructions || undefined }), 'Request sent to the client portal.')
        .then(ok => { if (ok) setForm({ ...form, title: '', instructions: '' }); }); }}>
        <h4>New request</h4>
        <label>Engagement and tax year<select required value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}><option value="">Select</option>{targetOptions}</select></label>
        <label>Document requested<input required minLength={3} maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        <label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{label(c)}</option>)}</select></label>
        <label><input type="checkbox" checked={form.required} onChange={e => setForm({ ...form, required: e.target.checked })} /> Required</label>
        <label>Due date<input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></label>
        <label>Instructions for the client<input maxLength={2000} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} /></label>
        <button disabled={busy}>Create request</button>
      </form>

      <form onSubmit={e => { e.preventDefault(); if (!apply.target || !apply.templateId) return; const t = target(apply.target);
          void run(() => documentRequestService.applyTemplate(clientId, apply.templateId, t.engagementId, t.taxYear, apply.dueDate || undefined), 'Checklist applied.'); }}>
        <h4>Apply a firm checklist</h4>
        <label>Checklist<select required value={apply.templateId} onChange={e => setApply({ ...apply, templateId: e.target.value })}><option value="">Select</option>
          {templates.filter(t => t.status === 'ACTIVE').map(t => <option key={t.templateId} value={t.templateId}>{t.name} ({t.items.length} items)</option>)}</select></label>
        <label>Engagement and tax year<select required value={apply.target} onChange={e => setApply({ ...apply, target: e.target.value })}><option value="">Select</option>{targetOptions}</select></label>
        <label>Due date<input type="date" value={apply.dueDate} onChange={e => setApply({ ...apply, dueDate: e.target.value })} /></label>
        <button disabled={busy}>Apply checklist</button>
      </form>
    </>}

    <h3>Firm checklists</h3>
    <p>Checklists are the firm's own lists of documents to request. They contain no tax rules.</p>
    <ul>{templates.map(t => <li key={t.templateId}>{t.name} — {t.items.map(i => i.title).join(', ')} (version {t.version})</li>)}</ul>
    <form onSubmit={e => { e.preventDefault();
        const items = tpl.lines.split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[0]).map(([title, category, required]) => ({ title, category: category || 'other', required: !/^(no|optional)$/i.test(required || '') }));
        void run(() => documentRequestService.saveTemplate({ templateId: tpl.templateId, name: tpl.name, items }), 'Checklist saved.')
          .then(ok => { if (ok) documentRequestService.templates().then(r => setTemplates(r.items)).catch(() => undefined); }); }}>
      <h4>Save a checklist (managers)</h4>
      <label>Checklist identifier<input required pattern="[A-Za-z0-9_\-]{3,64}" value={tpl.templateId} onChange={e => setTpl({ ...tpl, templateId: e.target.value })} /></label>
      <label>Name<input required minLength={3} maxLength={200} value={tpl.name} onChange={e => setTpl({ ...tpl, name: e.target.value })} /></label>
      <label>Items, one per line: title | category | required or optional<textarea required value={tpl.lines} onChange={e => setTpl({ ...tpl, lines: e.target.value })} /></label>
      <button disabled={busy}>Save checklist</button>
    </form>
  </section>;
}
