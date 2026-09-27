/**
 * A/R TAX SERVICES, LLC - Comprehensive U.S.-Only Client Intake & Intelligence Routes
 * Strictly U.S. Federal & State Jurisdictions (IRC, Treasury Regs, State Revenue Departments)
 * Zero Foreign / BIR / Philippine References
 */

import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../auth';
import { FullClientIntakeDossier, SetupAreaItem, CrossBorderReviewTask } from '../../types/intake';

export const intakeRouter = Router();

// Helper to calculate Setup Areas and Overall Progress based strictly on required applicable items
export function recalculateSetupAreasAndProgress(dossier: FullClientIntakeDossier): {
  setupAreas: SetupAreaItem[];
  percentComplete: number;
} {
  const areas: SetupAreaItem[] = [];

  // 1. Business Information
  const bp = dossier.businessProfile;
  const isBusinessComplete = Boolean(
    bp?.legalBusinessName &&
    bp?.formationState &&
    bp?.businessAddress?.street &&
    bp?.businessAddress?.city &&
    bp?.businessAddress?.state &&
    bp?.businessAddress?.zip &&
    bp?.phoneUs &&
    bp?.email
  );
  areas.push({
    id: 'area_business_info',
    name: 'Business Information',
    status: isBusinessComplete ? 'complete' : 'in_progress',
    statusLabel: isBusinessComplete ? 'Complete' : 'In Progress',
    badgeVariant: isBusinessComplete ? 'success' : 'warning',
    description: isBusinessComplete 
      ? `Verified legal name, formation in ${bp.formationState}, and business address.`
      : 'Legal entity name, formation state, business address, and contact details.',
    requiredForSubmission: true,
    completionPercentage: isBusinessComplete ? 100 : 50
  });

  // 2. Tax Information & Jurisdictions
  const jur = dossier.jurisdictions;
  const isTaxInfoComplete = Boolean(
    jur?.residentState &&
    jur?.statesOfOperation &&
    jur.statesOfOperation.length > 0
  );
  areas.push({
    id: 'area_tax_info',
    name: 'Tax Information',
    status: isTaxInfoComplete ? 'complete' : 'required',
    statusLabel: isTaxInfoComplete ? 'Complete' : 'Required',
    badgeVariant: isTaxInfoComplete ? 'success' : 'danger',
    description: isTaxInfoComplete
      ? `Federal filing with nexus registered in ${jur.statesOfOperation.join(', ')}.`
      : 'Federal and state tax nexus elections, resident state, and local licenses.',
    requiredForSubmission: true,
    completionPercentage: isTaxInfoComplete ? 100 : 0
  });

  // 3. Owners and Contacts (Total ownership must equal 100% unless sole prop or reviewed)
  const owners = dossier.ownersAndContacts || [];
  const totalOwnership = owners.reduce((sum, o) => sum + (Number(o.ownershipPercentage) || 0), 0);
  const isOwnersComplete = owners.length > 0 && Math.abs(totalOwnership - 100) < 0.01;
  areas.push({
    id: 'area_owners_contacts',
    name: 'Owners and Contacts',
    status: isOwnersComplete ? 'complete' : owners.length > 0 ? 'in_progress' : 'required',
    statusLabel: isOwnersComplete ? 'Complete' : `${totalOwnership}% Equity Allocated`,
    badgeVariant: isOwnersComplete ? 'success' : 'warning',
    description: isOwnersComplete
      ? `${owners.length} owner(s) documented with 100% equity distribution.`
      : 'Owner identities, officer roles, equity distribution, and BOI information.',
    requiredForSubmission: true,
    completionPercentage: isOwnersComplete ? 100 : Math.min(90, Math.round(totalOwnership))
  });

  // 4. Chart of Accounts
  const coa = dossier.accountingSetup?.chartOfAccounts || [];
  const unapprovedCoa = coa.filter(c => !c.accountantApproved);
  const isCoaNeedsReview = unapprovedCoa.length > 0;
  const isCoaComplete = coa.length > 0 && !isCoaNeedsReview;
  areas.push({
    id: 'area_coa',
    name: 'Chart of Accounts',
    status: isCoaNeedsReview ? 'needs_review' : isCoaComplete ? 'complete' : 'required',
    statusLabel: isCoaNeedsReview ? 'Needs Review' : isCoaComplete ? 'Complete' : 'Required',
    badgeVariant: isCoaNeedsReview ? 'warning' : isCoaComplete ? 'success' : 'danger',
    description: isCoaNeedsReview
      ? `${unapprovedCoa.length} account mapping(s) suggested by AI await confirmation.`
      : isCoaComplete
      ? `${coa.length} accounts configured and mapped to IRS tax lines.`
      : 'Standard chart of accounts or imported accounting ledger.',
    requiredForSubmission: true,
    completionPercentage: isCoaComplete ? 100 : isCoaNeedsReview ? 75 : 0
  });

  // 5. Bank Accounts
  const bankAccounts = dossier.accountingSetup?.bankAccounts || [];
  const unverifiedBanks = bankAccounts.filter(b => b.currentReconciliationStatus === 'needs_review' || !b.lastStatementUploadedDate);
  const isBankComplete = bankAccounts.length > 0 && unverifiedBanks.length === 0;
  areas.push({
    id: 'area_bank_accounts',
    name: 'Bank Accounts',
    status: isBankComplete ? 'complete' : bankAccounts.length === 0 ? 'required' : 'missing_items',
    statusLabel: isBankComplete ? 'Complete' : unverifiedBanks.length === 1 ? '1 Account Missing Statement' : `${unverifiedBanks.length} Accounts Need Statements`,
    badgeVariant: isBankComplete ? 'success' : 'danger',
    description: isBankComplete
      ? `${bankAccounts.length} operating & reserve accounts verified with statements.`
      : 'Business checking, credit card, and operating accounts.',
    requiredForSubmission: true,
    completionPercentage: isBankComplete ? 100 : bankAccounts.length > 0 ? 50 : 0
  });

  // 6. Opening Balances
  const ob = dossier.accountingSetup;
  const isObComplete = Boolean(ob?.openingBalancesRecorded && ob?.openingBalancesBalanced);
  areas.push({
    id: 'area_opening_balances',
    name: 'Opening Balances',
    status: isObComplete ? 'complete' : 'required',
    statusLabel: isObComplete ? 'Complete' : 'Required',
    badgeVariant: isObComplete ? 'success' : 'danger',
    description: isObComplete
      ? `Opening ledger balanced: $${(ob?.openingBalancesDebitTotal || 0).toLocaleString()} Debits = Credits.`
      : 'Beginning cash, accounts receivable, liabilities, and retained earnings as of period start.',
    requiredForSubmission: true,
    completionPercentage: isObComplete ? 100 : 30
  });

  // 7. Financial Documents
  const docs = dossier.documentChecklist || [];
  const missingDocs = docs.filter(d => d.status === 'missing' && d.required);
  const isDocsComplete = missingDocs.length === 0 && docs.length > 0;
  areas.push({
    id: 'area_financial_docs',
    name: 'Financial Documents',
    status: isDocsComplete ? 'complete' : 'missing_items',
    statusLabel: isDocsComplete ? 'Complete' : missingDocs.length === 1 ? '1 Document Missing' : `${missingDocs.length} Documents Missing`,
    badgeVariant: isDocsComplete ? 'success' : 'danger',
    description: isDocsComplete
      ? 'All required tax filings, W-2s, 1099s, and statements approved.'
      : `${missingDocs.map(d => d.title).slice(0, 2).join(', ')}${missingDocs.length > 2 ? '...' : ''}`,
    requiredForSubmission: true,
    completionPercentage: isDocsComplete ? 100 : Math.round(((docs.length - missingDocs.length) / Math.max(1, docs.length)) * 100)
  });

  // 8. Accounting Preferences
  const pref = dossier.accountingSetup;
  const isPrefComplete = Boolean(pref?.accountingMethod && pref?.currentSoftware);
  areas.push({
    id: 'area_accounting_prefs',
    name: 'Accounting Preferences',
    status: isPrefComplete ? 'complete' : 'in_progress',
    statusLabel: isPrefComplete ? 'Complete' : 'In Progress',
    badgeVariant: isPrefComplete ? 'success' : 'warning',
    description: isPrefComplete
      ? `${(pref.accountingMethod || 'cash').toUpperCase()} basis, fiscal year-end, synced with ${pref.currentSoftware}.`
      : 'Cash vs. accrual election, software integration, and reporting schedules.',
    requiredForSubmission: true,
    completionPercentage: isPrefComplete ? 100 : 50
  });

  // Calculate weighted percent complete
  const totalPercentage = areas.reduce((sum, a) => sum + a.completionPercentage, 0);
  const percentComplete = Math.round(totalPercentage / areas.length);

  return { setupAreas: areas, percentComplete };
}

