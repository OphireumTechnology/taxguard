/**
 * A/R Tax Services, LLC - Profile Amendment Routes
 * Production Profile Amendment Engine (Milestone M3 / Directive 3 & 24)
 *
 * Implements:
 * Certified Original -> Client Amendment Request -> Pending Review -> Practice Console -> Authorized Reviewer -> Approve/Reject -> Versioned Authoritative Profile.
 * Original certified Stage 01 submission is NEVER mutated directly.
 * All changes retain previous value, proposed value, requestor, timestamps, reviewer, disposition, resulting version, and tamper-evident audit record.
 */

import { Router, Response } from 'express';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../auth';

export const profileAmendmentRouter = Router();

profileAmendmentRouter.use(authenticateToken);

// 1. Get Authoritative Profile (Original Stage 01 + Active Versioned Amendments)
profileAmendmentRouter.get('/authoritative', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const clientId = req.user.role === 'client' ? (req.user.clientId || req.user.id) : (req.query.clientId as string || req.user.id);
  const profile = db.getAuthoritativeProfile(clientId);
  const originalDossier = db.clientOnboarding.get(clientId);

  return res.json({
    clientId,
    version: profile.version,
    effectiveAt: profile.effectiveAt,
    lastAmendedAt: profile.lastAmendedAt,
    lastAmendedBy: profile.lastAmendedBy,
    amendedFields: profile.amendedFields,
    originalCertifiedRecord: originalDossier ? {
      legalName: originalDossier.identityContact?.legalFirstName + ' ' + originalDossier.identityContact?.legalLastName,
      email: originalDossier.identityContact?.email,
      phone: originalDossier.identityContact?.mobilePhone,
      residentialAddress: originalDossier.identityContact?.residentialAddress,
      mailingAddress: originalDossier.identityContact?.mailingAddress,
      filingStatus: originalDossier.taxProfile?.filingStatus,
      taxpayerType: originalDossier.entityClassification?.entityType,
      certifiedAt: originalDossier.reviewSubmission?.submittedAt,
      isLocked: Boolean(originalDossier.reviewSubmission?.lockedForClient)
    } : null
  });
});

// 2. List Profile Amendments
profileAmendmentRouter.get('/amendments', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const isStaff = ['accountant', 'senior_reviewer', 'admin', 'super_admin'].includes(req.user.role);
  const requestedClientId = req.query.clientId as string;

  let records = Array.from(db.profileAmendments.values());

  if (!isStaff) {
    const myClientId = req.user.clientId || req.user.id;
    records = records.filter(r => r.clientId === myClientId);
  } else if (requestedClientId) {
    records = records.filter(r => r.clientId === requestedClientId);
  }

  // Sort newest first
  records.sort((a, b) => new Date(b.requestTimestamp).getTime() - new Date(a.requestTimestamp).getTime());

  return res.json({
    totalCount: records.length,
    amendments: records
  });
});

// 3. Client Requests a Profile Amendment
profileAmendmentRouter.post('/amendments', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const {
    field,
    fieldLabel,
    previousValue,
    proposedValue,
    reason,
    isSensitiveIdentityChange,
    verificationDocumentId
  } = req.body;

  if (!field || proposedValue === undefined) {
    return res.status(400).json({ error: 'Field name and proposed value are required.' });
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return res.status(400).json({ error: 'A valid business or factual reason (minimum 5 characters) is required for amendment.' });
  }

  const clientId = req.user.role === 'client' ? (req.user.clientId || req.user.id) : (req.body.clientId || req.user.id);
  const tenantId = process.env.TAXGUARD_TENANT_ID || 'tenantA';

  // High-risk identity change check (e.g. legal name change, SSN/TIN update, entity status)
  const isSensitive = Boolean(isSensitiveIdentityChange || ['legalName', 'tin', 'taxpayerType', 'entityClassification'].includes(field));

  const amendment = db.recordProfileAmendment({
    clientId,
    tenantId,
    field,
    fieldLabel: fieldLabel || field,
    previousValue,
    proposedValue,
    requestingUserId: req.user.id,
    requestingUserEmail: req.user.email,
    isSensitiveIdentityChange: isSensitive,
    additionalVerificationRequired: isSensitive && !verificationDocumentId,
    reason
  });

  return res.status(201).json({
    message: 'Profile amendment request successfully recorded and routed to Practice Console.',
    amendment
  });
});

// 4. Staff / Reviewer Reviews Profile Amendment (Approve / Reject / Request Info)
profileAmendmentRouter.post(
  '/amendments/:id/review',
  requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const { disposition, notes } = req.body;

    if (!disposition || !['APPROVED', 'REJECTED', 'INFO_REQUESTED'].includes(disposition)) {
      return res.status(400).json({ error: 'Valid disposition (APPROVED, REJECTED, INFO_REQUESTED) is required.' });
    }

    const result = db.reviewProfileAmendment({
      amendmentId: req.params.id,
      reviewingUserId: req.user!.id,
      reviewingUserEmail: req.user!.email,
      disposition,
      notes
    });

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    return res.json({
      message: `Profile amendment dispositioned as ${disposition}.`,
      amendment: result.amendment
    });
  }
);
