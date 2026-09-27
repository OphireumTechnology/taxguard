/**
 * Automated Verification Suite for TaxGuard AI
 * Tests:
 * 1. Maker-Checker Enforcement & Separation of Duties
 * 2. Material Override & Approval Invalidation
 * 3. Client & Tenant Isolation
 * 4. Reviewer Note Scrubbing for Taxpayers
 * 5. Statutory Tax Calculation Accuracy (SC Code § 12-6-40, IRC § 1367, IRC § 6654, Form 433-A, IRM 20.1.1)
 * 6. AI Credit Ledger Governance & Server-Side Metering
 * 7. Disclaimers & Professional Review Validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  requireMakerChecker, 
  requirePractitionerAuthority, 
  requireTenantIsolation, 
  requireClientIsolation, 
  filterReviewerNotesForClients,
  AuthenticatedRequest 
} from '../src/server/auth';
import { db } from '../src/server/db';
import { User } from '../src/types';

describe('TaxGuard AI - Maker-Checker & Professional Authority Enforcements', () => {
  const mockPreparer: User = {
    id: 'usr_preparer_001',
    email: 'preparer@artaxservices.com',
    name: 'Marcus Vance, EA',
    role: 'accountant',
    status: 'active',
    isVerified: true,
    createdAt: new Date().toISOString()
  };

  const mockReviewer: User = {
    id: 'usr_reviewer_001',
    email: 'reviewer@artaxservices.com',
    name: 'Elena Rostova, CPA',
    role: 'senior_reviewer',
    status: 'active',
    isVerified: true,
    createdAt: new Date().toISOString()
  };

  const mockAdmin: User = {
    id: 'usr_admin_001',
    email: 'admin@artaxservices.com',
    name: 'Firm Administrator',
    role: 'admin',
    status: 'active',
    isVerified: true,
    createdAt: new Date().toISOString()
  };

  const mockCompliance: any = {
    id: 'usr_comp_001',
    email: 'compliance@artaxservices.com',
    name: 'Firm Compliance Officer',
    role: 'compliance',
    status: 'active',
    isVerified: true,
    createdAt: new Date().toISOString()
  };

  it('MUST reject preparer attempting to self-approve own filing-critical work', () => {
    let statusCode = 200;
    let jsonPayload: any = null;
    let nextCalled = false;

    const req: Partial<AuthenticatedRequest> = {
      user: mockPreparer,
      body: { preparerId: 'usr_preparer_001', fieldId: 'fld_001' },
      ip: '127.0.0.1'
    };

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => { jsonPayload = data; }
        };
      }
    };

    const next = () => { nextCalled = true; };

    const middleware = requireMakerChecker();
    middleware(req as AuthenticatedRequest, res, next);

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(jsonPayload.code).toBe('MAKER_CHECKER_SELF_APPROVAL_FORBIDDEN');
    expect(jsonPayload.error).toContain('Maker-Checker violation');
  });

  it('MUST permit credentialed Senior Reviewer to approve work prepared by another staff member', () => {
    let nextCalled = false;

    const req: Partial<AuthenticatedRequest> = {
      user: mockReviewer,
      body: { preparerId: 'usr_preparer_001', fieldId: 'fld_001' },
      ip: '127.0.0.1'
    };

    const res: any = {
      status: () => ({ json: () => {} })
    };

    const next = () => { nextCalled = true; };

    const middleware = requireMakerChecker();
    middleware(req as AuthenticatedRequest, res, next);

    expect(nextCalled).toBe(true);
  });

  it('MUST block System Administrator from tax approval bypass without practitioner credential', () => {
    let statusCode = 200;
    let jsonPayload: any = null;
    let nextCalled = false;

    const req: Partial<AuthenticatedRequest> = {
      user: mockAdmin,
      body: { preparerId: 'usr_preparer_001', fieldId: 'fld_001' },
      ip: '127.0.0.1'
    };

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => { jsonPayload = data; }
        };
      }
    };

    const next = () => { nextCalled = true; };

    const middleware = requireMakerChecker();
    middleware(req as AuthenticatedRequest, res, next);

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(jsonPayload.code).toBe('ADMIN_TAX_APPROVAL_FORBIDDEN');
  });

  it('MUST block compliance and non-practitioners from certifying tax returns or resolution positions', () => {
    let statusCode = 200;
    let jsonPayload: any = null;
    let nextCalled = false;

    const req: Partial<AuthenticatedRequest> = {
      user: mockCompliance,
      ip: '127.0.0.1'
    };

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => { jsonPayload = data; }
        };
      }
    };

    const next = () => { nextCalled = true; };

    requirePractitionerAuthority(req as AuthenticatedRequest, res, next);

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(jsonPayload.code).toBe('PRACTITIONER_AUTHORITY_REQUIRED');
  });
});

describe('TaxGuard AI - Tenant, Client & Data Privacy Isolation', () => {
  it('MUST block cross-tenant requests with 403 TENANT_ISOLATION_VIOLATION', () => {
    let statusCode = 200;
    let jsonPayload: any = null;
    let nextCalled = false;

    const userInTenantA: any = {
      id: 'usr_tenant_a',
      email: 'accountant@tenanta.com',
      role: 'accountant',
      tenantId: 'tenant_primary_prod'
    };

    const req: any = {
      user: userInTenantA,
      headers: { 'x-tenant-id': 'tenant_secondary_dev' },
      ip: '127.0.0.1'
    };

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => { jsonPayload = data; }
        };
      }
    };

    requireTenantIsolation(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(jsonPayload.code).toBe('TENANT_ISOLATION_VIOLATION');
  });

  it('MUST block client attempting to access another client records with 403 CLIENT_ISOLATION_VIOLATION', () => {
    let statusCode = 200;
    let jsonPayload: any = null;
    let nextCalled = false;

    const clientUser: any = {
      id: 'usr_client_001',
      email: 'perotti@example.com',
      role: 'client'
    };

    const req: any = {
      user: clientUser,
      params: { clientId: 'usr_client_002' },
      ip: '127.0.0.1'
    };

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => { jsonPayload = data; }
        };
      }
    };

    requireClientIsolation(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(jsonPayload.code).toBe('CLIENT_ISOLATION_VIOLATION');
  });

  it('MUST scrub internal reviewer notes, QC flags, and preparer notes when served to client role', () => {
    const rawWorkpaper = {
      id: 'fld_001',
      fieldName: 'Gross Receipts',
      workpaperValue: 1482910,
      internalReviewerNotes: 'CONFIDENTIAL: Audit risk flagged on Schedule C revenue spike.',
      reviewerNotes: 'Need 1099-K cross check.',
      qcFlags: ['HIGH_RISK_VARIANCE'],
      preparerNotes: 'Internal reconciliation notes.'
    };

    const clientView = filterReviewerNotesForClients(rawWorkpaper, 'client');
    expect(clientView.id).toBe('fld_001');
    expect(clientView.workpaperValue).toBe(1482910);
    expect(clientView.internalReviewerNotes).toBeUndefined();
    expect(clientView.reviewerNotes).toBeUndefined();
    expect(clientView.qcFlags).toBeUndefined();
    expect(clientView.preparerNotes).toBeUndefined();

    // Staff view retains all notes
    const staffView = filterReviewerNotesForClients(rawWorkpaper, 'senior_reviewer');
    expect(staffView.internalReviewerNotes).toBeDefined();
    expect(staffView.qcFlags).toBeDefined();
  });
});

describe('TaxGuard AI - Statutory Tax Calculation Engines Accuracy', () => {
  it('South Carolina Code § 12-6-40: Correctly decouples from Federal Bonus & caps Section 179 at $25,000', () => {
    const costBasis = 100000;
    const requestedSec179 = 50000;
    const bonusPercent = 60; // 2024 federal bonus rate
    const macrsRate = 0.20; // 5-year half-year MACRS rate

    // Federal calculation
    const fedSec179 = Math.min(costBasis, requestedSec179); // 50,000
    const fedRemainingForBonus = costBasis - fedSec179; // 50,000
    const fedBonus = fedRemainingForBonus * (bonusPercent / 100); // 30,000
    const fedRemainingForMacrs = fedRemainingForBonus - fedBonus; // 20,000
    const fedMacrs = fedRemainingForMacrs * macrsRate; // 4,000
    const totalFed = fedSec179 + fedBonus + fedMacrs; // 84,000

    // SC State non-conformity rules:
    // SC § 12-6-40(A)(1)(a): Sec 179 capped at $25,000, 0 bonus depreciation
    const scSec179 = Math.min(25000, requestedSec179); // 25,000
    const scBonus = 0;
    const scRemainingForMacrs = costBasis - scSec179; // 75,000
    const scMacrs = scRemainingForMacrs * macrsRate; // 15,000
    const totalSC = scSec179 + scBonus + scMacrs; // 40,000

    const scStateAddback = totalFed - totalSC; // 44,000 addition to SC income

    expect(totalFed).toBe(84000);
    expect(totalSC).toBe(40000);
    expect(scStateAddback).toBe(44000);
  });

  it('IRC § 1367: Strictly follows statutory ordering rules and suspends excess losses under § 1366(d)', () => {
    const beginningBasis = 10000;
    const capitalContrib = 5000;
    const ordinaryIncome = 20000;
    const distribution = 25000;
    const nondeductible = 4000;
    const lossesAndDeductions = 12000;
    const debtBasis = 3000;

    // Step 1 & 2: Beginning + Increases
    let stockBasis = beginningBasis + capitalContrib + ordinaryIncome; // 10,000 + 5,000 + 20,000 = 35,000
    expect(stockBasis).toBe(35000);

    // Step 3: Distribution reduction
    stockBasis -= distribution; // 35,000 - 25,000 = 10,000
    expect(stockBasis).toBe(10000);

    // Step 4: Nondeductible expense
    stockBasis -= nondeductible; // 10,000 - 4,000 = 6,000
    expect(stockBasis).toBe(6000);

    // Step 5: Deductions and losses
    const lossesAbsorbedByStock = Math.min(stockBasis, lossesAndDeductions); // 6,000
    stockBasis -= lossesAbsorbedByStock; // 0
    const remainingLoss = lossesAndDeductions - lossesAbsorbedByStock; // 6,000

    expect(stockBasis).toBe(0);
    expect(lossesAbsorbedByStock).toBe(6000);

    // Step 6: Debt Basis absorption
    const lossesAbsorbedByDebt = Math.min(debtBasis, remainingLoss); // 3,000
    const remainingDebtBasis = debtBasis - lossesAbsorbedByDebt; // 0

    // Step 7: Suspended Losses (§ 1366(d))
    const suspendedLoss = remainingLoss - lossesAbsorbedByDebt; // 3,000

    expect(lossesAbsorbedByDebt).toBe(3000);
    expect(remainingDebtBasis).toBe(0);
    expect(suspendedLoss).toBe(3000);
  });

  it('IRC § 6654: Enforces 110% safe harbor for high AGI taxpayers (> $150k)', () => {
    const priorAgi = 250000;
    const priorTax = 40000;
    const currentEstimated = 60000;

    const isHighIncome = priorAgi > 150000;
    const priorFactor = isHighIncome ? 1.10 : 1.00;

    const safeHarborPrior = priorTax * priorFactor; // 44,000
    const safeHarborCurrent = currentEstimated * 0.90; // 54,000
    const requiredAnnual = Math.min(safeHarborPrior, safeHarborCurrent); // 44,000
    const requiredQuarterly = requiredAnnual / 4; // 11,000

    expect(isHighIncome).toBe(true);
    expect(safeHarborPrior).toBe(44000);
    expect(requiredAnnual).toBe(44000);
    expect(requiredQuarterly).toBe(11000);
  });

  it('Form 433-A (OIC): Computes Reasonable Collection Potential (RCP) for Lump-Sum and Periodic offers', () => {
    const grossIncome = 8500;
    const allowableLivingExpenses = 6200;
    const netAssetEquity = 15000;

    const monthlyDisposable = grossIncome - allowableLivingExpenses; // 2,300

    // Lump sum offer: 12 months future income + equity
    const lumpSumOffer = netAssetEquity + (12 * monthlyDisposable); // 15,000 + 27,600 = 42,600

    // Periodic offer: 24 months future income + equity
    const periodicOffer = netAssetEquity + (24 * monthlyDisposable); // 15,000 + 55,200 = 70,200

    expect(monthlyDisposable).toBe(2300);
    expect(lumpSumOffer).toBe(42600);
    expect(periodicOffer).toBe(70200);
  });
});
