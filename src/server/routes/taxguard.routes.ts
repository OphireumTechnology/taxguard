/**
 * TaxGuard AI Server-Side Route Controller & Authorization Gate
 * Governs legacy route redirects, Maker-Checker authorization, credit metering,
 * statutory tax calculations (SC decoupling, IRC § 1367, IRC § 6654, Form 433-A),
 * and provenance trace integrity.
 */

import { Router, Response } from 'express';
import { 
  authenticateToken, 
  requireRole, 
  requireClientIsolation, 
  requireTenantIsolation, 
  requirePractitionerAuthority,
  requireMakerChecker,
  filterReviewerNotesForClients,
  AuthenticatedRequest 
} from '../auth';
import { db } from '../db';

export const taxguardRouter = Router();

// Developer Support Contact metadata for error payloads
const DEVELOPER_NOTICE = {
  developer: 'Ophireum Multimedia Production',
  phone: '+63 917 966 8814',
  environment: 'Demonstration Environment – No Live Filing, Payment, Signature, Banking Connection, or Government Submission',
  complianceNotice: 'Compliance-supporting technology. Final legal, regulatory, accounting, and tax requirements must be validated by qualified U.S. professionals.'
};

// In-memory versioned workpapers and credit balances for demonstration state
interface WorkpaperField {
  id: string;
  engagementId: string;
  clientId: string;
  fieldName: string;
  taxFormTarget: string;
  sourceDocumentId: string;
  sourceDocName: string;
  sourceSha256: string;
  ocrArtifactId: string;
  extractionArtifactId: string;
  sourcePage: number;
  boundingBox: { ymin: number; xmin: number; ymax: number; xmax: number };
  extractedRawValue: string;
  workpaperValue: number;
  priorYearValue: number;
  confidence: number;
  reviewStatus: 'Draft' | 'Pending Review' | 'Approved' | 'Corrected';
  preparerId: string;
  preparerName: string;
  lastApprovedBy?: string;
  lastApprovedAt?: string;
  version: number;
  internalReviewerNotes?: string;
  preparerNotes?: string;
  history: Array<{
    version: number;
    value: number;
    modifiedBy: string;
    reason: string;
    timestamp: string;
  }>;
}

const DEMO_WORKPAPERS: Map<string, WorkpaperField> = new Map([
  [
    'fld_rev_001',
    {
      id: 'fld_rev_001',
      engagementId: 'eng_2025_perotti',
      clientId: 'usr_client_001',
      fieldName: 'Gross Receipts or Sales',
      taxFormTarget: 'Form 1120-S, Line 1a',
      sourceDocumentId: 'doc_gl_trial_balance_2024',
      sourceDocName: '2024_General_Ledger_Trial_Balance.pdf',
      sourceSha256: '7df42928a44b67b57e6c0e497f5103f787d0ef89f4ad4d97ac6f27db320e658f',
      ocrArtifactId: 'ocr_doc_gl_trial_balance_2024_v1',
      extractionArtifactId: 'ext_doc_gl_trial_balance_2024_v1',
      sourcePage: 1,
      boundingBox: { ymin: 120, xmin: 50, ymax: 160, xmax: 320 },
      extractedRawValue: '$ 1,482,910.00',
      workpaperValue: 1482910,
      priorYearValue: 1290400,
      confidence: 0.98,
      reviewStatus: 'Approved',
      preparerId: 'usr_staff_001',
      preparerName: 'Marcus Vance, EA',
      lastApprovedBy: 'Elena Rostova, CPA',
      lastApprovedAt: '2024-09-15 11:30',
      version: 1,
      internalReviewerNotes: 'Reconciled to Form 1099-K and Merchant Bank Settlement Statements.',
      history: []
    }
  ],
  [
    'fld_rev_003',
    {
      id: 'fld_rev_003',
      engagementId: 'eng_2025_summit',
      clientId: 'usr_client_002',
      fieldName: 'Depreciation & Section 179 Expense',
      taxFormTarget: 'Form 1120-S, Line 14 (Form 4562)',
      sourceDocumentId: 'doc_fixed_asset_additions_2024',
      sourceDocName: '2024_Fixed_Asset_Additions_Invoice_Batch.pdf',
      sourceSha256: '1178a801b75c253f101fbe70545b28d89d6fd4a8fe900c3565f652aba1c1956c',
      ocrArtifactId: 'ocr_doc_fixed_asset_additions_2024_v1',
      extractionArtifactId: 'ext_doc_fixed_asset_additions_2024_v1',
      sourcePage: 1,
      boundingBox: { ymin: 360, xmin: 50, ymax: 410, xmax: 310 },
      extractedRawValue: '$ 173,731.00',
      workpaperValue: 173731,
      priorYearValue: 94200,
      confidence: 0.92,
      reviewStatus: 'Pending Review',
      preparerId: 'usr_staff_001',
      preparerName: 'Marcus Vance, EA',
      version: 1,
      internalReviewerNotes: 'Verify South Carolina non-conformity addback under SC Code § 12-6-40.',
      preparerNotes: 'Significant variance due to new Mini Excavator ($118.5k) and Ford F-250 ($68.4k).',
      history: []
    }
  ]
]);

