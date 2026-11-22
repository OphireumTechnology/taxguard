import { Router } from 'express';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';

export function staffAccessDevelopmentConfigured(): boolean {
  return process.env.NODE_ENV !== 'production' && practiceStoreConfigured();
}

export function createStaffAccessRouter() {
  const router = Router();
  router.use((_req, res) => {
    res.status(503).json({
      code: 'DURABLE_STAFF_ACCESS_UNAVAILABLE',
      error: 'Durable staff access store is not configured in this environment.',
    });
  });
  return router;
}