// 1. GET /api/intake/dashboard - Client Intake Dashboard Overview
intakeRouter.get('/dashboard', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const targetClientId = (req.user.role === 'client' || req.user.role === 'prospective_client')
    ? req.user.id
    : ((req.query.clientId as string) || req.user.id);

  let dossier = db.clientIntakeDossiers.get(targetClientId);

  if (!dossier) {
    // If not existing, create initial dossier based on user profile
    const user = db.users.get(targetClientId) || req.user;
    const initial: FullClientIntakeDossier = {
      id: `intake_${targetClientId}`,
      clientId: targetClientId,
      clientName: user.name,
      legalBusinessName: user.companyName || `${user.name} Consulting`,
      dbaName: user.companyName,
      entityType: 'llc',
      taxYear: 2025,
      primaryJurisdiction: 'Federal & South Carolina, USA',
      assignedAccountantName: 'Desmond Hinds',
      assignedAccountantId: 'user_accountant_desmond',
      currentEngagementTitle: '2025 Tax Advisory & Preparation Engagement',
      percentComplete: 45,
      currentSectionStep: 1,
      status: 'in_progress',
      setupAreas: [],
      businessProfile: {
        legalBusinessName: user.companyName || `${user.name} Consulting`,
        tradeNameDba: '',
        entityType: 'llc',
        einMasked: '57-•••9102',
        formationState: 'SC',
        formationDate: '2022-01-01',
        fiscalYearEndMonth: 12,
        accountingMethod: 'cash',
        businessAddress: {
          street: '100 Main Street',
          city: 'Columbia',
          state: 'SC',
          zip: '29201'
        },
        mailingAddressSameAsBusiness: true,
        phoneUs: user.phone || '803-555-0100',
        email: user.email,
        industrySector: 'Professional Services',
        primaryActivityDescription: 'Client consulting and business operations',
        employeeCount: 1,
        contractorCount: 1,
        branchesCount: 1,
        reportingCurrency: 'USD',
        hasForeignActivity: false,
        hasRelatedEntities: false
      },
      jurisdictions: {
        federalFilingRequired: true,
        residentState: 'SC',
        statesOfOperation: ['SC'],
        statesWithEmployees: ['SC'],
        statesWithContractors: [],
        statesWithInventory: [],
        statesWithProperty: ['SC'],
        statesWithSalesNexus: ['SC'],
        stateTaxAccounts: [],
        localJurisdictions: ['Richland County']
      },
      entitySpecificDetails: {},
      ownersAndContacts: [
        {
          id: 'owner_primary',
          legalName: user.name,
          role: 'Owner & Managing Member',
          title: 'Managing Member',
          email: user.email,
          phone: user.phone || '803-555-0100',
          ownershipPercentage: 100,
          startDate: '2022-01-01',
          isUsResident: true,
          isAuthorizedSignatory: true,
          isResponsibleParty: true,
          approvalAuthorityLevel: 'full',
          portalAccessRole: 'owner',
          authorizedAccountingContact: true,
          authorizedBillingContact: true,
          isBoiBeneficialOwner: true,
          maskedSsnOrTin: '•••-••-1234'
        }
      ],
      accountingSetup: {
        accountingMethod: 'cash',
        chartOfAccountsSource: 'default_standard_coa',
        chartOfAccounts: [],
        bankAccounts: [],
        openingBalancesRecorded: false,
        openingBalancesDebitTotal: 0,
        openingBalancesCreditTotal: 0,
        openingBalancesBalanced: false,
        accountsReceivableBalance: 0,
        accountsPayableBalance: 0,
        fixedAssetsRecorded: false,
        depreciationSchedulesAvailable: false,
        inventoryMethod: 'none',
        currentSoftware: 'QuickBooks Online'
      },
      businessOperations: {
        acceptsCreditCards: true,
        acceptsCashOver10k: false,
        acceptsEWallets: false,
        sellsOnOnlineMarketplaces: false,
        holdsInventory: false,
        pays1099Contractors: true,
        contractor1099Issued: true,
        hasCommercialLoans: false,
        hasEquipmentLeases: false,
        sponsorsRetirementPlan: false,
        sponsorsGroupHealth: false,
        conductsRdActivities: false,
        holdsGovernmentContracts: false
      },
      crossBorderTriggers: {
        hasForeignBankAccounts: false,
        hasForeignBusinessInterests: false,
        hasForeignTrustsOrGifts: false,
        hasForeignCryptoExchanges: false,
        hasForeignTaxesPaid: false,
        generatedReviewTasks: []
      },
      documentChecklist: [
        {
          id: 'chk_init_1',
          category: 'w2',
          title: 'Form W-2 Wage and Tax Statements',
          description: 'All 2025 W-2 statements.',
          required: true,
          status: 'missing'
        },
        {
          id: 'chk_init_2',
          category: 'banking',
          title: 'Year-End Bank Statements (December 2025)',
          description: 'Closing statement for all active business accounts.',
          required: true,
          status: 'missing'
        }
      ],
      preferencesAndConsents: {
        preferredContactMethod: 'portal',
        preferredConsultationSchedule: 'morning',
        timeZone: 'America/New_York (EST)',
        electronicDeliveryConsentDate: new Date().toISOString(),
        engagementLetterAcceptedDate: new Date().toISOString(),
        privacyConsentDate: new Date().toISOString(),
        aiDocumentIntelligenceConsentDate: new Date().toISOString(),
        consentVersion: 'v2026.1',
        electronicSignature: user.name
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const calc = recalculateSetupAreasAndProgress(initial);
    initial.setupAreas = calc.setupAreas;
    initial.percentComplete = calc.percentComplete;
    db.clientIntakeDossiers.set(targetClientId, initial);
    dossier = initial;
  }

  // Ensure setup areas are up-to-date
  const { setupAreas, percentComplete } = recalculateSetupAreasAndProgress(dossier);
  dossier.setupAreas = setupAreas;
  dossier.percentComplete = percentComplete;

  // Gather missing critical items
  const missingItems: string[] = [];
  const unapprovedBanks = dossier.accountingSetup.bankAccounts.filter(b => !b.lastStatementUploadedDate || b.currentReconciliationStatus === 'needs_review');
  if (unapprovedBanks.length > 0) {
    missingItems.push(`${unapprovedBanks.length} bank statement(s) missing`);
  }
  const missingDocs = dossier.documentChecklist.filter(d => d.status === 'missing' && d.required);
  if (missingDocs.length > 0) {
    missingItems.push(`${missingDocs.length} financial document(s) missing`);
  }
  if (!dossier.accountingSetup.openingBalancesBalanced) {
    missingItems.push('Opening ledger balance reconciliation required');
  }

  // Documents under review
  const underReviewDocs = dossier.documentChecklist.filter(d => d.status === 'under_ai_review' || d.status === 'under_accountant_review');

  // Latest staff request
  const latestCorrection = dossier.accountantCorrections?.find(c => !c.resolved);

  return res.json({
    clientName: dossier.clientName,
    legalBusinessName: dossier.legalBusinessName,
    assignedAccountant: {
      id: dossier.assignedAccountantId,
      name: dossier.assignedAccountantName,
      title: 'Founder & Senior Managing Accountant',
      email: 'dhinds@artaxservices.com',
      phone: '678-205-9486'
    },
    currentEngagement: dossier.currentEngagementTitle,
    applicableTaxYear: dossier.taxYear,
    applicableJurisdiction: dossier.primaryJurisdiction,
    setupPercentage: dossier.percentComplete,
    status: dossier.status,
    missingCriticalItems: missingItems,
    upcomingDeadlines: [
      { date: '2026-03-15', form: 'Form 1120-S / Form 1065', description: 'S-Corporation & Partnership Federal Tax Returns' },
      { date: '2026-04-15', form: 'Form 1040 / Form 1120', description: 'Individual Income & C-Corporation Returns' }
    ],
    documentsUnderReviewCount: underReviewDocs.length,
    latestStaffRequest: latestCorrection ? {
      section: latestCorrection.section,
      instructions: latestCorrection.instructions,
      requestedBy: latestCorrection.requestedBy,
      requestedAt: latestCorrection.requestedAt
    } : null,
    nextRecommendedAction: missingDocs.length > 0
      ? `Upload missing ${missingDocs[0].title}`
      : unapprovedBanks.length > 0
      ? 'Upload December bank statement to complete bank reconciliation'
      : 'Review and finalize Chart of Accounts mappings with Desmond Hinds',
    setupAreas: dossier.setupAreas,
    dossier
  });
});

// 2. GET /api/intake/dossier - Full dossier for guided wizard
intakeRouter.get('/dossier', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const targetClientId = (req.user.role === 'client' || req.user.role === 'prospective_client')
    ? req.user.id
    : ((req.query.clientId as string) || req.user.id);

  const dossier = db.clientIntakeDossiers.get(targetClientId);
  if (!dossier) {
    return res.status(404).json({ error: 'Intake dossier not found. Initialize via /api/intake/dashboard first.' });
  }

  return res.json({ dossier });
});

