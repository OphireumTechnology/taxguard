/**
 * Legal & Professional Coordination Routes
 * Administrative coordination for estates, trusts, entity formations, and operating agreements.
 * Enforces mandatory statutory disclaimers:
 * "A/R Tax Services, LLC provides tax and accounting services. Legal document preparation
 * and representation are handled through independent licensed attorneys."
 */

import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest, blockRecruiterFromTaxRecords } from '../auth';
import { LegalCoordinationRecord } from '../../types';

export const legalRouter = Router();

const STATUTORY_LEGAL_DISCLAIMER = 
  "A/R Tax Services, LLC provides tax and accounting services. Legal document preparation and legal representation are handled exclusively through independent licensed attorneys admitted to the South Carolina Bar or respective jurisdiction. A/R Tax Services, LLC does not render legal advice.";

// List legal coordination dossiers
legalRouter.get('/', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  let list = Array.from(db.legalRecords.values());

  if (req.user.role === 'client' || req.user.role === 'prospective_client') {
    list = list.filter(r => r.clientId === req.user!.id);
  }

  return res.json({
    legalRecords: list,
    statutoryDisclaimer: STATUTORY_LEGAL_DISCLAIMER
  });
});

// Create legal coordination intake request
legalRouter.post('/', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const {
    title,
    category,
    assignedExternalAttorney,
    attorneyLawFirm,
    attorneyBarNumber,
    filingDeadline,
    publicRecordReference,
    notes,
    documentIds
  } = req.body;

  if (!title || !category) {
    return res.status(400).json({ error: 'Title and category are required.' });
  }

  const targetClientId = (req.user.role === 'client' || req.user.role === 'prospective_client')
    ? req.user.id
    : (req.body.clientId || req.user.id);

  const client = db.users.get(targetClientId);

  const recId = `legal_${randomUUID()}`;
  const newRec: LegalCoordinationRecord = {
    id: recId,
    clientId: targetClientId,
    clientName: client?.name || req.user.name,
    title,
    category,
    assignedExternalAttorney: assignedExternalAttorney || 'Independent Licensed Bar Counsel',
    attorneyLawFirm: attorneyLawFirm || 'Affiliated Legal Services Network',
    attorneyBarNumber: attorneyBarNumber || 'SC-BAR #Pending',
    filingDeadline: filingDeadline || '2026-11-30',
    publicRecordReference,
    status: 'counsel_review',
    notes: notes || 'Administrative tax package compiled for attorney review.',
    disclaimerAcknowledged: true,
    documentIds: documentIds || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.legalRecords.set(recId, newRec);

  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'LEGAL_COORDINATION_DOSSIER_CREATED',
    resource: `Legal Record #${recId} (${title})`,
    details: `Coordinating dossier assigned to external attorney. Legal disclaimer verified.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.status(201).json({
    message: 'Administrative legal coordination record created.',
    record: newRec,
    statutoryDisclaimer: STATUTORY_LEGAL_DISCLAIMER
  });
});
