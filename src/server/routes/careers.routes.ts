/**
 * Careers & Recruiting Pipeline Routes
 * Public job postings, application submissions, and recruiter-only workspace.
 * Candidate data is strictly isolated from client financial data.
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../auth';
import { JobListing, Applicant } from '../../types';

export const careersRouter = Router();

// Public: View Active Job Listings (Active & Open only)
careersRouter.get('/jobs', (req: Request, res: Response) => {
  const jobs = Array.from(db.jobs.values()).filter(j => j.status === 'open' && j.isActive !== false);
  return res.json({ jobs });
});

// Public: View Single Job Listing
careersRouter.get('/jobs/:id', (req: Request, res: Response) => {
  const job = db.jobs.get(req.params.id);
  if (!job || !job.isActive || job.status !== 'open') {
    return res.status(404).json({ error: 'Job position not found or no longer accepting applications.' });
  }
  return res.json({ job });
});

// Public: Submit Job Application with strict format, duplicate, and payload controls
careersRouter.post('/apply', (req: Request, res: Response) => {
  try {
    const {
      jobId,
      fullName,
      email,
      phone,
      linkedinUrl,
      yearsExperience,
      resumeFileName,
      coverLetter
    } = req.body;

    // 1. Validate required fields
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ error: 'Valid job position ID is required.' });
    }
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Full legal name is required.' });
    }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    // 2. Format validation: Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // 3. Format validation: Phone (optional or if provided, must be valid)
    if (phone && typeof phone === 'string') {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit telephone number.' });
      }
    }

    // 4. File extension validation: Resume
    const cleanResume = (resumeFileName || 'Candidate_Resume.pdf').trim();
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.rtf'];
    const hasValidExt = allowedExtensions.some(ext => cleanResume.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      return res.status(400).json({ error: 'Resume must be a PDF, DOC, DOCX, or RTF document.' });
    }

    // 5. Check job existence and open status
    const job = db.jobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Position not found.' });
    }
    if (!job.isActive || job.status !== 'open') {
      return res.status(400).json({ error: 'This position is closed or no longer accepting applications.' });
    }

    // 6. Duplicate submission control
    const existingApplicant = Array.from(db.applicants.values()).find(
      a => a.jobId === jobId && a.email.toLowerCase() === cleanEmail
    );
    if (existingApplicant) {
      return res.status(409).json({
        error: 'An application for this position with this email address has already been received. Our recruiting team will follow up directly.'
      });
    }

    const appId = `app_${randomUUID()}`;
    const newApplicant: Applicant = {
      id: appId,
      jobId,
      jobTitle: job.title,
      fullName: fullName.trim(),
      email: cleanEmail,
      phone: phone ? phone.trim() : '',
      linkedinUrl: linkedinUrl ? String(linkedinUrl).trim() : undefined,
      yearsExperience: Number(yearsExperience) || 3,
      resumeFileName: cleanResume,
      coverLetter: coverLetter ? String(coverLetter).trim() : '',
      status: 'submitted',
      appliedAt: new Date().toISOString()
    };

    db.applicants.set(appId, newApplicant);

    // Increment applicant count on job
    job.applicantCount = (job.applicantCount || 0) + 1;
    db.jobs.set(job.id, job);

    // Immutable audit logging (PII masked for privacy)
    db.logAudit({
      userId: 'guest',
      userName: 'Prospective Candidate',
      userRole: 'prospective_client',
      action: 'CAREER_APPLICATION_SUBMITTED',
      resource: `Job #${job.id} (${job.title})`,
      details: `New application submitted for role ${job.title}. Application ID: ${appId}.`,
      ipAddress: req.ip || 'unknown',
      severity: 'info'
    });

    return res.status(201).json({
      message: 'Application received successfully. Our recruiting team will review your qualifications.',
      applicantId: appId
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Application processing failed. Please try again later.' });
  }
});

// RECRUITER WORKSPACE: Strictly restricted to recruiter, admin, super_admin
careersRouter.get('/applicants', authenticateToken, requireRole('recruiter', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  const { jobId, status } = req.query;

  let list = Array.from(db.applicants.values());
  if (jobId && typeof jobId === 'string') {
    list = list.filter(a => a.jobId === jobId);
  }
  if (status && typeof status === 'string') {
    list = list.filter(a => a.status === status);
  }

  return res.json({ applicants: list });
});

// Recruiter: Update applicant status
careersRouter.patch('/applicants/:id/status', authenticateToken, requireRole('recruiter', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  const applicant = db.applicants.get(req.params.id);
  if (!applicant) return res.status(404).json({ error: 'Applicant record not found.' });

  const { status, rating, internalNotes, interviewDate } = req.body;

  if (status) applicant.status = status;
  if (rating !== undefined) applicant.rating = rating;
  if (internalNotes) applicant.internalNotes = internalNotes;
  if (interviewDate) applicant.interviewDate = interviewDate;

  db.applicants.set(applicant.id, applicant);

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: `APPLICANT_STATUS_${status ? status.toUpperCase() : 'UPDATED'}`,
    resource: `Applicant #${applicant.id} (${applicant.fullName})`,
    details: `Candidate status updated to ${status}. Evaluated by ${req.user!.name}.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({ message: 'Candidate record updated.', applicant });
});
