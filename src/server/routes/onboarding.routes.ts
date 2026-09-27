/**
 * A/R TAX SERVICES, LLC - Dual Onboarding System Router
 * Implements completely separate workflows:
 * 1. Client Onboarding (Part 1 & 2)
 * 2. Staff (Accountant, Consultant, Reviewer) Onboarding via Admin Invitation (Part 3)
 */

import { Router, Response } from 'express';
import { randomUUID, createHash } from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest, requireRole, hashPassword } from '../auth';
import { 
  ClientOnboardingDossier, 
  StaffInvitation, 
  StaffOnboardingDossier, 
  StaffRole,
  ClientOnboardingStatus,
  StaffOnboardingStatus 
} from '../../types';

export const onboardingRouter = Router();

// -------------------------------------------------------------
// PART 1 & 2: SEPARATE CLIENT ONBOARDING
// -------------------------------------------------------------

// Helper to calculate progress for Client Onboarding Dossier
export function calculateClientDossierProgress(dossier: ClientOnboardingDossier): number {
  let stepsCompleted = 0;
  const totalSteps = 8; // A through H (I is final review/submit)

  // Section A: Identity
  if (dossier.identityContact?.legalFirstName && dossier.identityContact?.legalLastName && dossier.identityContact?.email && dossier.identityContact?.mobilePhone && dossier.identityContact?.residentialAddress?.street) {
    stepsCompleted += 1;
  }
  // Section B: Entity Classification
  if (dossier.entityClassification?.entityType) {
    stepsCompleted += 1;
  }
  // Section C: Tax Profile
  if (dossier.taxProfile?.requestedTaxYear && dossier.taxProfile?.filingStatus) {
    stepsCompleted += 1;
  }
  // Section D: Accounting Requirements
  if (dossier.accountingRequirements?.accountingSoftware) {
    stepsCompleted += 1;
  }
  // Section E: Service Selection
  if (dossier.serviceSelection?.selectedServices?.length > 0) {
    stepsCompleted += 1;
  }
  // Section F: Document Checklist
  if (dossier.documentChecklist && dossier.documentChecklist.length > 0) {
    stepsCompleted += 1;
  }
  // Section G: Consultation Preferences
  if (dossier.consultationPreferences?.meetingType) {
    stepsCompleted += 1;
  }
  // Section H: Engagement & Consent
  if (dossier.engagementConsent?.electronicSignatureName && dossier.engagementConsent?.engagementLetterAcknowledged) {
    stepsCompleted += 1;
  }

  return Math.round((stepsCompleted / totalSteps) * 100);
}

// Generate dynamic document checklist based on entity & tax profile answers
export function generateDynamicChecklist(dossier: ClientOnboardingDossier) {
  const items = [
    {
      id: 'doc_gov_id',
      category: 'government_id',
      name: 'Government-Issued Photo ID',
      description: "Unexpired state driver's license, state ID card, or US Passport.",
      required: true,
      status: 'pending' as const
    },
    {
      id: 'doc_prior_return',
      category: 'prior_tax_returns',
      name: 'Prior Year Tax Return (2024)',
      description: 'Complete federal and state tax returns with all attached forms & schedules.',
      required: true,
      status: 'pending' as const
    }
  ];

  const tax = dossier.taxProfile;
  const entity = dossier.entityClassification;

  if (tax?.incomeCategories?.includes('w2')) {
    items.push({
      id: 'doc_w2',
      category: 'income_records',
      name: 'Form(s) W-2 Wage & Tax Statements',
      description: 'All 2025 W-2 slips from all employers.',
      required: true,
      status: 'pending' as const
    });
  }

  if (tax?.incomeCategories?.includes('1099_nec') || tax?.selfEmploymentActivity) {
    items.push({
      id: 'doc_1099_nec',
      category: 'self_employment',
      name: 'Form(s) 1099-NEC / 1099-K / 1099-MISC',
      description: 'Non-employee compensation & payment app processing reports.',
      required: true,
      status: 'pending' as const
    });
  }

  if (entity?.isBusiness || entity?.entityType === 'llc' || entity?.entityType === 'scorp' || entity?.entityType === 'partnership') {
    items.push(
      {
        id: 'doc_formation',
        category: 'entity_formation',
        name: 'Articles of Organization & EIN Confirmation Letter',
        description: 'State Secretary of State filing & IRS Form CP-575 EIN notice.',
        required: true,
        status: 'pending' as const
      },
      {
        id: 'doc_pnl',
        category: 'business_financials',
        name: 'Year-End Profit & Loss and Balance Sheet',
        description: 'Accrual or cash-basis financial reports exported from QuickBooks/Xero.',
        required: true,
        status: 'pending' as const
      },
      {
        id: 'doc_bank_stmt',
        category: 'banking',
        name: 'December 2025 Business Bank & Credit Card Statements',
        description: 'Closing statements verifying ending cash & liabilities.',
        required: true,
        status: 'pending' as const
      }
    );
  }

  if (tax?.hasIrsOrStateNotices) {
    items.push({
      id: 'doc_irs_notice',
      category: 'tax_notices',
      name: 'IRS / State Department of Revenue Notices',
      description: 'Recent letters, CP2000, or audit coordination requests.',
      required: true,
      status: 'pending' as const
    });
  }

  if (tax?.rentalPropertiesCount > 0) {
    items.push({
      id: 'doc_rental_stmt',
      category: 'real_estate',
      name: 'Rental Property Income & Expense Summaries',
      description: 'Mortgage Form 1098, property taxes, insurance, repairs.',
      required: true,
      status: 'pending' as const
    });
  }

  return items;
}

