import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import { createProductionApp } from '../server/productionApp';

// Production responses must not be framable by another site (clickjacking of the authenticated portals) and must
// tell browsers to keep using HTTPS. The development server deliberately allows framing for preview tools; the
// production app never does.
describe('production framing and transport headers', () => {
  let server: Server; let baseUrl = '';
  const originalNodeEnv = process.env.NODE_ENV;
  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    const app = createProductionApp();
    await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', () => { const a = server.address(); if (a && typeof a === 'object') baseUrl = `http://127.0.0.1:${a.port}`; resolve(); }); });
  });
  afterAll(async () => { process.env.NODE_ENV = originalNodeEnv; await new Promise<void>(resolve => server.close(() => resolve())); });

  it('the server entry point applies the same policy in production and keeps framing open only in development', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync('server.ts', 'utf8');
    expect(source).toContain("applyFramingPolicy(res, process.env.NODE_ENV === 'production');");
    expect(source).not.toMatch(/res\.removeHeader\(\s*'X-Frame-Options'\s*\)/);
    const { applyFramingPolicy, PRODUCTION_FRAMING_HEADERS } = await import('../server/securityHeaders');
    const headers = new Map<string, string>();
    const res = { setHeader: (k: string, v: string) => headers.set(k, v), removeHeader: (k: string) => headers.delete(k) } as any;
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    applyFramingPolicy(res, false);
    expect([...headers.keys()]).toEqual([]);
    applyFramingPolicy(res, true);
    expect(Object.fromEntries(headers)).toEqual(PRODUCTION_FRAMING_HEADERS);
  });

  it.each(['/', '/portal/login', '/staff/workspace', '/api/health', '/api/does-not-exist'])('%s is not framable and requires HTTPS', async path => {
    const res = await fetch(baseUrl + path, { headers: { Accept: path.startsWith('/api') ? 'application/json' : 'text/html' } });
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('strict-transport-security')).toMatch(/^max-age=\d{7,}; includeSubDomains$/);
  });
});