// 3. PUT /api/intake/dossier - Save & Continue / Autosave
intakeRouter.put('/dossier', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const targetClientId = (req.user.role === 'client' || req.user.role === 'prospective_client')
    ? req.user.id
    : (req.body.clientId || req.user.id);

  let dossier = db.clientIntakeDossiers.get(targetClientId);
  if (!dossier) {
    return res.status(404).json({ error: 'Intake dossier not found.' });
  }

  // Merge updates safely
  const updates = req.body;
  if (updates.businessProfile) {
    dossier.businessProfile = { ...dossier.businessProfile, ...updates.businessProfile };
    dossier.legalBusinessName = dossier.businessProfile.legalBusinessName || dossier.legalBusinessName;
  }
  if (updates.jurisdictions) {
    dossier.jurisdictions = { ...dossier.jurisdictions, ...updates.jurisdictions };
  }
  if (updates.entitySpecificDetails) {
    dossier.entitySpecificDetails = { ...dossier.entitySpecificDetails, ...updates.entitySpecificDetails };
  }
  if (updates.ownersAndContacts) {
    dossier.ownersAndContacts = updates.ownersAndContacts;
  }
  if (updates.accountingSetup) {
    dossier.accountingSetup = { ...dossier.accountingSetup, ...updates.accountingSetup };
  }
  if (updates.businessOperations) {
    dossier.businessOperations = { ...dossier.businessOperations, ...updates.businessOperations };
  }
  if (updates.crossBorderTriggers) {
    dossier.crossBorderTriggers = { ...dossier.crossBorderTriggers, ...updates.crossBorderTriggers };

    // Auto-generate professional review tasks if foreign activities indicated
    if (dossier.crossBorderTriggers.hasForeignBankAccounts && dossier.crossBorderTriggers.generatedReviewTasks.length === 0) {
      dossier.crossBorderTriggers.generatedReviewTasks.push({
        id: `task_cb_${randomUUID()}`,
        clientId: targetClientId,
        taxYear: dossier.taxYear,
        triggerField: 'hasForeignBankAccounts',
        triggerValue: 'Foreign financial account indicated during client intake',
        recommendedFormsToInspect: ['FinCEN_114_FBAR', 'Form_8938'],
        mandatedByStaff: false, // NOT mandated automatically - needs CPA signoff
        createdAt: new Date().toISOString()
      });
    }
  }
  if (updates.documentChecklist) {
    dossier.documentChecklist = updates.documentChecklist;
  }
  if (updates.preferencesAndConsents) {
    dossier.preferencesAndConsents = { ...dossier.preferencesAndConsents, ...updates.preferencesAndConsents };
  }
  if (updates.currentSectionStep !== undefined) {
    dossier.currentSectionStep = updates.currentSectionStep;
  }

  // Recalculate progress and setup areas
  const { setupAreas, percentComplete } = recalculateSetupAreasAndProgress(dossier);
  dossier.setupAreas = setupAreas;
  dossier.percentComplete = percentComplete;
  dossier.updatedAt = new Date().toISOString();

  db.clientIntakeDossiers.set(targetClientId, dossier);

  // Log audit
  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'INTAKE_DOSSIER_AUTOSAVED',
    resource: `Intake Dossier #${dossier.id}`,
    details: `Updated intake step ${dossier.currentSectionStep} (${dossier.percentComplete}% complete).`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({
    success: true,
    message: 'Intake progress saved successfully.',
    dossier
  });
});