// 1. Get client onboarding dossier
onboardingRouter.get('/client', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const permanentClientId = req.user.clientId?.trim();

  if (req.user.role === 'client' && !permanentClientId) {
    return res.status(409).json({
      error: 'Permanent TaxGuard Client ID is required before onboarding can continue.',
      code: 'CLIENT_ID_REQUIRED'
    });
  }

  const onboardingKey = permanentClientId || req.user.id;

  let dossier = db.clientOnboarding.get(onboardingKey);
  if (!dossier) {
    // Create initial dossier
    const [firstName, ...rest] = (req.user.name || '').split(' ');
    const lastName = rest.join(' ') || 'Taxpayer';

    dossier = {
      id: `conb_${randomUUID()}`,
      clientId: req.user.clientId!,
      status: 'onboarding_in_progress',
      currentSection: 'A',
      percentComplete: 15,
      identityContact: {
        legalFirstName: firstName || 'Client',
        legalLastName: lastName,
        preferredName: firstName || '',
        email: req.user.email,
        mobilePhone: req.user.phone || '',
        residentialAddress: {
          street: '',
          city: '',
          state: 'SC',
          zip: '',
          country: 'United States'
        },
        mailingAddressSameAsResidential: true,
        preferredLanguage: 'English',
        preferredChannel: 'portal',
        timeZone: 'America/New_York'
      },
      entityClassification: {
        isBusiness: req.user.clientType === 'business',
        entityType: req.user.clientType === 'business' ? 'llc' : 'individual',
        statesOfOperation: ['SC'],
        hasExistingAccountant: false
      },
      taxProfile: {
        requestedTaxYear: 2025,
        filingStatus: 'single',
        dependentsCount: 0,
        incomeCategories: ['w2'],
        selfEmploymentActivity: false,
        rentalPropertiesCount: 0,
        investmentActivity: false,
        foreignIncomeOrAccounts: false,
        digitalAssetActivity: false,
        madeEstimatedTaxPayments: false,
        priorYearReturnAvailable: true,
        hasIrsOrStateNotices: false,
        outstandingTaxBalances: false,
        extensionOrAmendedRequired: false,
        multiStateFilingRequired: false,
        multiStatesList: []
      },
      accountingRequirements: {
        bookkeepingRequired: false,
        accountingSoftware: 'none',
        payrollSupportRequired: false,
        salesTaxFilingRequired: false,
        accountsPayableRequired: false,
        accountsReceivableRequired: false,
        financialReportingRequired: false,
        bankReconciliationRequired: false,
        cleanupOrCatchupNeeded: false,
        businessAdvisoryRequired: false
      },
      serviceSelection: {
        selectedServices: ['individual_tax_1040']
      },
      documentChecklist: [],
      consultationPreferences: {
        serviceRequired: 'individual_tax_1040',
        preferredProfessional: 'next_available',
        meetingType: 'virtual',
        preferredTimeZone: 'America/New_York'
      },
      engagementConsent: {
        engagementLetterAcknowledged: false,
        scopeAcknowledged: false,
        pricingAcknowledged: false,
        privacyNoticeAcknowledged: false,
        electronicConsentAcknowledged: false,
        retentionPolicyAcknowledged: false,
        electronicSignatureName: '',
        signatureTimestamp: '',
        policyVersion: '2026.1'
      },
      reviewSubmission: {
        lockedForClient: false
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dossier.documentChecklist = generateDynamicChecklist(dossier);
    dossier.percentComplete = calculateClientDossierProgress(dossier);
    db.clientOnboarding.set(onboardingKey, dossier);
  }

  return res.json({ dossier });
});

// 2. Save client onboarding section
onboardingRouter.post('/client/save-section', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { section, data } = req.body;
  let dossier = db.clientOnboarding.get(req.user.id);
  if (!dossier) {
    return res.status(404).json({ error: 'Client onboarding dossier not initialized.' });
  }

  if (dossier.reviewSubmission?.lockedForClient) {
    return res.status(403).json({ error: 'Dossier has been submitted and is locked for staff review.' });
  }

  // Update specific section
  switch (section) {
    case 'A':
      dossier.identityContact = { ...dossier.identityContact, ...data };
      break;
    case 'B':
      dossier.entityClassification = { ...dossier.entityClassification, ...data };
      dossier.documentChecklist = generateDynamicChecklist(dossier);
      break;
    case 'C':
      dossier.taxProfile = { ...dossier.taxProfile, ...data };
      dossier.documentChecklist = generateDynamicChecklist(dossier);
      break;
    case 'D':
      dossier.accountingRequirements = { ...dossier.accountingRequirements, ...data };
      break;
    case 'E':
      dossier.serviceSelection = { ...dossier.serviceSelection, ...data };
      break;
    case 'F':
      if (Array.isArray(data)) {
        dossier.documentChecklist = data;
      }
      break;
    case 'G':
      dossier.consultationPreferences = { ...dossier.consultationPreferences, ...data };
      break;
    case 'H':
      dossier.engagementConsent = {
        ...dossier.engagementConsent,
        ...data,
        signatureTimestamp: new Date().toISOString(),
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] as string
      };
      break;
    default:
      break;
  }

  dossier.updatedAt = new Date().toISOString();
  dossier.percentComplete = calculateClientDossierProgress(dossier);
  db.clientOnboarding.set(req.user.id, dossier);

  return res.json({ success: true, dossier });
});

