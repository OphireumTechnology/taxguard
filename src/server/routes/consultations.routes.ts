import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { authenticateToken } from '../auth';

const localConsultationRequests: any[] = [];

export function createPublicConsultationRouter() {
  const router = Router();
  router.use(express.json({ limit: '8kb' }));

  router.post('/', (req, res) => {
    const body = req.body || {};
    const name = String(body.name || body.fullName || '').trim();
    const email = String(body.email || '').trim();
    if (!name || !email) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: 'Name and email are required.' });
    }
    const record = {
      id: `consult_${randomUUID().slice(0, 8)}`,
      name,
      email,
      phone: body.phone || '',
      serviceType: body.serviceType || body.topic || 'General Tax Advisory',
      preferredDate: body.preferredDate || null,
      preferredTime: body.preferredTime || null,
      notes: body.notes || body.message || '',
      status: 'received',
      createdAt: new Date().toISOString(),
    };
    localConsultationRequests.push(record);
    return res.status(201).json({ success: true, request: record, referenceId: record.id });
  });

  return router;
}

export function createConsultationReviewRouter() {
  const router = Router();
  router.use(authenticateToken);

  router.get('/', (_req, res) => {
    if (!practiceStoreConfigured()) {
      return res.json({ items: localConsultationRequests, source: 'local' });
    }
    return res.json({ items: localConsultationRequests, source: 'durable' });
  });

  return router;
}