// 4. POST /api/intake/dossier/submit - Submit for Staff Review
intakeRouter.post('/dossier/submit', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const targetClientId = (req.user.role === 'client' || req.user.role === 'prospective_client')
    ? req.user.id
    : (req.body.clientId || req.user.id);

  const dossier = db.clientIntakeDossiers.get(targetClientId);
  if (!dossier) {
    return res.status(404).json({ error: 'Intake dossier not found.' });
  }

  const { electronicSignature } = req.body;
  if (!electronicSignature || electronicSignature.trim().length === 0) {
    return res.status(400).json({ error: 'An authorized electronic signature is required to complete submission.' });
  }

  dossier.status = 'submitted_pending_review';
  dossier.preferencesAndConsents.electronicSignature = electronicSignature.trim();
  dossier.preferencesAndConsents.submissionTimestamp = new Date().toISOString();
  dossier.updatedAt = new Date().toISOString();

  db.clientIntakeDossiers.set(targetClientId, dossier);

  // Log audit
  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'INTAKE_DOSSIER_SUBMITTED',
    resource: `Intake Dossier #${dossier.id}`,
    details: `Signed by ${electronicSignature.trim()} and submitted for Desmond Hinds review.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({
    success: true,
    message: 'Your intake dossier has been successfully submitted to your assigned CPA Desmond Hinds for review.',
    dossier
  });
});

// 5. POST /api/intake/dossier/resolve-correction - Resolve correction
intakeRouter.post('/dossier/resolve-correction', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { correctionId, clientResponse } = req.body;
  const targetClientId = (req.user.role === 'client' || req.user.role === 'prospective_client')
    ? req.user.id
    : (req.body.clientId || req.user.id);

  const dossier = db.clientIntakeDossiers.get(targetClientId);
  if (!dossier) return res.status(404).json({ error: 'Dossier not found.' });

  const corr = dossier.accountantCorrections?.find(c => c.id === correctionId);
  if (!corr) return res.status(404).json({ error: 'Correction request not found.' });

  corr.resolved = true;
  corr.clientResponse = clientResponse || 'Updated in portal.';
  dossier.updatedAt = new Date().toISOString();

  db.clientIntakeDossiers.set(targetClientId, dossier);

  return res.json({ success: true, message: 'Correction resolved.', dossier });
});

// 6. GET /api/intake/research-rules - Governed IRS & State Research Rules
intakeRouter.get('/research-rules', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { entityType, jurisdictionCode } = req.query;

  let rules = Array.from(db.governedResearchRules.values());

  if (entityType && typeof entityType === 'string') {
    rules = rules.filter(r => r.entityType === 'all' || r.entityType === entityType);
  }

  if (jurisdictionCode && typeof jurisdictionCode === 'string') {
    rules = rules.filter(r => r.jurisdictionCode === 'US' || r.jurisdictionCode === jurisdictionCode);
  }

  return res.json({ rules });
});
