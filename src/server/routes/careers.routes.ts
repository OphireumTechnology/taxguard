import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db';

export const careersRouter = Router();

careersRouter.get('/jobs', (_req, res) => {
  res.json({ jobs: Array.from(db.jobs.values()) });
});

careersRouter.post('/apply', (req, res) => {
  const { jobId, name, email, phone, coverLetter, linkedinUrl } = req.body || {};
  if (!jobId || !name || !email) {
    return res.status(400).json({ error: 'Job ID, name, and email are required.' });
  }
  const applicant: any = {
    id: `app_${randomUUID().slice(0, 8)}`,
    jobId,
    name,
    email,
    phone: phone || '',
    coverLetter: coverLetter || '',
    linkedinUrl: linkedinUrl || '',
    status: 'submitted',
    appliedAt: new Date().toISOString(),
  };
  db.applicants.set(applicant.id, applicant);
  return res.status(201).json({ success: true, applicantId: applicant.id, applicant });
});
