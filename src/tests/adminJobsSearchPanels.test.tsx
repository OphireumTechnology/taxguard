import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { clearStoredToken, setStoredToken } from '../services/api';
import { JOB_STATUSES, jobActions, jobMessage, JobRequestError, jobService } from '../services/jobService';
import { AdminJobQueuePanel } from '../components/admin/AdminJobQueuePanel';
import { AdminPracticeSearchPanel } from '../components/admin/AdminPracticeSearchPanel';

// Block 92 administrator panels for the durable job queue (Block 82) and practice search (Block 88). The server rules are
// covered on PostgreSQL (durableJobQueue, practiceSearch); the panels in the browser by suite 11.
const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ total: 0, jobs: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('administrator job queue and search panels', () => {
  it('relays job calls to their routes, uncached, with only the filters given', async () => {
    await jobService.list(); await jobService.list({ status: 'DEAD_LETTER', limit: 25, offset: 50 }); await jobService.list({ clientId: 'client a' });
    await jobService.retry('job/1'); await jobService.cancel('job_2');
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/jobs', ''), init.method, init.cache, init.body])).toEqual([
      ['', 'GET', 'no-store', undefined], ['?status=DEAD_LETTER&limit=25&offset=50', 'GET', 'no-store', undefined], ['?clientId=client+a', 'GET', 'no-store', undefined],
      ['/job%2F1/retry', 'POST', 'no-store', undefined], ['/job_2/cancel', 'POST', 'no-store', undefined]]);
  });

  it('offers only the actions the database allows for each status, and words its refusals', () => {
    expect(JOB_STATUSES.filter(s => jobActions(s).retry)).toEqual(['FAILED', 'DEAD_LETTER']);
    expect(JOB_STATUSES.filter(s => !jobActions(s).cancel)).toEqual(['COMPLETED', 'CANCELLED']);
    expect(jobMessage(new JobRequestError(403, 'JOB_ADMIN_REQUIRED'))).toMatch(/Only an administrator/);
    expect(jobMessage(new JobRequestError(409, 'JOB_STATE_INVALID'))).toMatch(/no longer in a state/);
    expect(jobMessage(new JobRequestError(404, 'JOB_NOT_FOUND'))).toMatch(/not in your scope/);
    expect(jobMessage(new JobRequestError(403, 'SOMETHING'))).toBe('Your role is not authorized for this action.');
    expect(jobMessage(new Error('x'))).toBe('The job queue did not confirm this action. Refresh and try again.');
  });

  it('render loading or an empty search first, never sample records', () => {
    const jobs = renderToStaticMarkup(<AdminJobQueuePanel />);
    expect(jobs).toContain('Durable Job Queue'); expect(jobs).toContain('Loading recorded jobs'); expect(jobs).toContain('No worker is commissioned');
    expect(jobs).not.toContain('<table');
    const search = renderToStaticMarkup(<AdminPracticeSearchPanel />);
    expect(search).toContain('Global Practice Search'); expect(search).toContain('Invoices are not searched'); expect(search).not.toContain('<table');
  });
});
