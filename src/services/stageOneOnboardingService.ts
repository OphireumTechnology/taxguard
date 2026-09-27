/**
 * A/R Tax Services, LLC - Stage One Onboarding & Identity Verification Engine
 * Implements Stage One (Onboard) in the Unified 18-Stage Operating Workflow:
 * 1. Minimal account entry -> Internal Client ID generation
 * 2. Identity Verification Wizard (Individual or Entity)
 * 3. Secure TIN (Never exposed in full, masked)
 * 4. Addresses & Authorized Representative
 * 5. Supporting ID documents
 * 6. Duplicate check across TIN, Legal Name, Email, Phone, Address (block/route to review)
 * 7. Engagement & Consent with approved IRC § 7216 language
 * 8. Onboarding Readiness Card & Hard Exit Gate
 * 9. Stage Two activation upon satisfaction
 */

import { INITIAL_DEMO_CLIENTS } from '../demo/mockData';
import { TaxGuardAuditService } from '../taxguard/services/TaxGuardAuditService';
import { EnvironmentConfigService } from '../config/environmentConfig';

export type TaxpayerType = 'individual' | 'entity';

export type EntityClassification =
  | 'llc'
  | 'scorp'
  | 'ccorp'
  | 'partnership'
  | 'sole_prop'
  | 'nonprofit'
  | 'trust_estate';

export interface AddressData {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface AuthorizedRepData {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  relationshipOrCapacity: string;
  hasPowerOfAttorney: boolean;
}

export interface SupportingIdDoc {
  id: string;
  name: string;
  category: 'government_id' | 'passport' | 'articles_of_org' | 'ein_letter' | 'ssn_card' | 'other';
  sha256Hash: string;
  uploadedAt: string;
  fileSize: string;
  verified: boolean;
}

export interface EngagementConsentData {
  irc7216ConsentAccepted: boolean;
  termsAndScopeAccepted: boolean;
  pricingScheduleAcknowledged: boolean;
  electronicSignatureConsentAccepted: boolean;
  signerFullName: string;
  signedAt: string;
  ipAddress: string;
  consentVersion: string;
}

export interface DuplicateMatchItem {
  matchedField: 'tin' | 'name' | 'email' | 'phone' | 'address';
  matchedValue: string;
  matchedClientId: string;
  matchedClientName: string;
  matchedBusinessName?: string;
  confidence: 'exact' | 'high' | 'moderate';
  details: string;
}

export interface DuplicateCheckReport {
  timestamp: string;
  status: 'CLEARED' | 'LIKELY_MATCH' | 'EXACT_MATCH';
  matches: DuplicateMatchItem[];
  routedToReview: boolean;
  reviewDecision?: 'pending' | 'override_approved' | 'rejected_duplicate';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface ReadinessBlockingItem {
  id: string;
  label: string;
  satisfied: boolean;
  blockingReason?: string;
}

export interface StageOneReadinessReport {
  isReady: boolean;
  completionPercentage: number;
  blockingItems: ReadinessBlockingItem[];
  overallStatus: 'incomplete' | 'review_hold' | 'ready_to_exit' | 'completed';
}

export interface StageOneDossier {
  clientId: string; // Internal Client ID, e.g. AR-CLT-2025-XXXXX
  taxpayerType: TaxpayerType;
  entityClassification?: EntityClassification;
  legalName: string;
  dbaName?: string;
  email: string;
  phone: string;
  tinType: 'ssn' | 'ein' | 'itin';
  maskedTIN: string; // STRICT RULE: Never expose full TIN
  tinLast4: string;
  residentialOrPrincipalAddress: AddressData;
  mailingAddress: AddressData;
  mailingSameAsResidential: boolean;
  authorizedRep?: AuthorizedRepData;
  supportingDocs: SupportingIdDoc[];
  duplicateCheck: DuplicateCheckReport;
  engagementConsent: EngagementConsentData;
  readiness: StageOneReadinessReport;
  stageOneCompleted: boolean;
  stageOneCompletedAt?: string;
  activeWorkflowStage: number; // 1 during Stage 1, 2 upon exit gate pass
  notes?: string;
}

const STORAGE_KEY_PREFIX = 'artax_stage_one_dossier_';
const ACTIVE_CLIENT_ID_KEY = 'artax_active_onboarding_client_id';

export class StageOneOnboardingService {
  /**
   * Generate internal Client ID: AR-CLT-YYYY-XXXXX
   */
  public static generateClientId(): string {
    const currentYear = new Date().getFullYear();
    const randomSeq = Math.floor(10000 + Math.random() * 90000);
    return `AR-CLT-${currentYear}-${randomSeq}`;
  }

