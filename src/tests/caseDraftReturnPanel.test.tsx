import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { clearStoredToken, setStoredToken } from '../services/api';
import { FINAL_STATUS_REASON_LABELS, finalAuthorizationText, READINESS_REASON_LABELS, readinessText, RETURN_RISK_REASON_LABELS, returnProblems, returnProblemText, returnRiskText,
  SIGNATURE_STATUS_REASON_LABELS, comparisonLineText, signaturePackageText, TaxEngineRequestError, taxEngineMessage, taxEngineService, verificationText } from '../services/taxEngineService';
import { actionNotice, CaseDraftReturnPanel, returnBadge } from '../components/workspace/CaseDraftReturnPanel';
import { practiceManagerRequestAllowed } from '../server/practiceManagerAccess';
import { qcOutcomeText, QualityControlQueuePanel } from '../components/workspace/QualityControlQueuePanel';
import { FinalAuthorizationQueuePanel, finalOutcomeText } from '../components/workspace/FinalAuthorizationQueuePanel';
import { SignatureReleaseForm } from '../components/workspace/SignatureReleaseForm';
import { ComparisonLines, ReturnComparisonView } from '../components/workspace/ReturnComparisonView';

// Block 68 browser client and panel. The server rules are covered on PostgreSQL in taxReturnPreparation.db.test.ts.
const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const ID = '0123abcd-0000-4000-8000-000000000001';

