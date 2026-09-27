/**
 * A/R Tax Services, LLC - Stage Two Collection & Document Intake Engine
 * Unified 18-Stage Tax Operating Workflow â€” Milestone M2 / Stage 02: Collect
 *
 * Implements:
 * - TG-COL-001: Centralized Tax-Year Collection Workspace Context (Client ID + Engagement + Tax Year + Entity/Return Type)
 * - TG-COL-002: Dynamic Rules-Driven Required Document Checklist with Stable Requirement IDs & 10 Standard Statuses
 * - TG-COL-003: Secure Upload Center Integration with Unique Document IDs, Metadata Ingestion, SHA-256 Hashing, & Audit Logging
 *
 * STRICT SECURITY & COMPLIANCE:
 * - Documents are NEVER treated as verified simply because upload succeeded (isVerified: false initially).
 * - Client TINs remain permanently masked.
 * - Every upload emits an immutable audit event via TaxGuardAuditService.
 */

import { demoDataStore } from '../demo/services/DemoDataService';
import { TaxGuardAuditService } from '../taxguard/services/TaxGuardAuditService';
import { StageOneOnboardingService, StageOneDossier } from './stageOneOnboardingService';
import { DemoDocument } from '../demo/types';
import {
  StageTwoIntakeSecurityService,
  StagedSecurityDocument,
  PipelineStage,
  QuarantineStatus
} from './stageTwoIntakeSecurityService';
import {
  StageTwoDocumentIntelligenceService,
  DocumentIntelligenceRecord,
  HumanReviewQueueItem,
  HumanReviewAction,
  TaxDocumentCategory
} from './stageTwoDocumentIntelligenceService';
import { StageTwoCollectionOperationsService } from './stageTwoCollectionOperationsService';

export type CollectionDocumentStatus =
  | 'Required'
  | 'Requested'
  | 'Received'
  | 'Processing'
  | 'Under Review'
  | 'Accepted'
  | 'Rejected'
  | 'Missing'
  | 'Superseded'
  | 'Not Applicable';

export type EntityReturnType =
  | 'individual'    // Form 1040
  | 's_corp'        // Form 1120-S
  | 'c_corp'        // Form 1120
  | 'partnership'   // Form 1065
  | 'llc';          // Disregarded / SMLLC (Schedule C) or Multi-Member

export interface ChecklistRequirement {
  requirementId: string;       // Stable ID, e.g. REQ-2025-IND-W2, REQ-2025-SCORP-TB-GL
  clientId: string;
  taxYear: number;
  entityType: EntityReturnType;
  title: string;
  formNumber: string;
  category: string;
  jurisdiction: string;        // 'Federal' | 'SC' | 'NC' | 'CA' | 'NY' | 'Multi-State'
  description: string;
  statutoryBasis?: string;
  priority: 'Required' | 'Required if applicable' | 'Recommended' | 'Optional';
  status: CollectionDocumentStatus;
  associatedDocumentId?: string;
  notes?: string;
  lastUpdated: string;
}

export interface StageTwoUploadedDocument {
  documentId: string;          // Standard format: DOC-YYYY-XXXXX
  clientId: string;
  engagementId: string;
  taxYear: number;
  uploaderSource: 'client_portal' | 'staff_upload' | 'scanner_intake' | 'api';
  uploadedBy: string;
  originalFileName: string;
  fileSizeBytes: number;
  mimeType: string;
  claimedCategory: string;
  associatedRequirementId?: string;
  sha256Hash: string;
  uploadTimestamp: string;
  processingStatus: 'Received' | 'Processing' | 'Under Review' | 'Accepted' | 'Rejected';
  isVerified: boolean;         // MANDATORY RULE: Must be false initially! Uploading != verified
  securityCheckStatus: 'Passed (SHA-256 Validated)' | 'Quarantined';
  notes?: string;

  // Sprint 2 Security & Pipeline Extensions
  pipelineStage?: PipelineStage;
  quarantineStatus?: QuarantineStatus;
  taxDataVerified?: boolean;
  humanReviewed?: boolean;
  isReadyForOcr?: boolean;
  stagedSecurityDoc?: StagedSecurityDocument;

  // Sprint 3 Document Intelligence Extensions
  intelligenceRecord?: DocumentIntelligenceRecord;
}

export interface CollectionReadinessReport {
  totalRequirements: number;
  requiredCount: number;
  receivedCount: number;
  acceptedCount: number;
  missingCount: number;
  underReviewCount: number;
  readinessScore: number;      // 0 to 100 percentage
  isReadyForStageThree: boolean;
  blockingItems: string[];
  stageTwoGateStatus: 'LOCKED' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'STAGE_TWO_PASSED';
}

export interface TaxYearCollectionWorkspaceContext {
  clientId: string;
  engagementId: string;
  taxYear: number;
  entityType: EntityReturnType;
  entityName: string;
  returnType: string;
  jurisdictions: string[];
  status: string;
  assignedPreparer: string;
  assignedReviewer: string;
}

const STORAGE_KEY_REQUIREMENTS = 'artax_stage_two_requirements_v1';
const STORAGE_KEY_UPLOADS = 'artax_stage_two_uploads_v1';

