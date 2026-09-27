/**
 * A/R Tax Services, LLC - Authoritative Pre-Filing Gate Registry Service
 * 
 * Provides the single source of truth for the 7 Pre-Filing Hard-Stop Gates,
 * Maker-Checker Separation of Duties, Concurrency & Idempotency Guards,
 * Simulated Agency Acknowledgements, Rejection Correction, and Records Archive.
 * 
 * DEMONSTRATION ENVIRONMENT RESTRICTIONS:
 * “DEMONSTRATION ENVIRONMENT — No live IRS or state filing, payment, electronic signature,
 * government transmission, or government acknowledgement is performed.”
 */

import {
  GateId,
  GateState,
  PreFilingGate,
  MakerCheckerRecord,
  GateOverrideRecord,
  SimulatedAcknowledgementRecord,
  SimulatedAckStatus,
  RejectionCorrectionRecord,
  DemoFilingRecordExtended,
  ArchivedReturnPackage,
  ClientFilingNotification
} from '../types/preFilingGateRegistry';
import { demoDataStore } from './DemoDataService';
import { DemoRole } from '../types';

export interface GateEvaluationResult {
  gates: PreFilingGate[];
  canApproveForFiling: boolean;
  canReleaseForFiling: boolean;
  blockingReasons: string[];
  totalGates: number;
  clearedCount: number;
  blockedCount: number;
  clientContext: {
    clientId: string;
    taxYear: number;
    entityType: string;
    preparer: string;
    reviewer: string;
    returnVersion: string;
  };
}

export interface ClientProfileContext {
  clientId: string;
  clientName: string;
  entityType: string;
  taxYear: number;
  filingStatus: string;
  jurisdictions: string[];
  identityVerified: boolean;
  preparer: string;
  reviewer: string;
  hasForeignInfo: boolean;
  returnVersion: string;
}

class PreFilingGateRegistryService {
  private static instance: PreFilingGateRegistryService;

  // State isolated by key: `${clientId}_${taxYear}`
  private gateStates: Map<string, Map<GateId, PreFilingGate>> = new Map();
  private overrides: Map<string, GateOverrideRecord[]> = new Map();
  private makerCheckerLogs: Map<string, MakerCheckerRecord[]> = new Map();
  private filingRecords: Map<string, DemoFilingRecordExtended[]> = new Map();
  private acknowledgements: Map<string, SimulatedAcknowledgementRecord[]> = new Map();
  private rejections: Map<string, RejectionCorrectionRecord[]> = new Map();
  private archives: Map<string, ArchivedReturnPackage[]> = new Map();
  private notifications: ClientFilingNotification[] = [];
  private idempotencyKeys: Set<string> = new Set();
  private activeSubmissions: Set<string> = new Set();

  // Return versions by context
  private returnVersions: Map<string, string> = new Map();

  // Client approvals & Form 8879 authorizations
  private clientApprovals: Map<string, {
    approved: boolean;
    approvedAt?: string;
    approvedBy?: string;
    returnVersion: string;
  }> = new Map();

  private form8879Authorizations: Map<string, {
    authorized: boolean;
    authorizedAt?: string;
    authorizedBy?: string;
    returnVersion: string;
    documentHash: string;
  }> = new Map();

  private filingReleaseAuthorizations: Map<string, {
    authorized: boolean;
    authorizedAt?: string;
    authorizedBy?: string;
    role: string;
    returnVersion: string;
  }> = new Map();

  // Listeners
  private listeners: (() => void)[] = [];

  private constructor() {
    this.seedInitialNotifications();
  }

  public static getInstance(): PreFilingGateRegistryService {
    if (!PreFilingGateRegistryService.instance) {
      PreFilingGateRegistryService.instance = new PreFilingGateRegistryService();
    }
    return PreFilingGateRegistryService.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(l => {
      try {
        l();
      } catch (e) {
        console.error('Error in PreFilingGateRegistryService listener:', e);
      }
    });
  }

  private getContextKey(clientId: string, taxYear: number): string {
    return `${clientId}_${taxYear}`;
  }

  public getReturnVersion(clientId: string, taxYear: number): string {
    const key = this.getContextKey(clientId, taxYear);
    return this.returnVersions.get(key) || 'v1.0';
  }

  public setReturnVersion(clientId: string, taxYear: number, version: string): void {
    const key = this.getContextKey(clientId, taxYear);
    this.returnVersions.set(key, version);
    this.notify();
  }

  // ==========================================
  // AUTHORITATIVE 7-GATE DEFINITIONS & EVALUATION
  // ==========================================