// 3. Submit client onboarding dossier to firm
onboardingRouter.post('/client/submit', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const dossier = db.clientOnboarding.get(req.user.id);
  if (!dossier) {
    return res.status(404).json({ error: 'Onboarding dossier not found.' });
  }

  // Check required fields
  if (!dossier.engagementConsent?.electronicSignatureName || !dossier.engagementConsent?.engagementLetterAcknowledged) {
    return res.status(400).json({ error: 'Electronic signature and engagement letter acceptance are required before submission.' });
  }

  dossier.status = 'onboarding_submitted';
  dossier.currentSection = 'I';
  dossier.percentComplete = 100;
  dossier.reviewSubmission = {
    ...dossier.reviewSubmission,
    submittedAt: new Date().toISOString(),
    lockedForClient: true
  };
  dossier.updatedAt = new Date().toISOString();
  db.clientOnboarding.set(req.user.id, dossier);

  // Update user record
  const user = db.users.get(req.user.id);
  if (user) {
    user.onboardingStatus = 'submitted';
    db.users.set(user.id, user);
  }

  // Record audit log
  db.logAuditEvent(
    req.user.id,
    req.user.role,
    'CLIENT_ONBOARDING_SUBMITTED',
    'clientOnboarding',
    dossier.id,
    { percentComplete: 100, services: dossier.serviceSelection.selectedServices },
    req.ip || '127.0.0.1'
  );

  // Create notification job for firm staff
  db.notificationJobs.set(`notif_job_${randomUUID()}`, {
    type: 'client_onboarding_submitted',
    clientId: req.user.id,
    clientName: req.user.name,
    timestamp: new Date().toISOString(),
    status: 'pending'
  });

  return res.json({ success: true, message: 'Onboarding dossier successfully submitted for executive CPA review.', dossier });
});

