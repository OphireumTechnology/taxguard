/**
 * BLOCK TG-09 — Stage 09: PREPARE TAXES Engine (Highest Priority Functional Block)
 *
 * Implements:
 * - Taxpayer & Entity Profile Management (distinct legal structure vs federal tax classification)
 * - Versioned Federal & State Forms Registry (all Section 09.03 forms; unsupported explicitly marked)
 * - Versioned Tax Rule Pack Governance (immutable once approved; maker-checker approval)
 * - Deterministic Exact-Decimal Tax Computation Engine (SHA-256 fingerprinted, zero floats)
 * - Book-to-Tax Reconciliation Engine (temporary/permanent adjustments, Schedule M-1/M-2 tie-out)
 * - End-to-End Evidence-to-Form Lineage Graph (blocks missing or disputed evidence)
 * - Versioned Return Assembly with Optimistic Concurrency and Stage 10 Submission
 */

import { randomUUID } from 'crypto';
import { ExactDecimal } from './exactDecimal';
import { sha256Hex } from './providerBoundary';
import {
  ActorSessionContext,
  BookToTaxAdjustmentRecord,
  BookToTaxReconciliationSummary,
  EvidenceLineageLink,
  FederalTaxClassification,
  FilingStatus,
  FormRegistryEntry,
  LegalEntityStructure,
  ScopedCaseContext,
  SourceEvidenceRecord,
  TaxBracketRule,
  TaxCalculationRunRecord,
  TaxGuardStageError,
  TaxpayerProfileRecord,
  TaxReturnVersionRecord,
  TaxRulePackRecord,
} from './types';

function scopeKey(scope: ScopedCaseContext): string {
  return `${scope.tenantId}::${scope.clientId}::${scope.engagementId}::${scope.caseId}::${scope.taxYear}`;
}

/**
 * Builds the canonical Section 09.03 Federal & State Forms Registry.
 * Unsupported forms or forms without approved rule packs are explicitly marked
 * NOT_SUPPORTED or PENDING_RULE_APPROVAL — never fabricated.
 */