export class StageTwoCollectionService {
  private static inMemoryRequirements: Map<string, ChecklistRequirement[]> = new Map();
  private static inMemoryUploads: Map<string, StageTwoUploadedDocument[]> = new Map();

  /**
   * Generates a standardized unique Document ID: DOC-YYYY-XXXXX
   */
  public static generateDocumentId(taxYear: number = new Date().getFullYear()): string {
    const randomSeq = Math.floor(10000 + Math.random() * 90000);
    return `DOC-${taxYear}-${randomSeq}`;
  }

  /**
   * Resolves the centralized Stage 02 Collection Workspace context
   * Client ID + Engagement + Tax Year + Entity/Return Type
   */
  public static getWorkspaceContext(
    targetClientId?: string,
    targetTaxYear?: number
  ): TaxYearCollectionWorkspaceContext {
    // 1. Resolve the client from the caller or active Stage 01 dossier.
    //
    // IMPORTANT:
    // Demo callers explicitly provide cli_perotti.
    // LIVE callers explicitly provide their authenticated Client ID.
    //
    // Never silently substitute another taxpayer when client identity
    // is unavailable.
    const activeOnboardingId = StageOneOnboardingService.getActiveClientId();
    const resolvedClientId = targetClientId || activeOnboardingId;

    if (!resolvedClientId) {
      throw new Error(
        'TaxGuard client context is unavailable. Re-authentication or Stage 01 onboarding is required.'
      );
    }
    
    // 2. Resolve Tax Year (default 2025)
    let resolvedYear = targetTaxYear || 2025;
    if (!targetTaxYear && typeof window !== 'undefined') {
      const savedYear = localStorage.getItem('artax_selected_tax_year');
      if (savedYear) resolvedYear = parseInt(savedYear, 10);
    }

    // 3. Resolve Entity & Engagement details
    const onboardingDossier = StageOneOnboardingService.getDossier(resolvedClientId);

    // Hard LIVE/DEMO isolation.
    // Only the canonical DEMO taxpayer may query the demo data store.
    const isExplicitDemoClient = resolvedClientId === 'cli_perotti';

    const demoClient = isExplicitDemoClient
      ? demoDataStore.getClientById(resolvedClientId)
      : undefined;

    const demoEng = isExplicitDemoClient
      ? demoDataStore.getEngagements().find(
          e => e.clientId === resolvedClientId && e.taxYear === resolvedYear
        )
      : undefined;

    let entityType: EntityReturnType = 'individual';
    let entityName = 'Client';
    let returnType = 'Form 1040 (U.S. Individual Income Tax Return)';
    let jurisdictions = ['Federal', 'SC'];

    if (onboardingDossier) {
      entityName = onboardingDossier.legalName;
      if (onboardingDossier.taxpayerType === 'entity') {
        const c = onboardingDossier.entityClassification;
        if (c === 'scorp') {
          entityType = 's_corp';
          returnType = 'Form 1120-S (U.S. Income Tax Return for an S Corporation)';
        } else if (c === 'ccorp') {
          entityType = 'c_corp';
          returnType = 'Form 1120 (U.S. Corporation Income Tax Return)';
        } else if (c === 'partnership') {
          entityType = 'partnership';
          returnType = 'Form 1065 (U.S. Return of Partnership Income)';
        } else {
          entityType = 'llc';
          returnType = 'Form 1040 Schedule C / Form 1065 (LLC Return)';
        }
      } else {
        entityType = 'individual';
        returnType = 'Form 1040 (U.S. Individual Income Tax Return)';
      }
      jurisdictions = ['Federal', onboardingDossier.residentialOrPrincipalAddress.state || 'SC'];
    } else if (demoClient) {
      entityName = demoClient.name;
      if (demoClient.entityType === 'S Corporation') {
        entityType = 's_corp';
        returnType = 'Form 1120-S (U.S. S-Corporation Return)';
      } else if (demoClient.entityType === 'C Corporation') {
        entityType = 'c_corp';
        returnType = 'Form 1120 (U.S. Corporation Return)';
      } else if (demoClient.entityType === 'Partnership') {
        entityType = 'partnership';
        returnType = 'Form 1065 (U.S. Partnership Return)';
      } else {
        entityType = 'individual';
        returnType = 'Form 1040 (U.S. Individual Return)';
      }
      jurisdictions = [demoClient.primaryJurisdiction || 'SC', ...(demoClient.secondaryJurisdictions || [])];
    }

    return {
      clientId: resolvedClientId,
      engagementId: demoEng ? demoEng.id : `ENG-${resolvedYear}-001`,
      taxYear: resolvedYear,
      entityType,
      entityName,
      returnType,
      jurisdictions,
      status: demoEng ? demoEng.currentStatus : 'Awaiting Documents',
      assignedPreparer: demoEng ? demoEng.assignedStaff : 'Senior Tax Accountant',
      assignedReviewer: 'Desmond Hinds, CPA / Senior Reviewer'
    };
  }

