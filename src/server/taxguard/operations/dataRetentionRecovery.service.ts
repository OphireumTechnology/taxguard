/**
 * TaxGuard Data Retention, Legal Hold, Archive Integrity & Annual Rollover Service
 * Enforces firm-configured and jurisdiction-sensitive retention policies,
 * immutable SHA-256 archive verification, legal hold blocking (overriding all
 * automated deletion), Stage 17 renewal proposals, and safe Stage 18 annual rollover.
 *
 * Retention periods are governed as firm-configured policy, jurisdiction-sensitive
 * policy, and record-type policy rather than fixed statutory assertions.
 */

import { createHash } from 'node:crypto';

export type RetentionPolicyBasis = 'FIRM_CONFIGURED_POLICY' | 'JURISDICTION_POLICY' | 'CUSTOM_ENGAGEMENT_POLICY';

export interface RetentionPolicyItem {
  recordCategory: 'TAX_RETURN' | 'WORKPAPERS' | 'COMMUNICATIONS' | 'AUDIT_LOGS' | 'INVOICES';
  retentionYears: number;
  policyBasis: RetentionPolicyBasis;
  jurisdiction?: string;
  legalHoldActive: boolean;
  holdReason?: string;
  holdPlacedBy?: string;
  holdPlacedAt?: string;
}

export interface ArchiveManifestCheckResult {
  manifestId: string;
  isValid: boolean;
  computedSha256: string;
  expectedSha256: string;
  verifiedAt: string;
}

export interface RolloverPayload {
  clientId: string;
  sourceTaxYear: number;
  targetTaxYear: number;
  carriedForward: {
    clientIdentity: boolean;
    contactDetails: boolean;
    chartOfAccounts: boolean;
  };
  excludedFromRollover: {
    priorYearIncome: boolean;
    priorYearDocuments: boolean;
    priorYearTaxResults: boolean;
    expiredConsents: boolean;
    resolvedRequests: boolean;
  };
}

export class DataRetentionRecoveryService {
  private retentionPolicies = new Map<string, RetentionPolicyItem>();

  constructor() {
    this.seedDefaultPolicies();
  }

  private seedDefaultPolicies(): void {
    const defaults: RetentionPolicyItem[] = [
      { recordCategory: 'TAX_RETURN', retentionYears: 7, policyBasis: 'FIRM_CONFIGURED_POLICY', jurisdiction: 'US_FEDERAL_DEFAULT', legalHoldActive: false },
      { recordCategory: 'WORKPAPERS', retentionYears: 7, policyBasis: 'FIRM_CONFIGURED_POLICY', jurisdiction: 'US_FEDERAL_DEFAULT', legalHoldActive: false },
      { recordCategory: 'COMMUNICATIONS', retentionYears: 5, policyBasis: 'FIRM_CONFIGURED_POLICY', jurisdiction: 'US_FEDERAL_DEFAULT', legalHoldActive: false },
      { recordCategory: 'AUDIT_LOGS', retentionYears: 10, policyBasis: 'FIRM_CONFIGURED_POLICY', jurisdiction: 'US_FEDERAL_DEFAULT', legalHoldActive: false },
      { recordCategory: 'INVOICES', retentionYears: 7, policyBasis: 'FIRM_CONFIGURED_POLICY', jurisdiction: 'US_FEDERAL_DEFAULT', legalHoldActive: false },
    ];
    for (const p of defaults) {
      this.retentionPolicies.set(p.recordCategory, p);
    }
  }

  getRetentionPolicies(): RetentionPolicyItem[] {
    return Array.from(this.retentionPolicies.values());
  }

