import React, { useState } from 'react';
import type { User } from '../../../types';
import { api } from '../../../services/api';
import type { ClientDashboardData } from './clientDashboardModel';
import './clientDashboard.css';

export function ClientDashboardModule({ module, data, user, taxYear, onRefresh, onBack, onSelectYear }: { module: string; data: ClientDashboardData; user: User; taxYear: number; onRefresh: () => void; onBack: () => void; onSelectYear: (year: number) => void }) {
  const [text, setText] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const title = ({ tax_return: 'My Tax Returns', messages: 'Messages', requests: 'Requests', billing: 'Payments', records: 'My Records (2022+)' } as Record<string, string>)[module];
  const engagement = data.engagements.data?.find(record => record.taxYear === taxYear);
  const send = async (requestId?: string) => {
    const content = requestId ? replies[requestId] || '' : text;
    if (busy || content.trim().length < 2) return;
    if (!requestId && !engagement?.assignedAccountantId) { setNotice('Your assigned advisor is unavailable. Contact support.'); return; }
    setBusy(true); setNotice('');
    try {
      if (requestId) await api.clientDashboard.respond(taxYear, requestId, content.trim());
      else await api.messages.send({ content: text.trim(), engagementId: engagement!.id, recipientId: engagement!.assignedAccountantId, recipientName: engagement!.assignedAccountantName, isInternalNote: false });
      setNotice('Response saved by the server.'); setText(''); if (requestId) setReplies(previous => ({ ...previous, [requestId]: '' })); onRefresh();
    } catch { setNotice('Your response could not be saved. Please retry.'); }
    finally { setBusy(false); }
  };
  const empty = (status: string, label: string) => <p>{status === 'loading' ? 'Loading…' : status === 'unavailable' ? `${label} unavailable. Refresh or contact support.` : `No ${label.toLowerCase()} recorded.`}</p>;
  return <div className="tg-client-dashboard"><section className="tg-client-panel"><header><h1>{title}</h1><button onClick={onBack}>Back to Dashboard</button></header><div className="tg-client-panel-body">
    {module === 'tax_return' && <><h2>Tax Year {taxYear}</h2>{engagement ? <dl className="tg-return-facts"><div><dt>Status</dt><dd>{engagement.status.replaceAll('_', ' ')}</dd></div><div><dt>Service</dt><dd>{engagement.serviceTitle}</dd></div><div><dt>Last Updated</dt><dd>{engagement.updatedAt || 'Not available'}</dd></div></dl> : empty(data.engagements.status, 'Return engagements')}<p>Filing, signature and approval events are shown only through the authoritative workflow controls.</p></>}
    {module === 'records' && <><p>Only years with verified engagement or document records are shown.</p><ul className="tg-client-list">{Array.from(new Set([...(data.engagements.data || []).map(e => e.taxYear), ...(data.documents.data || []).map(d => d.taxYear)])).sort((a, b) => b - a).map(year => <li key={year}><button onClick={() => onSelectYear(year)}>{year} — {(data.documents.data || []).filter(d => d.taxYear === year).length} documents · {data.engagements.data?.find(e => e.taxYear === year)?.status.replaceAll('_', ' ') || 'Document records'}</button></li>)}</ul>{!data.documents.data?.length && !data.engagements.data?.length && empty(data.documents.status, 'Tax-year records')}</>}
    {module === 'billing' && <><p>Account-wide invoices. Live payment processing is not offered by this dashboard.</p>{data.invoices.data?.length ? <ul className="tg-client-list">{data.invoices.data.map(invoice => <li key={invoice.id}><strong>{invoice.invoiceNumber}</strong><p>{invoice.description}</p><p>{new Intl.NumberFormat(undefined, { style: 'currency', currency: invoice.currency }).format(invoice.amount)} · {invoice.status}</p></li>)}</ul> : empty(data.invoices.status, 'Invoices')}<p>Contact your firm for authorized payment options.</p></>}
    {module === 'messages' && <><p>Selected-year and general conversations. Internal staff notes are excluded.</p>{data.messages.data?.length ? <ul className="tg-client-list">{data.messages.data.map(message => <li key={message.id}><strong>{message.senderId === user.id ? 'You' : message.senderName}</strong><p>{message.content}</p><small>{message.createdAt || message.timestamp || 'Date unavailable'}</small></li>)}</ul> : empty(data.messages.status, 'Messages')}<form onSubmit={event => { event.preventDefault(); void send(); }}><label htmlFor="client-message">Message your assigned advisor</label><textarea id="client-message" value={text} onChange={event => setText(event.target.value)} required minLength={2} /><button className="tg-client-primary-button" disabled={busy || !engagement?.assignedAccountantId}>{busy ? 'Sending…' : 'Send Message'}</button></form></>}
    {module === 'requests' && <>{data.requests.data?.length ? <ul className="tg-client-list">{data.requests.data.map(request => <li key={request.id}><h2>{request.title || request.subject || 'Information Request'}</h2><p>{request.description || request.message}</p><p>Status: {request.status}</p>{['OPEN', 'IN_PROGRESS', 'PENDING', 'REQUESTED', 'AWAITING_CLIENT', 'NEEDS_RESPONSE'].includes(request.status.toUpperCase()) && <form onSubmit={event => { event.preventDefault(); void send(request.id); }}><label htmlFor={`reply-${request.id}`}>Your response</label><textarea id={`reply-${request.id}`} value={replies[request.id] || ""} onChange={event => setReplies(previous => ({ ...previous, [request.id]: event.target.value }))} required minLength={2} /><button className="tg-client-primary-button" disabled={busy}>Send response</button></form>}</li>)}</ul> : empty(data.requests.status, 'Requests')}</>}
    {notice && <p role="status">{notice}</p>}
  </div></section></div>;
}
