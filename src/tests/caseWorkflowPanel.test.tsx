import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { setStoredToken, clearStoredToken } from '../services/api';
import { CaseRequestError, caseMessage, caseService, restaffCandidates, stageLabel, STAGE_NAMES } from '../services/caseService';
import { ACCOUNTANT_STAGES } from '../components/workspace/accountantDashboardModel';
import { CaseWorkflowPanel } from '../components/workspace/CaseWorkflowPanel';
import { MANAGER_MODULES } from '../components/workspace/practiceManagerModel';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('case workflow client', () => {
  it('uses the canonical stage names unchanged', () => {
    expect(STAGE_NAMES).toEqual(ACCOUNTANT_STAGES);
    expect(stageLabel(13)).toBe('13 Government Feedback');
  });
  it('sends only the current stage, version and attestation; never a pass decision', async () => {
    await caseService.advance('case/1', 2, 5, { confirmed: ['documents_received_or_waived'], statement: 'Synthetic attestation statement' });
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/api/cases/case%2F1/advance');
    expect(JSON.parse(options.body)).toEqual({ fromStage: 2, version: 5, attestation: { confirmed: ['documents_received_or_waived'], statement: 'Synthetic attestation statement' } });
    expect(options.body).not.toMatch(/passed|gateName/);
  });
  it('restaffing sends only the role, person, version and reason to the case team endpoint', async () => {
    await caseService.restaff('case/1', 'reviewer', 'synthetic-reviewer', 7, 'Synthetic restaffing reason');
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/api/cases/case%2F1/team');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ role: 'reviewer', userId: 'synthetic-reviewer', version: 7, reason: 'Synthetic restaffing reason' });
  });
  it('offers only people who hold the live assignment for the case engagement and year, never the current holder', () => {
    const target = { engagementId: 'eng-1', taxYear: 2025, preparerUid: 'prep-a', reviewerUid: 'rev-a' };
    const team = [{ role: 'reviewer', userId: 'rev-a', engagementId: 'eng-1', taxYear: 2025 }, { role: 'reviewer', userId: 'rev-b', engagementId: 'eng-1', taxYear: 2025 },
      { role: 'reviewer', userId: 'rev-other-year', engagementId: 'eng-1', taxYear: 2024 }, { role: 'reviewer', userId: 'rev-other-eng', engagementId: 'eng-2', taxYear: 2025 },
      { role: 'reviewer', userId: 'rev-wide', engagementId: null, taxYear: null }, { role: 'preparer', userId: 'prep-b', engagementId: 'eng-1', taxYear: 2025 }];
    expect(restaffCandidates(team, target, 'reviewer')).toEqual(['rev-b', 'rev-wide']);
    expect(restaffCandidates(team, target, 'preparer')).toEqual(['prep-b']);
  });
  it('explains restaffing refusals', () => {
    expect(caseMessage(new CaseRequestError(409, 'CASE_ASSIGNEE_NOT_ASSIGNED'))).toMatch(/no longer holds this role/);
    expect(caseMessage(new CaseRequestError(409, 'ASSIGNMENT_SEGREGATION_OF_DUTIES'))).toMatch(/independent/);
    expect(caseMessage(new CaseRequestError(403, 'PRACTICE_MANAGER_REQUIRED'))).toMatch(/practice manager or administrator/);
    expect(caseMessage(new CaseRequestError(409, 'CASE_VERSION_CONFLICT'))).toMatch(/changed since it was loaded/);
  });
  it('explains failed checks and external blockers', () => {
    expect(caseMessage(new CaseRequestError(409, 'STAGE_GATE_NOT_MET', ['documents_in_private_storage']))).toBe('Stage requirements are not met: documents in private storage.');
    expect(caseMessage(new CaseRequestError(409, 'STAGE_BLOCKED_FILING_NOT_AUTHORIZED'))).toMatch(/filing is not authorized/);
    expect(caseMessage(new CaseRequestError(403, 'STAGE_ATTESTATION_REQUIRES_REVIEWER'))).toMatch(/case reviewer/);
  });
  it('is reachable from the practice manager navigation and renders the queue controls', () => {
    expect(MANAGER_MODULES).toContain('Case Workflow');
    const html = renderToStaticMarkup(<CaseWorkflowPanel />);
    expect(html).toContain('Case Workflow'); expect(html).toContain('As reviewer'); expect(html).toContain('Loading cases');
  });
});