export function buildDefaultFormsRegistry(taxYear: number): FormRegistryEntry[] {
  const entries: Array<Omit<FormRegistryEntry, 'taxYear' | 'revisionTag'>> = [
    // Individual Income Tax
    { formCode: '1040', formTitle: 'U.S. Individual Income Tax Return', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null, blockingReason: 'Requires owner-approved tax-year rule pack activation.' },
    { formCode: '1040-SR', formTitle: 'U.S. Tax Return for Seniors', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null, blockingReason: 'Requires approved Form 1040-SR tax-year rule pack.' },
    { formCode: '1040-NR', formTitle: 'U.S. Nonresident Alien Income Tax Return', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'Nonresident treaty & FDAP/ECI rule packs not implemented.' },
    // Entity & Fiduciary Returns
    { formCode: '1065', formTitle: 'U.S. Return of Partnership Income', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['PARTNERSHIP_1065'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null, blockingReason: 'Requires approved partnership allocation & K-1 rule pack.' },
    { formCode: '1120', formTitle: 'U.S. Corporation Income Tax Return', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['C_CORP_1120'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null, blockingReason: 'Requires approved corporate income tax rule pack.' },
    { formCode: '1120-S', formTitle: 'U.S. Income Tax Return for an S Corporation', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['S_CORP_1120S'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null, blockingReason: 'Requires approved S-Corp shareholder basis & K-1 rule pack.' },
    { formCode: '1041', formTitle: 'U.S. Income Tax Return for Estates and Trusts', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['FIDUCIARY_1041'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'Fiduciary DNI & beneficiary allocation rules not implemented.' },
    { formCode: '990', formTitle: 'Return of Organization Exempt From Income Tax', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['EXEMPT_990'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'Exempt organization governance & UBIT schedules not implemented.' },
    { formCode: '990-EZ', formTitle: 'Short Form Return of Organization Exempt From Income Tax', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['EXEMPT_990'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'Exempt organization rule pack not implemented.' },
    { formCode: '990-N', formTitle: 'Electronic Notice (e-Postcard) for Tax-Exempt Organizations', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['EXEMPT_990'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'Filed directly via IRS e-Postcard portal.' },
    { formCode: '990-PF', formTitle: 'Return of Private Foundation', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['EXEMPT_990'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'Private foundation excise tax rules not implemented.' },
    // Supporting Schedules
    { formCode: 'Schedule A', formTitle: 'Itemized Deductions', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null },
    { formCode: 'Schedule B', formTitle: 'Interest and Ordinary Dividends', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null },
    { formCode: 'Schedule C', formTitle: 'Profit or Loss From Business (Sole Proprietorship)', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040', 'DISREGARDED_ENTITY'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null },
    { formCode: 'Schedule D', formTitle: 'Capital Gains and Losses', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null },
    { formCode: 'Schedule E', formTitle: 'Supplemental Income and Loss', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null },
    { formCode: 'Schedule F', formTitle: 'Profit or Loss From Farming', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'Farm income averaging & agricultural rules not implemented.' },
    { formCode: 'Schedule SE', formTitle: 'Self-Employment Tax', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040', 'DISREGARDED_ENTITY'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null },
    { formCode: 'Schedule K-1', formTitle: 'Partner / Shareholder / Beneficiary Share of Income, Deductions, Credits', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['PARTNERSHIP_1065', 'S_CORP_1120S', 'FIDUCIARY_1041'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null },
    // Required Special Forms (Section 09.03)
    { formCode: '4562', formTitle: 'Depreciation and Amortization', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040', 'PARTNERSHIP_1065', 'C_CORP_1120', 'S_CORP_1120S'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'MACRS / Section 179 / Bonus Depreciation tables pending rule pack approval.' },
    { formCode: '4797', formTitle: 'Sales of Business Property', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040', 'PARTNERSHIP_1065', 'C_CORP_1120', 'S_CORP_1120S'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'Section 1231/1245/1250 recapture rules not implemented.' },
    { formCode: '8949', formTitle: 'Sales and Other Dispositions of Capital Assets', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null },
    { formCode: '8829', formTitle: 'Expenses for Business Use of Your Home', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040', 'DISREGARDED_ENTITY'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'Home office depreciation/carryover rules not implemented.' },
    { formCode: '8863', formTitle: 'Education Credits (AOTC & Lifetime Learning)', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'MAGI phase-out tables pending rule pack approval.' },
    { formCode: '8889', formTitle: 'Health Savings Accounts (HSAs)', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'HDHP annual contribution limit rule pack pending approval.' },
    { formCode: '8995', formTitle: 'Qualified Business Income Deduction Simplified Computation', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null },
    { formCode: '8995-A', formTitle: 'Qualified Business Income Deduction (Complex / Above Threshold)', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'W-2 wage / UBIA & SSTB phase-in calculations pending rule approval.' },
    { formCode: '6251', formTitle: 'Alternative Minimum Tax — Individuals', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'AMT exemption & preference rule packs not implemented.' },
    { formCode: '2210', formTitle: 'Underpayment of Estimated Tax by Individuals, Estates, and Trusts', jurisdiction: 'FEDERAL', jurisdictionCode: 'US', entityClassifications: ['INDIVIDUAL_1040', 'FIDUCIARY_1041'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'Quarterly IRS interest rate tables pending rule approval.' },
    // Representative State Jurisdiction Entries
    { formCode: 'SC1040', formTitle: 'South Carolina Individual Income Tax Return', jurisdiction: 'STATE', jurisdictionCode: 'SC', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'PENDING_RULE_APPROVAL', approvedRulePackId: null, blockingReason: 'Requires SCDOR tax-year bracket & conformity rule pack approval.' },
    { formCode: 'SC1120S', formTitle: 'South Carolina S Corporation Income Tax Return', jurisdiction: 'STATE', jurisdictionCode: 'SC', entityClassifications: ['S_CORP_1120S'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'SCDOR corporate/PTE election rule pack not implemented.' },
    { formCode: 'GA500', formTitle: 'Georgia Individual Income Tax Return', jurisdiction: 'STATE', jurisdictionCode: 'GA', entityClassifications: ['INDIVIDUAL_1040'], supportStatus: 'NOT_SUPPORTED', approvedRulePackId: null, blockingReason: 'Georgia DOR flat-rate conformity rule pack not implemented.' },
  ];

  return entries.map(e => ({
    ...e,
    taxYear,
    revisionTag: `TY${taxYear}.1`,
  }));
}

export class Stage09PrepareTaxesService {
  private readonly profiles = new Map<string, TaxpayerProfileRecord>();
  private readonly rulePacks = new Map<string, TaxRulePackRecord>();
  private readonly evidence = new Map<string, SourceEvidenceRecord[]>();
  private readonly adjustments = new Map<string, BookToTaxAdjustmentRecord[]>();
  private readonly calculationRuns = new Map<string, TaxCalculationRunRecord[]>();
  private readonly returnVersions = new Map<string, TaxReturnVersionRecord[]>();
  private readonly formsCatalogByYear = new Map<number, FormRegistryEntry[]>();

  private onReturnMateriallyModified?: (params: {
    scope: ScopedCaseContext;
    returnVersionId: string;
    newContentSha256: string;
    actorId: string;
  }) => void;

  setMaterialModificationListener(
    listener: (params: {
      scope: ScopedCaseContext;
      returnVersionId: string;
      newContentSha256: string;
      actorId: string;
    }) => void
  ): void {
    this.onReturnMateriallyModified = listener;
  }

  getFormsRegistry(taxYear: number): FormRegistryEntry[] {
    let list = this.formsCatalogByYear.get(taxYear);
    if (!list) {
      list = buildDefaultFormsRegistry(taxYear);
      this.formsCatalogByYear.set(taxYear, list);
    }
    // Reflect any approved rule packs truthfully
    return list.map(entry => {
      const approvedPack = Array.from(this.rulePacks.values()).find(
        rp =>
          rp.status === 'APPROVED' &&
          rp.formCode === entry.formCode &&
          rp.jurisdictionCode === entry.jurisdictionCode &&
          rp.taxYear === taxYear
      );
      if (approvedPack) {
        return {
          ...entry,
          supportStatus: 'SUPPORTED_RULE_APPROVED',
          approvedRulePackId: approvedPack.rulePackId,
          blockingReason: undefined,
        };
      }
      return entry;
    });
  }

  // --------------------------------------------------------------------------
  // TAXPAYER & ENTITY PROFILE MANAGEMENT
  // --------------------------------------------------------------------------

  upsertTaxpayerProfile(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      legalEntityStructure: LegalEntityStructure;
      federalTaxClassification: FederalTaxClassification;
      filingStatus: FilingStatus;
      primaryJurisdictionCode: string;
      additionalJurisdictions?: string[];
      dependentsCount?: number;
      priorYearCaseId?: string;
      expectedVersion?: number;
    }
  ): TaxpayerProfileRecord {
    const key = scopeKey(scope);
    const existing = this.profiles.get(key);
    if (existing && input.expectedVersion !== undefined && existing.version !== input.expectedVersion) {
      throw new TaxGuardStageError(
        409,
        'CONCURRENCY_CONFLICT',
        `Taxpayer profile version mismatch: expected ${input.expectedVersion}, actual ${existing.version}.`
      );
    }

    // Validate compatibility between legal entity structure and federal tax classification
    if (input.legalEntityStructure === 'INDIVIDUAL' && input.federalTaxClassification !== 'INDIVIDUAL_1040') {
      throw new TaxGuardStageError(
        400,
        'INVALID_TAX_CLASSIFICATION',
        'An INDIVIDUAL legal structure must map to INDIVIDUAL_1040 federal tax classification.'
      );
    }

    const record: TaxpayerProfileRecord = {
      id: existing?.id || `prof_${randomUUID()}`,
      scope: { ...scope },
      legalEntityStructure: input.legalEntityStructure,
      federalTaxClassification: input.federalTaxClassification,
      filingStatus: input.filingStatus,
      primaryJurisdictionCode: input.primaryJurisdictionCode.trim().toUpperCase(),
      additionalJurisdictions: (input.additionalJurisdictions || []).map(j => j.trim().toUpperCase()),
      dependentsCount: Math.max(0, Math.trunc(input.dependentsCount || 0)),
      priorYearCaseId: input.priorYearCaseId,
      version: (existing?.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    };
    this.profiles.set(key, record);
    return record;
  }

  getTaxpayerProfile(scope: ScopedCaseContext): TaxpayerProfileRecord | null {
    return this.profiles.get(scopeKey(scope)) || null;
  }

  // --------------------------------------------------------------------------
  // VERSIONED TAX RULE PACK GOVERNANCE (MAKER-CHECKER APPROVED)
  // --------------------------------------------------------------------------

  draftRulePack(
    actor: ActorSessionContext,
    input: {
      formCode: string;
      jurisdiction: 'FEDERAL' | 'STATE';
      jurisdictionCode: string;
      taxYear: number;
      sourceCitation: string;
      standardDeductions: Partial<Record<FilingStatus, string>>;
      brackets: Partial<Record<FilingStatus, TaxBracketRule[]>>;
      selfEmploymentRate: string;
      selfEmploymentNetEarningsFactor: string;
      qbiDeductionRate: string;
    }
  ): TaxRulePackRecord {
    const existingForForm = Array.from(this.rulePacks.values()).filter(
      r =>
        r.formCode === input.formCode &&
        r.jurisdictionCode === input.jurisdictionCode &&
        r.taxYear === input.taxYear
    );
    const version = existingForForm.length + 1;
    const rulePackId = `rp_${input.jurisdictionCode}_${input.formCode}_${input.taxYear}_v${version}`;
    const contentSha256 = sha256Hex({
      formCode: input.formCode,
      jurisdiction: input.jurisdiction,
      jurisdictionCode: input.jurisdictionCode,
      taxYear: input.taxYear,
      version,
      sourceCitation: input.sourceCitation,
      standardDeductions: input.standardDeductions,
      brackets: input.brackets,
      selfEmploymentRate: input.selfEmploymentRate,
      selfEmploymentNetEarningsFactor: input.selfEmploymentNetEarningsFactor,
      qbiDeductionRate: input.qbiDeductionRate,
    });

    const record: TaxRulePackRecord = {
      rulePackId,
      formCode: input.formCode,
      jurisdiction: input.jurisdiction,
      jurisdictionCode: input.jurisdictionCode.toUpperCase(),
      taxYear: input.taxYear,
      version,
      status: 'DRAFT',
      sourceCitation: input.sourceCitation,
      standardDeductions: input.standardDeductions,
      brackets: input.brackets,
      selfEmploymentRate: input.selfEmploymentRate,
      selfEmploymentNetEarningsFactor: input.selfEmploymentNetEarningsFactor,
      qbiDeductionRate: input.qbiDeductionRate,
      preparedBy: actor.userId,
      approvedBy: null,
      approvedAt: null,
      contentSha256,
    };

    this.rulePacks.set(rulePackId, record);
    return record;
  }

  approveRulePack(actor: ActorSessionContext, rulePackId: string): TaxRulePackRecord {
    const pack = this.rulePacks.get(rulePackId);
    if (!pack) {
      throw new TaxGuardStageError(404, 'RULE_PACK_NOT_FOUND', `Tax rule pack ${rulePackId} not found.`);
    }
    if (pack.preparedBy === actor.userId) {
      throw new TaxGuardStageError(
        403,
        'SELF_APPROVAL_FORBIDDEN',
        'Maker-checker violation: rule pack author cannot approve their own tax rule pack.'
      );
    }
    if (!['reviewer', 'senior_reviewer', 'approver'].includes(actor.role)) {
      throw new TaxGuardStageError(
        403,
        'RULE_PACK_APPROVER_REQUIRED',
        'Only an independent reviewer or qualified tax approver may approve a tax rule pack.'
      );
    }

    // Supersede any previous approved pack for same form/jurisdiction/year
    for (const other of this.rulePacks.values()) {
      if (
        other.rulePackId !== rulePackId &&
        other.formCode === pack.formCode &&
        other.jurisdictionCode === pack.jurisdictionCode &&
        other.taxYear === pack.taxYear &&
        other.status === 'APPROVED'
      ) {
        other.status = 'SUPERSEDED';
      }
    }

    pack.status = 'APPROVED';
    pack.approvedBy = actor.userId;
    pack.approvedAt = new Date().toISOString();
    return pack;
  }

  listRulePacks(taxYear?: number): TaxRulePackRecord[] {
    const all = Array.from(this.rulePacks.values());
    return taxYear ? all.filter(r => r.taxYear === taxYear) : all;
  }

  // --------------------------------------------------------------------------
  // SOURCE EVIDENCE REGISTRY (FOR EVIDENCE-TO-FORM LINEAGE)
  // --------------------------------------------------------------------------

  recordSourceEvidence(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      sourceDocumentId: string;
      verifiedFactId: string;
      category: SourceEvidenceRecord['category'];
      description: string;
      amount: string;
      status?: SourceEvidenceRecord['status'];
    }
  ): SourceEvidenceRecord {
    // Validate exact decimal amount format immediately
    const normalizedAmount = ExactDecimal.fromString(input.amount).toMoneyString();
    const key = scopeKey(scope);
    const list = this.evidence.get(key) || [];
    const status = input.status || 'VERIFIED';

    const rec: SourceEvidenceRecord = {
      evidenceId: `ev_${randomUUID()}`,
      scope: { ...scope },
      sourceDocumentId: input.sourceDocumentId,
      verifiedFactId: input.verifiedFactId,
      category: input.category,
      description: input.description,
      amount: normalizedAmount,
      status,
      verifiedBy: status === 'VERIFIED' ? actor.userId : null,
      verifiedAt: status === 'VERIFIED' ? new Date().toISOString() : null,
    };

    list.push(rec);
    this.evidence.set(key, list);
    return rec;
  }

  listSourceEvidence(scope: ScopedCaseContext): SourceEvidenceRecord[] {
    return [...(this.evidence.get(scopeKey(scope)) || [])];
  }

  // --------------------------------------------------------------------------
  // BOOK-TO-TAX RECONCILIATION ENGINE
  // --------------------------------------------------------------------------

  recordBookToTaxAdjustment(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      accountCode: string;
      accountName: string;
      taxLineCode: string;
      adjustmentType: 'PERMANENT' | 'TEMPORARY';
      scheduleType: 'M-1' | 'M-2' | 'BOOK_TO_TAX';
      description: string;
      amount: string;
      evidenceId: string;
    }
  ): BookToTaxAdjustmentRecord {
    const normalized = ExactDecimal.fromString(input.amount).toMoneyString();
    const evList = this.evidence.get(scopeKey(scope)) || [];
    const linkedEv = evList.find(e => e.evidenceId === input.evidenceId);
    if (!linkedEv || linkedEv.status !== 'VERIFIED') {
      throw new TaxGuardStageError(
        422,
        'MISSING_SOURCE_EVIDENCE',
        'Book-to-tax adjustment requires a verified source evidence record.'
      );
    }

    const key = scopeKey(scope);
    const list = this.adjustments.get(key) || [];
    const adj: BookToTaxAdjustmentRecord = {
      adjustmentId: `b2t_${randomUUID()}`,
      scope: { ...scope },
      accountCode: input.accountCode,
      accountName: input.accountName,
      taxLineCode: input.taxLineCode,
      adjustmentType: input.adjustmentType,
      scheduleType: input.scheduleType,
      description: input.description,
      amount: normalized,
      evidenceId: input.evidenceId,
      status: 'DRAFT',
      preparedBy: actor.userId,
      approvedBy: null,
      approvedAt: null,
    };
    list.push(adj);
    this.adjustments.set(key, list);
    return adj;
  }

  approveBookToTaxAdjustment(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    adjustmentId: string
  ): BookToTaxAdjustmentRecord {
    const list = this.adjustments.get(scopeKey(scope)) || [];
    const adj = list.find(a => a.adjustmentId === adjustmentId);
    if (!adj) {
      throw new TaxGuardStageError(404, 'ADJUSTMENT_NOT_FOUND', `Adjustment ${adjustmentId} not found.`);
    }
    if (adj.preparedBy === actor.userId) {
      throw new TaxGuardStageError(403, 'SELF_APPROVAL_FORBIDDEN', 'Preparer cannot self-approve a book-to-tax adjustment.');
    }
    if (!['reviewer', 'senior_reviewer', 'approver'].includes(actor.role)) {
      throw new TaxGuardStageError(403, 'REVIEWER_REQUIRED', 'Independent reviewer required to approve book-to-tax adjustments.');
    }
    adj.status = 'APPROVED';
    adj.approvedBy = actor.userId;
    adj.approvedAt = new Date().toISOString();
    return adj;
  }

  computeBookToTaxReconciliation(
    scope: ScopedCaseContext,
    bookNetIncomeStr: string,
    targetTaxableIncomeStr?: string
  ): BookToTaxReconciliationSummary {
    const bookNet = ExactDecimal.fromString(bookNetIncomeStr);
    const allAdj = this.adjustments.get(scopeKey(scope)) || [];
    const approvedAdj = allAdj.filter(a => a.status === 'APPROVED');

    let perm = ExactDecimal.zero();
    let temp = ExactDecimal.zero();
    for (const a of approvedAdj) {
      const amt = ExactDecimal.fromString(a.amount);
      if (a.adjustmentType === 'PERMANENT') perm = perm.add(amt);
      else temp = temp.add(amt);
    }

    const reconciled = bookNet.add(perm).add(temp);
    const variance = targetTaxableIncomeStr
      ? reconciled.sub(ExactDecimal.fromString(targetTaxableIncomeStr))
      : ExactDecimal.zero();

    return {
      reconciliationId: `rec_${sha256Hex(`${scopeKey(scope)}:${bookNet.toMoneyString()}:${reconciled.toMoneyString()}`).slice(0, 14)}`,
      scope: { ...scope },
      bookNetIncome: bookNet.toMoneyString(),
      totalPermanentDifferences: perm.toMoneyString(),
      totalTemporaryDifferences: temp.toMoneyString(),
      reconciledTaxableIncome: reconciled.toMoneyString(),
      reconciliationVariance: variance.toMoneyString(),
      isReconciled: variance.isZero(),
      adjustments: allAdj,
      generatedAt: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------------------------
  // DETERMINISTIC EXACT-DECIMAL TAX COMPUTATION ENGINE
  // --------------------------------------------------------------------------

  runDeterministicCalculation(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      formCode: string;
      jurisdictionCode: string;
      rulePackId: string;
      filingStatus: FilingStatus;
    }
  ): TaxCalculationRunRecord {
    const rulePack = this.rulePacks.get(input.rulePackId);
    if (!rulePack) {
      throw new TaxGuardStageError(
        422,
        'UNSUPPORTED_TAX_RULE',
        `Tax rule pack "${input.rulePackId}" does not exist or is unsupported.`
      );
    }
    if (rulePack.status !== 'APPROVED') {
      throw new TaxGuardStageError(
        422,
        'UNAPPROVED_TAX_RULE_PACK',
        `Calculation blocked: rule pack "${rulePack.rulePackId}" status is ${rulePack.status}; only APPROVED rule packs may compute authoritative return figures.`
      );
    }
    if (
      rulePack.formCode !== input.formCode ||
      rulePack.jurisdictionCode !== input.jurisdictionCode.toUpperCase() ||
      rulePack.taxYear !== scope.taxYear
    ) {
      throw new TaxGuardStageError(
        422,
        'INVALID_CALCULATION_RULE_VERSION',
        `Rule pack ${rulePack.rulePackId} does not match form ${input.formCode}, jurisdiction ${input.jurisdictionCode}, and tax year ${scope.taxYear}.`
      );
    }

    const brackets = rulePack.brackets[input.filingStatus];
    const stdDedStr = rulePack.standardDeductions[input.filingStatus];
    if (!brackets || !brackets.length || !stdDedStr) {
      throw new TaxGuardStageError(
        422,
        'UNSUPPORTED_TAX_RULE',
        `Rule pack ${rulePack.rulePackId} does not define approved brackets/deductions for filing status ${input.filingStatus}.`
      );
    }

    const evidenceList = this.evidence.get(scopeKey(scope)) || [];
    if (evidenceList.length === 0) {
      throw new TaxGuardStageError(
        422,
        'MISSING_SOURCE_EVIDENCE',
        'Deterministic tax calculation requires verified source evidence records.'
      );
    }

    // Block if any source evidence is MISSING or DISPUTED
    const disputed = evidenceList.find(e => e.status === 'DISPUTED');
    if (disputed) {
      throw new TaxGuardStageError(
        422,
        'DISPUTED_SOURCE_EVIDENCE',
        `Calculation blocked: source evidence "${disputed.description}" (${disputed.evidenceId}) is DISPUTED.`
      );
    }
    const missing = evidenceList.find(e => e.status === 'MISSING');
    if (missing) {
      throw new TaxGuardStageError(
        422,
        'MISSING_SOURCE_EVIDENCE',
        `Calculation blocked: required source evidence "${missing.description}" (${missing.evidenceId}) is MISSING.`
      );
    }

    const verifiedEvidence = evidenceList.filter(e => e.status === 'VERIFIED');
    const sumCat = (cat: SourceEvidenceRecord['category']): ExactDecimal =>
      verifiedEvidence
        .filter(e => e.category === cat)
        .reduce((acc, e) => acc.add(ExactDecimal.fromString(e.amount)), ExactDecimal.zero());

    const w2Wages = sumCat('W2_WAGES');
    const interestIncome = sumCat('INTEREST_INCOME');
    const dividendIncome = sumCat('DIVIDEND_INCOME');
    const schedCGross = sumCat('SCHEDULE_C_GROSS');
    const schedCExpenses = sumCat('SCHEDULE_C_EXPENSES');
    const schedCNet = schedCGross.sub(schedCExpenses);
    const capitalGainLoss = sumCat('CAPITAL_GAIN_LOSS');
    const schedENet = sumCat('SCHEDULE_E_NET');
    const adjustmentsToIncome = sumCat('ADJUSTMENTS_TO_INCOME');
    const itemizedDeductions = sumCat('ITEMIZED_DEDUCTIONS');
    const taxCredits = sumCat('TAX_CREDITS');
    const federalWithholding = sumCat('FEDERAL_WITHHOLDING');
    const estimatedPayments = sumCat('ESTIMATED_PAYMENTS');

    // Include approved book-to-tax adjustments into Schedule C / business net
    const approvedB2t = (this.adjustments.get(scopeKey(scope)) || [])
      .filter(a => a.status === 'APPROVED')
      .reduce((acc, a) => acc.add(ExactDecimal.fromString(a.amount)), ExactDecimal.zero());

    const businessIncomeTotal = schedCNet.add(approvedB2t);

    // Self-Employment Tax (only when net business earnings >= $400)
    let selfEmploymentTax = ExactDecimal.zero();
    let halfSeTaxDeduction = ExactDecimal.zero();
    if (businessIncomeTotal.gte(ExactDecimal.fromString('400.00'))) {
      const seNetFactor = ExactDecimal.fromString(rulePack.selfEmploymentNetEarningsFactor);
      const seRate = ExactDecimal.fromString(rulePack.selfEmploymentRate);
      const seTaxableBase = businessIncomeTotal.mul(seNetFactor);
      selfEmploymentTax = seTaxableBase.mul(seRate);
      halfSeTaxDeduction = selfEmploymentTax.div(ExactDecimal.fromString('2.00'));
    }

    const grossIncome = w2Wages
      .add(interestIncome)
      .add(dividendIncome)
      .add(businessIncomeTotal)
      .add(capitalGainLoss)
      .add(schedENet);

    const adjustedGrossIncome = ExactDecimal.max(
      ExactDecimal.zero(),
      grossIncome.sub(adjustmentsToIncome).sub(halfSeTaxDeduction)
    );

    const standardDeduction = ExactDecimal.fromString(stdDedStr);
    const useItemized = itemizedDeductions.gt(standardDeduction);
    const deductionUsed = useItemized ? itemizedDeductions : standardDeduction;
    const deductionMethod: 'STANDARD' | 'ITEMIZED' = useItemized ? 'ITEMIZED' : 'STANDARD';

    const preQbiTaxable = ExactDecimal.max(ExactDecimal.zero(), adjustedGrossIncome.sub(deductionUsed));

    // Simplified Section 199A QBI Deduction (only on positive qualified business net)
    let qbiDeduction = ExactDecimal.zero();
    if (businessIncomeTotal.gt(ExactDecimal.zero()) && preQbiTaxable.gt(ExactDecimal.zero())) {
      const qbiRate = ExactDecimal.fromString(rulePack.qbiDeductionRate);
      const twentyPctBusiness = businessIncomeTotal.sub(halfSeTaxDeduction).mul(qbiRate);
      const twentyPctTaxable = preQbiTaxable.mul(qbiRate);
      qbiDeduction = ExactDecimal.max(
        ExactDecimal.zero(),
        ExactDecimal.min(twentyPctBusiness, twentyPctTaxable)
      );
    }

    const taxableIncome = ExactDecimal.max(ExactDecimal.zero(), preQbiTaxable.sub(qbiDeduction));

    // Progressive exact-decimal bracket tax computation
    let regularIncomeTax = ExactDecimal.zero();
    let lowerBound = ExactDecimal.zero();
    for (const bracket of brackets) {
      if (!taxableIncome.gt(lowerBound)) break;
      const upperBound = bracket.upTo ? ExactDecimal.fromString(bracket.upTo) : null;
      const sliceTop = upperBound ? ExactDecimal.min(taxableIncome, upperBound) : taxableIncome;
      if (sliceTop.gt(lowerBound)) {
        const taxableSlice = sliceTop.sub(lowerBound);
        const rate = ExactDecimal.fromString(bracket.rate);
        regularIncomeTax = regularIncomeTax.add(taxableSlice.mul(rate));
      }
      if (upperBound) {
        lowerBound = upperBound;
      } else {
        break;
      }
    }

    const totalTaxBeforeCredits = regularIncomeTax.add(selfEmploymentTax);
    const totalTaxLiability = ExactDecimal.max(ExactDecimal.zero(), totalTaxBeforeCredits.sub(taxCredits));
    const totalPayments = federalWithholding.add(estimatedPayments);
    const netDiff = totalPayments.sub(totalTaxLiability);
    const isRefund = !netDiff.isNegative();
    const refundOrBalanceDue = isRefund
      ? netDiff.toMoneyString()
      : ExactDecimal.zero().sub(netDiff).toMoneyString();

    const inputs: Record<string, string> = {
      w2Wages: w2Wages.toMoneyString(),
      interestIncome: interestIncome.toMoneyString(),
      dividendIncome: dividendIncome.toMoneyString(),
      scheduleCGross: schedCGross.toMoneyString(),
      scheduleCExpenses: schedCExpenses.toMoneyString(),
      approvedBookToTaxAdjustments: approvedB2t.toMoneyString(),
      capitalGainLoss: capitalGainLoss.toMoneyString(),
      scheduleENet: schedENet.toMoneyString(),
      adjustmentsToIncome: adjustmentsToIncome.toMoneyString(),
      itemizedDeductions: itemizedDeductions.toMoneyString(),
      taxCredits: taxCredits.toMoneyString(),
      federalWithholding: federalWithholding.toMoneyString(),
      estimatedPayments: estimatedPayments.toMoneyString(),
    };

    const intermediates: Record<string, string> = {
      businessIncomeTotal: businessIncomeTotal.toMoneyString(),
      halfSeTaxDeduction: halfSeTaxDeduction.toMoneyString(),
      standardDeduction: standardDeduction.toMoneyString(),
      preQbiTaxableIncome: preQbiTaxable.toMoneyString(),
    };

    const outputs = {
      grossIncome: grossIncome.toMoneyString(),
      adjustedGrossIncome: adjustedGrossIncome.toMoneyString(),
      deductionUsed: deductionUsed.toMoneyString(),
      deductionMethod,
      qbiDeduction: qbiDeduction.toMoneyString(),
      taxableIncome: taxableIncome.toMoneyString(),
      regularIncomeTax: regularIncomeTax.toMoneyString(),
      selfEmploymentTax: selfEmploymentTax.toMoneyString(),
      totalTaxBeforeCredits: totalTaxBeforeCredits.toMoneyString(),
      totalCredits: taxCredits.toMoneyString(),
      totalTaxLiability: totalTaxLiability.toMoneyString(),
      totalPayments: totalPayments.toMoneyString(),
      refundOrBalanceDue,
      isRefund,
    };

    const calculationRunId = `calc_${randomUUID()}`;
    const calculationSha256 = sha256Hex({
      scope,
      formCode: input.formCode,
      rulePackId: rulePack.rulePackId,
      rulePackSha256: rulePack.contentSha256,
      inputs,
      intermediates,
      outputs,
    });

    const run: TaxCalculationRunRecord = {
      calculationRunId,
      scope: { ...scope },
      formCode: input.formCode,
      jurisdictionCode: input.jurisdictionCode.toUpperCase(),
      rulePackId: rulePack.rulePackId,
      rulePackVersion: rulePack.version,
      filingStatus: input.filingStatus,
      inputs,
      intermediates,
      outputs,
      calculationSha256,
      computedAt: new Date().toISOString(),
      computedBy: actor.userId,
      isAuthoritative: true,
    };

    const key = scopeKey(scope);
    const list = this.calculationRuns.get(key) || [];
    list.push(run);
    this.calculationRuns.set(key, list);
    return run;
  }

  // --------------------------------------------------------------------------
  // VERSIONED RETURN ASSEMBLY + EVIDENCE-TO-FORM LINEAGE
  // --------------------------------------------------------------------------

  assembleReturnVersion(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      calculationRunId: string;
      returnKind?: 'ORIGINAL' | 'AMENDED';
      parentReturnVersionId?: string | null;
    }
  ): TaxReturnVersionRecord {
    const key = scopeKey(scope);
    const runs = this.calculationRuns.get(key) || [];
    const run = runs.find(r => r.calculationRunId === input.calculationRunId);
    if (!run) {
      throw new TaxGuardStageError(
        404,
        'INVALID_CALCULATION_VERSION',
        `Calculation run ${input.calculationRunId} not found in this case scope.`
      );
    }

    const rulePack = this.rulePacks.get(run.rulePackId);
    if (!rulePack || rulePack.status !== 'APPROVED') {
      throw new TaxGuardStageError(
        422,
        'UNAPPROVED_TAX_RULE_PACK',
        'Cannot assemble return version: calculation rule pack is not APPROVED.'
      );
    }

    const evidenceList = this.evidence.get(scopeKey(scope)) || [];
    const blockingEvidence = evidenceList.find(e => e.status === 'MISSING' || e.status === 'DISPUTED');
    if (blockingEvidence) {
      throw new TaxGuardStageError(
        422,
        blockingEvidence.status === 'DISPUTED' ? 'DISPUTED_SOURCE_EVIDENCE' : 'MISSING_SOURCE_EVIDENCE',
        `Return assembly blocked due to ${blockingEvidence.status} evidence: ${blockingEvidence.description}`
      );
    }

    const verifiedEv = evidenceList.filter(e => e.status === 'VERIFIED');
    if (verifiedEv.length === 0) {
      throw new TaxGuardStageError(
        422,
        'MISSING_SOURCE_EVIDENCE',
        'Return assembly blocked: no verified source evidence linked.'
      );
    }

    const approvedAdjustments = (this.adjustments.get(key) || []).filter(a => a.status === 'APPROVED');

    // Build complete Source -> Fact -> Adjustment -> Calculation -> Form Field lineage
    const lineage: EvidenceLineageLink[] = verifiedEv.map((ev, idx) => {
      const matchingAdj = approvedAdjustments.find(a => a.evidenceId === ev.evidenceId);
      const lineKey = this.mapEvidenceCategoryToFormLine(run.formCode, ev.category);
      const lineageId = `lin_${idx + 1}_${sha256Hex(`${ev.evidenceId}:${run.calculationRunId}:${lineKey}`).slice(0, 10)}`;
      return {
        lineageId,
        sourceDocumentId: ev.sourceDocumentId,
        verifiedFactId: ev.verifiedFactId,
        approvedAdjustmentId: matchingAdj?.adjustmentId || null,
        calculationRunId: run.calculationRunId,
        formCode: run.formCode,
        formLineKey: lineKey,
        amountImpact: ev.amount,
        evidenceStatus: ev.status,
        lineageSha256: sha256Hex({
          sourceDocumentId: ev.sourceDocumentId,
          verifiedFactId: ev.verifiedFactId,
          approvedAdjustmentId: matchingAdj?.adjustmentId || null,
          calculationRunId: run.calculationRunId,
          formCode: run.formCode,
          formLineKey: lineKey,
          amountImpact: ev.amount,
        }),
      };
    });

    const primaryLineageId = lineage[0].lineageId;
    const formFields = [
      { formCode: run.formCode, lineKey: 'L9_TOTAL_INCOME', label: 'Total Income', value: run.outputs.grossIncome, lineageId: primaryLineageId },
      { formCode: run.formCode, lineKey: 'L11_AGI', label: 'Adjusted Gross Income (AGI)', value: run.outputs.adjustedGrossIncome, lineageId: primaryLineageId },
      { formCode: run.formCode, lineKey: 'L12_DEDUCTION', label: `Deduction (${run.outputs.deductionMethod})`, value: run.outputs.deductionUsed, lineageId: primaryLineageId },
      { formCode: run.formCode, lineKey: 'L13_QBI', label: 'Qualified Business Income Deduction', value: run.outputs.qbiDeduction, lineageId: primaryLineageId },
      { formCode: run.formCode, lineKey: 'L15_TAXABLE_INCOME', label: 'Taxable Income', value: run.outputs.taxableIncome, lineageId: primaryLineageId },
      { formCode: run.formCode, lineKey: 'L16_REGULAR_TAX', label: 'Regular Income Tax', value: run.outputs.regularIncomeTax, lineageId: primaryLineageId },
      { formCode: run.formCode, lineKey: 'L23_OTHER_TAX_SE', label: 'Self-Employment Tax (Schedule SE)', value: run.outputs.selfEmploymentTax, lineageId: primaryLineageId },
      { formCode: run.formCode, lineKey: 'L24_TOTAL_TAX', label: 'Total Tax Liability', value: run.outputs.totalTaxLiability, lineageId: primaryLineageId },
      { formCode: run.formCode, lineKey: 'L33_TOTAL_PAYMENTS', label: 'Total Payments & Withholding', value: run.outputs.totalPayments, lineageId: primaryLineageId },
      {
        formCode: run.formCode,
        lineKey: run.outputs.isRefund ? 'L34_OVERPAID_REFUND' : 'L37_AMOUNT_YOU_OWE',
        label: run.outputs.isRefund ? 'Overpayment / Refund' : 'Balance Due',
        value: run.outputs.refundOrBalanceDue,
        lineageId: primaryLineageId,
      },
    ];

    const existing = this.returnVersions.get(key) || [];
    const returnKind = input.returnKind || 'ORIGINAL';
    const versionNumber = existing.length + 1;
    const returnVersionId = `ret_${scope.caseId}_v${versionNumber}_${randomUUID().slice(0, 8)}`;
    const contentSha256 = sha256Hex({
      scope,
      formCode: run.formCode,
      returnKind,
      calculationSha256: run.calculationSha256,
      formFields,
      lineage: lineage.map(l => l.lineageSha256),
    });

    const record: TaxReturnVersionRecord = {
      returnVersionId,
      scope: { ...scope },
      versionNumber,
      optimisticVersion: 1,
      formCode: returnKind === 'AMENDED' && run.formCode === '1040' ? '1040-X' : run.formCode,
      jurisdictionCode: run.jurisdictionCode,
      returnKind,
      parentReturnVersionId: input.parentReturnVersionId || null,
      status: returnKind === 'AMENDED' ? 'AMENDED_DRAFT' : 'DRAFT',
      calculationRunId: run.calculationRunId,
      rulePackId: run.rulePackId,
      formFields,
      lineage,
      contentSha256,
      preparedBy: actor.userId,
      preparedAt: new Date().toISOString(),
      submittedAt: null,
      materiallyModifiedAt: null,
      isImmutableHistorical: false,
    };

    existing.push(record);
    this.returnVersions.set(key, existing);
    return record;
  }

  /**
   * Materially modifies a non-immutable draft/return version (e.g. updated form field after
   * correction), increments optimisticVersion, recalculates contentSha256, and triggers
   * Stage 10/11 invalidation callbacks so stale approvals or signatures can NEVER be reused.
   */
  materiallyModifyReturnField(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      returnVersionId: string;
      lineKey: string;
      newValue: string;
      expectedOptimisticVersion: number;
    }
  ): TaxReturnVersionRecord {
    const record = this.getReturnVersionOrThrow(scope, input.returnVersionId);
    if (record.isImmutableHistorical) {
      throw new TaxGuardStageError(
        409,
        'ORIGINAL_RETURN_IMMUTABLE',
        'Historical filed return version is immutable. Create a linked amended return version in Stage 14 instead.'
      );
    }
    if (record.optimisticVersion !== input.expectedOptimisticVersion) {
      throw new TaxGuardStageError(
        409,
        'CONCURRENCY_CONFLICT',
        `Return version concurrency conflict: expected v${input.expectedOptimisticVersion}, actual v${record.optimisticVersion}.`
      );
    }

    const field = record.formFields.find(f => f.lineKey === input.lineKey);
    if (!field) {
      throw new TaxGuardStageError(404, 'FORM_FIELD_NOT_FOUND', `Form field ${input.lineKey} not found.`);
    }

    field.value = ExactDecimal.fromString(input.newValue).toMoneyString();
    record.optimisticVersion += 1;
    record.materiallyModifiedAt = new Date().toISOString();
    record.status = 'DRAFT';
    record.contentSha256 = sha256Hex({
      scope: record.scope,
      formCode: record.formCode,
      returnKind: record.returnKind,
      formFields: record.formFields,
      lineage: record.lineage.map(l => l.lineageSha256),
      materiallyModifiedAt: record.materiallyModifiedAt,
    });

    if (this.onReturnMateriallyModified) {
      this.onReturnMateriallyModified({
        scope,
        returnVersionId: record.returnVersionId,
        newContentSha256: record.contentSha256,
        actorId: actor.userId,
      });
    }

    return record;
  }

  submitReturnForStage10Review(
    scope: ScopedCaseContext,
    _actor: ActorSessionContext,
    returnVersionId: string,
    expectedOptimisticVersion?: number
  ): TaxReturnVersionRecord {
    const record = this.getReturnVersionOrThrow(scope, returnVersionId);
    if (expectedOptimisticVersion !== undefined && record.optimisticVersion !== expectedOptimisticVersion) {
      throw new TaxGuardStageError(409, 'CONCURRENCY_CONFLICT', 'Return version was modified concurrently.');
    }
    if (!['DRAFT', 'RETURNED_FOR_CORRECTION', 'AMENDED_DRAFT'].includes(record.status)) {
      throw new TaxGuardStageError(
        409,
        'INVALID_RETURN_TRANSITION',
        `Cannot submit return version in status ${record.status} for review.`
      );
    }
    if (record.lineage.some(l => l.evidenceStatus !== 'VERIFIED')) {
      throw new TaxGuardStageError(
        422,
        'MISSING_SOURCE_EVIDENCE',
        'Cannot submit return version for review while unverified or disputed source evidence exists.'
      );
    }
    record.status = 'SUBMITTED_FOR_REVIEW';
    record.submittedAt = new Date().toISOString();
    record.optimisticVersion += 1;
    return record;
  }

  markReturnStatus(
    scope: ScopedCaseContext,
    returnVersionId: string,
    status: TaxReturnVersionRecord['status'],
    lockImmutable?: boolean
  ): TaxReturnVersionRecord {
    const record = this.getReturnVersionOrThrow(scope, returnVersionId);
    record.status = status;
    record.optimisticVersion += 1;
    if (lockImmutable) {
      record.isImmutableHistorical = true;
    }
    return record;
  }

  getReturnVersionOrThrow(scope: ScopedCaseContext, returnVersionId: string): TaxReturnVersionRecord {
    const list = this.returnVersions.get(scopeKey(scope)) || [];
    const found = list.find(r => r.returnVersionId === returnVersionId);
    if (!found) {
      throw new TaxGuardStageError(404, 'RETURN_VERSION_NOT_FOUND', `Return version ${returnVersionId} not found in case scope.`);
    }
    return found;
  }

  listReturnVersions(scope: ScopedCaseContext): TaxReturnVersionRecord[] {
    return [...(this.returnVersions.get(scopeKey(scope)) || [])];
  }

  listCalculationRuns(scope: ScopedCaseContext): TaxCalculationRunRecord[] {
    return [...(this.calculationRuns.get(scopeKey(scope)) || [])];
  }

  getCommandCenterSummary(scope: ScopedCaseContext) {
    const profile = this.getTaxpayerProfile(scope);
    const evidence = this.listSourceEvidence(scope);
    const calculations = this.listCalculationRuns(scope);
    const returns = this.listReturnVersions(scope);
    const adjustments = this.adjustments.get(scopeKey(scope)) || [];
    const forms = this.getFormsRegistry(scope.taxYear);
    const blockingEvidenceCount = evidence.filter(e => e.status === 'MISSING' || e.status === 'DISPUTED').length;

    return {
      scope,
      profile,
      evidenceSummary: {
        total: evidence.length,
        verified: evidence.filter(e => e.status === 'VERIFIED').length,
        blocking: blockingEvidenceCount,
      },
      bookToTaxSummary: {
        totalAdjustments: adjustments.length,
        approvedAdjustments: adjustments.filter(a => a.status === 'APPROVED').length,
      },
      calculationRunsCount: calculations.length,
      latestCalculation: calculations[calculations.length - 1] || null,
      returnVersionsCount: returns.length,
      latestReturnVersion: returns[returns.length - 1] || null,
      supportedFormsCount: forms.filter(f => f.supportStatus === 'SUPPORTED_RULE_APPROVED').length,
      totalCatalogedFormsCount: forms.length,
      readyForStage10Submission: Boolean(
        profile &&
        blockingEvidenceCount === 0 &&
        returns.some(r => r.status === 'SUBMITTED_FOR_REVIEW' || r.status === 'APPROVED')
      ),
    };
  }

  private mapEvidenceCategoryToFormLine(formCode: string, category: SourceEvidenceRecord['category']): string {
    const map: Record<SourceEvidenceRecord['category'], string> = {
      W2_WAGES: `${formCode}:L1a_WAGES`,
      INTEREST_INCOME: `${formCode}:L2b_TAXABLE_INTEREST`,
      DIVIDEND_INCOME: `${formCode}:L3b_ORDINARY_DIVIDENDS`,
      SCHEDULE_C_GROSS: 'SCH_C:L1_GROSS_RECEIPTS',
      SCHEDULE_C_EXPENSES: 'SCH_C:L28_TOTAL_EXPENSES',
      CAPITAL_GAIN_LOSS: `${formCode}:L7_CAPITAL_GAIN_LOSS`,
      SCHEDULE_E_NET: 'SCH_1:L5_RENTAL_PARTNERSHIP_SCORP',
      ADJUSTMENTS_TO_INCOME: `${formCode}:L10_ADJUSTMENTS`,
      ITEMIZED_DEDUCTIONS: 'SCH_A:L17_TOTAL_ITEMIZED',
      TAX_CREDITS: `${formCode}:L21_TOTAL_CREDITS`,
      FEDERAL_WITHHOLDING: `${formCode}:L25a_W2_WITHHOLDING`,
      ESTIMATED_PAYMENTS: `${formCode}:L26_ESTIMATED_PAYMENTS`,
      BOOK_TRIAL_BALANCE: 'SCH_M1:L1_BOOK_NET_INCOME',
    };
    return map[category];
  }
}