  /**
   * Generates a dynamic rules-driven document checklist based on:
   * Taxpayer/entity type, tax year, engagement scope, jurisdiction, and known facts.
   * Every requirement receives a permanent, stable requirement ID.
   */
  public static generateRulesDrivenRequirements(
    clientId: string,
    taxYear: number,
    entityType: EntityReturnType,
    primaryJurisdiction: string = 'SC',
    knownFacts: Record<string, boolean> = {}
  ): ChecklistRequirement[] {
    const list: ChecklistRequirement[] = [];
    const now = new Date().toISOString();

    const addReq = (
      code: string,
      title: string,
      formNumber: string,
      category: string,
      jurisdiction: string,
      description: string,
      priority: 'Required' | 'Required if applicable' | 'Recommended' | 'Optional',
      statutoryBasis?: string,
      initialStatus: CollectionDocumentStatus = 'Required'
    ) => {
      const stableId = `REQ-${taxYear}-${entityType.toUpperCase()}-${code}`;
      list.push({
        requirementId: stableId,
        clientId,
        taxYear,
        entityType,
        title,
        formNumber,
        category,
        jurisdiction,
        description,
        statutoryBasis,
        priority,
        status: initialStatus,
        lastUpdated: now
      });
    };

    // =========================================================================
    // 1. INDIVIDUAL (Form 1040) CHECKLIST RULES
    // =========================================================================
    if (entityType === 'individual') {
      addReq(
        'GOV-ID',
        'Government-Issued Photo Identification',
        'Govt ID',
        'Identity & Dependents',
        'Federal',
        'Valid unexpired Driverâ€™s License or Passport for taxpayer and spouse per IRS security verification requirements.',
        'Required',
        'IRS Pub 1345 / Identity Verification'
      );

      addReq(
        'W2-WAGE',
        'Form W-2 Wage & Tax Statements',
        'Form W-2',
        'Employment',
        'Federal / ' + primaryJurisdiction,
        'All Form W-2 statements issued by employers reporting wages, tips, federal, and state income tax withholdings.',
        'Required',
        'IRC Â§ 6051'
      );

      addReq(
        '1099-INT',
        'Form 1099-INT Interest Income Statements',
        'Form 1099-INT',
        'Interest',
        'Federal',
        'Interest income earned across bank accounts, credit unions, CDs, or municipal bonds.',
        'Required if applicable',
        'IRC Â§ 6049'
      );

      addReq(
        '1099-DIV',
        'Form 1099-DIV Dividends & Capital Distributions',
        'Form 1099-DIV',
        'Dividends',
        'Federal',
        'Ordinary dividends, qualified dividends, and capital gain distributions from brokerage holdings.',
        'Required if applicable',
        'IRC Â§ 6042'
      );

      addReq(
        '1099-NEC',
        'Form 1099-NEC Nonemployee Compensation',
        'Form 1099-NEC',
        'Contract / Gig Work',
        'Federal',
        'Independent contractor, consulting, or freelance compensation earned during the tax year.',
        knownFacts.hasContractWork ? 'Required' : 'Required if applicable',
        'IRC Â§ 6041A'
      );

      addReq(
        '1098-MORTGAGE',
        'Form 1098 Mortgage Interest Statement',
        'Form 1098',
        'Mortgage Interest',
        'Federal',
        'Reports home mortgage interest, points, and real estate property taxes paid to lending institutions.',
        'Required if applicable',
        'IRC Â§ 6050H'
      );

      addReq(
        '1095-A',
        'Form 1095-A Health Insurance Marketplace Statement',
        'Form 1095-A',
        'Marketplace Insurance',
        'Federal',
        'Required for reconciling federal Premium Tax Credit (Form 8962) if covered by Healthcare.gov or state exchange.',
        knownFacts.hasMarketplaceInsurance ? 'Required' : 'Required if applicable',
        'IRC Â§ 36B'
      );

      addReq(
        'SCH-K1-INCOMING',
        'Schedule K-1 Pass-Through Shareholder / Partner Earnings',
        'Schedule K-1',
        'Partnership / S Corporation / Estate / Trust',
        'Federal',
        'Share of income, deductions, and credits from partnerships, S-corporations, or trusts.',
        knownFacts.hasPassThrough ? 'Required' : 'Required if applicable',
        'IRC Â§Â§ 702, 1366'
      );

      if (primaryJurisdiction === 'SC') {
        addReq(
          'SC-ADD',
          'South Carolina State Specific Adjustments & Property Tax Credit',
          'SC-1040 Sch NR/TC',
          'State Specific',
          'SC',
          'Documentation supporting South Carolina state tax credits, tuition tax credits, and county property tax credits.',
          'Recommended',
          'SC Code Ann. Â§ 12-6-40'
        );
      }
    }

    // =========================================================================
    // 2. S-CORPORATION (Form 1120-S) CHECKLIST RULES
    // =========================================================================
    else if (entityType === 's_corp') {
      addReq(
        'PY-RETURN',
        'Prior Year Form 1120-S Corporate Income Tax Return',
        'Form 1120-S (PY)',
        'Prior Year / Archival',
        'Federal',
        'Complete signed copy of the prior tax year Form 1120-S including all Schedules K-1, balance sheets, and depreciation schedules.',
        'Required',
        'Treas. Reg. Â§ 1.6037-1'
      );

      addReq(
        'TB-GL',
        'Final Year-End Trial Balance & General Ledger',
        'Trial Balance / GL',
        'Accounting Records',
        'Federal',
        'Year-end adjusted trial balance with debit/credit balance, chart of accounts, and detailed general ledger export.',
        'Required',
        'IRC Â§ 446 / Accounting Methods'
      );

      addReq(
        'BANK-RECON',
        'Year-End Bank & Credit Card Statements & Reconciliations',
        'Bank Reconciliations',
        'Banking & Cash',
        'Federal',
        'All business checking, savings, and credit card statements through December 31 with formal bank reconciliation tie-outs.',
        'Required',
        'IRC Â§ 6001 / Recordkeeping'
      );

      addReq(
        'PAYROLL-941',
        'Annual Payroll Summary & Quarterly Form 941 / Form 940 Filings',
        'Forms 941 / 940 / W-3',
        'Payroll Records',
        'Federal',
        'Reconciled federal employment tax returns and annual W-3 summary substantiating shareholder-officer reasonable compensation.',
        'Required',
        'IRC Â§ 3121 / Rev. Rul. 74-44'
      );

      addReq(
        'SHAREHOLDER-BASIS',
        'Shareholder Stock & Debt Basis Worksheets',
        'Form 7203 Schedule',
        'Shareholder Equity',
        'Federal',
        'Cumulative stock and debt basis schedules tracking beginning basis, income additions, non-dividend distributions, and loss limits.',
        'Required',
        'IRC Â§ 1367 / Form 7203'
      );

      addReq(
        'FIXED-ASSETS',
        'Fixed Asset Additions, Dispositions & Depreciation Schedule',
        'Form 4562 Detail',
        'Depreciation & Assets',
        'Federal / ' + primaryJurisdiction,
        'Invoices and settlement statements for all capital asset acquisitions, vehicle purchases, and machinery placed in service.',
        'Required',
        'IRC Â§Â§ 168, 179'
      );

      if (primaryJurisdiction === 'SC') {
        addReq(
          'SC-DEPR-DECOUPLE',
          'South Carolina Bonus Depreciation & Section 179 Decoupling Schedule',
          'SC-1120S Schedule',
          'State Specific',
          'SC',
          'State depreciation modification schedule disallowing federal bonus depreciation and capping Section 179 at $25,000.',
          'Required',
          'SC Code Ann. Â§ 12-6-40(A)(1)(a)'
        );
      }
    }

    // =========================================================================
    // 3. C-CORPORATION (Form 1120) CHECKLIST RULES
    // =========================================================================
    else if (entityType === 'c_corp') {
      addReq(
        'PY-RETURN',
        'Prior Year Form 1120 U.S. Corporation Tax Return',
        'Form 1120 (PY)',
        'Prior Year / Archival',
        'Federal',
        'Prior year Form 1120 with Schedule M-1/M-3 book-to-tax reconciliations and carryforward loss records.',
        'Required',
        'IRC Â§ 6012'
      );

      addReq(
        'FIN-STATEMENTS',
        'Audited / Reviewed Year-End Financial Statements',
        'Balance Sheet & P&L',
        'Financial Reporting',
        'Federal',
        'Comparative balance sheet, income statement, statement of cash flows, and note disclosures.',
        'Required',
        'IRC Â§ 446'
      );

      addReq(
        'TB-GL',
        'Year-End Adjusted Trial Balance',
        'Trial Balance',
        'Accounting Records',
        'Federal',
        'Complete year-end adjusted trial balance mapped to corporate tax chart of accounts.',
        'Required',
        'IRC Â§ 6001'
      );

      addReq(
        'SCH-M-BOOKTAX',
        'Schedule M-1 / M-3 Book-to-Tax Reconciliation Schedules',
        'Schedule M-1 / M-3',
        'Book-to-Tax',
        'Federal',
        'Permanent and temporary timing differences (meals limitation, officer life insurance, deferred compensation, depreciation).',
        'Required',
        'Treas. Reg. Â§ 1.6012-2'
      );

      addReq(
        'EST-PAYMENTS',
        'Federal & State Quarterly Corporate Estimated Tax Records',
        'Form 1120-W Records',
        'Tax Payments',
        'Federal / ' + primaryJurisdiction,
        'Electronic Federal Tax Payment System (EFTPS) and state DOR confirmation receipts for quarterly tax installments.',
        'Required',
        'IRC Â§ 6655'
      );
    }

    // =========================================================================
    // 4. PARTNERSHIP / MULTI-MEMBER LLC (Form 1065) CHECKLIST RULES
    // =========================================================================
    else if (entityType === 'partnership') {
      addReq(
        'PY-RETURN',
        'Prior Year Form 1065 Partnership Tax Return',
        'Form 1065 (PY)',
        'Prior Year / Archival',
        'Federal',
        'Prior year Form 1065 with all partner Schedules K-1 and tax basis capital account schedules.',
        'Required',
        'IRC Â§ 6031'
      );

      addReq(
        'PARTNERSHIP-AGREEMENT',
        'Partnership Agreement & Amendments (Capital Sharing Ratios)',
        'Operating Agreement',
        'Entity Governance',
        'Federal',
        'Current executed Operating Agreement detailing profit/loss allocation percentages, guaranteed payments, and capital contributions.',
        'Required',
        'IRC Â§ 704(b)'
      );

      addReq(
        'CAPITAL-ACCOUNTS',
        'Partner Capital Account Reconciliation (Tax Basis Method)',
        'Schedule M-2 Workpapers',
        'Partner Equity',
        'Federal',
        'Itemized partner capital account reconciliations reporting beginning capital, contributions, net income, distributions, and ending capital.',
        'Required',
        'IRS Form 1065 Instructions / Tax Basis Capital'
      );

      addReq(
        'TB-GL',
        'Year-End Trial Balance & General Ledger',
        'Trial Balance',
        'Accounting Records',
        'Federal',
        'Full adjusted trial balance substantiating all gross receipts, cost of goods sold, and deductible operating expenses.',
        'Required',
        'IRC Â§ 6001'
      );

      addReq(
        'GUARANTEED-PAYMENTS',
        'Guaranteed Payments to Partners Register',
        'Partner Compensation',
        'Partner Compensation',
        'Federal',
        'Itemized schedules of all guaranteed payments for services or capital paid to partners under IRC Â§ 707(c).',
        'Required if applicable',
        'IRC Â§ 707(c)'
      );
    }

    // =========================================================================
    // 5. SINGLE-MEMBER LLC / SCHEDULE C RULES
    // =========================================================================
    else {
      addReq(
        'SMLLC-INCOME-EXPENSE',
        'Schedule C Business Income & Expense Ledger',
        'Schedule C Detail',
        'Business Records',
        'Federal',
        'Categorized annual summary of business gross revenues, merchant processing fees, advertising, supplies, and operating expenses.',
        'Required',
        'IRC Â§ 162'
      );

      addReq(
        'SMLLC-BANK-STMTS',
        'Dedicated Business Bank Statements',
        'Bank Statements',
        'Banking & Cash',
        'Federal',
        'January through December business bank account statements demonstrating non-commingling of business and personal assets.',
        'Required',
        'IRC Â§ 6001'
      );

      addReq(
        'SMLLC-1099K',
        'Payment Card & Third-Party Network Transactions',
        'Form 1099-K',
        'Payment Processing',
        'Federal',
        'Statements issued by Stripe, Square, PayPal, or merchant processors reporting gross settlement volumes.',
        'Required if applicable',
        'IRC Â§ 6050W'
      );
    }

    return list;
  }