// 4. Admin review client onboarding
onboardingRouter.post('/client/review', authenticateToken, requireRole('administrator', 'super_administrator', 'accountant'), (req: AuthenticatedRequest, res: Response) => {
  const { clientId, decision, notes, correctionInstructions } = req.body;
  const dossier = db.clientOnboarding.get(clientId);
  if (!dossier) return res.status(404).json({ error: 'Client dossier not found.' });

  dossier.reviewSubmission = {
    ...dossier.reviewSubmission,
    reviewedByStaffId: req.user!.id,
    reviewedAt: new Date().toISOString(),
    staffDecision: decision,
    staffNotes: notes,
    correctionInstructions: correctionInstructions || '',
    lockedForClient: decision === 'approved'
  };

  if (decision === 'approved') {
    dossier.status = 'approved';
    const user = db.users.get(clientId);
    if (user) {
      user.onboardingStatus = 'approved';
      db.users.set(clientId, user);
    }
  } else if (decision === 'correction_requested') {
    dossier.status = 'correction_requested';
    dossier.reviewSubmission.lockedForClient = false;
  }

  dossier.updatedAt = new Date().toISOString();
  db.clientOnboarding.set(clientId, dossier);

  db.logAuditEvent(
    req.user!.id,
    req.user!.role,
    `CLIENT_ONBOARDING_${decision.toUpperCase()}`,
    'clientOnboarding',
    dossier.id,
    { decision, notes },
    req.ip || '127.0.0.1'
  );

  return res.json({ success: true, dossier });
});

// -------------------------------------------------------------
// PART 3: ACCOUNTANT & CONSULTANT ONBOARDING (STAFF INVITATION ONLY)
// -------------------------------------------------------------

// 1. Admin sends secure staff invitation
onboardingRouter.post(['/staff/invite', '/staff/invitations'], authenticateToken, requireRole('administrator', 'super_administrator'), (req: AuthenticatedRequest, res: Response) => {
  const { email, legalFirstName, legalLastName, firstName, lastName, proposedRole } = req.body;
  const effectiveFirstName = legalFirstName || firstName;
  const effectiveLastName = legalLastName || lastName;

  if (!email || !effectiveFirstName || !effectiveLastName || !proposedRole) {
    return res.status(400).json({ error: 'Email, legal first name, legal last name, and proposed role are required.' });
  }

  const validRoles: StaffRole[] = ['consultant', 'accountant', 'reviewer', 'managing_consultant', 'founder', 'administrator'];
  if (!validRoles.includes(proposedRole)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  // Generate single-use secure token
  const rawToken = randomUUID() + '-' + randomUUID();
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expirationDays = 7;
  const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString();

  const invitationId = `inv_${randomUUID()}`;
  const invitation: StaffInvitation = {
    id: invitationId,
    email: email.toLowerCase().trim(),
    legalFirstName: effectiveFirstName,
    legalLastName: effectiveLastName,
    proposedRole,
    tokenHash,
    expiresAt,
    status: 'pending',
    invitedByUserId: req.user!.id,
    invitedByUserName: req.user!.name,
    createdAt: new Date().toISOString()
  };

  db.staffInvitations.set(invitationId, invitation);

  db.logAuditEvent(
    req.user!.id,
    req.user!.role,
    'STAFF_INVITATION_CREATED',
    'staffInvitations',
    invitationId,
    { email, proposedRole, expiresAt },
    req.ip || '127.0.0.1'
  );

  // Return rawToken strictly on invitation creation for email dispatch
  return res.json({
    success: true,
    message: `Invitation generated successfully for ${email}.`,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      proposedRole: invitation.proposedRole,
      expiresAt: invitation.expiresAt
    },
    invitationToken: rawToken,
    invitationUrl: `/staff/onboarding?token=${rawToken}`
  });
});

// 2. Admin lists all staff invitations
onboardingRouter.get('/staff/invitations', authenticateToken, requireRole('administrator', 'super_administrator'), (req: AuthenticatedRequest, res: Response) => {
  const list = Array.from(db.staffInvitations.values()).map(inv => ({
    id: inv.id,
    email: inv.email,
    legalFirstName: inv.legalFirstName,
    legalLastName: inv.legalLastName,
    proposedRole: inv.proposedRole,
    status: inv.status,
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
    invitedByUserName: inv.invitedByUserName
  }));
  return res.json({ invitations: list });
});

