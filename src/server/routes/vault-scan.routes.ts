import express, { Router } from 'express';
import type { ScanCoordinator } from '../taxguard/documents/malwareScanning';

export function createScanCallbackRouter(_options: {
  coordinator: () => ScanCoordinator | null;
  secret: () => string | null;
  tenant: () => string;
}) {
  const router = Router();
  router.use(express.json({ limit: '2kb' }));
  router.post('/callback', (_req, res) => {
    res.status(503).json({ code: 'SCANNER_NOT_CONFIGURED' });
  });
  return router;
}
