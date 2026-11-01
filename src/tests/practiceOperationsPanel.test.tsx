import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { clearStoredToken, setStoredToken } from '../services/api';
import { practiceService } from '../services/practiceService';
import { dueText, LEVEL_LABELS, notificationText, PracticeOperationsPanel } from '../components/workspace/PracticeOperationsPanel';

// Block 90 browser client and panel for the durable practice operations of Blocks 84-88. The server rules are covered on
// PostgreSQL (taskReassignmentWorkload, deadlineEscalation, staffNotifications, practiceSearch); the panel in the browser
// by src/tests-e2e/06-role-dashboards.e2e.test.ts.
const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });
const ID = '0123abcd-0000-4000-8000-000000000001';

describe('practice operations in the browser client', () => {
  it('relays each call to its route, uncached, with only the fields it needs', async () => {
    await practiceService.workload(); await practiceService.workload('user/2');
    await practiceService.deadlineEscalations(2); await practiceService.deadlineEscalations(0, 'client-a');
    await practiceService.notifications(); await practiceService.notifications(true); await practiceService.markNotificationRead(ID);
    await practiceService.search('alpha & co'); await practiceService.reassignTask('client-a', 'task/1', null, 3); await practiceService.reassignTask('client-a', 'task-1', 'u2', 4, 'Hand-off');
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/practice', ''), init.method, init.cache, init.body ? JSON.parse(init.body) : undefined])).toEqual([
      ['/workload', 'GET', 'no-store', undefined], ['/workload?userId=user%2F2', 'GET', 'no-store', undefined],
      ['/deadline-escalations?minLevel=2', 'GET', 'no-store', undefined], ['/deadline-escalations?minLevel=0&clientId=client-a', 'GET', 'no-store', undefined],
      ['/notifications', 'GET', 'no-store', undefined], ['/notifications?unreadOnly=true', 'GET', 'no-store', undefined], [`/notifications/${ID}/read`, 'POST', 'no-store', undefined],
      ['/search?q=alpha+%26+co&limit=25', 'GET', 'no-store', undefined],
      ['/clients/client-a/tasks/task%2F1/reassign', 'POST', 'no-store', { assignedUserId: null, version: 3 }],
      ['/clients/client-a/tasks/task-1/reassign', 'POST', 'no-store', { assignedUserId: 'u2', version: 4, reason: 'Hand-off' }],
    ]);
  });

  it('words due times and notifications from the server\'s values only', () => {
    expect(dueText(0)).toBe('due now');
    expect(dueText(1)).toBe('due in 1 hour');
    expect(dueText(24)).toBe('due in 24 hours');
    expect(dueText(72)).toBe('due in 3 days');
    expect(dueText(-5)).toBe('5 hours overdue');
    expect(dueText(-240)).toBe('10 days overdue');
    expect(LEVEL_LABELS).toEqual({ NORMAL: 'Normal', APPROACHING: 'Approaching', DUE_SOON: 'Due soon', OVERDUE: 'Overdue', CRITICAL: 'Critical' });
    const base = { notificationId: ID, kind: 'TASK_ASSIGNED' as const, clientId: 'client-a', taskId: 't1', createdBy: 'mgr-1', createdAt: '2026-01-01T00:00:00Z', readAt: null };
    expect(notificationText({ ...base, available: true, task: { title: 'Prepare W-2 summary', status: 'OPEN', assignedToMe: true } })).toBe('Task assigned to you by mgr-1: Prepare W-2 summary');
    expect(notificationText({ ...base, available: true, task: { title: 'Prepare W-2 summary', status: 'OPEN', assignedToMe: false } })).toBe('Task assigned to you by mgr-1: Prepare W-2 summary (since reassigned)');
    const hidden = notificationText({ ...base, available: false, task: null });
    expect(hidden).toBe('A task was assigned to you that you can no longer see.');
  });

  it('renders loading states first and never placeholder figures', () => {
    const html = renderToStaticMarkup(<PracticeOperationsPanel />);
    for (const text of ['Practice operations', 'Loading your workload', 'Loading deadlines', 'Loading notifications', 'Search clients, cases, tasks and document requests'])
      expect(html).toContain(text);
    expect(html).not.toMatch(/<strong>\d/);
    expect(html).not.toContain('unread');
  });
});
