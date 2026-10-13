import React, { useCallback, useEffect, useRef, useState } from 'react';
import { communicationErrorText, communicationsService, newCommKey, THREAD_CATEGORIES, type CommMessage, type CommThread, type MessageVisibility, type ThreadCategory } from '../../services/communicationsService';

type Load<T> = { status: 'loading' | 'ready' | 'error'; data: T | null; error?: string };
const when = (iso: string) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t).toLocaleString() : 'Date unavailable'; };

/**
 * Durable client / staff conversations for one client (proposal 039). Everything shown comes from
 * /api/communications; the server decides visibility, so clients never receive internal notes.
 * A failed send keeps its idempotency key, so retrying unchanged text cannot post it twice; editing
 * the text starts a new key.
 */
export function ConversationPanel({ clientId, mode, canArchive = false, engagementId }: { clientId: string; mode: 'client' | 'staff'; canArchive?: boolean; engagementId?: string }) {
  const [threads, setThreads] = useState<Load<CommThread[]>>({ status: 'loading', data: null });
  const [openId, setOpenId] = useState<string | null>(null);
  const [open, setOpen] = useState<Load<{ thread: CommThread; messages: CommMessage[] }> | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ subject: '', category: 'GENERAL' as ThreadCategory, body: '', key: newCommKey() });
  const [reply, setReply] = useState({ body: '', internal: false, key: newCommKey() });
  const mounted = useRef(true);
  // StrictMode mounts, unmounts and mounts again: the flag must be restored on every mount.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const loadThreads = useCallback((signal?: AbortSignal) => {
    setThreads(previous => ({ status: 'loading', data: previous.data }));
    communicationsService.threads(clientId, signal).then(data => { if (mounted.current) setThreads({ status: 'ready', data }); })
      .catch(error => { if (mounted.current && !signal?.aborted) setThreads({ status: 'error', data: null, error: communicationErrorText(error) }); });
  }, [clientId]);
  const loadThread = useCallback((threadId: string) => {
    setOpen({ status: 'loading', data: null });
    communicationsService.thread(clientId, threadId).then(data => {
      if (!mounted.current) return;
      setOpen({ status: 'ready', data });
      if (data.thread.unread > 0) void communicationsService.markRead(clientId, threadId).then(() => mounted.current && loadThreads()).catch(() => undefined);
    }).catch(error => { if (mounted.current) setOpen({ status: 'error', data: null, error: communicationErrorText(error) }); });
  }, [clientId, loadThreads]);
  useEffect(() => { const controller = new AbortController(); loadThreads(controller.signal); return () => controller.abort(); }, [loadThreads]);
  useEffect(() => { if (openId) loadThread(openId); else setOpen(null); }, [openId, loadThread]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try { await action(); } catch (error) { if (mounted.current) setNotice({ error: true, text: communicationErrorText(error) }); }
    finally { if (mounted.current) setBusy(false); }
  };
  const start = (event: React.FormEvent) => {
    event.preventDefault();
    if (draft.subject.trim().length < 3 || !draft.body.trim()) { setNotice({ error: true, text: 'Enter a subject (at least 3 characters) and a message.' }); return; }
    void run(async () => {
      const created = await communicationsService.createThread(clientId, { subject: draft.subject.trim(), body: draft.body.trim(), category: draft.category,
        ...(engagementId ? { engagementId } : {}) }, draft.key);
      if (!mounted.current) return;
      setDraft({ subject: '', category: 'GENERAL', body: '', key: newCommKey() });
      setNotice({ error: false, text: 'Conversation started. Your message was recorded by the server.' });
      loadThreads(); setOpenId(created.thread.threadId);
    });
  };
  const send = (event: React.FormEvent) => {
    event.preventDefault();
    if (!openId || !reply.body.trim()) return;
    const visibility: MessageVisibility = mode === 'staff' && reply.internal ? 'INTERNAL_ONLY' : 'CLIENT_VISIBLE';
    void run(async () => {
      await communicationsService.post(clientId, openId, reply.body.trim(), reply.key, visibility);
      if (!mounted.current) return;
      setReply({ body: '', internal: false, key: newCommKey() });
      setNotice({ error: false, text: visibility === 'INTERNAL_ONLY' ? 'Internal note recorded. The client cannot see it.' : 'Message sent and recorded by the server.' });
      loadThread(openId); loadThreads();
    });
  };
  const setStatus = (status: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED') => openId && void run(async () => {
    await communicationsService.setStatus(clientId, openId, status);
    if (!mounted.current) return;
    setNotice({ error: false, text: status === 'ACTIVE' ? 'Conversation reopened.' : status === 'RESOLVED' ? 'Conversation marked resolved.' : 'Conversation archived.' });
    if (status === 'ARCHIVED' && mode === 'client') setOpenId(null); else loadThread(openId);
    loadThreads();
  });

  const list = threads.data ?? [];
  const thread = open?.data?.thread;
  return <section aria-label="Conversations" className="space-y-4 text-sm">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold">{mode === 'client' ? 'Messages with your advisors' : 'Client communication'}</h2>
      <button type="button" onClick={() => loadThreads()} disabled={threads.status === 'loading'}>Refresh conversations</button>
    </header>
    {mode === 'client' && <p>Conversations are kept on your account. Do not send passwords or full account numbers. Send documents through your document vault.</p>}
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {threads.status === 'loading' && !threads.data && <p role="status">Loading conversations…</p>}
    {threads.status === 'error' && <p role="alert">{threads.error} <button type="button" onClick={() => loadThreads()}>Retry</button></p>}
    {threads.status === 'ready' && list.length === 0 && <p>No conversations yet.</p>}
    {list.length > 0 && <ul aria-label="Conversation list" className="space-y-2">{list.map(t => <li key={t.threadId}>
      <button type="button" aria-current={openId === t.threadId} onClick={() => setOpenId(t.threadId)} className="w-full text-left">
        <strong>{t.subject}</strong> · {THREAD_CATEGORIES.find(([k]) => k === t.category)?.[1] ?? t.category} · {t.status.toLowerCase()}
        {t.unread > 0 && <> · <span>{t.unread} unread</span></>}{mode === 'staff' && t.awaitingStaffReply && <> · <span>awaiting reply</span></>}
        <br /><small>Last message {when(t.lastMessageAt)}</small>
      </button></li>)}</ul>}

    {open && <article aria-label="Conversation" className="space-y-3 rounded border p-3">
      {open.status === 'loading' && <p role="status">Loading conversation…</p>}
      {open.status === 'error' && <p role="alert">{open.error} <button type="button" onClick={() => openId && loadThread(openId)}>Retry</button></p>}
      {thread && open.data && <>
        <h3 className="font-bold">{thread.subject}</h3>
        <p>Status: {thread.status.toLowerCase()}</p>
        <ol aria-label="Messages" className="space-y-2">{open.data.messages.map(m => <li key={m.messageId} className={m.visibility === 'INTERNAL_ONLY' ? 'border-l-4 border-amber-400 pl-2' : ''}>
          <strong>{m.own ? 'You' : m.senderKind === 'client' ? 'Client' : mode === 'client' ? 'Your advisor team' : `Staff (${m.senderRole.replaceAll('_', ' ')})`}</strong>
          {m.visibility === 'INTERNAL_ONLY' && <> · <em>Internal note — not visible to the client</em></>}
          <p className="whitespace-pre-wrap">{m.body}</p><small>{when(m.createdAt)}</small></li>)}</ol>
        {thread.status === 'ACTIVE' ? <form aria-label="Reply" onSubmit={send} className="space-y-2">
          <label className="block">{mode === 'staff' && reply.internal ? 'Internal note' : 'Reply'}<textarea required maxLength={5000} value={reply.body} disabled={busy}
            onChange={e => setReply({ ...reply, body: e.target.value, key: newCommKey() })} className="w-full" /></label>
          {mode === 'staff' && <label><input type="checkbox" checked={reply.internal} disabled={busy} onChange={e => setReply({ ...reply, internal: e.target.checked, key: newCommKey() })} /> Internal note (not visible to the client)</label>}
          <button disabled={busy || !reply.body.trim()}>{busy ? 'Sending…' : mode === 'staff' && reply.internal ? 'Record internal note' : 'Send message'}</button>
        </form> : <p>This conversation is {thread.status.toLowerCase()}. {mode === 'client' ? 'Start a new conversation if you need more help.' : ''}</p>}
        {mode === 'staff' && <div className="flex flex-wrap gap-2">
          {thread.status === 'ACTIVE' && <button type="button" disabled={busy} onClick={() => setStatus('RESOLVED')}>Mark resolved</button>}
          {thread.status === 'RESOLVED' && <button type="button" disabled={busy} onClick={() => setStatus('ACTIVE')}>Reopen</button>}
          {canArchive && thread.status !== 'ARCHIVED' && <button type="button" disabled={busy} onClick={() => setStatus('ARCHIVED')}>Archive</button>}
        </div>}
        <button type="button" onClick={() => setOpenId(null)}>Close conversation</button>
      </>}
    </article>}

    <form aria-label="Start a conversation" onSubmit={start} className="space-y-2 rounded border p-3">
      <h3 className="font-bold">Start a conversation</h3>
      <label className="block">Subject<input required minLength={3} maxLength={200} value={draft.subject} disabled={busy} onChange={e => setDraft({ ...draft, subject: e.target.value, key: newCommKey() })} className="w-full" /></label>
      <label className="block">Topic<select value={draft.category} disabled={busy} onChange={e => setDraft({ ...draft, category: e.target.value as ThreadCategory, key: newCommKey() })}>
        {THREAD_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block">Message<textarea required maxLength={5000} value={draft.body} disabled={busy} onChange={e => setDraft({ ...draft, body: e.target.value, key: newCommKey() })} className="w-full" /></label>
      <button disabled={busy}>{busy ? 'Sending…' : 'Start conversation'}</button>
    </form>
  </section>;
}