// Server-authoritative Credit Ledger
let serverCreditBalance = 4850;
interface ServerCreditTransaction {
  id: string;
  timestamp: string;
  userId: string;
  clientId: string;
  engagementId: string;
  provider: string;
  model: string;
  operation: string;
  estimatedCredits: number;
  actualCredits: number;
  status: 'Reserved' | 'Completed' | 'Refunded';
  notes: string;
}

const SERVER_CREDIT_LEDGER: ServerCreditTransaction[] = [
  {
    id: 'crd_tx_001',
    timestamp: new Date().toISOString(),
    userId: 'usr_staff_001',
    clientId: 'usr_client_001',
    engagementId: 'eng_2025_perotti',
    provider: 'Google Doc AI v2.4',
    model: 'Form Parser Enterprise',
    operation: 'OCR & Bounding Box Extraction',
    estimatedCredits: 18,
    actualCredits: 18,
    status: 'Completed',
    notes: 'Multipage extraction completed with 98% confidence.'
  }
];

// ----------------------------------------------------------------------
// 1. LEGACY ROUTE HANDLERS
// ----------------------------------------------------------------------

// Legacy route entry: /taxguard, /taxguard/dashboard, /taxguard/operating-console
export function handleLegacyTaxGuardRoute(req: AuthenticatedRequest, res: Response) {
  // If user is authenticated, redirect to their designated role dashboard
  if (req.user) {
    const role = req.user.role as string;
    let targetHash = '#/client/dashboard';

    if (role === 'admin' || role === 'administrator' || role === 'super_admin') {
      targetHash = '#/admin/dashboard';
    } else if (role === 'senior_reviewer' || role === 'reviewer') {
      targetHash = '#/reviewer/dashboard';
    } else if (role === 'accountant' || role === 'staff') {
      targetHash = '#/accountant/dashboard';
    } else if (role === 'billing') {
      targetHash = '#/billing/dashboard';
    } else if (role === 'compliance') {
      targetHash = '#/compliance/dashboard';
    } else if (role === 'client' || role === 'prospective_client') {
      targetHash = '#/client/dashboard';
    }

    return res.redirect(302, `/${targetHash}`);
  }

  // If unauthenticated: Reject with 401
  return res.status(401).json({
    error: 'Unauthorized: Authentication required',
    code: 'AUTH_REQUIRED',
    message: 'Standalone TaxGuard AI console has been deprecated. TaxGuard AI operates as an integrated service layer within authorized role dashboards. Please authenticate with your designated role credentials.',
    ...DEVELOPER_NOTICE,
    loginUrl: '/#/client/login'
  });
}

// Map express legacy endpoints
taxguardRouter.get('/', handleLegacyTaxGuardRoute);
taxguardRouter.get('/dashboard', handleLegacyTaxGuardRoute);
taxguardRouter.get('/operating-console', handleLegacyTaxGuardRoute);
taxguardRouter.get('/console', handleLegacyTaxGuardRoute);

