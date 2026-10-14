/**
 * Malware-scanner verdict callback (POST /api/vault-scan/callback), proposal 050. Called by the
 * scanning provider, not by users: authenticated by an HMAC signature over the verdict with a
 * configured secret and a timestamp window; the database accepts one verdict per issued request.
 * Answers 503 SCANNER_NOT_CONFIGURED unless a scanner and a durable store are configured. Mounted
 * before the server's general JSON parser with its own 2 KB limit. Responses carry codes only;
 * rejected callbacks are recorded as security events (address fingerprinted when durable).
 */
import express, { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { ScanCoordinator, ScanError, verifyScanCallback } from '../taxguard/documents/malwareScanning';

export interface ScanCallbackDeps { coordinator?: () => ScanCoordinator | null; secret?: () => string | null; tenant?: () => string }

export function createScanCallbackRouter(deps: ScanCallbackDeps = {}) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.post('/callback', express.json({ limit: '2kb', strict: true }), async (req: Request, res: Response) => {
    const coordinator = deps.coordinator?.() ?? null, secret = deps.secret?.() ?? null, tenant = deps.tenant?.() ?? '';
    if (!coordinator || !secret || !tenant) return res.status(503).json({ code: 'SCANNER_NOT_CONFIGURED' });
    try {
      const callback = verifyScanCallback(secret, tenant, req.body, { timestamp: req.get('x-taxguard-scan-timestamp'), signature: req.get('x-taxguard-scan-signature') });
      const state = await coordinator.complete(callback);
      return res.status(200).json({ status: state.status });
    } catch (error) {
      const code = error instanceof ScanError ? error.code : 'SCAN_STORE_UNAVAILABLE';
      const status = error instanceof ScanError ? error.status : 503;
      if (status === 400 || status === 401 || code === 'SCAN_VERDICT_REPLAYED' || code === 'SCAN_PROVIDER_MISMATCH')
        db.logSecurityEvent({ eventType: 'SCANNER_CALLBACK_REJECTED', ipAddress: req.ip || 'unknown', resourceType: 'scan_callback', authorizationResult: 'denied',
          details: 'Scanner callback rejected: ' + code, severity: 'warning' });
      return res.status(status).json({ code });
    }
  });
  router.all('*', (_req, res) => res.status(404).json({ code: 'NOT_FOUND' }));
  // Malformed JSON or an oversized body.
  router.use((error: any, _req: Request, res: Response, _next: express.NextFunction) => res.status(error?.type === 'entity.too.large' ? 413 : 400).json({ code: 'SCAN_CALLBACK_INVALID' }));
  return router;
}
