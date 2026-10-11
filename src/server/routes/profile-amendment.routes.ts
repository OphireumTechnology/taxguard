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
import {
  authenticateToken,
  AuthenticatedRequest,
  requireRole,
  resolveAuthorizedClientContext
} from '../auth';
import { SupabaseDurableSessions } from '../supabase-db';

export const profileAmendmentRouter = Router();

profileAmendmentRouter.use(authenticateToken);
profileAmendmentRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

const SENSITIVE_FIELDS = [
  'legalName',
  'tin',
  'ssn',
  'ein',
  'itin',
  'taxpayerType',
  'entityClassification',
  'dateOfBirth',
  'authorizedRep',
  'supportingDocs'
];

// 1. Get Authoritative Profile (Original Stage 01 + Active Versioned Amendments + All 7 Profile Sections)
profileAmendmentRouter.get('/authoritative', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const context = resolveAuthorizedClientContext(
    req,
    res,
    'authoritative_profile',
    typeof req.query.clientId === 'string' ? req.query.clientId : undefined
  );
  if (!context) return;
  const { clientId } = context;
  const profile = db.getAuthoritativeProfile(clientId);
  const user = (req.user.role === 'client' || req.user.role === 'prospective_client')
    ? req.user
    : db.users.get(clientId) || req.user;
  const rawDossier = db.clientOnboarding.get(clientId) || {};
  const originalDossier = {
    ...(user.stageOneDossier || {}),
    ...(profile.originalDossier || {}),
    ...rawDossier
  };

  // Resolve StageOneDossier or ClientOnboardingDossier structure
  const legalName =
    profile.amendedFields.legalName ||
    originalDossier?.legalName ||
    (originalDossier?.identityContact?.legalFirstName
      ? `${originalDossier.identityContact.legalFirstName} ${originalDossier.identityContact.legalLastName || ''}`.trim()
      : user.name || 'Valued Client');

  const email = originalDossier?.identityContact?.email || originalDossier?.email || user.email;
  const phone = profile.amendedFields.phone || originalDossier?.identityContact?.mobilePhone || originalDossier?.phone || user.phone || '';
  
  const residentialAddress =
    profile.amendedFields.residentialAddress ||
    originalDossier?.identityContact?.residentialAddress ||
    originalDossier?.residentialOrPrincipalAddress || {
      street: '',
      unit: '',
      city: '',
      state: '',
      zip: '',
      country: 'United States'
    };

  const mailingAddress =
    profile.amendedFields.mailingAddress ||
    originalDossier?.identityContact?.mailingAddress ||
    originalDossier?.mailingAddress ||
    residentialAddress;

  const taxpayerType =
    profile.amendedFields.taxpayerType ||
    originalDossier?.taxpayerType ||
    (originalDossier?.entityClassification?.isBusiness ? 'entity' : undefined) ||
    (user.clientType === 'business' ? 'entity' : user.clientType === 'individual' ? 'individual' : null);

  const entityClassification =
    profile.amendedFields.entityClassification ||
    originalDossier?.entityClassification?.entityType ||
    (typeof originalDossier?.entityClassification === 'string' ? originalDossier.entityClassification : undefined) ||
    (taxpayerType === 'individual' ? 'individual' : null);

  const maskedTIN =
    profile.amendedFields.maskedTIN ||
    originalDossier?.maskedTIN ||
    profile.originalDossier?.maskedTIN ||
    user?.stageOneDossier?.maskedTIN ||
    (originalDossier?.tinLast4
      ? (taxpayerType === 'entity' ? `XX-XXX${originalDossier.tinLast4}` : `***-**-${originalDossier.tinLast4}`)
      : '•••-••-••••');

  const tinType = profile.amendedFields.tinType || originalDossier?.tinType || profile.originalDossier?.tinType || user?.stageOneDossier?.tinType || null;
  const tinLast4 = profile.amendedFields.tinLast4 || originalDossier?.tinLast4 || profile.originalDossier?.tinLast4 || user?.stageOneDossier?.tinLast4 || '';
  const dateOfBirth = profile.amendedFields.dateOfBirth || originalDossier?.dateOfBirth || originalDossier?.identityContact?.dob || '';

  const authorizedRep =
    profile.amendedFields.authorizedRep ||
    originalDossier?.authorizedRep ||
    originalDossier?.identityContact?.authorizedContact || null;

  const supportingDocs = Array.isArray(originalDossier.supportingDocs) ? originalDossier.supportingDocs : [];
  // Profile creation time and account identity are not certification or consent evidence.
  const recordedDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
  const certifiedAt = recordedDate(originalDossier?.stageOneCompletedAt) ||
    (user.onboardingStatus === 'COMPLETED' ? recordedDate(user.onboardingCompletedAt) : null);
  const consent = originalDossier?.engagementConsent || {};
  const signerFullName = typeof (consent.signerFullName ?? consent.electronicSignatureName) === 'string'
    ? (consent.signerFullName ?? consent.electronicSignatureName).trim() : '';
  const signedAt = recordedDate(consent.signedAt ?? consent.signatureTimestamp);
  const signed = Boolean(signedAt && signerFullName.length >= 3);
  const recordedAcceptance = (primary: unknown, alternate?: unknown) => signed && (primary ?? alternate) === true;
  const agreementAccepted = recordedAcceptance(consent.termsAndScopeAccepted, consent.engagementLetterAcknowledged);
  const pricingAccepted = recordedAcceptance(consent.pricingScheduleAcknowledged, consent.pricingAcknowledged);
  const signatureAccepted = recordedAcceptance(consent.electronicSignatureConsentAccepted, consent.electronicConsentAcknowledged);
  const taxYear = originalDossier.taxYear ?? originalDossier.taxProfile?.requestedTaxYear;
  const authorizationDocuments = Array.isArray(authorizedRep?.supportingDocs) ? authorizedRep.supportingDocs : [];
  const stateOfIncorporation = originalDossier.stateOfIncorporation || originalDossier.entityClassification?.stateOfIncorporation || originalDossier.entityClassification?.formationState || null;
  const taxDocuments = Array.from(db.documents.values()).filter(document => document.clientId === clientId && (document as any).tenantId === context.tenantId)
    .map(document => ({id:document.id, name:document.name || document.fileName, category:document.category, taxYear:document.taxYear, status:document.status, uploadedAt:document.uploadedAt, version:document.version}));

  // Filter client amendments
  const clientAmendments = Array.from(db.profileAmendments.values())
    .filter(a => a.clientId === clientId)
    .sort((a, b) => new Date(b.requestTimestamp).getTime() - new Date(a.requestTimestamp).getTime());

  return res.json({
    clientId,
    version: profile.version,
    effectiveAt: profile.effectiveAt,
    lastAmendedAt: profile.lastAmendedAt,
    lastAmendedBy: profile.lastAmendedBy,
    amendedFields: profile.amendedFields,
    originalCertifiedRecord: certifiedAt ? {
      legalName: originalDossier?.identityContact?.legalFirstName
        ? `${originalDossier.identityContact.legalFirstName} ${originalDossier.identityContact.legalLastName || ''}`.trim()
        : originalDossier?.legalName || legalName,
      email,
      phone,
      residentialAddress,
      mailingAddress,
      taxpayerType,
      entityClassification,
      certifiedAt,
      isLocked: true
    } : null,
    personal: {
      legalName,
      taxpayerType,
      entityClassification,
      dbaName: profile.amendedFields.dbaName || originalDossier?.entityClassification?.dbaName || originalDossier?.dbaName || '',
      maskedTIN,
      tinType,
      tinLast4,
      dateOfBirth,
      stateOfIncorporation,
      businessDetails: {
        entityType: entityClassification,
        dbaName: profile.amendedFields.dbaName || originalDossier?.entityClassification?.dbaName || originalDossier?.dbaName || '',
        stateOfIncorporation,
        naicsCode: originalDossier?.entityClassification?.naicsCode || null,
        taxClassification: originalDossier?.entityClassification?.taxClassification || originalDossier.taxClassification || null
      }
    },
    contact: {
      email,
      phone,
      residentialAddress,
      mailingAddress,
      communicationPreferences: profile.amendedFields.communicationPreferences || {
        email: true,
        sms: false,
        portal: true
      }
    },
    representative: {
      name: authorizedRep?.fullName || authorizedRep?.name || '',
      title: authorizedRep?.title || '',
      relationship: authorizedRep?.relationshipOrCapacity || authorizedRep?.relationship || '',
      relationshipOrCapacity: authorizedRep?.relationshipOrCapacity || authorizedRep?.relationship || '',
      phone: authorizedRep?.phone || '',
      email: authorizedRep?.email || '',
      authorizationStatus: (authorizedRep?.fullName || authorizedRep?.name) ? 'RECORDED' : 'NONE',
      hasPowerOfAttorney: authorizedRep?.hasPowerOfAttorney === true,
      hasForm2848: authorizedRep?.hasForm2848 === true,
      hasForm8821: authorizedRep?.hasForm8821 === true,
      supportingDocuments: authorizationDocuments
    },
    identity: {
      status: originalDossier.identityComplete === true ? 'RECORDED_COMPLETE' : 'NOT_VERIFIED',
      verifiedAt: null,
      supportingDocsCount: supportingDocs.length,
      documents: supportingDocs,
      duplicateCheckStatus: originalDossier?.duplicateCheck?.status || 'NOT_RECORDED'
    },
    engagement: {
      engagementId: originalDossier.engagementId || null,
      taxYear: Number.isInteger(taxYear) && taxYear >= 2022 && taxYear <= 2200 ? taxYear : null,
      agreementAccepted,
      engagementTerms: typeof consent.engagementTerms === 'string' ? consent.engagementTerms : null,
      feeScheduleAccepted: pricingAccepted,
      feeScheduleAcknowledged: pricingAccepted,
      acceptedAt: agreementAccepted ? signedAt : null,
      signerFullName
    },
    consentCenter: {
      irc7216ConsentAccepted: recordedAcceptance(consent.irc7216ConsentAccepted),
      eSignConsentAccepted: signatureAccepted,
      electronicSignatureConsentAccepted: signatureAccepted,
      privacyConsentAccepted: recordedAcceptance(consent.privacyConsentAccepted, consent.privacyNoticeAcknowledged),
      termsAndScopeAccepted: recordedAcceptance(consent.termsAndScopeAccepted, consent.scopeAcknowledged),
      consentVersion: consent.consentVersion ?? consent.policyVersion ?? null,
      acceptedAt: signed ? signedAt : null,
      signerFullName,
      communicationPreferences: profile.amendedFields.communicationPreferences || {
        email: true,
        sms: false,
        portal: true
      }
    },
    myDocuments: {
      identityDocuments: supportingDocs,
      authorizationDocuments,
      onboardingDocuments: Array.isArray(originalDossier.onboardingDocuments) ? originalDossier.onboardingDocuments : [],
      engagementDocuments: Array.isArray(originalDossier.engagementDocuments) ? originalDossier.engagementDocuments : [],
      taxDocuments,
      priorYearDocuments: taxDocuments.filter(document => document.category === 'prior_year_return')
    },
    amendments: clientAmendments
  });
});