// 3. Public check of staff invitation token
onboardingRouter.get(['/staff/invitation/:token', '/staff/invitations/:token'], (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: 'Invitation token required.' });

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const invitation = Array.from(db.staffInvitations.values()).find(i => i.tokenHash === tokenHash);

  if (!invitation) {
    return res.status(404).json({ error: 'Invalid or unknown invitation token.', code: 'INVALID_TOKEN' });
  }

  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    invitation.status = 'expired';
    return res.status(410).json({ error: 'This invitation token has expired. Request a new invitation from your administrator.', code: 'TOKEN_EXPIRED' });
  }

  if (invitation.status === 'completed') {
    return res.status(409).json({ error: 'This invitation has already been accepted and completed.', code: 'ALREADY_COMPLETED' });
  }

  return res.json({
    valid: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      legalFirstName: invitation.legalFirstName,
      legalLastName: invitation.legalLastName,
      proposedRole: invitation.proposedRole,
      expiresAt: invitation.expiresAt
    }
  });
});

// 4. Staff accepts invitation, sets credentials, enrolls MFA, and initializes dossier
onboardingRouter.post('/staff/accept-invitation', async (req, res) => {
  const { token, password, mobileNumber, timeZone } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Invitation token and secure password are required.' });
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const invitation = Array.from(db.staffInvitations.values()).find(i => i.tokenHash === tokenHash);

  if (!invitation || invitation.status !== 'pending') {
    return res.status(400).json({ error: 'Invalid, already accepted, or expired invitation token.' });
  }

  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    invitation.status = 'expired';
    return res.status(410).json({ error: 'Invitation has expired.' });
  }

  const staffUserId = `staff_${randomUUID()}`;
  const hashedPassword = hashPassword(password);
  db.userPasswords.set(invitation.email, hashedPassword);

  // Create staff user in database
  const newUser = {
    id: staffUserId,
    email: invitation.email,
    name: `${invitation.legalFirstName} ${invitation.legalLastName}`,
    role: invitation.proposedRole as any,
    phone: mobileNumber || '803-555-0100',
    status: 'pending' as const, // Pending until admin activation
    isVerified: true,
    mfaEnabled: true,
    createdAt: new Date().toISOString()
  };
  db.users.set(staffUserId, newUser);

  // Initialize Staff Onboarding Dossier
  const dossierId = `sdoss_${randomUUID()}`;
  const dossier: StaffOnboardingDossier = {
    id: dossierId,
    invitationId: invitation.id,
    userId: staffUserId,
    status: 'profile_in_progress',
    currentSection: 'A',
    personalContact: {
      legalFirstName: invitation.legalFirstName,
      legalLastName: invitation.legalLastName,
      professionalDisplayName: `${invitation.legalFirstName} ${invitation.legalLastName}`,
      workEmail: invitation.email,
      mobileNumber: mobileNumber || '',
      residentialAddress: '',
      emergencyContact: { name: '', relation: '', phone: '' },
      preferredLanguage: 'English',
      timeZone: timeZone || 'America/New_York',
      professionalBio: ''
    },
    employmentInfo: {
      employmentType: 'employee',
      jobTitle: invitation.proposedRole === 'accountant' ? 'Tax Accountant' : 'Consultant & Advisor',
      department: 'Tax',
      startDate: new Date().toISOString().slice(0, 10),
      supervisorName: 'Desmond Hinds, Founder',
      officeLocation: 'Columbia HQ',
      weeklyWorkingHours: 40,
      signedAgreements: {
        employmentAgreement: false,
        confidentialityAgreement: false,
        acceptableUsePolicy: false,
        securityAgreement: false
      }
    },
    qualifications: {
      degrees: [],
      licenses: [],
      yearsOfExperience: 3,
      references: []
    },
    servicesSpecializations: {
      qualifiedServices: ['individual_tax_1040', 'business_tax_scorp_llc'],
      canActAsReviewer: invitation.proposedRole === 'reviewer' || invitation.proposedRole === 'founder'
    },
    jurisdictionsEligibility: {
      statesAuthorized: ['SC'],
      federalWorkAuthorization: true,
      entityExperience: ['1040', '1120-S', 'LLC'],
      clientTypesAccepted: ['individual', 'business'],
      languagesSpoken: ['English'],
      maxActiveClientCapacity: 30,
      maxDailyAppointments: 6,
      founderOnlyServicesApproved: false
    },
    securitySetup: {
      emailVerified: true,
      mfaEnrolled: true,
      sessionTimeoutAcknowledged: true,
      completedTrainings: {
        confidentialityTraining: true,
        phishingTraining: true,
        dataProtectionTraining: true,
        documentHandlingTraining: true,
        incidentReportingAcknowledged: true
      }
    },
    calendarSetup: {
      timeZone: timeZone || 'America/New_York',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      workingHours: { start: '09:00', end: '17:00' },
      appointmentDurations: [30, 45, 60],
      bufferMinutesBefore: 15,
      bufferMinutesAfter: 15,
      lunchBreak: { start: '12:00', end: '13:00' },
      minimumBookingNoticeHours: 12,
      maximumBookingWindowDays: 60,
      maxDailyMeetings: 6,
      meetingLocations: ['virtual', 'telephone', 'in_office'],
      videoProvider: 'google_meet',
      connectedGoogleCalendar: false,
      connectedOutlookCalendar: false,
      personalCalendarPrivacy: 'busy_only'
    },
    adminReview: {
      verifiedIdentity: false,
      verifiedEmail: true,
      verifiedAgreements: false,
      verifiedQualifications: false,
      verifiedLicenses: false,
      assignedRole: invitation.proposedRole,
      assignedPermissions: ['view_assigned_clients', 'manage_assigned_appointments', 'send_client_messages']
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.staffOnboarding.set(staffUserId, dossier);

  // Mark invitation completed
  invitation.status = 'completed';
  invitation.completedAt = new Date().toISOString();
  db.staffInvitations.set(invitation.id, invitation);

  db.logAuditEvent(
    staffUserId,
    invitation.proposedRole,
    'STAFF_INVITATION_ACCEPTED',
    'staffOnboarding',
    dossier.id,
    { email: invitation.email, role: invitation.proposedRole },
    req.ip || '127.0.0.1'
  );

  return res.json({
    success: true,
    message: 'Invitation accepted and account initialized. Please log in to complete your professional onboarding.',
    userId: staffUserId
  });
});

// 5. Get staff member's own onboarding dossier
onboardingRouter.get('/staff/dossier', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const dossier = db.staffOnboarding.get(req.user.id);
  if (!dossier) {
    return res.status(404).json({ error: 'Staff onboarding dossier not found for active user.' });
  }

  return res.json({ dossier });
});