// ----------------------------------------------------------------------
// 2. HEALTH & VERSIONED CALCULATION ENGINES
// ----------------------------------------------------------------------
taxguardRouter.get('/status', (req, res) => {
  res.json({
    service: 'TaxGuard AI Service Layer',
    status: 'operational',
    architecture: 'Integrated Role Dashboard Service Layer (No Standalone Console)',
    supportedForms: ['Form 1040', 'Form 1120-S', 'Form 1065', 'Form 4562', 'Form 433-A', 'SC1040ES', 'SC Form 1120S-WH'],
    activeEngines: {
      scDepreciationConformity: {
        statutoryCode: 'SC Code § 12-6-40(A)(1)(a)',
        section179Cap: 25000,
        bonusDepreciationAllowed: false,
        version: 'SC-2024.1'
      },
      shareholderBasisLimitation: {
        statutoryCode: 'IRC § 1367 / IRC § 1366(d)',
        orderingRulesEnforced: true,
        version: 'IRC-1367-2024'
      },
      estimatedTaxSafeHarbor: {
        statutoryCode: 'IRC § 6654(d)(1)(B)-(C)',
        highAgiThreshold: 150000,
        highAgiSafeHarborPercent: 1.10,
        standardSafeHarborPercent: 1.00,
        currentYearSafeHarborPercent: 0.90,
        version: 'IRC-6654-2024'
      },
      offerInCompromiseRcp: {
        statutoryCode: 'IRC § 7122 / Form 433-A(OIC)',
        nationalStandardsApplied: true,
        version: 'IRS-OIC-2024.2'
      },
      firstTimePenaltyAbatement: {
        statutoryCode: 'IRM 20.1.1.3.6.1',
        cleanComplianceYearsRequired: 3,
        version: 'IRM-FTA-2024'
      }
    },
    ...DEVELOPER_NOTICE
  });
});

// ----------------------------------------------------------------------
// 3. SERVER-AUTHORITATIVE CREDIT METERING & RECONCILIATION
// ----------------------------------------------------------------------

// Get balance (Server-calculated; client cannot tamper)
taxguardRouter.get('/credits/balance', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    firmBalance: serverCreditBalance,
    recentTransactions: SERVER_CREDIT_LEDGER.slice(-10),
    ...DEVELOPER_NOTICE
  });
});

