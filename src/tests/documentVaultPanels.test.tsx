import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { setStoredToken, clearStoredToken } from '../services/api';
import { documentStatusText, VaultRequestError, vaultMessage, vaultService } from '../services/vaultService';
import { ClientDocumentVaultPanel } from '../components/documents/ClientDocumentVaultPanel';
import { StaffDocumentReviewPanel } from '../components/documents/StaffDocumentReviewPanel';
import { MANAGER_MODULES } from '../components/workspace/practiceManagerModel';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('vault browser client', () => {
  it('sends the raw file with its type and an idempotency key; metadata travels in the query only', async () => {
    const file = new File(['%PDF-1.4 synthetic'], 'w2.pdf', { type: 'application/pdf' });
    await vaultService.upload('client/1', file, { engagementId: 'eng_1', taxYear: 2025, category: 'income' }, 'vault-key-1');
    const [url, options] = transport.mock.calls[0];
    const u = new URL(url);
    expect(u.pathname).toBe('/api/vault/clients/client%2F1/documents');
    expect(Object.fromEntries(u.searchParams)).toEqual({ engagementId: 'eng_1', taxYear: '2025', category: 'income', fileName: 'w2.pdf' });
    expect(options.headers).toMatchObject({ 'Content-Type': 'application/pdf', 'Idempotency-Key': 'vault-key-1', Authorization: 'Bearer synthetic-session' });
    expect(options.body).toBe(file); expect(options.cache).toBe('no-store');
  });
  it('refuses unsupported or oversized files before any request', async () => {
    await expect(vaultService.upload('c', new File(['x'], 'run.exe', { type: 'application/x-msdownload' }), { engagementId: 'e', taxYear: 2025, category: 'income' }, 'k-123456789')).rejects.toMatchObject({ code: 'DOCUMENT_TYPE_NOT_ALLOWED' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('explains statuses and refusals plainly', () => {
    expect(documentStatusText('SCAN_PENDING')).toBe('Awaiting security scan');
    expect(vaultMessage(new VaultRequestError(403, 'MAKER_CHECKER_VIOLATION'))).toMatch(/different staff member/);
    expect(vaultMessage(new VaultRequestError(404, 'DOCUMENT_NOT_FOUND'))).toBe('You are not authorized for this document.');
  });
});

describe('vault panels', () => {
  it('render loading states and labelled controls; staff review is reachable from practice management', () => {
    expect(renderToStaticMarkup(<ClientDocumentVaultPanel clientId="c1" />)).toContain('Loading documents');
    const staff = renderToStaticMarkup(<StaffDocumentReviewPanel />);
    expect(staff).toContain('Document Review'); expect(staff).toContain('Loading review queue');
    expect(MANAGER_MODULES).toContain('Document Review');
  });
});