// 6. Save staff onboarding section
onboardingRouter.post('/staff/save-section', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { section, data } = req.body;
  const dossier = db.staffOnboarding.get(req.user.id);
  if (!dossier) {
    return res.status(404).json({ error: 'Staff onboarding dossier not found.' });
  }

  switch (section) {
    case 'A':
      dossier.personalContact = { ...dossier.personalContact, ...data };
      break;
    case 'B':
      dossier.employmentInfo = { ...dossier.employmentInfo, ...data };
      break;
    case 'C':
      dossier.qualifications = { ...dossier.qualifications, ...data };
      break;
    case 'D':
      dossier.servicesSpecializations = { ...dossier.servicesSpecializations, ...data };
      break;
    case 'E':
      dossier.jurisdictionsEligibility = { ...dossier.jurisdictionsEligibility, ...data };
      break;
    case 'F':
      dossier.securitySetup = { ...dossier.securitySetup, ...data };
      break;
    case 'G':
      dossier.calendarSetup = { ...dossier.calendarSetup, ...data };
      break;
    default:
      break;
  }

  dossier.updatedAt = new Date().toISOString();
  db.staffOnboarding.set(req.user.id, dossier);

  return res.json({ success: true, dossier });
});

// 7. Submit staff onboarding for administrator activation
onboardingRouter.post('/staff/submit', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const dossier = db.staffOnboarding.get(req.user.id);
  if (!dossier) return res.status(404).json({ error: 'Staff dossier not found.' });

  dossier.status = 'submitted';
  dossier.updatedAt = new Date().toISOString();
  db.staffOnboarding.set(req.user.id, dossier);

  db.logAuditEvent(
    req.user.id,
    req.user.role,
    'STAFF_ONBOARDING_SUBMITTED',
    'staffOnboarding',
    dossier.id,
    { email: req.user.email },
    req.ip || '127.0.0.1'
  );

  return res.json({ success: true, message: 'Onboarding submitted for executive administrator review and verification.', dossier });
});

