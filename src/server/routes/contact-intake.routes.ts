import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';

export function createPublicContactRouter() {
  const router = Router();
  router.use(express.json({ limit: '8kb' }));

  router.post('/', (req, res) => {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: 'Name, email, and message are required.' });
    }
    return res.status(201).json({
      success: true,
      referenceId: `contact_${randomUUID().slice(0, 8)}`,
      receivedAt: new Date().toISOString(),
    });
  });

  return router;
}