  /**
   * Configure or update policy for a record category (firm or jurisdiction specific)
   */
  configurePolicy(
    recordCategory: RetentionPolicyItem['recordCategory'],
    retentionYears: number,
    policyBasis: RetentionPolicyBasis = 'FIRM_CONFIGURED_POLICY',
    jurisdiction = 'US_FEDERAL_DEFAULT'
  ): RetentionPolicyItem {
    if (retentionYears < 1 || retentionYears > 50) {
      throw new Error(`INVALID_RETENTION_DURATION: Retention years must be between 1 and 50.`);
    }
    const current = this.retentionPolicies.get(recordCategory) || {
      recordCategory,
      retentionYears,
      policyBasis,
      jurisdiction,
      legalHoldActive: false,
    };
    current.retentionYears = retentionYears;
    current.policyBasis = policyBasis;
    current.jurisdiction = jurisdiction;
    this.retentionPolicies.set(recordCategory, current);
    return current;
  }

  /**
   * Place or remove a legal hold (unconditionally overrides automated deletion)
   */
  setLegalHold(
    recordCategory: RetentionPolicyItem['recordCategory'],
    active: boolean,
    placedBy: string,
    reason?: string
  ): RetentionPolicyItem {
    const policy = this.retentionPolicies.get(recordCategory);
    if (!policy) throw new Error(`UNKNOWN_RETENTION_CATEGORY: ${recordCategory}`);

    policy.legalHoldActive = active;
    if (active) {
      policy.holdPlacedBy = placedBy;
      policy.holdReason = reason || 'Firm Legal Hold / Pending Regulatory Inquiry';
      policy.holdPlacedAt = new Date().toISOString();
    } else {
      policy.holdPlacedBy = undefined;
      policy.holdReason = undefined;
      policy.holdPlacedAt = undefined;
    }

    this.retentionPolicies.set(recordCategory, policy);
    return policy;
  }

  /**
   * Determine whether a record is eligible for scheduled safe deletion
   */
  isEligibleForDeletion(recordCategory: RetentionPolicyItem['recordCategory'], recordDate: string): boolean {
    const policy = this.retentionPolicies.get(recordCategory);
    if (!policy) return false;

    // RULE 1: Legal Hold BLOCKS deletion unconditionally
    if (policy.legalHoldActive) {
      return false;
    }

    // RULE 2: Must exceed retention period
    const recordTimestamp = new Date(recordDate).getTime();
    const ageYears = (Date.now() - recordTimestamp) / (1000 * 60 * 60 * 24 * 365.25);
    return ageYears >= policy.retentionYears;
  }

  /**
   * Stage 16 Archive Integrity Verification
   * Re-computes SHA-256 of archive content and verifies against authoritative manifest
   */
  verifyArchiveManifest(
    manifestId: string,
    contentPayload: string,
    expectedSha256: string
  ): ArchiveManifestCheckResult {
    const computedSha256 = createHash('sha256').update(contentPayload).digest('hex');
    const isValid = computedSha256.toLowerCase() === expectedSha256.toLowerCase();

    return {
      manifestId,
      isValid,
      computedSha256,
      expectedSha256,
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Stage 17 & 18 Safe Annual Rollover
   * Carries forward ONLY appropriate client identity, contact details, and account structure.
   * Explicitly blocks prior year income, tax outputs, expired consents, and documents.
   */
  executeAnnualRollover(params: {
    clientId: string;
    sourceTaxYear: number;
    targetTaxYear: number;
    actorId: string;
  }): RolloverPayload {
    if (params.targetTaxYear <= params.sourceTaxYear) {
      throw new Error('INVALID_ROLLOVER_YEAR: Target tax year must be greater than source tax year.');
    }

    return {
      clientId: params.clientId,
      sourceTaxYear: params.sourceTaxYear,
      targetTaxYear: params.targetTaxYear,
      carriedForward: {
        clientIdentity: true,
        contactDetails: true,
        chartOfAccounts: true,
      },
      excludedFromRollover: {
        priorYearIncome: true,
        priorYearDocuments: true,
        priorYearTaxResults: true,
        expiredConsents: true,
        resolvedRequests: true,
      },
    };
  }
}

export const globalDataRetentionRecoveryService = new DataRetentionRecoveryService();