  public evaluateGates(
    profile: ClientProfileContext,
    options?: {
      pendingDocsCount?: number;
      missingDocsCount?: number;
      unverifiedIncomeCount?: number;
      unverifiedPaymentsCount?: number;
      openExceptionsCount?: number;
      foreignExceptionsCount?: number;
      openPriorYearCount?: number;
      uncheckedQcCount?: number;
      finalAccountantApprovalSigned?: boolean;
    }
  ): GateEvaluationResult {
    const key = this.getContextKey(profile.clientId, profile.taxYear);
    const returnVersion = this.getReturnVersion(profile.clientId, profile.taxYear);
    const now = new Date().toISOString();

    const pendingDocs = options?.pendingDocsCount ?? 0;
    const missingDocs = options?.missingDocsCount ?? 0;
    const unverifiedIncome = options?.unverifiedIncomeCount ?? 0;
    const unverifiedPayments = options?.unverifiedPaymentsCount ?? 0;
    const openExceptions = options?.openExceptionsCount ?? 0;
    const foreignExceptions = options?.foreignExceptionsCount ?? (profile.hasForeignInfo ? 1 : 0);
    const openPriorYear = options?.openPriorYearCount ?? 0;
    const uncheckedQc = options?.uncheckedQcCount ?? 0;
    const accountantSigned = options?.finalAccountantApprovalSigned ?? false;

    // Maker-checker validation: Preparer cannot be Reviewer
    const isMakerCheckerConflict = 
      Boolean(profile.preparer && profile.reviewer && 
      profile.preparer.trim().toLowerCase() === profile.reviewer.trim().toLowerCase());

    const clientApproval = this.clientApprovals.get(key);
    const hasValidClientApproval = Boolean(
      clientApproval?.approved && clientApproval.returnVersion === returnVersion
    );

    const form8879 = this.form8879Authorizations.get(key);
    const hasValidForm8879 = Boolean(
      form8879?.authorized && form8879.returnVersion === returnVersion
    );

    const filingRelease = this.filingReleaseAuthorizations.get(key);
    const hasValidReleaseAuth = Boolean(
      filingRelease?.authorized && filingRelease.returnVersion === returnVersion
    );

    const blockingReasons: string[] = [];

    // GATE 1 — Client, Entity, Engagement, and Tax-Year Verification
    const g1BlockingItems: string[] = [];
    if (!profile.identityVerified) g1BlockingItems.push('Client identity verification incomplete (Form 14039 / Knowledge-Based Authentication pending)');
    if (!profile.clientName) g1BlockingItems.push('Client profile record missing required name');
    if (!profile.entityType) g1BlockingItems.push('Entity classification undefined');
    if (!profile.taxYear || profile.taxYear < 2020) g1BlockingItems.push('Statutory tax year out of filing range');
    if (!profile.jurisdictions || profile.jurisdictions.length === 0) g1BlockingItems.push('Filing jurisdictions undefined');

    const g1Cleared = g1BlockingItems.length === 0;
    const g1Reason = g1Cleared ? undefined : g1BlockingItems.join('; ');
    if (g1Reason) blockingReasons.push(`Gate 1: ${g1Reason}`);

    const gate1: PreFilingGate = {
      gateId: 'gate-1-verification',
      gateNumber: 1,
      name: 'Client, Entity, Engagement, and Tax-Year Verification',
      description: 'Confirm correct client, taxpayer identity verification, entity classification, engagement scope, return type, statutory tax year, and filing jurisdictions.',
      category: 'Verification',
      isRequired: true,
      isCleared: g1Cleared,
      blockingReason: g1Reason,
      blockingItems: g1BlockingItems,
      requiredEvidence: ['Verified Government ID / Driver License', 'Taxpayer Engagement Letter (Signed)', 'Entity EIN Confirmation Notice / SSN Match'],
      responsibleRole: 'Preparer',
      clearedBy: g1Cleared ? profile.preparer : undefined,
      clearedAt: g1Cleared ? now : undefined,
      ruleVersion: 'REV-2025.1.G1',
      taxYear: profile.taxYear,
      lastEvaluatedAt: now,
      status: g1Cleared ? 'Cleared' : 'Blocked',
      id: 'gate-1-verification',
      label: 'Client, Entity, Engagement, and Tax-Year Verification',
      isBlocking: !g1Cleared,
      blockReason: g1Reason
    };

    // GATE 2 — Required Documents and Source Completeness
    const g2BlockingItems: string[] = [];
    if (pendingDocs > 0) g2BlockingItems.push(`${pendingDocs} source document(s) pending accountant review`);
    if (missingDocs > 0) g2BlockingItems.push(`${missingDocs} required checklist document(s) pending receipt or waiver`);
    if (foreignExceptions > 0) g2BlockingItems.push('Foreign financial information / FBAR Form 114 review required before document completeness clearance');

    const g2Cleared = g2BlockingItems.length === 0;
    const g2Reason = g2Cleared ? undefined : g2BlockingItems.join('; ');
    if (g2Reason) blockingReasons.push(`Gate 2: ${g2Reason}`);

    const gate2: PreFilingGate = {
      gateId: 'gate-2-documents',
      gateNumber: 2,
      name: 'Required Documents and Source Completeness',
      description: 'Confirm all required source documents ingested, missing items resolved or waived, tax-year mismatches investigated, and foreign accounts reviewed.',
      category: 'Documents',
      isRequired: true,
      isCleared: g2Cleared,
      blockingReason: g2Reason,
      blockingItems: g2BlockingItems,
      requiredEvidence: ['Consolidated Document Dossier', 'Missing Document Resolution Log', 'Foreign Account Schedule / FinCEN 114 Review'],
      responsibleRole: 'Preparer',
      clearedBy: g2Cleared ? profile.preparer : undefined,
      clearedAt: g2Cleared ? now : undefined,
      ruleVersion: 'REV-2025.1.G2',
      taxYear: profile.taxYear,
      lastEvaluatedAt: now,
      status: g2Cleared ? 'Cleared' : 'Blocked',
      id: 'gate-2-documents',
      label: 'Required Documents and Source Completeness',
      isBlocking: !g2Cleared,
      blockReason: g2Reason
    };

    // GATE 3 — Accounting Records and Workpaper Completion
    const g3BlockingItems: string[] = [];
    if (unverifiedIncome > 0) g3BlockingItems.push(`${unverifiedIncome} income workpaper line(s) pending verification`);
    if (unverifiedPayments > 0) g3BlockingItems.push(`${unverifiedPayments} tax payment or withholding record(s) pending reconciliation`);

    const g3Cleared = g3BlockingItems.length === 0;
    const g3Reason = g3Cleared ? undefined : g3BlockingItems.join('; ');
    if (g3Reason) blockingReasons.push(`Gate 3: ${g3Reason}`);

    const gate3: PreFilingGate = {
      gateId: 'gate-3-accounting',
      gateNumber: 3,
      name: 'Accounting Records and Workpaper Completion',
      description: 'Confirm complete trial balances, cross-footed workpapers, approved journal entries, closed accounting periods, and documented book-to-tax adjustments.',
      category: 'Accounting',
      isRequired: true,
      isCleared: g3Cleared,
      blockingReason: g3Reason,
      blockingItems: g3BlockingItems,
      requiredEvidence: ['Trial Balance Reconciliation Schedule', 'Lead Tax Workpapers (W-2, 1099, K-1)', 'Estimated Tax Payment Transcripts'],
      responsibleRole: 'Preparer',
      clearedBy: g3Cleared ? profile.preparer : undefined,
      clearedAt: g3Cleared ? now : undefined,
      ruleVersion: 'REV-2025.1.G3',
      taxYear: profile.taxYear,
      lastEvaluatedAt: now,
      status: g3Cleared ? 'Cleared' : 'Blocked',
      id: 'gate-3-accounting',
      label: 'Accounting Records and Workpaper Completion',
      isBlocking: !g3Cleared,
      blockReason: g3Reason
    };

    // GATE 4 — AI Exceptions and Return Diagnostics
    const g4BlockingItems: string[] = [];
    if (openExceptions > 0) g4BlockingItems.push(`${openExceptions} AI exception(s) remain un-disposed`);
    if (openPriorYear > 0) g4BlockingItems.push(`${openPriorYear} prior-year discrepancy item(s) require accountant review`);

    const g4Cleared = g4BlockingItems.length === 0;
    const g4Reason = g4Cleared ? undefined : g4BlockingItems.join('; ');
    if (g4Reason) blockingReasons.push(`Gate 4: ${g4Reason}`);

    const gate4: PreFilingGate = {
      gateId: 'gate-4-exceptions',
      gateNumber: 4,
      name: 'AI Exceptions and Return Diagnostics',
      description: 'Confirm all AI extraction flags disposed with documented reasoning, prior-year differences resolved, and return diagnostics mathematically cleared.',
      category: 'Diagnostics',
      isRequired: true,
      isCleared: g4Cleared,
      blockingReason: g4Reason,
      blockingItems: g4BlockingItems,
      requiredEvidence: ['AI Exception Disposition Log', 'Prior-Year Variance Justification Record', 'Return Mathematical Diagnostics Run'],
      responsibleRole: 'Preparer',
      clearedBy: g4Cleared ? profile.preparer : undefined,
      clearedAt: g4Cleared ? now : undefined,
      ruleVersion: 'REV-2025.1.G4',
      taxYear: profile.taxYear,
      lastEvaluatedAt: now,
      status: g4Cleared ? 'Cleared' : 'Blocked',
      id: 'gate-4-exceptions',
      label: 'AI Exceptions and Return Diagnostics',
      isBlocking: !g4Cleared,
      blockReason: g4Reason
    };

    // GATE 5 — Independent Quality-Control Review (Maker-Checker Enforced)
    const g5BlockingItems: string[] = [];
    if (isMakerCheckerConflict) {
      g5BlockingItems.push(`Maker-Checker Violation: Preparer (${profile.preparer}) cannot independently act as Reviewer. Independent review required.`);
    }
    if (uncheckedQc > 0) {
      g5BlockingItems.push(`${uncheckedQc} quality-control review stage(s) unchecked`);
    }
    if (!accountantSigned) {
      g5BlockingItems.push('Professional attestation and supervisory sign-off pending');
    }

    const g5Cleared = g5BlockingItems.length === 0;
    const g5Reason = g5Cleared ? undefined : g5BlockingItems.join('; ');
    if (g5Reason) blockingReasons.push(`Gate 5: ${g5Reason}`);

    const gate5: PreFilingGate = {
      gateId: 'gate-5-qc-review',
      gateNumber: 5,
      name: 'Independent Quality-Control Review',
      description: 'Confirm independent CPA/EA review completed, maker-checker separation enforced, all QC checklist stages verified, and supervisory sign-off executed.',
      category: 'Quality Control',
      isRequired: true,
      isCleared: g5Cleared,
      blockingReason: g5Reason,
      blockingItems: g5BlockingItems,
      requiredEvidence: ['17-Stage QC Checklist Signed', 'Independent Reviewer Attestation Log', 'Circular 230 Due Diligence Certification'],
      responsibleRole: 'Reviewer',
      clearedBy: g5Cleared ? profile.reviewer : undefined,
      clearedAt: g5Cleared ? now : undefined,
      reviewedBy: profile.reviewer,
      reviewedAt: g5Cleared ? now : undefined,
      ruleVersion: 'REV-2025.1.G5',
      taxYear: profile.taxYear,
      lastEvaluatedAt: now,
      status: g5Cleared ? 'Cleared' : (isMakerCheckerConflict ? 'Blocked' : 'Awaiting Reviewer'),
      id: 'gate-5-qc-review',
      label: 'Independent Quality-Control Review',
      isBlocking: !g5Cleared,
      blockReason: g5Reason
    };

    // GATE 6 — Client Review, Approval, and Authorization
    const g6BlockingItems: string[] = [];
    if (!hasValidClientApproval) {
      g6BlockingItems.push(`Client return approval pending for version ${returnVersion}`);
    }
    if (!hasValidForm8879) {
      g6BlockingItems.push(`Form 8879 / SC8879 e-signature authorization pending for version ${returnVersion}`);
    }

    const g6Cleared = g6BlockingItems.length === 0;
    const g6Reason = g6Cleared ? undefined : g6BlockingItems.join('; ');
    if (g6Reason) blockingReasons.push(`Gate 6: ${g6Reason}`);

    const gate6: PreFilingGate = {
      gateId: 'gate-6-client-authorization',
      gateNumber: 6,
      name: 'Client Review, Approval, and Authorization',
      description: 'Confirm client received final draft, questions answered, client approval recorded, and Form 8879 signed for current return version without post-approval changes.',
      category: 'Client Authorization',
      isRequired: true,
      isCleared: g6Cleared,
      blockingReason: g6Reason,
      blockingItems: g6BlockingItems,
      requiredEvidence: ['Client Portal Acceptance Log', 'Executed Form 8879 Signature Certificate', 'Version Alignment Attestation'],
      responsibleRole: 'Client',
      clearedBy: g6Cleared ? (form8879?.authorizedBy || profile.clientName) : undefined,
      clearedAt: g6Cleared ? form8879?.authorizedAt : undefined,
      ruleVersion: 'REV-2025.1.G6',
      taxYear: profile.taxYear,
      lastEvaluatedAt: now,
      status: g6Cleared ? 'Cleared' : 'Awaiting Client',
      id: 'gate-6-client-authorization',
      label: 'Client Review, Approval, and Authorization',
      isBlocking: !g6Cleared,
      blockReason: g6Reason
    };

    // GATE 7 — Final Filing Release Authorization
    const g7BlockingItems: string[] = [];
    const upstreamBlocked = !g1Cleared || !g2Cleared || !g3Cleared || !g4Cleared || !g5Cleared || !g6Cleared;
    if (upstreamBlocked) {
      g7BlockingItems.push('Prerequisite Gates 1–6 must be fully cleared before filing release can be authorized');
    }
    if (!hasValidReleaseAuth) {
      g7BlockingItems.push('Filing operations release sign-off by authorized staff required');
    }

    // Check duplicate submission
    const existingFilings = this.filingRecords.get(key) || [];
    const activeOrAccepted = existingFilings.find(f => f.packageVersion === returnVersion && (f.status.includes('ACCEPTED') || f.status.includes('SUBMITTED')));
    if (activeOrAccepted) {
      g7BlockingItems.push(`Duplicate submission prevention: Return version ${returnVersion} already submitted under ID ${activeOrAccepted.submissionId}`);
    }

    const g7Cleared = g7BlockingItems.length === 0;
    const g7Reason = g7Cleared ? undefined : g7BlockingItems.join('; ');
    if (g7Reason) blockingReasons.push(`Gate 7: ${g7Reason}`);

    const gate7: PreFilingGate = {
      gateId: 'gate-7-filing-release',
      gateNumber: 7,
      name: 'Final Filing Release Authorization',
      description: 'Confirm Gates 1–6 cleared, filing package locked to approved version, duplicate submission check passed, jurisdictions confirmed, and filing staff release signed.',
      category: 'Filing Release',
      isRequired: true,
      isCleared: g7Cleared,
      blockingReason: g7Reason,
      blockingItems: g7BlockingItems,
      requiredEvidence: ['Filing Release Token', 'Version Integrity Checksum', 'Duplicate E-File Pre-Check Passed'],
      responsibleRole: 'Filing Operator',
      clearedBy: g7Cleared ? filingRelease?.authorizedBy : undefined,
      clearedAt: g7Cleared ? filingRelease?.authorizedAt : undefined,
      ruleVersion: 'REV-2025.1.G7',
      taxYear: profile.taxYear,
      lastEvaluatedAt: now,
      status: g7Cleared ? 'Cleared' : (upstreamBlocked ? 'Blocked' : 'Ready for Review'),
      id: 'gate-7-filing-release',
      label: 'Final Filing Release Authorization',
      isBlocking: !g7Cleared,
      blockReason: g7Reason
    };

    const allGates = [gate1, gate2, gate3, gate4, gate5, gate6, gate7];

    // Store in registry map
    const contextMap = new Map<GateId, PreFilingGate>();
    allGates.forEach(g => contextMap.set(g.gateId as GateId, g));
    this.gateStates.set(key, contextMap);

    const clearedCount = allGates.filter(g => g.isCleared).length;
    const blockedCount = allGates.filter(g => !g.isCleared).length;

    // Can approve for filing: Gates 1–5 must be cleared
    const canApprove = g1Cleared && g2Cleared && g3Cleared && g4Cleared && g5Cleared;

    // Can run filing simulation: ALL 7 Gates must be cleared
    const canRelease = allGates.every(g => g.isCleared);

    return {
      gates: allGates,
      canApproveForFiling: canApprove,
      canReleaseForFiling: canRelease,
      blockingReasons,
      totalGates: allGates.length,
      clearedCount,
      blockedCount,
      clientContext: {
        clientId: profile.clientId,
        taxYear: profile.taxYear,
        entityType: profile.entityType,
        preparer: profile.preparer,
        reviewer: profile.reviewer,
        returnVersion
      }
    };
  }