  /**
   * Safe TIN masking: returns ***-**-1234 or XX-XXX1234.
   * Never stores or returns full TIN in persistent state.
   */
  public static maskTIN(rawInput: string, type: 'ssn' | 'ein' | 'itin' = 'ssn'): { masked: string; last4: string } {
    const cleaned = (rawInput || '').replace(/\D/g, '');
    const last4 = cleaned.slice(-4).padStart(4, '0');
    if (type === 'ssn' || type === 'itin') {
      return { masked: `***-**-${last4}`, last4 };
    }
    return { masked: `XX-XXX${last4}`, last4 };
  }

  /**
   * Create initial minimal Stage One Dossier upon registration
   */
  public static createInitialDossier(params: {
    fullName: string;
    email: string;
    phone: string;
    taxpayerType?: TaxpayerType;
    businessName?: string;
  }): StageOneDossier {
    const clientId = this.generateClientId();
    const isEntity = params.taxpayerType === 'entity' || Boolean(params.businessName);

    const dossier: StageOneDossier = {
      clientId,
      taxpayerType: isEntity ? 'entity' : 'individual',
      entityClassification: isEntity ? 'llc' : undefined,
      legalName: params.fullName,
      dbaName: params.businessName,
      email: params.email,
      phone: params.phone,
      tinType: isEntity ? 'ein' : 'ssn',
      maskedTIN: isEntity ? 'XX-XXX0000' : '***-**-0000',
      tinLast4: '0000',
      residentialOrPrincipalAddress: {
        street: '',
        city: '',
        state: 'SC',
        zip: '',
        country: 'United States'
      },
      mailingAddress: {
        street: '',
        city: '',
        state: 'SC',
        zip: '',
        country: 'United States'
      },
      mailingSameAsResidential: true,
      authorizedRep: isEntity ? {
        fullName: params.fullName,
        title: 'Managing Member',
        email: params.email,
        phone: params.phone,
        relationshipOrCapacity: 'Authorized Officer / Managing Member',
        hasPowerOfAttorney: false
      } : undefined,
      supportingDocs: [],
      duplicateCheck: {
        timestamp: new Date().toISOString(),
        status: 'CLEARED',
        matches: [],
        routedToReview: false
      },
      engagementConsent: {
        irc7216ConsentAccepted: false,
        termsAndScopeAccepted: false,
        pricingScheduleAcknowledged: false,
        electronicSignatureConsentAccepted: false,
        signerFullName: '',
        signedAt: '',
        ipAddress: '127.0.0.1 (Client Portal)',
        consentVersion: '2025.1-IRC7216'
      },
      readiness: {
        isReady: false,
        completionPercentage: 15,
        blockingItems: [],
        overallStatus: 'incomplete'
      },
      stageOneCompleted: false,
      activeWorkflowStage: 1
    };

    dossier.readiness = this.evaluateReadiness(dossier);
    this.saveDossier(dossier);
    this.setActiveClientId(clientId);

    // Audit log
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_demo',
      userId: clientId,
      userEmail: params.email,
      userRole: 'client',
      ipAddress: '127.0.0.1',
      action: 'STAGE_01_ONBOARDING_INITIALIZED',
      recordType: 'verification',
      recordId: clientId,
      result: 'success',
      riskLevel: 'routine',
      details: `Stage One Onboard started. Assigned internal Client ID: ${clientId}. Taxpayer Type: ${dossier.taxpayerType}.`
    });

    return dossier;
  }