// Reserve credits before job execution
taxguardRouter.post('/credits/reserve', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { clientId, engagementId, provider, model, operation, estimatedCredits } = req.body;

  if (!estimatedCredits || estimatedCredits <= 0) {
    return res.status(400).json({ error: 'Valid estimatedCredits quantity required.' });
  }

  if (serverCreditBalance < estimatedCredits) {
    return res.status(402).json({
      error: 'Insufficient firm AI credits for this operation.',
      code: 'INSUFFICIENT_CREDITS',
      balance: serverCreditBalance,
      required: estimatedCredits
    });
  }

  // Deduct server-side reservation
  serverCreditBalance -= estimatedCredits;

  const transaction: ServerCreditTransaction = {
    id: `crd_res_${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: req.user!.id,
    clientId: clientId || 'general',
    engagementId: engagementId || 'general',
    provider: provider || 'Google GenAI / DocAI',
    model: model || 'Default TaxGuard Model',
    operation: operation || 'Workflow Execution',
    estimatedCredits,
    actualCredits: 0,
    status: 'Reserved',
    notes: `Pre-execution credit reservation for ${operation}.`
  };

  SERVER_CREDIT_LEDGER.push(transaction);

  res.json({
    success: true,
    reservationId: transaction.id,
    newBalance: serverCreditBalance,
    transaction
  });
});

// Reconcile actual credit use after job completion
taxguardRouter.post('/credits/reconcile', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { reservationId, actualCredits } = req.body;

  const tx = SERVER_CREDIT_LEDGER.find(t => t.id === reservationId);
  if (!tx) {
    return res.status(404).json({ error: 'Reservation transaction not found.' });
  }

  if (tx.status !== 'Reserved') {
    return res.status(400).json({ error: `Transaction already finalized as ${tx.status}.` });
  }

  const creditDiff = tx.estimatedCredits - actualCredits;
  // If actual was less than estimated, refund difference to server balance
  if (creditDiff > 0) {
    serverCreditBalance += creditDiff;
  } else if (creditDiff < 0) {
    // Additional consumption
    serverCreditBalance -= Math.abs(creditDiff);
  }

  tx.actualCredits = actualCredits;
  tx.status = 'Completed';
  tx.notes = `Job completed. Actual credit consumption reconciled ($${actualCredits} credits used).`;

  res.json({
    success: true,
    reconciledBalance: serverCreditBalance,
    transaction: tx
  });
});

// Automatic refund on failed or aborted jobs
taxguardRouter.post('/credits/refund', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { reservationId, failureReason } = req.body;

  const tx = SERVER_CREDIT_LEDGER.find(t => t.id === reservationId);
  if (!tx) {
    return res.status(404).json({ error: 'Reservation transaction not found.' });
  }

  if (tx.status === 'Completed') {
    return res.status(400).json({ error: 'Cannot refund a successfully completed transaction.' });
  }

  // Restore 100% of reserved credits
  serverCreditBalance += tx.estimatedCredits;
  tx.status = 'Refunded';
  tx.actualCredits = 0;
  tx.notes = `Job aborted or failed: ${failureReason || 'Internal pipeline fault'}. Full credit reserve released.`;

  res.json({
    success: true,
    message: 'Reserved credits safely returned to firm balance.',
    restoredBalance: serverCreditBalance,
    transaction: tx
  });
});

// ----------------------------------------------------------------------
// 4. MAKER-CHECKER ENFORCEMENT & IMMUTABLE RECORD LOCKING
// ----------------------------------------------------------------------

// Certify & approve workpaper value (Requires Maker-Checker check)
taxguardRouter.post('/maker-checker/approve', 
  authenticateToken, 
  requireMakerChecker((req) => {
    const field = DEMO_WORKPAPERS.get(req.body.fieldId);
    return field?.preparerId;
  }),
  (req: AuthenticatedRequest, res: Response) => {
    const { fieldId } = req.body;
    const field = DEMO_WORKPAPERS.get(fieldId);

    if (!field) {
      return res.status(404).json({ error: 'Workpaper field not found.', code: 'NOT_FOUND' });
    }

    field.reviewStatus = 'Approved';
    field.lastApprovedBy = req.user!.name;
    field.lastApprovedAt = new Date().toISOString();

    db.logSecurityEvent({
      eventType: 'MAKER_CHECKER_APPROVAL_RECORDED',
      ipAddress: req.ip || 'unknown',
      userId: req.user!.id,
      details: `Senior Reviewer ${req.user!.name} approved field "${field.fieldName}" ($${field.workpaperValue.toLocaleString()}) for engagement ${field.engagementId}.`,
      severity: 'info'
    });

    res.json({
      success: true,
      message: `Workpaper field "${field.fieldName}" certified and locked to return package.`,
      field
    });
  }
);

// Material override: Automatically invalidates previous approvals and increments version
taxguardRouter.post('/maker-checker/material-override', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { fieldId, newAmount, justification } = req.body;

  if (!justification || justification.trim().length < 5) {
    return res.status(400).json({ error: 'Contemporaneous professional justification required for material overrides.' });
  }

  const parsedNewAmount = Number(newAmount);
  if (newAmount === null || newAmount === undefined || newAmount === '' || !Number.isFinite(parsedNewAmount)) {
    return res.status(400).json({
      error: 'Material override requires an explicit finite numeric amount. Unsupported source data was not repaired or coerced.'
    });
  }

  const field = DEMO_WORKPAPERS.get(fieldId);
  if (!field) {
    return res.status(404).json({ error: 'Workpaper field not found.' });
  }

  const wasApproved = field.reviewStatus === 'Approved';
  const previousApprovedBy = field.lastApprovedBy;
  const previousValue = field.workpaperValue;

  // Preserve history
  field.history.push({
    version: field.version,
    value: previousValue,
    modifiedBy: req.user!.name,
    reason: justification,
    timestamp: new Date().toISOString()
  });

  // Apply change, increment version, and invalidate prior sign-off
  field.version += 1;
  field.workpaperValue = parsedNewAmount;
  field.reviewStatus = 'Corrected';
  field.lastApprovedBy = undefined;
  field.lastApprovedAt = undefined;

  if (wasApproved) {
    db.logSecurityEvent({
      eventType: 'MATERIAL_CHANGE_INVALIDATED_APPROVAL',
      ipAddress: req.ip || 'unknown',
      userId: req.user!.id,
      details: `Material override on "${field.fieldName}" from ${previousValue.toLocaleString()} to ${parsedNewAmount.toLocaleString()} INVALIDATED former approval by ${previousApprovedBy || 'Reviewer'}. Reason: ${justification}`,
      severity: 'critical'
    });
  }

  res.json({
    success: true,
    message: `Material override applied. Prior approvals were invalidated. New version is v${field.version}.`,
    invalidatedPreviousApproval: wasApproved,
    field
  });
});

// Query field provenance
taxguardRouter.get('/provenance/field/:fieldId', authenticateToken, requireClientIsolation, (req: AuthenticatedRequest, res: Response) => {
  const { fieldId } = req.params;
  const field = DEMO_WORKPAPERS.get(fieldId);

  if (!field) {
    return res.status(404).json({ error: 'Requested field not found.', code: 'NOT_FOUND', ...DEVELOPER_NOTICE });
  }

  // Scrub internal notes if client is requesting
  const sanitized = filterReviewerNotesForClients(field, req.user!.role);
  res.json({
    ...sanitized,
    evidenceLineage: {
      document: {
        documentId: field.sourceDocumentId,
        fileName: field.sourceDocName
      },
      hash: {
        algorithm: 'SHA-256',
        value: field.sourceSha256
      },
      ocrArtifact: {
        artifactId: field.ocrArtifactId
      },
      extractionArtifact: {
        artifactId: field.extractionArtifactId,
        page: field.sourcePage,
        boundingBox: field.boundingBox
      },
      proposedField: {
        fieldId: field.id,
        fieldName: field.fieldName,
        rawValue: field.extractedRawValue,
        proposedWorkpaperValue: field.workpaperValue,
        confidence: field.confidence,
        isAiProposedOnly: true
      },
      validation: {
        status: field.reviewStatus,
        version: field.version
      },
      decision: {
        approvedBy: field.lastApprovedBy || null,
        approvedAt: field.lastApprovedAt || null,
        history: field.history
      }
    }
  });
});

// ----------------------------------------------------------------------
// 5. STATUTORY TAX CALCULATION ENGINES
// ----------------------------------------------------------------------

// South Carolina Depreciation Decoupling (SC Code § 12-6-40)
taxguardRouter.post('/calculations/depreciation', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { costBasis, category, recoveryYears, section179Claimed, bonusPercent } = req.body;

  const basis = Number(costBasis) || 0;
  const sec179 = Math.min(basis, Number(section179Claimed) || 0);

  // Federal Bonus Depreciation (60% in 2024 for qualified property)
  const remainingBasisForBonus = Math.max(0, basis - sec179);
  const bonusAmount = remainingBasisForBonus * ((Number(bonusPercent) || 60) / 100);

  // Remaining basis for standard MACRS 200% DB half-year (year 1 rate for 5-yr property = 20%)
  const remainingBasisForMacrs = Math.max(0, remainingBasisForBonus - bonusAmount);
  const macrsRate = recoveryYears === 7 ? 0.1429 : 0.20;
  const macrsDepreciation = remainingBasisForMacrs * macrsRate;

  const totalFederalDepreciation = Math.round(sec179 + bonusAmount + macrsDepreciation);

  // South Carolina State Rules:
  // 1. SC Code § 12-6-40(A)(1)(a) caps Section 179 at $25,000
  // 2. SC Code § 12-6-40(A)(1)(a) explicitly disallows federal bonus depreciation (IRC § 168(k))
  const scSec179 = Math.min(25000, sec179);
  const scBonus = 0;
  const scRemainingBasis = Math.max(0, basis - scSec179);
  const scMacrsDepreciation = scRemainingBasis * macrsRate;
  const totalStateDepreciation = Math.round(scSec179 + scBonus + scMacrsDepreciation);

  // SC State Addition to Federal Taxable Income
  const scStateAddback = Math.max(0, totalFederalDepreciation - totalStateDepreciation);

  res.json({
    taxYear: 2024,
    federal: {
      costBasis: basis,
      section179Amount: sec179,
      bonusDepreciationAmount: bonusAmount,
      macrsDepreciation: Math.round(macrsDepreciation),
      totalDepreciation: totalFederalDepreciation
    },
    stateSC: {
      statutoryAuthority: 'South Carolina Code § 12-6-40(A)(1)(a)',
      section179Cap: 25000,
      bonusDepreciationAllowed: false,
      section179Allowed: scSec179,
      macrsDepreciation: Math.round(scMacrsDepreciation),
      totalDepreciation: totalStateDepreciation,
      scStateAddbackAdjustment: scStateAddback,
      schedulePlacement: 'SC Form 1120S-WH / SC1040 Addition to Federal Income'
    },
    ...DEVELOPER_NOTICE
  });
});

// IRC § 1367 Shareholder Stock and Debt Basis Calculation
taxguardRouter.post('/calculations/shareholder-basis', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const {
    beginningStockBasis,
    capitalContributions,
    ordinaryBusinessIncome,
    taxExemptIncome,
    distributions,
    nondeductibleExpenses,
    deductionsAndLosses,
    beginningDebtBasis,
    shareholderLoansAdded,
    shareholderLoansRepaid
  } = req.body;

  // Step 1: Beginning Basis
  let stockBasis = Number(beginningStockBasis) || 0;

  // Step 2: Increases (Capital contributions + taxable and tax-exempt income)
  const totalIncreases = (Number(capitalContributions) || 0) + 
                         (Number(ordinaryBusinessIncome) || 0) + 
                         (Number(taxExemptIncome) || 0);
  stockBasis += totalIncreases;

  // Step 3: Decreases for non-dividend distributions (cannot reduce below 0)
  const dist = Number(distributions) || 0;
  const allowableDistribution = Math.min(stockBasis, dist);
  const capitalGainOnDistribution = Math.max(0, dist - stockBasis);
  stockBasis -= allowableDistribution;

  // Step 4: Decreases for nondeductible expenses
  const nondeduct = Number(nondeductibleExpenses) || 0;
  const nondeductApplied = Math.min(stockBasis, nondeduct);
  stockBasis -= nondeductApplied;

  // Step 5: Deductions and losses
  const losses = Number(deductionsAndLosses) || 0;
  const lossesAbsorbedByStock = Math.min(stockBasis, losses);
  stockBasis -= lossesAbsorbedByStock;
  const remainingLosses = losses - lossesAbsorbedByStock;

  // Step 6: Debt Basis (Direct loans to S-Corp)
  let debtBasis = (Number(beginningDebtBasis) || 0) + (Number(shareholderLoansAdded) || 0) - (Number(shareholderLoansRepaid) || 0);
  debtBasis = Math.max(0, debtBasis);

  const lossesAbsorbedByDebt = Math.min(debtBasis, remainingLosses);
  debtBasis -= lossesAbsorbedByDebt;

  // Step 7: Suspended Losses under IRC § 1366(d) (Carry forward indefinitely)
  const suspendedLosses = remainingLosses - lossesAbsorbedByDebt;

  res.json({
    taxYear: 2024,
    statutoryAuthority: 'IRC § 1367 / Treas. Reg. § 1.1367-1',
    schedule: {
      beginningStockBasis: Number(beginningStockBasis) || 0,
      plusIncreases: totalIncreases,
      lessDistributions: allowableDistribution,
      capitalGainOnExcessDistribution: capitalGainOnDistribution,
      lessNondeductibleExpenses: nondeductApplied,
      lessLossesAbsorbedByStock: lossesAbsorbedByStock,
      endingStockBasis: Math.max(0, stockBasis),
      debtBasisCalculations: {
        adjustedDebtBasis: debtBasis,
        lossesAbsorbedByDebt
      },
      suspendedLossesCarryforward: suspendedLosses
    },
    ...DEVELOPER_NOTICE
  });
});

// IRC § 6654 Estimated Tax Safe-Harbor
taxguardRouter.post('/calculations/safe-harbor', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { priorYearTax, priorYearAgi, currentEstimatedTax } = req.body;

  const priorTax = Number(priorYearTax) || 0;
  const priorAgi = Number(priorYearAgi) || 0;
  const currentTax = Number(currentEstimatedTax) || 0;

  // 110% rule if prior AGI > $150,000 ($75,000 if married filing separately)
  const isHighIncome = priorAgi > 150000;
  const priorYearFactor = isHighIncome ? 1.10 : 1.00;

  const safeHarborPriorYearAnnual = Math.round(priorTax * priorYearFactor);
  const safeHarborCurrentYearAnnual = Math.round(currentTax * 0.90);

  const requiredSafeHarborAnnual = Math.min(safeHarborPriorYearAnnual, safeHarborCurrentYearAnnual);
  const requiredQuarterlyPayment = Math.round(requiredSafeHarborAnnual / 4);

  res.json({
    taxYear: 2024,
    statutoryAuthority: 'IRC § 6654(d)(1)(B)-(C)',
    isHighIncome,
    priorYearSafeHarbor: {
      requiredPercentage: priorYearFactor * 100,
      annualTotal: safeHarborPriorYearAnnual,
      quarterlyPayment: Math.round(safeHarborPriorYearAnnual / 4)
    },
    currentYearSafeHarbor: {
      requiredPercentage: 90,
      annualTotal: safeHarborCurrentYearAnnual,
      quarterlyPayment: Math.round(safeHarborCurrentYearAnnual / 4)
    },
    recommendedAnnualSafeHarbor: requiredSafeHarborAnnual,
    recommendedQuarterlyPayment: requiredQuarterlyPayment,
    ...DEVELOPER_NOTICE
  });
});

// Form 433-A OIC Reasonable Collection Potential (RCP)
taxguardRouter.post('/calculations/rcp', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { monthlyGrossIncome, allowableLivingExpenses, netRealizableEquityInAssets } = req.body;

  const income = Number(monthlyGrossIncome) || 0;
  const ale = Number(allowableLivingExpenses) || 0;
  const equity = Number(netRealizableEquityInAssets) || 0;

  const monthlyDisposableIncome = Math.max(0, income - ale);

  // Lump Sum Offer: Equity + (12 * monthly disposable income) (Paid in 5 or fewer months)
  const lumpSumOffer = equity + (12 * monthlyDisposableIncome);

  // Periodic Payment Offer: Equity + (24 * monthly disposable income) (Paid in 6-24 months)
  const periodicPaymentOffer = equity + (24 * monthlyDisposableIncome);

  res.json({
    statutoryAuthority: 'IRC § 7122 / Form 433-A(OIC)',
    monthlyDisposableIncome,
    netRealizableEquity: equity,
    lumpSumOfferOption: {
      multiplierMonths: 12,
      futureIncomeComponent: 12 * monthlyDisposableIncome,
      minimumOfferAmount: lumpSumOffer
    },
    periodicPaymentOption: {
      multiplierMonths: 24,
      futureIncomeComponent: 24 * monthlyDisposableIncome,
      minimumOfferAmount: periodicPaymentOffer
    },
    ...DEVELOPER_NOTICE
  });
});

// IRM 20.1.1 First-Time Penalty Abatement (FTA) Workflow
taxguardRouter.post('/calculations/penalty-abatement', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { taxYear, hasPriorPenaltiesInLast3Years, allRequiredReturnsFiled, currentTaxPaidOrOnInstallment } = req.body;

  const isEligibleForFta = !hasPriorPenaltiesInLast3Years && allRequiredReturnsFiled && currentTaxPaidOrOnInstallment;

  res.json({
    taxYear,
    statutoryAuthority: 'Internal Revenue Manual (IRM) 20.1.1.3.6.1',
    administrativeReliefType: 'First-Time Penalty Abatement (FTA)',
    criteria: {
      cleanPenaltyHistoryThreePriorYears: !hasPriorPenaltiesInLast3Years,
      filingCompliance: Boolean(allRequiredReturnsFiled),
      paymentCompliance: Boolean(currentTaxPaidOrOnInstallment)
    },
    qualifiedForFTA: isEligibleForFta,
    recommendedAction: isEligibleForFta 
      ? 'Prepare Form 843 or oral administrative request to IRS requesting penalty relief under IRM 20.1.1.'
      : 'Evaluate reasonable-cause relief under Treas. Reg. § 301.6651-1(c) based on ordinary business care and prudence.',
    ...DEVELOPER_NOTICE
  });
});

// Resolution Notice Certification (Guarded by requirePractitionerAuthority)
taxguardRouter.post('/resolution/certify', 
  authenticateToken, 
  requirePractitionerAuthority,
  (req: AuthenticatedRequest, res: Response) => {
    const { noticeId, strategy } = req.body;

    db.logSecurityEvent({
      eventType: 'PRACTITIONER_CERTIFIED_RESOLUTION',
      ipAddress: req.ip || 'unknown',
      userId: req.user!.id,
      details: `Practitioner ${req.user!.name} (${req.user!.role}) certified legal response for notice ${noticeId} using strategy "${strategy}".`,
      severity: 'info'
    });

    res.json({
      success: true,
      message: 'Resolution response dossier certified by authorized practitioner.',
      certifiedBy: req.user!.name,
      certifiedAt: new Date().toISOString()
    });
  }
);