// 2. Direct Update for Permitted Ordinary (Non-Sensitive) Profile Fields
profileAmendmentRouter.patch('/ordinary', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const context = resolveAuthorizedClientContext(
    req,
    res,
    'ordinary_profile_update',
    typeof req.body.clientId === 'string' ? req.body.clientId : undefined
  );
  if (!context) return;
  const { clientId } = context;
  const updates = req.body || {};

  // Defense-in-depth: Reject any sensitive verified identity field updates
  const prohibitedFields = Object.keys(updates).filter(k => SENSITIVE_FIELDS.includes(k));
  if (prohibitedFields.length > 0) {
    return res.status(400).json({
      error: 'SENSITIVE_FIELD_REQUIRES_FORMAL_AMENDMENT',
      code: 'SENSITIVE_FIELD_REQUIRES_FORMAL_AMENDMENT',
      message: `Direct update prohibited for sensitive identity fields: ${prohibitedFields.join(', ')}. Please submit an official Profile Amendment request.`,
      prohibitedFields
    });
  }

  const allowedFields = ['phone', 'mailingAddress', 'communicationPreferences', 'companyName', 'notes'];
  const sanitizedUpdates: Record<string, any> = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      sanitizedUpdates[key] = updates[key];
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    return res.status(400).json({ error: 'No valid permitted fields to update.' });
  }

  const now = new Date().toISOString();
  const profile = db.getAuthoritativeProfile(clientId);
  Object.assign(profile.amendedFields, sanitizedUpdates);
  profile.lastAmendedAt = now;
  profile.lastAmendedBy = req.user.email;
  db.authoritativeProfiles.set(clientId, profile);

  // Update user in memory and Supabase durable sessions
  const user = (req.user.role === 'client' || req.user.role === 'prospective_client')
    ? db.users.get(req.user.id) || req.user
    : db.users.get(clientId) || req.user;
  if (req.user.role === 'client' || req.user.role === 'prospective_client') {
    if (sanitizedUpdates.phone) user.phone = sanitizedUpdates.phone;
    if (sanitizedUpdates.companyName) user.companyName = sanitizedUpdates.companyName;
    user.updatedAt = now;
    db.users.set(user.id, user);

    try {
      const sessions = new SupabaseDurableSessions(undefined, context.tenantId);
      await sessions.updateUser(user.id, {
        ...(sanitizedUpdates.phone ? { phone: sanitizedUpdates.phone } : {}),
        ...(sanitizedUpdates.companyName ? { companyName: sanitizedUpdates.companyName } : {})
      });
    } catch {
      return res.status(503).json({ error: 'Profile update could not be persisted.', code: 'PROFILE_UPDATE_UNAVAILABLE' });
    }
  } else {
    user.updatedAt = now;
    db.users.set(user.id, user);
  }

  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'PROFILE_ORDINARY_FIELDS_UPDATED',
    resource: 'ClientProfile',
    details: `Updated permitted ordinary fields: ${Object.keys(sanitizedUpdates).join(', ')}.`,
    severity: 'info',
    ipAddress: req.ip || '127.0.0.1'
  });

  return res.json({
    success: true,
    message: 'Ordinary profile fields updated successfully.',
    amendedFields: profile.amendedFields,
    user
  });
});

