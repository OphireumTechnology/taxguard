import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import fs from 'node:fs';
import path from 'node:path';
import { createProductionApp } from '../server/productionApp';
import {
  isApiOrServerOnlyPath,
  resolveProductionDistPath,
  resolveProductionIndexHtmlPath,
  resolvePublicAssetsPath,
} from '../server/staticAssetPolicy';
import {
  CANONICAL_ROUTES,
  resolveCanonicalPageRoute,
  canAccessStaffWorkspace,
  resolveAuthoritativeStaffWorkspace,
} from '../config/canonicalRouting';
import { TaxGuardProductionRequestRouter } from '../taxguard/deployment/TaxGuardProductionAdapter';

describe('Production SPA Clean-Route Fallback & Routing Boundary Suite', () => {
  let server: Server;
  let baseUrl = '';
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    const app = createProductionApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('1. Direct URL Entry & Browser Refresh on Canonical Frontend Routes', () => {
    const requiredFrontendRoutes = [
      '/',
      '/about',
      '/services',
      '/industries',
      '/tax-strategies',
      '/book-consultation',
      '/portal',
      '/portal/login',
      '/portal/dashboard',
      '/portal/documents',
      '/portal/requests',
      '/portal/appointments',
      '/portal/profile',
      '/staff',
      '/staff/login',
      '/staff/workspace',
    ];

    it.each(requiredFrontendRoutes)(
      'GET %s serves SPA index.html with HTTP 200 on direct entry and refresh',
      async (routePath) => {
        // First request: Direct URL entry
        const directRes = await fetch(`${baseUrl}${routePath}`, {
          headers: { Accept: 'text/html,application/xhtml+xml' },
        });
        expect(directRes.status).toBe(200);
        expect(directRes.headers.get('content-type')).toContain('text/html');
        expect(directRes.headers.get('x-content-type-options')).toBe('nosniff');

        const html = await directRes.text();
        expect(html).toContain('<!doctype html>');
        expect(html).toContain('<div id="root"></div>');

        // Second request: Browser refresh simulation
        const refreshRes = await fetch(`${baseUrl}${routePath}`, {
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'Cache-Control': 'max-age=0',
          },
        });
        expect(refreshRes.status).toBe(200);
        expect(refreshRes.headers.get('content-type')).toContain('text/html');
        const refreshHtml = await refreshRes.text();
        expect(refreshHtml).toContain('<div id="root"></div>');
      }
    );
  });

  describe('2. Mandatory API & Webhook Exclusion from SPA Fallback', () => {
    it('never swallows /api/health and returns JSON 200', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const body = await res.json();
      expect(body.status).toBe('available');
    });

    it('never swallows unknown /api/* routes into dist/index.html', async () => {
      const res = await fetch(`${baseUrl}/api/this-route-does-not-exist`);
      expect(res.status).toBe(503);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(res.headers.get('content-type')).not.toContain('text/html');
      const body = await res.json();
      expect(body.code).toBe('API_NOT_RELEASED');
    });

    it('never swallows /webhooks or /webhooks/* routes into dist/index.html', async () => {
      const rootWebhook = await fetch(`${baseUrl}/webhooks`);
      expect(rootWebhook.status).toBe(404);
      expect(rootWebhook.headers.get('content-type')).toContain('application/json');
      expect((await rootWebhook.json()).code).toBe('WEBHOOK_NOT_FOUND');

      const nestedWebhook = await fetch(`${baseUrl}/webhooks/stripe-events`);
      expect(nestedWebhook.status).toBe(404);
      expect(nestedWebhook.headers.get('content-type')).toContain('application/json');
      expect((await nestedWebhook.json()).code).toBe('WEBHOOK_NOT_FOUND');
    });

    it('identifies server-only paths accurately in isApiOrServerOnlyPath and TaxGuardProductionRequestRouter', () => {
      expect(isApiOrServerOnlyPath('/api')).toBe(true);
      expect(isApiOrServerOnlyPath('/api/auth/me')).toBe(true);
      expect(isApiOrServerOnlyPath('/webhooks')).toBe(true);
      expect(isApiOrServerOnlyPath('/webhooks/payment')).toBe(true);
      expect(isApiOrServerOnlyPath('/staff')).toBe(false);
      expect(isApiOrServerOnlyPath('/staff/login')).toBe(false);
      expect(isApiOrServerOnlyPath('/portal/login')).toBe(false);

      const webhookDecision = TaxGuardProductionRequestRouter.route({
        path: '/webhooks/provider',
        method: 'POST',
      });
      expect(webhookDecision.runtime).toBe('NODE_API');
      expect(webhookDecision.spaFallbackAllowed).toBe(false);

      const staffDecision = TaxGuardProductionRequestRouter.route({
        path: '/staff/workspace',
        method: 'GET',
      });
      expect(staffDecision.runtime).toBe('STATIC_FRONTEND');
      expect(staffDecision.spaFallbackAllowed).toBe(true);
    });
  });

  describe('3. Static Asset Serving, Build Artifact Protection & Path Resolution', () => {
    it('serves real static assets before the SPA fallback', async () => {
      const res = await fetch(`${baseUrl}/favicon.png`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/png');
    });

    it('blocks executable server bundles, source maps, and archives from being served or falling back to SPA', async () => {
      for (const blockedPath of ['/server.cjs', '/assets/index.js.map', '/backup.zip', '/bundle.tar.gz']) {
        const res = await fetch(`${baseUrl}${blockedPath}`);
        expect(res.status).toBe(404);
      }
    });

    it('redirects legacy /ar-tax-portal paths with 301', async () => {
      const res = await fetch(`${baseUrl}/ar-tax-portal/staff/login`, { redirect: 'manual' });
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe('/staff/login');
    });

    it('resolves production dist, public, and index.html paths cleanly', () => {
      expect(fs.existsSync(resolvePublicAssetsPath())).toBe(true);
      expect(resolveProductionDistPath()).toContain('dist');
      expect(fs.existsSync(resolveProductionIndexHtmlPath())).toBe(true);
    });
  });

  describe('4. Canonical Server-Client Route Alignment & Access Governance', () => {
    it('defines all required canonical route constants', () => {
      expect(CANONICAL_ROUTES.HOME).toBe('/');
      expect(CANONICAL_ROUTES.ABOUT).toBe('/about');
      expect(CANONICAL_ROUTES.SERVICES).toBe('/services');
      expect(CANONICAL_ROUTES.INDUSTRIES).toBe('/industries');
      expect(CANONICAL_ROUTES.TAX_STRATEGIES).toBe('/tax-strategies');
      expect(CANONICAL_ROUTES.BOOK_CONSULTATION).toBe('/book-consultation');
      expect(CANONICAL_ROUTES.PORTAL).toBe('/portal');
      expect(CANONICAL_ROUTES.PORTAL_LOGIN).toBe('/portal/login');
      expect(CANONICAL_ROUTES.PORTAL_DASHBOARD).toBe('/portal/dashboard');
      expect(CANONICAL_ROUTES.PORTAL_DOCUMENTS).toBe('/portal/documents');
      expect(CANONICAL_ROUTES.PORTAL_REQUESTS).toBe('/portal/requests');
      expect(CANONICAL_ROUTES.PORTAL_APPOINTMENTS).toBe('/portal/appointments');
      expect(CANONICAL_ROUTES.PORTAL_PROFILE).toBe('/portal/profile');
      expect(CANONICAL_ROUTES.STAFF).toBe('/staff');
      expect(CANONICAL_ROUTES.STAFF_LOGIN).toBe('/staff/login');
      expect(CANONICAL_ROUTES.STAFF_WORKSPACE).toBe('/staff/workspace');
    });

    it('resolves all public, client portal, and staff portal pathnames in resolveCanonicalPageRoute', () => {
      expect(resolveCanonicalPageRoute('/')).toBe('home');
      expect(resolveCanonicalPageRoute('/about')).toBe('about');
      expect(resolveCanonicalPageRoute('/services')).toBe('services');
      expect(resolveCanonicalPageRoute('/industries')).toBe('industries');
      expect(resolveCanonicalPageRoute('/tax-strategies')).toBe('tax_strategies');
      expect(resolveCanonicalPageRoute('/book-consultation')).toBe('book_consultation');

      expect(resolveCanonicalPageRoute('/portal')).toBe('portal');
      expect(resolveCanonicalPageRoute('/portal/login')).toBe('client_login');
      expect(resolveCanonicalPageRoute('/portal/dashboard')).toBe('portal');
      expect(resolveCanonicalPageRoute('/portal/documents')).toBe('portal');
      expect(resolveCanonicalPageRoute('/portal/requests')).toBe('portal');
      expect(resolveCanonicalPageRoute('/portal/appointments')).toBe('portal');
      expect(resolveCanonicalPageRoute('/portal/profile')).toBe('portal');

      expect(resolveCanonicalPageRoute('/staff')).toBe('staff');
      expect(resolveCanonicalPageRoute('/staff/login')).toBe('staff_login');
      expect(resolveCanonicalPageRoute('/staff/workspace')).toBe('staff');
    });

    it('preserves strict role-based staff workspace access control', () => {
      expect(canAccessStaffWorkspace('client')).toBe(false);
      expect(canAccessStaffWorkspace('prospective_client')).toBe(false);
      expect(canAccessStaffWorkspace(null)).toBe(false);
      expect(canAccessStaffWorkspace('accountant')).toBe(true);
      expect(canAccessStaffWorkspace('reviewer')).toBe(true);
      expect(canAccessStaffWorkspace('admin')).toBe(true);

      expect(resolveAuthoritativeStaffWorkspace('client')).toBeNull();
      expect(resolveAuthoritativeStaffWorkspace('accountant')).toBe('accountant_workspace');
      expect(resolveAuthoritativeStaffWorkspace('reviewer')).toBe('reviewer_workspace');
      expect(resolveAuthoritativeStaffWorkspace('admin')).toBe('admin_dashboard');
    });

    it('verifies server.ts and productionApp.ts both wire createSpaFallbackHandler', () => {
      const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
      const prodAppSource = fs.readFileSync(
        path.resolve(process.cwd(), 'src/server/productionApp.ts'),
        'utf8'
      );

      expect(serverSource).toContain('createSpaFallbackHandler');
      expect(prodAppSource).toContain('createSpaFallbackHandler');
    });
  });
});