describe('draft returns in the browser client', () => {
  it('relays each request to its scoped route and sends only the template, or only a note', async () => {
    await taxEngineService.returnTemplates(2025);
    await taxEngineService.caseReturns('case/1');
    await taxEngineService.prepareReturn('case-1', ID);
    await taxEngineService.returnVersion(ID);
    await taxEngineService.transitionReturn(ID, 'submit');
    await taxEngineService.transitionReturn(ID, 'return', 'Synthetic: correct line 1a');
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/tax-engine', ''), init.method, init.body ? JSON.parse(init.body) : undefined])).toEqual([
      ['/return-templates?taxYear=2025', 'GET', undefined],
      ['/cases/case%2F1/returns', 'GET', undefined],
      ['/cases/case-1/returns', 'POST', { templateRuleId: ID }],
      [`/returns/${ID}`, 'GET', undefined],
      [`/returns/${ID}/submit`, 'POST', {}],
      [`/returns/${ID}/return`, 'POST', { note: 'Synthetic: correct line 1a' }],
    ]);
  });

  it('shows stale before any status, and explains a refused preparation form by form', () => {
    expect(returnBadge({ status: 'APPROVED', stale: [{ reason: 'RETURN_MAPPING_CHANGED', formId: 'SYN-1040' }] })).toBe('STALE');
    expect(returnBadge({ status: 'SUBMITTED', stale: [] })).toBe('SUBMITTED');
    expect(returnBadge({ status: 'SUPERSEDED', stale: [{ reason: 'RETURN_MAPPING_STALE' }] })).toBe('SUPERSEDED');
    expect(returnProblemText({ reason: 'RETURN_FORM_MISSING', formId: 'SYN-1040', formVersion: '2025.0' })).toBe('SYN-1040 2025.0: no current form mapping');
    expect(returnProblemText({ reason: 'RETURN_BLOCKING_DIAGNOSTICS', blocking: 2 })).toBe('the case has blocking diagnostics (2)');
    expect(returnProblemText({ reason: 'RETURN_TEMPLATE_REJECTED' })).toBe('the return template is rejected');
    expect(returnProblems('not json')).toEqual([]);
    const detail = JSON.stringify([{ formId: 'SYN-1040', formVersion: '2025.0', reason: 'RETURN_MAPPING_STALE', mappingId: ID }]);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_PREPARATION_REFUSED', detail)))
      .toBe('Preparation refused: nothing was written. SYN-1040 2025.0: the form mapping is stale; map the form again.');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_STALE', detail)))
      .toBe('Refused: this version is stale. SYN-1040 2025.0: the form mapping is stale; map the form again. Prepare the return again.');
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'TAX_RETURN_REVIEWER_REQUIRED'))).toBe("Only the case's independent reviewer can approve or return the draft return.");
  });

  it('announces a confirmed action only over refreshed server data, and says so when the refresh failed', () => {
    expect(actionNotice('Version 1 of SYN-1040-RETURN: approved.', null)).toEqual({ error: false, text: 'Version 1 of SYN-1040-RETURN: approved.' });
    expect(actionNotice('Version 1 of SYN-1040-RETURN: approved.', 'The tax rules service did not confirm this action.')).toEqual({ error: true,
      text: 'Version 1 of SYN-1040-RETURN: approved. The list below could not be refreshed, so it may not show this yet: The tax rules service did not confirm this action. Use Refresh draft returns.' });
  });

  it('describes a calculation verification, and why approval waits for one (Block 69)', () => {
    expect(verificationText({ result: 'VERIFIED', findings: [], runs: [{ runId: ID, ruleSetId: ID, recordedOutputSha256: 'a', recomputedOutputSha256: 'a' }] }))
      .toBe('verified: 1 calculation run recalculated with identical results');
    expect(verificationText({ result: 'DISCREPANCY', runs: [], findings: [{ runId: ID, reason: 'RECALCULATION_MISMATCH' }, { formId: 'SYN-1040', line: '1a', reason: 'VALUE_SOURCE_MISMATCH' }] }))
      .toBe('discrepancy: run 0123abcd: recalculating the run gives a different result; SYN-1040 line 1a: the value differs from the sum of the sources it cites');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_VERIFICATION_REQUIRED', 'NONE'))).toBe('Approval refused: verify the calculations of this version first.');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_VERIFICATION_REQUIRED', 'DISCREPANCY')))
      .toBe('Approval refused: the latest calculation verification of this version found a discrepancy. Return it to the preparer.');
  });

  it('sends only the amount at stake for a return risk assessment, and describes its outcome and reasons (Block 71)', async () => {
    await taxEngineService.assessReturnRisk(ID, 50_000);
    await taxEngineService.returnRisk(ID);
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/tax-engine', ''), init.method, init.body ? JSON.parse(init.body) : undefined])).toEqual([
      [`/returns/${ID}/risk`, 'POST', { amountCents: 50_000 }],
      [`/returns/${ID}/risk`, 'GET', undefined],
    ]);
    expect(returnRiskText({ outcome: 'BLOCKED', reasonCodes: ['RETURN_HUMAN_REVIEW_REQUIRED', 'RETURN_VERIFICATION_DISCREPANCY'] }))
      .toBe('blocked: Every return has human review (practice decision); The latest calculation verification found a discrepancy');
    for (const label of Object.values(RETURN_RISK_REASON_LABELS)) expect(label).toMatch(/\.$/);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_SUPERSEDED'))).toBe('This version has been superseded; assess the current version.');
  });

  it('relays quality control and readiness requests to their routes with only the documented fields (Block 72)', async () => {
    await taxEngineService.assignQc(ID, 'qc-1');
    await taxEngineService.revokeQc(ID, 'Synthetic: rotating reviewers');
    await taxEngineService.qcQueue();
    await taxEngineService.qcContext(ID);
    await taxEngineService.recordQc(ID, [{ code: 'TIES', result: 'PASS' }]);
    await taxEngineService.recordQc(ID, [{ code: 'TIES', result: 'FAIL', note: 'Synthetic' }], 'Synthetic: prepare again');
    await taxEngineService.qcReviews(ID);
    await taxEngineService.returnReadiness(ID);
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/tax-engine', ''), init.method, init.body ? JSON.parse(init.body) : undefined])).toEqual([
      [`/returns/${ID}/qc-assignment`, 'POST', { qcUid: 'qc-1' }],
      [`/returns/${ID}/qc-assignment/revoke`, 'POST', { reason: 'Synthetic: rotating reviewers' }],
      ['/qc/queue', 'GET', undefined],
      [`/returns/${ID}/qc-context`, 'GET', undefined],
      [`/returns/${ID}/qc`, 'POST', { results: [{ code: 'TIES', result: 'PASS' }] }],
      [`/returns/${ID}/qc`, 'POST', { results: [{ code: 'TIES', result: 'FAIL', note: 'Synthetic' }], note: 'Synthetic: prepare again' }],
      [`/returns/${ID}/qc-reviews`, 'GET', undefined],
      [`/returns/${ID}/readiness`, 'GET', undefined],
    ]);
  });

  it('says what final readiness means and why a version is not ready, and never calls it filed or signed', () => {
    expect(readinessText({ ready: true, reasons: [] })).toBe('ready for Stage 10 final authorization by an authorized professional (nothing is signed or filed)');
    expect(readinessText({ ready: false, reasons: ['RISK_NOT_CURRENT', 'QC_RETURNED'] }))
      .toBe('not ready: no risk assessment since the latest approval and diagnostics run; quality control returned the version');
    for (const code of ['NOT_APPROVED', 'STALE', 'NOT_VERIFIED', 'DIAGNOSTICS_NOT_CURRENT', 'DIAGNOSTICS_OPEN', 'RISK_NOT_CURRENT', 'RISK_BLOCKED', 'QC_NOT_RECORDED', 'QC_RETURNED', 'QC_NOT_CURRENT'])
      expect(READINESS_REASON_LABELS[code], code).toBeTruthy();
    expect(qcOutcomeText('QC_RETURNED')).toBe('returned to the preparer');
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'TAX_RETURN_QC_AUTHORITY_REQUIRED', 'NO_POLICY'))).toMatch(/^Quality control refused: it needs the QC authority under the practice's approved policy\. /);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_QC_NOT_INDEPENDENT'))).toBe('The quality control reviewer must be a third person: not the preparer, the reviewer or the assigning manager.');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_QC_CHECKLIST_REQUIRED'))).toBe('The practice has no approved quality control checklist, so quality control cannot be recorded.');
    const html = renderToStaticMarkup(<QualityControlQueuePanel />);
    expect(html).toContain('<h2 id="qc-queue-heading" tabindex="-1">My quality control queue');
    expect(html).toContain('<div role="status" aria-label="Quality control result"></div>');
    expect(html).toContain('Return use: BLOCKED.');
  });

  it('relays Stage 10 requests with only the documented fields and describes the decision without calling it signed or filed (Block 73)', async () => {
    await taxEngineService.assignFinalAuthorizer(ID, 'fa-1');
    await taxEngineService.revokeFinalAuthorizer(ID, 'Synthetic: rotating authorizers');
    await taxEngineService.finalQueue();
    await taxEngineService.finalContext(ID);
    await taxEngineService.decideFinal(ID, { outcome: 'AUTHORIZED', attestationVersion: 2, acknowledged: true });
    await taxEngineService.decideFinal(ID, { outcome: 'DECLINED', attestationVersion: 2, acknowledged: true, note: 'Synthetic: explain line 16' });
    await taxEngineService.finalAuthorizations(ID);
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/tax-engine', ''), init.method, init.body ? JSON.parse(init.body) : undefined])).toEqual([
      [`/returns/${ID}/final-assignment`, 'POST', { authorizerUid: 'fa-1' }],
      [`/returns/${ID}/final-assignment/revoke`, 'POST', { reason: 'Synthetic: rotating authorizers' }],
      ['/final/queue', 'GET', undefined],
      [`/returns/${ID}/final-context`, 'GET', undefined],
      [`/returns/${ID}/final-authorization`, 'POST', { outcome: 'AUTHORIZED', attestationVersion: 2, acknowledged: true }],
      [`/returns/${ID}/final-authorization`, 'POST', { outcome: 'DECLINED', attestationVersion: 2, acknowledged: true, note: 'Synthetic: explain line 16' }],
      [`/returns/${ID}/final-authorizations`, 'GET', undefined],
    ]);
    const decision = { authorizationId: ID, outcome: 'DECLINED' as const, note: 'Synthetic: explain line 16', attestationVersion: 2, decidedBy: 'fa-1', decidedAt: '2026-10-30T00:00:00Z' };
    expect(finalAuthorizationText({ stage10: 'AUTHORIZED' })).toBe('final authorization given; the client signature (Stage 11) is next, and nothing is signed or filed');
    expect(finalAuthorizationText({ stage10: 'FINAL_AUTHORIZATION_REQUIRED', finalAuthorization: { decision: null, current: false, reasons: [] } })).toBe('final authorization required');
    expect(finalAuthorizationText({ stage10: 'FINAL_AUTHORIZATION_REQUIRED', finalAuthorization: { decision, current: true, reasons: [] } }))
      .toBe('final authorization declined: Synthetic: explain line 16');
    expect(finalAuthorizationText({ stage10: 'FINAL_AUTHORIZATION_REQUIRED', finalAuthorization: { decision: { ...decision, outcome: 'AUTHORIZED' }, current: false,
      reasons: ['RISK_REASSESSED', 'ATTESTATION_CHANGED'] } })).toBe('final authorization required again: risk was assessed again; the practice approved a new attestation text');
    for (const code of ['NOT_READY', 'FORMS_CHANGED', 'VERIFICATION_CHANGED', 'DIAGNOSTICS_RERUN', 'RISK_REASSESSED', 'QC_REVIEWED_AGAIN', 'ATTESTATION_CHANGED'])
      expect(FINAL_STATUS_REASON_LABELS[code], code).toBeTruthy();
    expect(finalOutcomeText(null)).toBe('not decided yet');
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'TAX_RETURN_FINAL_AUTHORITY_REQUIRED', 'NO_POLICY')))
      .toMatch(/^Final authorization refused: it needs the final authorization authority under the practice's approved policy\. /);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_NOT_READY', '["QC_NOT_CURRENT"]')))
      .toBe('Final authorization refused: the version is not ready: the quality control review predates the current risk assessment, diagnostics or checklist.');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_NOT_READY', 'not json'))).toBe('Final authorization refused: the version is not ready.');
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'STAFF_RECENT_SIGN_IN_REQUIRED'))).toBe('Sign in again: this action needs a recent sign-in.');
    const html = renderToStaticMarkup(<FinalAuthorizationQueuePanel />);
    expect(html).toContain('<h2 id="final-queue-heading" tabindex="-1">My final authorization queue');
    expect(html).toContain('<div role="status" aria-label="Final authorization result"></div>');
    expect(html).toContain('Return use: BLOCKED.');
    const panel = renderToStaticMarkup(<CaseDraftReturnPanel caseId="case-1" taxYear={2025} returnFamily="1040" />);
    expect(panel).toContain('Authorization does not sign or file it.');
  });

  it('lets practice managers assign and read Stage 10, but never authorize (Block 73)', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', 'durable');
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key');
    for (const path of ['/api/tax-engine/final/queue', `/api/tax-engine/returns/${ID}/final-context`, `/api/tax-engine/returns/${ID}/final-authorizations`])
      expect(practiceManagerRequestAllowed('practice_manager', 'GET', path), path).toBe(true);
    for (const path of [`/api/tax-engine/returns/${ID}/final-assignment`, `/api/tax-engine/returns/${ID}/final-assignment/revoke`])
      expect(practiceManagerRequestAllowed('practice_manager', 'POST', path), path).toBe(true);
    expect(practiceManagerRequestAllowed('practice_manager', 'POST', `/api/tax-engine/returns/${ID}/final-authorization`)).toBe(false);
  });

  it('relays Stage 11 releases with only the documented fields and never calls a release signed, sent or filed (Block 74)', async () => {
    await taxEngineService.signatureContext(ID);
    await taxEngineService.releaseSignaturePackage(ID, { consentVersion: 3, acknowledged: true, signers: ['client-1', 'client-2'] });
    await taxEngineService.withdrawSignaturePackage(ID, 'Synthetic: the decision lapsed');
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/tax-engine', ''), init.method, init.body ? JSON.parse(init.body) : undefined])).toEqual([
      [`/returns/${ID}/signature-context`, 'GET', undefined],
      [`/returns/${ID}/signature-package`, 'POST', { consentVersion: 3, acknowledged: true, signers: ['client-1', 'client-2'] }],
      [`/returns/${ID}/signature-package/withdraw`, 'POST', { reason: 'Synthetic: the decision lapsed' }],
    ]);
    const pkg = { packageId: ID, returnVersionId: ID, authorizationId: ID, consentVersion: 3, signerUids: ['client-1'], releasedBy: 'rel-1', releasedAt: '2026-10-30T00:00:00Z',
      withdrawnBy: null, withdrawnAt: null, withdrawReason: null };
    expect(signaturePackageText({ stage11: 'SIGNATURE_PACKAGE_RELEASED' }))
      .toBe('released for client signature; electronic signing is not available yet, and nothing is signed or filed');
    expect(signaturePackageText({ stage11: 'CLIENT_SIGNATURE_REQUIRED', signaturePackage: { package: null, current: false, reasons: [] } })).toBe('not released for client signature yet');
    expect(signaturePackageText({ stage11: 'CLIENT_SIGNATURE_REQUIRED', signaturePackage: { package: pkg, current: false, reasons: ['CONSENT_CHANGED'] } }))
      .toBe('the released package is no longer current: the practice approved a new consent text; withdraw it');
    expect(signaturePackageText({ stage11: 'NOT_STARTED' })).toBe('not started');
    for (const code of ['FINAL_AUTHORIZATION_NOT_CURRENT', 'FINAL_AUTHORIZATION_CHANGED', 'CONSENT_CHANGED']) expect(SIGNATURE_STATUS_REASON_LABELS[code], code).toBeTruthy();
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'TAX_RETURN_SIGNATURE_AUTHORITY_REQUIRED', 'NO_POLICY')))
      .toMatch(/^Release refused: it needs the signature release authority under the practice's approved policy\. /);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_SIGNATURE_NOT_AUTHORIZED', '["NOT_READY","DIAGNOSTICS_RERUN"]')))
      .toBe('Release refused: the version is no longer ready; diagnostics were run again.');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_SIGNATURE_NOT_AUTHORIZED', '["NO_DECISION"]'))).toBe('Release refused: it has no Stage 10 decision.');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_SIGNATURE_NOT_AUTHORIZED', 'not json'))).toBe('Release refused: the version has no current Stage 10 authorization.');
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'TAX_RETURN_SIGNATURE_SESSION_REQUIRED'))).toMatch(/multi-factor session/);
    const form = renderToStaticMarkup(<SignatureReleaseForm returnVersionId={ID} name="SYN-1040-RETURN version 1" />);
    expect(form).toContain('Loading the signature status');
    const panel = renderToStaticMarkup(<CaseDraftReturnPanel caseId="case-1" taxYear={2025} returnFamily="1040" />);
    expect(panel).toContain('Electronic signing is not available, and nothing is sent, signed or filed.');
  });

  it('lets practice managers read and withdraw Stage 11 packages; the database decides whether they may release (Block 74)', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', 'durable');
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key');
    for (const path of [`/api/tax-engine/returns/${ID}/signature-context`, `/api/tax-engine/returns/${ID}/signature-packages`])
      expect(practiceManagerRequestAllowed('practice_manager', 'GET', path), path).toBe(true);
    for (const path of [`/api/tax-engine/returns/${ID}/signature-package`, `/api/tax-engine/returns/${ID}/signature-package/withdraw`])
      expect(practiceManagerRequestAllowed('practice_manager', 'POST', path), path).toBe(true);
    expect(practiceManagerRequestAllowed('practice_manager', 'POST', `/api/tax-engine/returns/${ID}/signature-package/sign`)).toBe(false);
  });

  it('reads the return comparison, describes each line and flags only what the variance policy flagged (Block 75)', async () => {
    await taxEngineService.returnComparison(ID);
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/tax-engine', ''), init.method, init.body])).toEqual([
      [`/returns/${ID}/comparison`, 'GET', undefined]]);
    const base = { formId: 'SYN-1040', priorFormVersion: '2024.0', formVersion: '2025.0', schedule: 'MAIN', line: '1a', field: 'f1_wages', valueType: 'MONEY' as const };
    const changed = { ...base, kind: 'CHANGED' as const, priorValue: '4000.00', value: '6000.00', change: '2000.00', changeBasisPoints: 5000, variance: true };
    expect(comparisonLineText(changed))
      .toBe('SYN-1040 MAIN line 1a (f1_wages): changed, 4000.00 to 6000.00 (change 2000.00, 50.00%); above the practice variance threshold, review it');
    expect(comparisonLineText({ ...changed, variance: null })).toBe('SYN-1040 MAIN line 1a (f1_wages): changed, 4000.00 to 6000.00 (change 2000.00, 50.00%)');
    expect(comparisonLineText({ ...base, kind: 'ADDED', priorValue: null, value: '10.00', change: '10.00', changeBasisPoints: null, variance: false }))
      .toBe('SYN-1040 MAIN line 1a (f1_wages): new line, 10.00');
    expect(comparisonLineText({ ...base, kind: 'REMOVED', priorValue: '10.00', value: null, change: '-10.00', changeBasisPoints: null, variance: null }))
      .toBe('SYN-1040 MAIN line 1a (f1_wages): no longer on the return, was 10.00');
    expect(comparisonLineText({ ...base, kind: 'AMBIGUOUS', priorValue: null, value: null, change: null, changeBasisPoints: null, variance: null }))
      .toBe('SYN-1040 MAIN line 1a (f1_wages): not compared: the line identifier is not unique');
    const unchanged = { ...base, field: 'f1_tax', line: '16', kind: 'UNCHANGED' as const, priorValue: '290.00', value: '290.00', change: '0.00', changeBasisPoints: 0, variance: null };
    const list = renderToStaticMarkup(<ComparisonLines label="Changes against 2024" lines={[changed, unchanged]} />);
    expect(list).toContain('1 of 2 lines differ; 1 above the variance threshold.');
    expect(list).toContain('<ul aria-label="Changes against 2024"><li data-variance="true">');
    expect(list).not.toContain('f1_tax');
    expect(renderToStaticMarkup(<ComparisonLines label="x" lines={[unchanged]} />)).toBe('<p>No line changed.</p>');
    expect(renderToStaticMarkup(<ReturnComparisonView returnVersionId={ID} name="SYN-1040-RETURN version 2" />))
      .toBe('<p role="status">Loading the comparison of SYN-1040-RETURN version 2…</p>');
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', 'durable');
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key');
    expect(practiceManagerRequestAllowed('practice_manager', 'GET', `/api/tax-engine/returns/${ID}/comparison`)).toBe(true);
    expect(practiceManagerRequestAllowed('practice_manager', 'POST', `/api/tax-engine/returns/${ID}/comparison`)).toBe(false);
  });

  it('renders the preparation form with its live region, focusable heading and the reason preparation may be refused', () => {
    const html = renderToStaticMarkup(<CaseDraftReturnPanel caseId="case-1" taxYear={2025} returnFamily="1040" />);
    expect(html).toContain('<h4 id="case-draft-return-heading" tabindex="-1">Draft return</h4>');
    expect(html).toContain('<div role="status" aria-label="Draft return result"></div>');
    expect(html).toContain('No approved template for 1040 2025');
    expect(html).toMatch(/<button disabled="" aria-describedby="case-draft-return-hint">Prepare draft return<\/button>/);
    expect(html).toContain('Final professional authorization is a separate step (Stage 10). Return use: BLOCKED.');
    expect(html).toContain('the outcome is never better than human review.');
  });

  it('lets practice managers read returns and draft templates, but not prepare, submit or approve', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', 'durable');
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key');
    for (const path of ['/api/tax-engine/return-templates', `/api/tax-engine/return-templates/${ID}`, '/api/tax-engine/cases/c1/returns',
      '/api/tax-engine/cases/c1/returns/stage-facts', `/api/tax-engine/returns/${ID}`, `/api/tax-engine/returns/${ID}/risk`,
      `/api/tax-engine/returns/${ID}/qc-reviews`, `/api/tax-engine/returns/${ID}/readiness`, `/api/tax-engine/returns/${ID}/qc-context`, '/api/tax-engine/qc/queue'])
      expect(practiceManagerRequestAllowed('practice_manager', 'GET', path), path).toBe(true);
    for (const path of ['/api/tax-engine/return-templates', `/api/tax-engine/return-templates/${ID}/submit`, `/api/tax-engine/returns/${ID}/qc-assignment`,
      `/api/tax-engine/returns/${ID}/qc-assignment/revoke`])
      expect(practiceManagerRequestAllowed('practice_manager', 'POST', path), path).toBe(true);
    for (const path of [`/api/tax-engine/return-templates/${ID}/approve`, '/api/tax-engine/cases/c1/returns', `/api/tax-engine/returns/${ID}/submit`,
      `/api/tax-engine/returns/${ID}/approve`, `/api/tax-engine/returns/${ID}/return`, `/api/tax-engine/returns/${ID}/risk`, `/api/tax-engine/returns/${ID}/qc`])
      expect(practiceManagerRequestAllowed('practice_manager', 'POST', path), path).toBe(false);
  });
});