  /**
   * Run duplicate check across:
   * 1. TIN (Last 4 / format)
   * 2. Legal Name (Exact and fuzzy)
   * 3. Email Address
   * 4. Phone Number
   * 5. Address (Street and ZIP)
   * Blocks or routes to review if a likely match!
   */
  public static runDuplicateCheck(dossier: Partial<StageOneDossier>): DuplicateCheckReport {
    const matches: DuplicateMatchItem[] = [];
    const normEmail = (dossier.email || '').trim().toLowerCase();
    const normPhone = (dossier.phone || '').replace(/\D/g, '');
    const normName = (dossier.legalName || '').trim().toLowerCase();
    const normDba = (dossier.dbaName || '').trim().toLowerCase();
    const normStreet = (dossier.residentialOrPrincipalAddress?.street || '').trim().toLowerCase();
    const normZip = (dossier.residentialOrPrincipalAddress?.zip || '').trim();
    const targetLast4 = dossier.tinLast4 || (dossier.maskedTIN ? dossier.maskedTIN.slice(-4) : '');

    // Cross-check against demo client repository
    for (const existing of INITIAL_DEMO_CLIENTS) {
      // 1. Check Email
      const exEmail = (existing.email || '').trim().toLowerCase();
      if (normEmail && exEmail && normEmail === exEmail) {
        matches.push({
          matchedField: 'email',
          matchedValue: dossier.email || '',
          matchedClientId: existing.id,
          matchedClientName: existing.name,
          matchedBusinessName: existing.businessName,
          confidence: 'exact',
          details: `Identical email address registered under ${existing.name} (${existing.id}).`
        });
      }

      // 2. Check Phone
      const exPhone = (existing.phone || '').replace(/\D/g, '');
      if (normPhone && exPhone && (normPhone === exPhone || (normPhone.length >= 7 && exPhone.endsWith(normPhone.slice(-7))))) {
        matches.push({
          matchedField: 'phone',
          matchedValue: dossier.phone || '',
          matchedClientId: existing.id,
          matchedClientName: existing.name,
          matchedBusinessName: existing.businessName,
          confidence: 'high',
          details: `Direct telephone match against existing profile ${existing.name}.`
        });
      }

      // 3. Check Legal Name / Business Name
      const exName = (existing.name || '').trim().toLowerCase();
      const exBiz = (existing.businessName || '').trim().toLowerCase();
      if (normName && (normName === exName || (exBiz && normName === exBiz))) {
        matches.push({
          matchedField: 'name',
          matchedValue: dossier.legalName || '',
          matchedClientId: existing.id,
          matchedClientName: existing.name,
          matchedBusinessName: existing.businessName,
          confidence: 'high',
          details: `Legal name collision with active taxpayer ${existing.name}.`
        });
      } else if (normDba && exBiz && normDba === exBiz) {
        matches.push({
          matchedField: 'name',
          matchedValue: dossier.dbaName || '',
          matchedClientId: existing.id,
          matchedClientName: existing.name,
          matchedBusinessName: existing.businessName,
          confidence: 'high',
          details: `Entity legal name matches existing portfolio client: ${existing.businessName}.`
        });
      }

      // 4. Check TIN (Last 4)
      const exTinLast4 = (existing.einOrSsnMasked || '').slice(-4);
      if (targetLast4 && targetLast4 !== '0000' && exTinLast4 === targetLast4) {
        matches.push({
          matchedField: 'tin',
          matchedValue: `***${targetLast4}`,
          matchedClientId: existing.id,
          matchedClientName: existing.name,
          matchedBusinessName: existing.businessName,
          confidence: 'exact',
          details: `Taxpayer Identification Number last 4 matches recorded entity ${existing.businessName || existing.name}.`
        });
      }

      // 5. Check Address (Street + ZIP)
      const exAddr = (existing.address || '').toLowerCase();
      if (normStreet && normStreet.length > 5 && exAddr.includes(normStreet.slice(0, 8))) {
        if (!normZip || exAddr.includes(normZip)) {
          matches.push({
            matchedField: 'address',
            matchedValue: `${dossier.residentialOrPrincipalAddress?.street}, ${dossier.residentialOrPrincipalAddress?.city}`,
            matchedClientId: existing.id,
            matchedClientName: existing.name,
            matchedBusinessName: existing.businessName,
            confidence: 'moderate',
            details: `Physical address proximity detected with existing entity ${existing.name}.`
          });
        }
      }
    }

    const hasExact = matches.some(m => m.confidence === 'exact');
    const hasHigh = matches.some(m => m.confidence === 'high');

    let status: 'CLEARED' | 'LIKELY_MATCH' | 'EXACT_MATCH' = 'CLEARED';
    let routedToReview = false;

    if (hasExact) {
      status = 'EXACT_MATCH';
      routedToReview = true;
    } else if (hasHigh || matches.length > 0) {
      status = 'LIKELY_MATCH';
      routedToReview = true;
    }

    const report: DuplicateCheckReport = {
      timestamp: new Date().toISOString(),
      status,
      matches,
      routedToReview,
      reviewDecision: routedToReview ? 'pending' : undefined
    };

    // Audit duplicate check
    if (routedToReview) {
      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_demo',
        userId: dossier.clientId || 'unassigned',
        userEmail: dossier.email || 'client@example.com',
        userRole: 'client',
        ipAddress: '127.0.0.1',
        action: 'DUPLICATE_CHECK_COLLISION_DETECTED',
        recordType: 'verification',
        recordId: dossier.clientId || 'temp',
        result: 'denied',
        riskLevel: 'high_risk',
        details: `Duplicate check flagged ${matches.length} matches. Status: ${status}. Routed to review.`
      });
    } else {
      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_demo',
        userId: dossier.clientId || 'unassigned',
        userEmail: dossier.email || 'client@example.com',
        userRole: 'client',
        ipAddress: '127.0.0.1',
        action: 'DUPLICATE_CHECK_CLEARED',
        recordType: 'verification',
        recordId: dossier.clientId || 'temp',
        result: 'success',
        riskLevel: 'routine',
        details: 'Automated 5-point duplicate check passed with zero collision.'
      });
    }

    return report;
  }

  /**
   * Evaluate Readiness Card & Hard Exit Gate criteria
   */
  public static evaluateReadiness(dossier: StageOneDossier): StageOneReadinessReport {
    const blockingItems: ReadinessBlockingItem[] = [];

    // Gate 1: Identity & Classification Verified
    const isEntity = dossier.taxpayerType === 'entity';
    const hasLegalName = Boolean(dossier.legalName && dossier.legalName.trim().length >= 2);
    const hasClassification = isEntity ? Boolean(dossier.entityClassification) : true;
    const identitySatisfied = hasLegalName && hasClassification;
    blockingItems.push({
      id: 'gate_identity',
      label: 'Taxpayer Classification & Legal Entity Name',
      satisfied: identitySatisfied,
      blockingReason: identitySatisfied ? undefined : 'Legal name and entity classification are required.'
    });

    // Gate 2: Secure Masked TIN Provided
    const hasTIN = Boolean(dossier.tinLast4 && dossier.tinLast4 !== '0000' && dossier.tinLast4.length === 4);
    blockingItems.push({
      id: 'gate_tin',
      label: 'Secure Masked TIN / Identification Formatted',
      satisfied: hasTIN,
      blockingReason: hasTIN ? undefined : 'Valid 9-digit SSN or EIN must be securely submitted and masked.'
    });

    // Gate 3: Addresses Provided
    const res = dossier.residentialOrPrincipalAddress;
    const hasResAddr = Boolean(res && res.street && res.city && res.state && res.zip && res.zip.length >= 5);
    const hasMailAddr = dossier.mailingSameAsResidential ? hasResAddr : Boolean(
      dossier.mailingAddress && dossier.mailingAddress.street && dossier.mailingAddress.city && dossier.mailingAddress.zip
    );
    const addressSatisfied = hasResAddr && hasMailAddr;
    blockingItems.push({
      id: 'gate_address',
      label: 'Physical / Principal and Mailing Addresses',
      satisfied: addressSatisfied,
      blockingReason: addressSatisfied ? undefined : 'Complete physical address and 5-digit ZIP code required.'
    });

    // Gate 4: Authorized Representative (Mandatory for entity, verified for individual)
    const authRep = dossier.authorizedRep;
    const repSatisfied = isEntity 
      ? Boolean(authRep && authRep.fullName && authRep.title && authRep.email && authRep.phone)
      : true;
    blockingItems.push({
      id: 'gate_auth_rep',
      label: isEntity ? 'Authorized Representative & Signing Capacity' : 'Designated Taxpayer / Representation',
      satisfied: repSatisfied,
      blockingReason: repSatisfied ? undefined : 'Entity requires verified authorized representative and title.'
    });

    // Gate 5: Supporting ID Document Upload
    const hasUploadedDoc = dossier.supportingDocs && dossier.supportingDocs.length > 0;
    blockingItems.push({
      id: 'gate_document',
      label: 'Government ID or Formation Document Vault Receipt',
      satisfied: hasUploadedDoc,
      blockingReason: hasUploadedDoc ? undefined : 'At least one verified supporting identification or entity document must be uploaded.'
    });

    // Gate 6: Duplicate Check Cleared or Approved
    const dup = dossier.duplicateCheck;
    const dupSatisfied = Boolean(
      dup && (dup.status === 'CLEARED' || dup.reviewDecision === 'override_approved')
    );
    blockingItems.push({
      id: 'gate_duplicate_check',
      label: 'Automated 5-Point Duplicate Resolution',
      satisfied: dupSatisfied,
      blockingReason: dupSatisfied ? undefined : 'Duplicate collision detected across TIN/Name/Email/Phone/Address. Review required.'
    });

    // Gate 7: Engagement & Consent Executed
    const eng = dossier.engagementConsent;
    const consentSatisfied = Boolean(
      eng && 
      eng.irc7216ConsentAccepted && 
      eng.termsAndScopeAccepted && 
      eng.pricingScheduleAcknowledged && 
      eng.electronicSignatureConsentAccepted &&
      eng.signerFullName && 
      eng.signerFullName.trim().length >= 3 &&
      eng.signedAt
    );
    blockingItems.push({
      id: 'gate_consent',
      label: 'Engagement Scope & IRC § 7216 Consent E-Signature',
      satisfied: consentSatisfied,
      blockingReason: consentSatisfied ? undefined : 'IRC § 7216 consent, scope acknowledgment, and legal electronic signature required.'
    });

    // Calculate percentage
    const satisfiedCount = blockingItems.filter(b => b.satisfied).length;
    const completionPercentage = Math.round((satisfiedCount / blockingItems.length) * 100);
    const isReady = satisfiedCount === blockingItems.length;

    let overallStatus: 'incomplete' | 'review_hold' | 'ready_to_exit' | 'completed' = 'incomplete';
    if (dossier.stageOneCompleted) {
      overallStatus = 'completed';
    } else if (dup && dup.routedToReview && dup.reviewDecision !== 'override_approved') {
      overallStatus = 'review_hold';
    } else if (isReady) {
      overallStatus = 'ready_to_exit';
    }

    return {
      isReady,
      completionPercentage,
      blockingItems,
      overallStatus
    };
  }

  /**
   * Hard Exit Gate: Only marks Stage One complete when all blocking items are satisfied!
   * Activates Stage Two (Collect) in the Unified 18-Stage Operating Workflow and reveals the client dashboard.
   */
  public static passHardExitGate(clientId: string): { success: boolean; error?: string; dossier?: StageOneDossier } {
    const dossier = this.getDossier(clientId);
    if (!dossier) {
      return { success: false, error: `Dossier for Client ID ${clientId} could not be located.` };
    }

    const readiness = this.evaluateReadiness(dossier);
    if (!readiness.isReady) {
      const pendingReasons = readiness.blockingItems
        .filter(b => !b.satisfied)
        .map(b => b.label)
        .join('; ');
      
      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_demo',
        userId: clientId,
        userEmail: dossier.email,
        userRole: 'client',
        ipAddress: '127.0.0.1',
        action: 'STAGE_01_HARD_EXIT_GATE_DENIED',
        recordType: 'verification',
        recordId: clientId,
        result: 'denied',
        riskLevel: 'high_risk',
        details: `Hard exit gate denied for ${clientId}. Unfulfilled blocking criteria: ${pendingReasons}`
      });

      return {
        success: false,
        error: `Hard Exit Gate Locked: All 7 blocking items must be satisfied. Outstanding: ${pendingReasons}`
      };
    }

    // Pass exit gate
    dossier.stageOneCompleted = true;
    dossier.stageOneCompletedAt = new Date().toISOString();
    dossier.activeWorkflowStage = 2; // Activate Stage 2 (Collect) in 18-Stage cycle
    dossier.readiness = this.evaluateReadiness(dossier);

    this.saveDossier(dossier);

    // Immutable Audit Log
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_demo',
      userId: clientId,
      userEmail: dossier.email,
      userRole: 'client',
      ipAddress: '127.0.0.1',
      action: 'STAGE_01_ONBOARD_COMPLETED',
      recordType: 'verification',
      recordId: clientId,
      result: 'success',
      riskLevel: 'routine',
      details: `Stage One Onboard successfully passed hard exit gate. Internal Client ID: ${clientId}. Activating Stage Two (Collect) in 18-Stage Tax Operating Workflow.`
    });

    return {
      success: true,
      dossier
    };
  }

  private static inMemoryDossiers: Map<string, StageOneDossier> = new Map();
  private static activeClientIdMemory: string | null = null;

  /**
   * Save dossier to storage
   */
  public static saveDossier(dossier: StageOneDossier): void {
    dossier.readiness = this.evaluateReadiness(dossier);
    this.inMemoryDossiers.set(dossier.clientId, JSON.parse(JSON.stringify(dossier)));

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${dossier.clientId}`, JSON.stringify(dossier));
      } catch {
        // storage fallback
      }
    }
  }

  /**
   * Retrieve dossier by Client ID
   */
  public static getDossier(clientId: string): StageOneDossier | null {
    if (this.inMemoryDossiers.has(clientId)) {
      const cached = this.inMemoryDossiers.get(clientId)!;
      cached.readiness = this.evaluateReadiness(cached);
      return JSON.parse(JSON.stringify(cached));
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${clientId}`);
        if (stored) {
          const parsed = JSON.parse(stored) as StageOneDossier;
          parsed.readiness = this.evaluateReadiness(parsed);
          this.inMemoryDossiers.set(clientId, parsed);
          return parsed;
        }
      } catch {
        // Fallback
      }
    }
    return null;
  }

  /**
   * Get currently active onboarding client ID
   */
  public static getActiveClientId(): string | null {
    if (this.activeClientIdMemory) {
      return this.activeClientIdMemory;
    }

    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(ACTIVE_CLIENT_ID_KEY);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Set active client ID
   */
  public static setActiveClientId(clientId: string): void {
    this.activeClientIdMemory = clientId;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_CLIENT_ID_KEY, clientId);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Reviewer override for duplicate match
   */
  public static resolveDuplicateReview(
    clientId: string, 
    decision: 'override_approved' | 'rejected_duplicate',
    reviewerName: string,
    notes: string
  ): StageOneDossier | null {
    const dossier = this.getDossier(clientId);
    if (!dossier) return null;

    dossier.duplicateCheck.reviewDecision = decision;
    dossier.duplicateCheck.reviewedBy = reviewerName;
    dossier.duplicateCheck.reviewedAt = new Date().toISOString();
    dossier.duplicateCheck.reviewNotes = notes;

    if (decision === 'override_approved') {
      dossier.duplicateCheck.routedToReview = false;
    }

    this.saveDossier(dossier);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_demo',
      userId: reviewerName,
      userEmail: 'reviewer@artaxservices.com',
      userRole: 'reviewer',
      ipAddress: '127.0.0.1',
      action: 'DUPLICATE_REVIEW_DECISION_LOGGED',
      recordType: 'governance',
      recordId: clientId,
      result: decision === 'override_approved' ? 'success' : 'denied',
      riskLevel: decision === 'override_approved' ? 'routine' : 'high_risk',
      details: `Compliance decision: ${decision}. Notes: ${notes}`
    });

    return dossier;
  }
}