  /**
   * Retrieves requirements for a specific client and tax year, initializing dynamically if not yet stored.
   */
  public static getRequirements(clientId: string, taxYear: number): ChecklistRequirement[] {
    const key = `${clientId}_${taxYear}`;
    
    // Check in-memory first
    if (this.inMemoryRequirements.has(key)) {
      return this.inMemoryRequirements.get(key)!;
    }

    // Check localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_REQUIREMENTS}_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored) as ChecklistRequirement[];
          this.inMemoryRequirements.set(key, parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('Error reading stored checklist requirements', e);
      }
    }

    // Resolve context to generate rules-driven checklist
    const context = this.getWorkspaceContext(clientId, taxYear);
    const initialRequirements = this.generateRulesDrivenRequirements(
      clientId,
      taxYear,
      context.entityType,
      context.jurisdictions[0] || 'SC'
    );

    // Save
    this.saveRequirements(clientId, taxYear, initialRequirements);
    return initialRequirements;
  }

  /**
   * Saves requirements state to in-memory cache and persistence.
   */
  public static saveRequirements(clientId: string, taxYear: number, requirements: ChecklistRequirement[]): void {
    const key = `${clientId}_${taxYear}`;
    this.inMemoryRequirements.set(key, requirements);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_REQUIREMENTS}_${key}`, JSON.stringify(requirements));
      } catch (e) {
        console.warn('Error saving checklist requirements to localStorage', e);
      }
    }
  }

  /**
   * Updates status for a single requirement with audit tracking
   */
  public static updateRequirementStatus(
    clientId: string,
    taxYear: number,
    requirementId: string,
    status: CollectionDocumentStatus,
    actor: string = 'client',
    notes?: string
  ): ChecklistRequirement | undefined {
    const reqs = this.getRequirements(clientId, taxYear);
    const target = reqs.find(r => r.requirementId === requirementId);
    if (!target) return undefined;

    const previousStatus = target.status;
    target.status = status;
    target.lastUpdated = new Date().toISOString();
    if (notes) target.notes = notes;

    this.saveRequirements(clientId, taxYear, reqs);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_demo',
      userId: clientId,
      userEmail: `${clientId}@artaxservices.com`,
      userRole: actor === 'preparer' ? 'accountant' : 'client',
      ipAddress: '127.0.0.1',
      action: 'CHECKLIST_REQUIREMENT_STATUS_UPDATED',
      recordType: 'verification',
      recordId: requirementId,
      result: 'success',
      riskLevel: 'routine',
      details: `Requirement ${requirementId} changed from ${previousStatus} to ${status} by ${actor}. Notes: ${notes || 'none'}`
    });

    return target;
  }

  /**
   * Computes real SHA-256 hash using Web Crypto API
   */
  public static async computeFileSha256(file: File): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        console.warn('Crypto digest failed, falling back', e);
      }
    }
    return `sha256_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * TG-COL-003: Ingests an uploaded document directly into the Stage 02 Collection Workspace.
   * Generates a unique Document ID: DOC-YYYY-XXXXX
   * Records metadata: Client ID, engagement, tax year, uploader, original filename, timestamp,
   * claimed category, file size, processing status: 'Received', isVerified: false, SHA-256 hash.
   * Emits an immutable audit event via TaxGuardAuditService.
   */
  public static async ingestDocumentUpload(payload: {
    clientId: string;
    engagementId: string;
    taxYear: number;
    uploaderSource?: 'client_portal' | 'staff_upload' | 'scanner_intake' | 'api';
    uploadedBy: string;
    originalFileName: string;
    fileSizeBytes: number;
    mimeType: string;
    claimedCategory: string;
    associatedRequirementId?: string;
    sha256Hash?: string;
    file?: File;
    notes?: string;
  }): Promise<StageTwoUploadedDocument> {
    const now = new Date().toISOString();

    // Prepare file bytes for security scanning & encryption pipeline
    let fileBytes: Uint8Array;
    if (payload.file) {
      try {
        const buffer = await payload.file.arrayBuffer();
        fileBytes = new Uint8Array(buffer);
      } catch {
        fileBytes = new TextEncoder().encode(`%PDF-1.4 simulated file payload ${payload.originalFileName}`);
      }
    } else {
      const ext = payload.originalFileName.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        fileBytes = new TextEncoder().encode(`%PDF-1.4 simulated file payload ${payload.originalFileName}`);
      } else if (ext === 'png') {
        fileBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
      } else if (ext === 'jpg' || ext === 'jpeg') {
        fileBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      } else if (ext === 'zip') {
        fileBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      } else {
        fileBytes = new TextEncoder().encode(`Simulated text/data content for ${payload.originalFileName}`);
      }
    }

    // Execute Sprint 2 Security Pipeline (Staging -> Signature -> Archive -> Malware -> Quarantine/Cleared -> Encryption -> Integrity -> Storage -> Ready for OCR)
    const stagedSecurityDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
      clientId: payload.clientId,
      engagementId: payload.engagementId,
      taxYear: payload.taxYear,
      uploader: payload.uploadedBy,
      uploaderSource: payload.uploaderSource,
      originalFilename: payload.originalFileName,
      fileBytes,
      claimedMimeType: payload.mimeType,
      claimedCategory: payload.claimedCategory,
      associatedRequirementId: payload.associatedRequirementId,
      notes: payload.notes
    });

    const isQuarantined = stagedSecurityDoc.quarantineStatus === 'QUARANTINED';
    const documentId = stagedSecurityDoc.documentId;
    const calculatedHash = payload.sha256Hash || stagedSecurityDoc.integrityRecord.originalHash;

    const newUpload: StageTwoUploadedDocument = {
      documentId,
      clientId: payload.clientId,
      engagementId: payload.engagementId,
      taxYear: payload.taxYear,
      uploaderSource: payload.uploaderSource || 'client_portal',
      uploadedBy: payload.uploadedBy,
      originalFileName: payload.originalFileName,
      fileSizeBytes: payload.fileSizeBytes,
      mimeType: payload.mimeType,
      claimedCategory: payload.claimedCategory,
      associatedRequirementId: payload.associatedRequirementId,
      sha256Hash: calculatedHash,
      uploadTimestamp: now,
      processingStatus: isQuarantined ? 'Rejected' : 'Received',
      // MANDATORY SPEC: Do NOT allow uploaded documents to be treated as verified simply because upload succeeded
      isVerified: false,
      securityCheckStatus: isQuarantined ? 'Quarantined' : 'Passed (SHA-256 Validated)',
      notes: isQuarantined ? stagedSecurityDoc.quarantineReason : `Ingested via Stage 02 Upload Center. Pending human review and OCR extraction.`,
      pipelineStage: stagedSecurityDoc.pipelineStage,
      quarantineStatus: stagedSecurityDoc.quarantineStatus,
      taxDataVerified: false,
      humanReviewed: false,
      isReadyForOcr: stagedSecurityDoc.isReadyForOcr,
      stagedSecurityDoc
    };

    // Store in uploads registry
    const key = `${payload.clientId}_${payload.taxYear}`;
    const currentUploads = this.getUploadedDocuments(payload.clientId, payload.taxYear);
    currentUploads.unshift(newUpload);
    this.inMemoryUploads.set(key, currentUploads);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_UPLOADS}_${key}`, JSON.stringify(currentUploads));
      } catch (e) {
        console.warn('Error persisting upload record', e);
      }
    }

    // If associated with a requirement and not quarantined, update requirement status to 'Received'
    if (payload.associatedRequirementId && !isQuarantined) {
      const reqs = this.getRequirements(payload.clientId, payload.taxYear);
      const req = reqs.find(r => r.requirementId === payload.associatedRequirementId);
      if (req) {
        req.status = 'Received';
        req.associatedDocumentId = documentId;
        req.lastUpdated = now;
        this.saveRequirements(payload.clientId, payload.taxYear, reqs);
      }
    }

    // DEMO isolation boundary:
    // LIVE taxpayer documents must never be synchronized into demoDataStore.
    const isExplicitDemoClient = payload.clientId === 'cli_perotti';

    if (!isQuarantined && isExplicitDemoClient) {
      try {
        demoDataStore.uploadDocument({
          clientId: payload.clientId,
          engagementId: payload.engagementId,
          fileName: payload.originalFileName,
          fileSize: `${(payload.fileSizeBytes / 1024).toFixed(1)} KB`,
          fileType: payload.mimeType,
          category: payload.claimedCategory,
          taxYear: payload.taxYear,
          uploadedBy: payload.uploadedBy
        });
      } catch (e) {
        console.warn('Note: demoDataStore sync skipped or simulated', e);
      }
    }

    // MANDATORY AUDIT EVENT: Emit immutable record via TaxGuardAuditService
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_demo',
      userId: payload.clientId,
      userEmail: `${payload.clientId}@artaxservices.com`,
      userRole: 'client',
      ipAddress: '127.0.0.1',
      action: 'DOCUMENT_UPLOAD_INGESTED',
      recordType: 'document',
      recordId: documentId,
      result: 'success',
      riskLevel: 'routine',
      details: `Stage 02 Document Ingested: ${payload.originalFileName} (${payload.claimedCategory}, ${payload.fileSizeBytes} bytes). SHA-256: ${calculatedHash.substring(0, 16)}... Status: ${isQuarantined ? 'Quarantined' : 'Received (Unverified)'}.`
    });

    // Sprint 3: If document has cleared all security gates and reached READY_FOR_OCR,
    // automatically initiate the Document Intelligence pipeline (OCR, Classification, Extraction)
    if (stagedSecurityDoc.isReadyForOcr) {
      try {
        const intel = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedSecurityDoc);
        newUpload.intelligenceRecord = intel;

        // TG-COL-028: Check if newly ingested doc supersedes or corrects existing doc
        if (intel.versionIntelligence?.relationship === 'CORRECTED' || intel.versionIntelligence?.relationship === 'REPLACEMENT') {
          StageTwoCollectionOperationsService.handleUpstreamDocumentChange({
            clientId: payload.clientId,
            taxYear: payload.taxYear,
            engagementId: payload.engagementId,
            documentId,
            reason: intel.versionIntelligence.relationship === 'CORRECTED' ? 'CORRECTED' : 'REPLACED',
            actor: payload.uploadedBy,
            actorRole: 'client',
            notes: `New revision uploaded for target document: ${intel.versionIntelligence.supersedesDocId || 'prior revision'}`
          });
        }
      } catch (err) {
        console.warn('OCR processing deferred or encountered gate block:', err);
      }
    } else if (isQuarantined) {
      // TG-COL-028: If quarantined, trigger upstream invalidation
      StageTwoCollectionOperationsService.handleUpstreamDocumentChange({
        clientId: payload.clientId,
        taxYear: payload.taxYear,
        engagementId: payload.engagementId,
        documentId,
        reason: 'QUARANTINED',
        actor: 'Security Scanner',
        actorRole: 'system',
        notes: `Document quarantined due to security violation.`
      });
    }

    return newUpload;
  }

  /**
   * Helper proxies for Sprint 2 Staging, Quarantine & Preserved Documents
   */
  public static getStagedSecurityDocuments(
    clientId: string,
    taxYear: number,
    role: string = 'client'
  ): StagedSecurityDocument[] {
    return StageTwoIntakeSecurityService.getStagedDocuments(clientId, taxYear, role);
  }

  public static getQuarantinedDocuments(
    clientId?: string,
    role: string = 'admin'
  ): StagedSecurityDocument[] {
    return StageTwoIntakeSecurityService.getQuarantinedDocuments(clientId, role);
  }

  public static dispositionQuarantinedDocument(params: {
    documentId: string;
    actor: string;
    actorRole: string;
    disposition: 'CLEARED' | 'REJECTED' | 'DELETED_DISPOSED';
    reason: string;
    requestingTenantId?: string;
  }): StagedSecurityDocument {
    const result = StageTwoIntakeSecurityService.dispositionQuarantinedDocument(params);
    if (params.disposition === 'REJECTED') {
      StageTwoCollectionOperationsService.handleUpstreamDocumentChange({
        clientId: result.clientId,
        taxYear: result.taxYear,
        engagementId: result.engagementId,
        documentId: params.documentId,
        reason: 'REJECTED',
        actor: params.actor,
        actorRole: params.actorRole,
        notes: params.reason
      });
    }
    return result;
  }

  /**
   * Helper proxies for Sprint 3 Document Intelligence, OCR & Human Review
   */
  public static async processOcrAndIntelligence(
    stagedDoc: StagedSecurityDocument
  ): Promise<DocumentIntelligenceRecord> {
    return StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);
  }

  public static getIntelligenceRecord(
    documentId: string,
    requestingClientId?: string,
    requestingRole: string = 'cpa'
  ): DocumentIntelligenceRecord | undefined {
    return StageTwoDocumentIntelligenceService.getIntelligenceRecord(documentId, requestingClientId, requestingRole);
  }

  public static getHumanReviewQueue(
    clientId?: string,
    taxYear?: number,
    requestingRole: string = 'cpa'
  ): HumanReviewQueueItem[] {
    return StageTwoDocumentIntelligenceService.getReviewQueue(clientId, taxYear, requestingRole);
  }

  public static executeHumanReviewAction(params: {
    documentId: string;
    actor: string;
    actorRole: string;
    action: HumanReviewAction;
    justification: string;
    fieldCorrections?: Record<string, any>;
    reclassifiedCategory?: TaxDocumentCategory;
  }): DocumentIntelligenceRecord {
    return StageTwoDocumentIntelligenceService.executeHumanReviewAction(params);
  }

  /**
   * Retrieves all Stage 02 uploaded documents for a client and tax year.
   */
  public static getUploadedDocuments(clientId: string, taxYear: number): StageTwoUploadedDocument[] {
    const key = `${clientId}_${taxYear}`;
    let uploads: StageTwoUploadedDocument[] = [];
    if (this.inMemoryUploads.has(key)) {
      uploads = this.inMemoryUploads.get(key)!;
    } else if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_UPLOADS}_${key}`);
        if (stored) {
          uploads = JSON.parse(stored) as StageTwoUploadedDocument[];
          this.inMemoryUploads.set(key, uploads);
        }
      } catch (e) {
        console.warn('Error reading stored uploads', e);
      }
    }

    uploads.forEach(u => {
      if (!u.intelligenceRecord) {
        u.intelligenceRecord = StageTwoDocumentIntelligenceService.getIntelligenceRecord(u.documentId);
      }
    });

    return uploads;
  }

  /**
   * Evaluates Collection Readiness for Stage 02
   */
  public static evaluateCollectionReadiness(clientId: string, taxYear: number): CollectionReadinessReport {
    const requirements = this.getRequirements(clientId, taxYear);
    const requiredItems = requirements.filter(r => r.priority === 'Required');
    const receivedItems = requirements.filter(r => ['Received', 'Processing', 'Under Review', 'Accepted'].includes(r.status));
    const acceptedItems = requirements.filter(r => r.status === 'Accepted');
    const underReviewItems = requirements.filter(r => ['Processing', 'Under Review'].includes(r.status));
    const missingItems = requirements.filter(r => ['Required', 'Missing', 'Requested'].includes(r.status));

    // Calculate score based on required items fulfilled
    const totalRequired = Math.max(1, requiredItems.length);
    const requiredFulfilled = requiredItems.filter(r => ['Received', 'Processing', 'Under Review', 'Accepted'].includes(r.status)).length;
    const readinessScore = Math.round((requiredFulfilled / totalRequired) * 100);

    const blockingItems: string[] = [];
    requiredItems.forEach(r => {
      if (['Required', 'Missing', 'Requested'].includes(r.status)) {
        blockingItems.push(`Missing mandatory requirement: ${r.title} (${r.formNumber})`);
      }
    });

    let stageTwoGateStatus: CollectionReadinessReport['stageTwoGateStatus'] = 'IN_PROGRESS';
    if (blockingItems.length === 0 && requiredFulfilled === totalRequired) {
      stageTwoGateStatus = 'READY_FOR_REVIEW';
    } else if (readinessScore === 0) {
      stageTwoGateStatus = 'LOCKED';
    }

    return {
      totalRequirements: requirements.length,
      requiredCount: requiredItems.length,
      receivedCount: receivedItems.length,
      acceptedCount: acceptedItems.length,
      missingCount: missingItems.length,
      underReviewCount: underReviewItems.length,
      readinessScore,
      isReadyForStageThree: blockingItems.length === 0,
      blockingItems,
      stageTwoGateStatus
    };
  }

  /**
   * Evaluates Collection Completeness with Deterministic Multi-Factor Checks (TG-COL-026)
   */
  public static evaluateCollectionCompleteness(clientId: string, taxYear: number, engagementId?: string) {
    return StageTwoCollectionOperationsService.evaluateCollectionCompleteness(clientId, taxYear, engagementId);
  }

  /**
   * Executes Stage 02 Hard Exit Gate (TG-COL-027)
   */
  public static executeStageTwoExitGate(params: Parameters<typeof StageTwoCollectionOperationsService.executeStageTwoExitGate>[0]) {
    return StageTwoCollectionOperationsService.executeStageTwoExitGate(params);
  }

  /**
   * Testing reset helper
   */
  public static resetCollectionForTesting(): void {
    StageTwoIntakeSecurityService.resetForTesting();
    StageTwoCollectionOperationsService.resetForTesting();
    this.inMemoryRequirements.clear();
    this.inMemoryUploads.clear();
    if (typeof window !== 'undefined') {
      try {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith(STORAGE_KEY_REQUIREMENTS) || k.startsWith(STORAGE_KEY_UPLOADS)) {
            localStorage.removeItem(k);
          }
        });
      } catch (e) {
        // ignore in test env
      }
    }
  }
}