// 3. List Profile Amendments
profileAmendmentRouter.get('/amendments', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const requestedClientId = req.query.clientId as string;
  const context = resolveAuthorizedClientContext(req, res, 'profile_amendments', requestedClientId);
  if (!context) return;
  const records = Array.from(db.profileAmendments.values())
    .filter(r => r.clientId === context.clientId && r.tenantId === context.tenantId);

  // Sort newest first
  records.sort((a, b) => new Date(b.requestTimestamp).getTime() - new Date(a.requestTimestamp).getTime());

  return res.json({
    totalCount: records.length,
    amendments: records
  });
});

// 4. Client Requests a Formal Profile Amendment (for sensitive verified fields)
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

  const context = resolveAuthorizedClientContext(
    req,
    res,
    'profile_amendment_create',
    typeof req.body.clientId === 'string' ? req.body.clientId : undefined
  );
  if (!context) return;
  const clientId = context.clientId;
  const tenantId = context.tenantId;

  // High-risk identity change check (e.g. legal name change, SSN/TIN update, entity status)
  const isSensitive = Boolean(isSensitiveIdentityChange || SENSITIVE_FIELDS.includes(field));

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

// 5. Staff / Reviewer Reviews Profile Amendment (Approve / Reject / Request Info)
profileAmendmentRouter.post(
  '/amendments/:id/review',
  requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const pendingAmendment = db.profileAmendments.get(req.params.id);
    if (!pendingAmendment) {
      return res.status(404).json({ error: 'Amendment not found.' });
    }
    const context = resolveAuthorizedClientContext(
      req,
      res,
      'profile_amendment_review',
      pendingAmendment.clientId,
      pendingAmendment.tenantId
    );
    if (!context) return;

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

    if (!result.success || !result.amendment) {
      return res.status(404).json({ error: result.error });
    }

    // If approved and legalName was changed, propagate to user record and Supabase durable identities
    if (disposition === 'APPROVED' && result.amendment.field === 'legalName') {
      const user = db.users.get(result.amendment.requestingUserId);
      if (user) {
        user.name = String(result.amendment.proposedValue);
        db.users.set(user.id, user);
        try {
          const sessions = new SupabaseDurableSessions(undefined, result.amendment.tenantId);
          await sessions.updateUser(user.id, { name: user.name });
        } catch {
          // Continue
        }
      }
    }

    return res.json({
      message: `Profile amendment dispositioned as ${disposition}.`,
      amendment: result.amendment
    });
  }
);
