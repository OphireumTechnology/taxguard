import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { TeamWorkloadPanel } from '../components/workspace/TeamWorkloadPanel';
import { DeadlineEscalationsPanel } from '../components/workspace/DeadlineEscalationsPanel';
import { AdminWorkloadPanel } from '../components/admin/AdminWorkloadPanel';

// Block 93 durable team workload and deadline escalation panels. The server rules are covered on PostgreSQL
// (taskReassignmentWorkload, deadlineEscalation); the panels in the browser by src/tests-e2e/06-role-dashboards.e2e.test.ts.
describe('team workload and deadline escalation panels', () => {
  it('render loading states first, with no figures, no capacity target and the threshold caveat only once data arrives', () => {
    const team = renderToStaticMarkup(<TeamWorkloadPanel />);
    expect(team).toContain('Recorded team workload'); expect(team).toContain('Loading recorded team workload');
    expect(team).toContain('No capacity target is defined'); expect(team).not.toMatch(/<td>\d/);
    const deadlines = renderToStaticMarkup(<DeadlineEscalationsPanel />);
    expect(deadlines).toContain('Deadline escalation'); expect(deadlines).toContain('Loading deadlines'); expect(deadlines).not.toMatch(/<strong>\d/);
    expect(deadlines).not.toContain('default thresholds');
  });
  it('offers every level from critical down to normal, defaulting to approaching', () => {
    const html = renderToStaticMarkup(<DeadlineEscalationsPanel />);
    expect([...html.matchAll(/<option value="(\d)"[^>]*>([^<]+)</g)].map(m => [m[1], m[2]])).toEqual([['4', 'Critical'], ['3', 'Overdue'], ['2', 'Due soon'], ['1', 'Approaching'], ['0', 'Normal']]);
    expect(html).toMatch(/<option value="1" selected="">Approaching/);
  });
  it('the administrator tab keeps its heading and shows the panel', () => {
    const html = renderToStaticMarkup(<AdminWorkloadPanel />);
    expect(html).toContain('Caseload &amp; Tasks'); expect(html).toContain('Loading recorded team workload');
  });
});
