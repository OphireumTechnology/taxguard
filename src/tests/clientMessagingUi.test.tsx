import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { threadSummaries, scopeMessages } from '../components/portal/dashboard/clientDashboardModel';
import { communicationErrorText, type CommThread } from '../services/communicationsService';
import { ConversationPanel } from '../components/communications/ConversationPanel';

// Durable conversation UI pieces (proposal 039), synthetic data only.
const scope = { userId: 'user-a', clientId: 'client-a', tenantId: 'tenant-a', taxYear: 2025 };
const thread = (over: Partial<CommThread> = {}): CommThread => ({ threadId: 'thr_a', clientId: 'client-a', engagementId: null, subject: 'Synthetic question', category: 'GENERAL',
  status: 'ACTIVE', createdAt: '2026-10-01T00:00:00Z', lastMessageAt: '2026-10-02T00:00:00Z', messageCount: 2, unread: 0, awaitingStaffReply: false, ...over });

describe('client overview from durable conversations', () => {
  it('shows one row per own conversation, never another client, and no invented advisor name', () => {
    const rows = threadSummaries([thread(), thread({ threadId: 'thr_b', awaitingStaffReply: true, unread: 0 }), thread({ threadId: 'thr_other', clientId: 'client-b' })], scope);
    expect(rows.map(r => r.id)).toEqual(['thr_a', 'thr_b']);
    expect(rows[0]).toMatchObject({ content: 'Synthetic question', senderName: 'Your advisor team', recipientId: 'user-a', isRead: true });
    expect(rows[1]).toMatchObject({ senderId: 'user-a', recipientId: undefined });
    // The existing client scope filter keeps them (general, client-scoped, involving the user).
    expect(scopeMessages(rows, [], scope).map(r => r.id).sort()).toEqual(['thr_a', 'thr_b']);
  });
  it('counts a conversation with unread replies as unread', () => {
    expect(threadSummaries([thread({ unread: 2 })], scope)[0].isRead).toBe(false);
  });
});

describe('conversation panel', () => {
  it('starts in a loading state and offers the client no internal-note control', () => {
    const html = renderToStaticMarkup(<ConversationPanel clientId="client-a" mode="client" />);
    expect(html).toContain('Loading conversations');
    expect(html).toContain('Messages with your advisors');
    expect(html).not.toMatch(/Internal note/);
  });
  it('explains refusals without claiming anything was sent', () => {
    expect(communicationErrorText({ code: 'COMM_STORE_UNAVAILABLE' })).toBe('Messaging is not available in this environment.');
    expect(communicationErrorText({ code: 'COMM_THREAD_CLOSED' })).toMatch(/closed/);
    expect(communicationErrorText({})).toMatch(/Nothing was sent/);
  });
});