  // ==========================================
  // MATERIAL UPSTREAM CHANGE & REOPENING RULES
  // ==========================================

  public notifyMaterialChange(
    clientId: string,
    taxYear: number,
    changeType: 'document_added' | 'workpaper_adjusted' | 'diagnostic_overridden' | 'name_correction' | 'calculation_update' | string,
    description: string,
    author: string
  ): { reopenedGates: string[]; newVersion: string } {
    const key = this.getContextKey(clientId, taxYear);
    const oldVersion = this.getReturnVersion(clientId, taxYear);
    const majorMinor = oldVersion.replace('v', '').split('.');
    const nextSubVersion = `v${majorMinor[0]}.${Number(majorMinor[1] || 0) + 1}`;
    this.setReturnVersion(clientId, taxYear, nextSubVersion);

    // Invalidate client approval and Form 8879
    this.clientApprovals.delete(key);
    this.form8879Authorizations.delete(key);
    this.filingReleaseAuthorizations.delete(key);

    const reopenedGates = [
      'gate-4-exceptions',
      'gate-5-qc-review',
      'gate-6-client-authorization',
      'gate-7-filing-release'
    ];

    // Log Maker-Checker / Audit Trail
    this.recordMakerChecker({
      id: `MC-${Date.now()}`,
      maker: author,
      checker: 'System Supervisory Rule Engine',
      role: 'Preparer',
      action: `Material Record Change: ${changeType}`,
      decision: 'Reopened',
      reason: `Material upstream modification: ${description}. Outdated approvals invalidated. Return version bumped from ${oldVersion} to ${nextSubVersion}.`,
      beforeState: `Approved (${oldVersion})`,
      afterState: `Reopened (${nextSubVersion})`,
      timestamp: new Date().toISOString(),
      returnVersion: nextSubVersion,
      gateAffected: 'Gates 4, 5, 6, 7'
    });

    demoDataStore.logAudit({
      user: author,
      role: 'accountant',
      action: 'Material Return Modification — Approvals Reopened',
      record: `Client: ${clientId} | TY${taxYear} | Version: ${nextSubVersion}`,
      result: 'Warning (Simulated)',
      reason: `Material change (${changeType}): ${description}. Gates 5, 6, 7 reopened for independent re-review and fresh client authorization.`
    });

    // Notify client portal that action is required
    this.addNotification({
      notificationId: `NOTIF-${Date.now()}`,
      clientId,
      taxYear,
      entityName: 'Client Account',
      status: 'Awaiting Your Review',
      title: 'Tax Return Updated — Re-Approval Required',
      plainLanguageMessage: `A material update occurred in your ${taxYear} tax file (${description}). Please review the revised return (Version ${nextSubVersion}) and re-authorize Form 8879.`,
      targetSection: 'filing_status',
      isDemonstration: true,
      timestamp: new Date().toISOString(),
      isRead: false
    });

    this.notify();
    return { reopenedGates, newVersion: nextSubVersion };
  }