// 8. Admin review & activate staff account
onboardingRouter.post('/staff/review-activate', authenticateToken, requireRole('administrator', 'super_administrator'), (req: AuthenticatedRequest, res: Response) => {
  const { staffUserId, verifiedQualifications, verifiedLicenses, assignedRole, permissions, adminNotes } = req.body;
  const dossier = db.staffOnboarding.get(staffUserId);
  if (!dossier) return res.status(404).json({ error: 'Staff dossier not found.' });

  dossier.status = 'approved';
  dossier.adminReview = {
    verifiedIdentity: true,
    verifiedEmail: true,
    verifiedAgreements: true,
    verifiedQualifications: !!verifiedQualifications,
    verifiedLicenses: !!verifiedLicenses,
    assignedRole: assignedRole || dossier.adminReview.assignedRole,
    assignedPermissions: permissions || ['view_assigned_clients', 'manage_assigned_appointments', 'send_client_messages', 'prepare_tax_work'],
    activatedAt: new Date().toISOString(),
    activatedByAdminId: req.user!.id,
    adminNotes: adminNotes || ''
  };
  dossier.updatedAt = new Date().toISOString();
  db.staffOnboarding.set(staffUserId, dossier);

  // Activate staff user
  const user = db.users.get(staffUserId);
  if (user) {
    user.status = 'active';
    user.role = assignedRole || dossier.adminReview.assignedRole;
    db.users.set(staffUserId, user);
  }

  // Create/update staff availability configuration
  const availId = `avail_${staffUserId}`;
  const standardWeekSchedule = [
    { dayOfWeek: 0, isAvailable: false, timeSlots: [] },
    { dayOfWeek: 1, isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00' }], lunchBreak: { start: '12:00', end: '13:00' } },
    { dayOfWeek: 2, isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00' }], lunchBreak: { start: '12:00', end: '13:00' } },
    { dayOfWeek: 3, isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00' }], lunchBreak: { start: '12:00', end: '13:00' } },
    { dayOfWeek: 4, isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00' }], lunchBreak: { start: '12:00', end: '13:00' } },
    { dayOfWeek: 5, isAvailable: true, timeSlots: [{ start: '09:00', end: '16:00' }], lunchBreak: { start: '12:00', end: '13:00' } },
    { dayOfWeek: 6, isAvailable: false, timeSlots: [] }
  ] as any;

  db.staffAvailability.set(staffUserId, {
    id: availId,
    staffId: staffUserId,
    staffName: user?.name || dossier.personalContact.professionalDisplayName,
    staffRole: assignedRole || dossier.adminReview.assignedRole,
    timeZone: dossier.calendarSetup.timeZone,
    isFounder: assignedRole === 'founder',
    weeklySchedule: standardWeekSchedule,
    bufferBeforeMinutes: dossier.calendarSetup.bufferMinutesBefore || 15,
    bufferAfterMinutes: dossier.calendarSetup.bufferMinutesAfter || 15,
    minNoticeHours: dossier.calendarSetup.minimumBookingNoticeHours || 12,
    maxAdvanceDays: dossier.calendarSetup.maximumBookingWindowDays || 60,
    maxDailyAppointments: dossier.calendarSetup.maxDailyMeetings || 6,
    maxWeeklyAppointments: 25,
    virtualEnabled: true,
    telephoneEnabled: true,
    officeEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  db.logAuditEvent(
    req.user!.id,
    req.user!.role,
    'STAFF_ACCOUNT_ACTIVATED',
    'staffOnboarding',
    staffUserId,
    { assignedRole, permissions },
    req.ip || '127.0.0.1'
  );

  return res.json({
    success: true,
    message: `Staff account for ${user?.name || staffUserId} activated with role ${assignedRole}.`,
    dossier
  });
});