  // ==========================================
  // MAKER-CHECKER ENFORCEMENT & LOGGING
  // ==========================================

  public recordMakerChecker(record: MakerCheckerRecord): void {
    const key = this.getContextKey(record.maker, new Date().getFullYear());
    const existing = this.makerCheckerLogs.get(key) || [];
    existing.unshift(record);
    this.makerCheckerLogs.set(key, existing);
    this.notify();
  }

  public getMakerCheckerLogs(): MakerCheckerRecord[] {
    const all: MakerCheckerRecord[] = [];
    this.makerCheckerLogs.forEach(records => all.push(...records));
    return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // ==========================================
  // EXCEPTION OVERRIDE PROCEDURE
  // ==========================================

  public applyGateOverride(params: {
    clientId: string;
    taxYear: number;
    gateId: GateId;
    authorizedRole: 'lead_cpa' | 'managing_partner' | string;
    authorizedBy: string;
    writtenReason: string;
    supportingEvidence: string;
    riskAcknowledgement: boolean;
    secondaryApprover: string;
  }): { success: boolean; message: string } {
    // Strict non-overrideable gates per Section 8
    const nonOverrideableGates: GateId[] = [
      'gate-1-verification', // Cross-client / ID verification
      'gate-5-qc-review',    // Prohibited maker-checker conflict
      'gate-6-client-authorization', // Client authorization
      'gate-7-filing-release' // Duplicate submission check
    ];

    if (nonOverrideableGates.includes(params.gateId)) {
      demoDataStore.logAudit({
        user: params.authorizedBy,
        role: 'compliance' as DemoRole,
        action: 'Gate Override Prohibited',
        record: `Gate: ${params.gateId} | Client: ${params.clientId}`,
        result: 'Warning (Simulated)',
        reason: 'Attempted override on statutory non-overrideable gate rejected per firm policy.'
      });
      return {
        success: false,
        message: `Policy Violation: ${params.gateId} cannot be manually overridden for convenience. Statutory compliance requires direct clearance.`
      };
    }

    if (!params.riskAcknowledgement) {
      return {
        success: false,
        message: 'Risk acknowledgement checkbox must be confirmed by the authorized partner.'
      };
    }

    if (!params.writtenReason || params.writtenReason.trim().length < 15) {
      return {
        success: false,
        message: 'A substantive written reason (at least 15 characters) is required for compliance audit logs.'
      };
    }

    const key = this.getContextKey(params.clientId, params.taxYear);
    const auditEventId = `AUDIT-OVR-${Date.now()}`;

    const overrideRecord: GateOverrideRecord = {
      id: `OVR-${Date.now()}`,
      gateId: params.gateId,
      authorizedRole: params.authorizedRole,
      authorizedBy: params.authorizedBy,
      writtenReason: params.writtenReason,
      supportingEvidence: params.supportingEvidence,
      riskAcknowledgement: params.riskAcknowledgement,
      secondaryApprover: params.secondaryApprover,
      effectiveDate: new Date().toISOString(),
      auditEventId,
      timestamp: new Date().toISOString()
    };

    const list = this.overrides.get(key) || [];
    list.unshift(overrideRecord);
    this.overrides.set(key, list);

    demoDataStore.logAudit({
      user: params.authorizedBy,
      role: 'accountant' as DemoRole,
      action: 'Authorized Gate Exception Override Granted',
      record: `Gate: ${params.gateId} | Client: ${params.clientId} (TY${params.taxYear})`,
      result: 'Success (Simulated)',
      reason: `Exception approved by ${params.authorizedBy} (${params.authorizedRole}) and secondary approver ${params.secondaryApprover}. Reason: ${params.writtenReason}`
    });

    this.notify();
    return {
      success: true,
      message: `Exception override logged successfully under audit reference ${auditEventId}.`
    };
  }

  // ==========================================
  // CLIENT APPROVAL & FORM 8879 MANAGEMENT
  // ==========================================

  public recordClientApproval(
    clientId: string,
    taxYear: number,
    clientName: string
  ): void {
    const key = this.getContextKey(clientId, taxYear);
    const returnVersion = this.getReturnVersion(clientId, taxYear);

    this.clientApprovals.set(key, {
      approved: true,
      approvedAt: new Date().toISOString(),
      approvedBy: clientName,
      returnVersion
    });

    demoDataStore.logAudit({
      user: clientName,
      role: 'client',
      action: 'Client Return Review & Draft Approval Recorded',
      record: `Client: ${clientName} | TY${taxYear} | Version: ${returnVersion}`,
      result: 'Success (Simulated)',
      reason: 'Client reviewed digital return draft and confirmed accuracy.'
    });

    this.notify();
  }

  public recordForm8879Authorization(
    clientId: string,
    taxYear: number,
    taxpayerName: string,
    documentHash: string = 'SHA256:7B9E20A15FC449D0E'
  ): void {
    const key = this.getContextKey(clientId, taxYear);
    const returnVersion = this.getReturnVersion(clientId, taxYear);

    this.form8879Authorizations.set(key, {
      authorized: true,
      authorizedAt: new Date().toISOString(),
      authorizedBy: taxpayerName,
      returnVersion,
      documentHash
    });

    demoDataStore.logAudit({
      user: taxpayerName,
      role: 'client',
      action: 'Form 8879 IRS e-File Signature Authorization Executed',
      record: `Taxpayer: ${taxpayerName} | TY${taxYear} | Version: ${returnVersion}`,
      result: 'Success (Simulated)',
      reason: `Electronic signature consent PIN captured under compliance with MeF guidance. Doc Hash: ${documentHash}`
    });

    this.notify();
  }

  public recordFilingReleaseAuthorization(
    clientId: string,
    taxYear: number,
    staffName: string,
    role: string = 'Filing Operations Specialist'
  ): { success: boolean; message: string } {
    const key = this.getContextKey(clientId, taxYear);
    const returnVersion = this.getReturnVersion(clientId, taxYear);

    this.filingReleaseAuthorizations.set(key, {
      authorized: true,
      authorizedAt: new Date().toISOString(),
      authorizedBy: staffName,
      role,
      returnVersion
    });

    demoDataStore.logAudit({
      user: staffName,
      role: 'filing' as DemoRole,
      action: 'Final Filing Release Authorized',
      record: `Client: ${clientId} | TY${taxYear} | Version: ${returnVersion}`,
      result: 'Success (Simulated)',
      reason: 'Filing operations staff verified package checksum and authorized simulated transmission.'
    });

    this.notify();
    return {
      success: true,
      message: `Filing release authorization recorded for ${staffName} on return package ${returnVersion}.`
    };
  }

  // ==========================================
  // IDEMPOTENT DEMO FILING TRANSMISSION
  // ==========================================

  public runDemoFilingSimulation(
    profileOrClientId: ClientProfileContext | string,
    optionsOrTaxYear: any,
    maybeIdempotencyKey?: string,
    maybeOperatorName?: string
  ): {
    success: boolean;
    submissionId?: string;
    message: string;
    record?: DemoFilingRecordExtended;
    acknowledgement?: SimulatedAcknowledgementRecord;
  } {
    let profile: ClientProfileContext;
    let options: { idempotencyKey: string; operatorName: string; evalOptions?: any };

    if (typeof profileOrClientId === 'string') {
      const clientId = profileOrClientId;
      const taxYear = typeof optionsOrTaxYear === 'number' ? optionsOrTaxYear : 2025;
      const c: any = demoDataStore.getClients().find(cl => cl.id === clientId) || {
        id: clientId,
        name: 'Client',
        entityType: 'Form 1040',
        assignedPreparer: 'Marcus Vance, EA',
        assignedReviewer: 'Elena Rostova, CPA'
      };
      profile = {
        clientId,
        clientName: c.name || 'Client',
        entityType: c.entityType || 'Form 1040 (Individual)',
        taxYear,
        jurisdictions: ['IRS Federal', 'South Carolina DOR'],
        preparer: c.assignedPreparer || 'Marcus Vance, EA',
        reviewer: c.assignedReviewer || 'Elena Rostova, CPA',
        filingStatus: 'Single',
        identityVerified: true,
        hasForeignInfo: false,
        returnVersion: this.getReturnVersion(clientId, taxYear)
      };
      options = {
        idempotencyKey: maybeIdempotencyKey || `SIM-${clientId}-${taxYear}-${Date.now()}`,
        operatorName: maybeOperatorName || 'Elena Rostova, CPA'
      };
    } else {
      profile = profileOrClientId;
      options = optionsOrTaxYear;
    }

    const key = this.getContextKey(profile.clientId, profile.taxYear);
    const returnVersion = this.getReturnVersion(profile.clientId, profile.taxYear);

    // Concurrency / Idempotency double-submission check
    if (this.idempotencyKeys.has(options.idempotencyKey)) {
      return {
        success: false,
        message: 'Duplicate submission request blocked by idempotency guard.'
      };
    }

    if (this.activeSubmissions.has(key)) {
      return {
        success: false,
        message: 'A filing transmission simulation is currently active for this client and tax year.'
      };
    }

    // Set lock
    this.activeSubmissions.add(key);
    this.idempotencyKeys.add(options.idempotencyKey);

    try {
      // Re-evaluate all 7 gates at execution time (Section 6 mandate)
      const evaluation = this.evaluateGates(profile, options.evalOptions);
      if (!evaluation.canReleaseForFiling) {
        return {
          success: false,
          message: `Filing simulation blocked: ${evaluation.blockingReasons.length} required gate(s) remain incomplete. ${evaluation.blockingReasons[0]}`
        };
      }

      const submissionId = `DEMO-MEF-${profile.taxYear}-${Math.floor(100000 + Math.random() * 900000)}`;
      const timestamp = new Date().toISOString();
      const mefHash = `SHA256:XML:${Math.random().toString(36).substring(2, 12).toUpperCase()}`;

      const filingRecord: DemoFilingRecordExtended = {
        submissionId,
        clientId: profile.clientId,
        clientName: profile.clientName,
        taxYear: profile.taxYear,
        returnType: profile.entityType.includes('S-Corp') ? 'Form 1120-S (S-Corporation)' : 'Form 1040 (Individual)',
        filingDateTime: timestamp,
        filingTimestamp: timestamp,
        filingMethod: 'Electronic Transmission (MEF XML Demo)',
        efileProvider: 'Demo E-File Gateway (Sandbox)',
        status: 'DEMO TRANSMISSION SUBMITTED',
        accountantSigner: profile.preparer,
        authorizationRecordId: `AUTH-8879-${Date.now()}`,
        mefTransmissionHash: mefHash,
        transmissionHash: mefHash,
        auditTrailId: `AUDIT-${submissionId}`,
        packageVersion: returnVersion,
        jurisdictions: profile.jurisdictions,
        preparer: profile.preparer,
        reviewer: profile.reviewer,
        clientApprovalStatus: 'Client Approved (Demo)',
        form8879Status: 'Authorized & E-Signed (Demo)',
        gateStatus: 'All 7 Gates Cleared',
        releaseStatus: 'Released (Simulated)',
        duplicateSubmissionStatus: 'Passed (Unique Transmission)',
        simulationStatus: 'Transmitted (Simulated)',
        idempotencyKey: options.idempotencyKey
      };

      // Store filing record
      const existing = this.filingRecords.get(key) || [];
      existing.unshift(filingRecord);
      this.filingRecords.set(key, existing);

      // Generate realistic simulated acknowledgement
      const ack = this.generateSimulatedAcknowledgement(submissionId, profile);
      filingRecord.latestAcknowledgement = ack;
      filingRecord.status = ack.status.includes('accepted') ? 'DEMO ACCEPTED' : 'DEMO REJECTED';

      // Store acknowledgement
      const existingAcks = this.acknowledgements.get(key) || [];
      existingAcks.unshift(ack);
      this.acknowledgements.set(key, existingAcks);

      // If accepted, trigger immutable archive handoff
      if (ack.status.includes('accepted')) {
        this.archiveFilingPackage(profile, filingRecord, ack);
      } else {
        // If rejected, trigger rejection correction workflow
        this.createRejectionRecord(submissionId, profile, ack);
      }

      // Log Audit Event
      demoDataStore.logAudit({
        user: options.operatorName,
        role: 'filing' as DemoRole,
        action: 'Run Demo Filing Simulation Executed',
        record: `Submission: ${submissionId} | Client: ${profile.clientName} | TY${profile.taxYear}`,
        result: ack.status.includes('accepted') ? 'Success (Simulated)' : 'Warning (Simulated)',
        reason: `Generated Modernized e-File XML envelope and simulated MeF agency gateway response: ${ack.status}`
      });

      // Notify Client Portal
      this.addNotification({
        notificationId: `NOTIF-${Date.now()}`,
        clientId: profile.clientId,
        taxYear: profile.taxYear,
        entityName: profile.clientName,
        status: ack.status.includes('accepted') ? 'Demo Accepted' : 'Client Action Required',
        title: ack.status.includes('accepted') ? 'Federal Return Accepted (Demo)' : 'Filing Notice Received (Demo)',
        plainLanguageMessage: ack.status.includes('accepted')
          ? `Your ${profile.taxYear} tax return has been successfully processed in our simulated filing environment.`
          : `A validation notice was returned for your ${profile.taxYear} submission. Our team is addressing the correction.`,
        targetSection: 'filing_status',
        isDemonstration: true,
        timestamp: new Date().toISOString(),
        isRead: false
      });

      this.notify();
      return {
        success: true,
        submissionId,
        record: filingRecord,
        acknowledgement: ack,
        message: `Filing simulation executed successfully. Submission ID: ${submissionId}. Status: ${ack.status}`
      };
    } finally {
      this.activeSubmissions.delete(key);
    }
  }

  // ==========================================
  // SIMULATED GOVERNMENT ACKNOWLEDGEMENTS
  // ==========================================

  public generateSimulatedAcknowledgement(
    submissionId: string,
    profile: ClientProfileContext,
    targetStatus?: SimulatedAckStatus
  ): SimulatedAcknowledgementRecord {
    const statusOptions: SimulatedAckStatus[] = [
      'Federal accepted, state pending',
      'Federal accepted, state rejected',
      'Federal rejected, state not submitted',
      'Business-rule rejection',
      'Resubmission accepted'
    ];

    const status = targetStatus || statusOptions[0];
    const ackId = `ACK-${profile.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString();

    let responseCode = '0000-SUCCESS';
    let plainExplanation = 'IRS Modernized e-File (MeF) schema validation passed. Federal return accepted for processing.';
    let technicalDetails = 'Federal Submission Archive Schema v2025.1; ReturnHeaderState: ACCEPTED; SC Gateway Status: PENDING_TRANSMISSION';
    let requiredAction = 'None required. Store acceptance acknowledgement in client tax dossier.';

    if (status === 'Federal accepted, state rejected') {
      responseCode = 'SC-R0000-901';
      plainExplanation = 'Federal return accepted by IRS. South Carolina return rejected due to missing state withholding verification schedule.';
      technicalDetails = 'SC Department of Revenue Gateway error code SC-901: Schedule W-2SC withholding mismatch.';
      requiredAction = 'Review state withholding schedule workpaper and resubmit state envelope.';
    } else if (status === 'Federal rejected, state not submitted' || status === 'Business-rule rejection') {
      responseCode = 'R0000-500-01';
      plainExplanation = 'IRS MeF rejected submission: Primary Taxpayer SSN and Name Control do not match IRS master database records.';
      technicalDetails = 'Rule R0000-500-01: /Return/ReturnHeader/Filer/PrimarySSN does not match NameControl in master e-File registry.';
      requiredAction = 'Verify Social Security card spelling or update name control in client profile and resubmit.';
    }

    return {
      demoAcknowledgementId: ackId,
      demoSubmissionId: submissionId,
      jurisdiction: 'IRS (Federal)',
      returnType: profile.entityType.includes('S-Corp') ? 'Form 1120-S' : 'Form 1040',
      taxYear: profile.taxYear,
      status,
      responseCode,
      plainLanguageExplanation: plainExplanation,
      technicalDetails,
      receivedTimestamp: now,
      requiredAction,
      relatedFilingVersion: this.getReturnVersion(profile.clientId, profile.taxYear),
      auditCorrelationId: `CORR-${submissionId}`
    };
  }

  // ==========================================
  // REJECTION & CORRECTION WORKFLOW ENGINE
  // ==========================================

  public createRejectionRecord(
    submissionId: string,
    profile: ClientProfileContext,
    ack: SimulatedAcknowledgementRecord
  ): RejectionCorrectionRecord {
    const rejectionId = `REJ-${Date.now()}`;
    const record: RejectionCorrectionRecord = {
      rejectionId,
      submissionId,
      classification: ack.responseCode.includes('500') ? 'Name Control / Identity' : 'Schedule Balance Error',
      plainLanguageExplanation: ack.plainLanguageExplanation,
      assignedStaff: profile.preparer,
      assignedRole: 'Preparer',
      clientActionRequired: ack.responseCode.includes('500'),
      clientNotificationSent: true,
      affectedGateIds: ['gate-1-verification', 'gate-5-qc-review', 'gate-7-filing-release'],
      originalSubmissionId: submissionId,
      correctedReturnVersion: this.getReturnVersion(profile.clientId, profile.taxYear),
      reviewerReapprovalRequired: true,
      clientReauthorizationRequired: ack.responseCode.includes('500'),
      resubmissionAuthorized: false,
      status: 'Assigned',
      history: [
        {
          timestamp: new Date().toISOString(),
          note: `Rejection notice received from simulated gateway: ${ack.responseCode}. Assigned to ${profile.preparer}.`,
          author: 'Simulated Gateway Listener'
        }
      ]
    };

    const key = this.getContextKey(profile.clientId, profile.taxYear);
    const existing = this.rejections.get(key) || [];
    existing.unshift(record);
    this.rejections.set(key, existing);
    this.notify();
    return record;
  }

  public resolveRejectionAndAuthorizeResubmission(
    clientId: string,
    taxYear: number,
    rejectionId: string,
    correctionNote: string,
    operatorName: string
  ): void {
    const key = this.getContextKey(clientId, taxYear);
    const list = this.rejections.get(key) || [];
    const record = list.find(r => r.rejectionId === rejectionId);
    if (!record) return;

    record.status = 'Resubmitted';
    record.resubmissionAuthorized = true;
    record.history.push({
      timestamp: new Date().toISOString(),
      note: `Correction applied: ${correctionNote}. Resubmission authorized by ${operatorName}.`,
      author: operatorName
    });

    demoDataStore.logAudit({
      user: operatorName,
      role: 'accountant',
      action: 'Rejection Correction Applied & Resubmission Authorized',
      record: `Rejection ID: ${rejectionId} | Client: ${clientId}`,
      result: 'Success (Simulated)',
      reason: correctionNote
    });

    this.notify();
  }

  // ==========================================
  // RECORDS ARCHIVE & HANDOFF
  // ==========================================

  public archiveFilingPackage(
    profile: ClientProfileContext,
    filingRecord: DemoFilingRecordExtended,
    acknowledgement: SimulatedAcknowledgementRecord
  ): ArchivedReturnPackage {
    const key = this.getContextKey(profile.clientId, profile.taxYear);
    const archiveId = `ARCHIVE-${profile.taxYear}-${profile.clientId}`;
    const integrityHash = `SHA256:ARCHIVE:${Math.random().toString(36).substring(2, 16).toUpperCase()}`;

    const archivePackage: ArchivedReturnPackage = {
      archiveId,
      clientId: profile.clientId,
      clientName: profile.clientName,
      taxYear: profile.taxYear,
      returnType: filingRecord.returnType,
      finalApprovedVersion: filingRecord.packageVersion,
      clientCopyUrl: `/api/demo/archive/${archiveId}/client-copy.pdf`,
      workpaperIndex: [
        { name: 'Lead Form 1040 Workpaper', category: 'Summary', hash: 'SHA256:WP1040' },
        { name: 'Form 1099-B Capital Gains Cross-Foot', category: 'Income', hash: 'SHA256:WP1099B' },
        { name: 'Foreign Account FBAR Verification', category: 'International', hash: 'SHA256:WPFBAR' }
      ],
      sourceManifest: [
        { docId: 'doc-w2-01', docName: '2025_W2_Sterling.pdf', pageCount: 1, verifiedDate: new Date().toLocaleDateString() },
        { docId: 'doc-1099-02', docName: '2025_1099B_Consolidated.pdf', pageCount: 8, verifiedDate: new Date().toLocaleDateString() }
      ],
      approvalHistory: this.getMakerCheckerLogs(),
      form8879Record: {
        signedBy: profile.clientName,
        signedAt: new Date().toISOString(),
        documentHash: 'SHA256:DOC8879VERIFIED',
        ipAddressMasked: '192.168.1.•••'
      },
      filingReleaseAuth: {
        authorizedBy: profile.preparer,
        role: 'Filing Operations Specialist',
        timestamp: new Date().toISOString()
      },
      submissionRecord: filingRecord,
      acknowledgementRecord: acknowledgement,
      correctionHistory: this.rejections.get(key) || [],
      gateClearanceHistory: Array.from(this.gateStates.get(key)?.values() || []),
      auditSummary: [
        'Gate 1–7 Full Clearance Verified',
        'Independent QC Attestation Current',
        'Client Form 8879 Validated Against Package Version',
        'Agency Acceptance Recorded'
      ],
      retentionStatus: 'Active Statutory 7-Year Retention',
      integrityHash,
      legalHoldStatus: false,
      accessLogs: [
        { user: profile.preparer, timestamp: new Date().toISOString(), action: 'Archive Bundle Sealed' }
      ]
    };

    const existing = this.archives.get(key) || [];
    existing.unshift(archivePackage);
    this.archives.set(key, existing);

    demoDataStore.logAudit({
      user: 'Archive Manager (Simulated)',
      role: 'accountant',
      action: 'Final Return Package Sealed & Archived',
      record: `Archive ID: ${archiveId} | Hash: ${integrityHash}`,
      result: 'Success (Simulated)',
      reason: 'Immutable client copy, workpapers, source manifest, Form 8879, and acceptance receipt sealed.'
    });

    this.notify();
    return archivePackage;
  }

  public getArchivedPackage(clientId: string, taxYear: number): ArchivedReturnPackage | undefined {
    const key = this.getContextKey(clientId, taxYear);
    const list = this.archives.get(key);
    return list && list.length > 0 ? list[0] : undefined;
  }

  public getFilingRecords(clientId: string, taxYear: number): DemoFilingRecordExtended[] {
    const key = this.getContextKey(clientId, taxYear);
    return this.filingRecords.get(key) || [];
  }

  public getExtendedFilingRecord(clientId: string, taxYear: number): DemoFilingRecordExtended {
    const list = this.getFilingRecords(clientId, taxYear);
    if (list && list.length > 0) return list[0];
    const client: any = demoDataStore.getClients().find(c => c.id === clientId) || {
      id: clientId,
      name: 'Client',
      entityType: 'Form 1040',
      assignedPreparer: 'Marcus Vance, EA',
      assignedReviewer: 'Elena Rostova, CPA'
    };
    return {
      submissionId: `DEMO-MEF-${taxYear}-PENDING`,
      clientId,
      clientName: client.name,
      taxYear,
      returnType: client.entityType?.includes('S-Corp') ? 'Form 1120-S' : 'Form 1040',
      filingDateTime: new Date().toISOString(),
      filingTimestamp: new Date().toISOString(),
      filingMethod: 'Electronic Transmission (MEF XML Demo)',
      efileProvider: 'Demo E-File Gateway (Sandbox)',
      status: 'READY FOR DEMO FILING',
      accountantSigner: client.assignedReviewer || 'Elena Rostova, CPA',
      authorizationRecordId: `AUTH-${taxYear}`,
      mefTransmissionHash: 'SHA256:DEMO:HASH:PENDING',
      auditTrailId: `AUDIT-TY${taxYear}`,
      packageVersion: this.getReturnVersion(clientId, taxYear),
      jurisdictions: ['IRS Federal', 'South Carolina DOR'],
      preparer: client.assignedPreparer || 'Marcus Vance, EA',
      reviewer: client.assignedReviewer || 'Elena Rostova, CPA',
      clientApprovalStatus: 'Client Approved (Demo)',
      form8879Status: 'Authorized & E-Signed (Demo)',
      gateStatus: 'All 7 Gates Cleared',
      releaseStatus: 'Ready for Demo Release',
      duplicateSubmissionStatus: 'Passed (Unique Transmission)',
      simulationStatus: 'Pending Execution',
      latestAcknowledgement: {
        demoAcknowledgementId: `ACK-DEMO-${taxYear}`,
        demoSubmissionId: `DEMO-MEF-${taxYear}-PENDING`,
        jurisdiction: 'IRS (Federal)',
        agency: 'IRS (Federal)',
        returnType: 'Form 1040',
        taxYear,
        status: 'Federal accepted, state pending',
        responseCode: 'ACK-000',
        code: 'ACK-000',
        plainLanguageExplanation: 'Electronic postmark recorded. Modernized e-File system accepted demonstration test envelope.',
        technicalDetails: 'Form 1040 MeF schema validation code 000.',
        receivedTimestamp: new Date().toISOString(),
        requiredAction: 'None - archived in demonstration ledger.',
        relatedFilingVersion: 'v1.0.0',
        auditCorrelationId: `AUDIT-${Date.now()}`
      }
    };
  }

  public overrideGate(clientId: string, taxYear: number, gateId: string, reason: string, authorizedBy: string = 'Managing CPA'): { success: boolean; message: string } {
    return this.applyGateOverride({
      clientId,
      taxYear,
      gateId: gateId as any,
      authorizedRole: 'Lead CPA',
      authorizedBy,
      writtenReason: reason,
      supportingEvidence: 'Firm documented exception & partner approval',
      riskAcknowledgement: true,
      secondaryApprover: 'Quality Review Partner'
    });
  }

  public getAcknowledgements(clientId: string, taxYear: number): SimulatedAcknowledgementRecord[] {
    const key = this.getContextKey(clientId, taxYear);
    return this.acknowledgements.get(key) || [];
  }

  public getRejections(clientId: string, taxYear: number): RejectionCorrectionRecord[] {
    const key = this.getContextKey(clientId, taxYear);
    return this.rejections.get(key) || [];
  }

  // ==========================================
  // CLIENT NOTIFICATIONS
  // ==========================================

  public addNotification(notif: ClientFilingNotification): void {
    this.notifications.unshift(notif);
    this.notify();
  }

  public getNotifications(clientId?: string): ClientFilingNotification[] {
    if (!clientId) return this.notifications;
    return this.notifications.filter(n => n.clientId === clientId);
  }

  private seedInitialNotifications(): void {
    this.notifications = [
      {
        notificationId: 'NOTIF-INIT-01',
        clientId: 'cli_complex_alex',
        taxYear: 2025,
        entityName: 'Alexander Sterling',
        status: 'Professional Review',
        title: 'Return in Professional Review',
        plainLanguageMessage: 'Elena Rostova, CPA is performing the independent quality-control and pre-filing review of your 2025 tax file.',
        targetSection: 'filing_status',
        isDemonstration: true,
        timestamp: new Date().toISOString(),
        isRead: false
      }
    ];
  }
}

export const preFilingGateRegistryService = PreFilingGateRegistryService.getInstance();
