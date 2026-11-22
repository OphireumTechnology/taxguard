/**
 * Provider-Neutral Integration Boundaries & Bounded AI Advisory Shield
 *
 * Fail-closed by default: live e-signature, IRS/state e-filing, government
 * transcripts, and external email/SMS notifications remain BLOCKED/DISABLED
 * until explicitly commissioned, verified in sandbox/staging, and authorized.
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  CommissioningStatus,
  ExternalProviderKey,
  ProviderCommissioningRecord,
  TaxGuardStageError,
} from './types';

export interface SignatureDispatchResult {
  providerName: string;
  providerEnvelopeId: string;
  status: 'SENT';
  dispatchedAt: string;
}

export interface SignatureProviderAdapter {
  readonly providerName: string;
  readonly commissioningStatus: CommissioningStatus;
  dispatchEnvelope(params: {
    envelopeId: string;
    documentSha256: string;
    signerEmail: string;
    signerName: string;
    expiresAt: string;
  }): SignatureDispatchResult;
  verifyWebhookSignature(rawPayload: string, signatureHeader: string, secret: string): boolean;
}

export interface FilingTransmitResult {
  providerName: string;
  providerSubmissionId: string;
  outcome: 'TRANSMITTED' | 'UNKNOWN_OUTCOME';
  transmittedAt: string;
}

export interface FilingTransmitterAdapter {
  readonly providerName: string;
  readonly commissioningStatus: CommissioningStatus;
  readonly efinConfigured: boolean;
  transmitReturn(params: {
    filingId: string;
    idempotencyKey: string;
    returnContentSha256: string;
    jurisdictionCode: string;
    schemaVersion: string;
  }): FilingTransmitResult;
}

export interface NotificationDeliveryAdapter {
  readonly providerName: string;
  readonly commissioningStatus: CommissioningStatus;
  sendExternal(params: {
    channel: 'EMAIL' | 'SMS';
    recipientRef: string;
    subject: string;
    idempotencyKey: string;
  }): { delivered: boolean; errorCode?: string };
}

export function sha256Hex(input: string | Record<string, unknown>): string {
  const payload = typeof input === 'string' ? input : canonicalJson(input);
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/** Deterministic key-sorted JSON serialization for stable cryptographic hashes */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

export function computeHmacSha256(rawPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(rawPayload, 'utf8').digest('hex');
}

export function verifyHmacSha256(rawPayload: string, signatureHex: string, secret: string): boolean {
  if (!rawPayload || !signatureHex || !secret) return false;
  const normalized = signatureHex.replace(/^sha256=/i, '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) return false;
  const expected = computeHmacSha256(rawPayload, secret);
  const a = Buffer.from(normalized, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Default Fail-Closed Signature Provider — refuses live dispatch with SIGNATURE_PROVIDER_NOT_CONFIGURED */
export class FailClosedSignatureProvider implements SignatureProviderAdapter {
  readonly providerName = 'UNCONFIGURED_SIGNATURE_PROVIDER';
  readonly commissioningStatus: CommissioningStatus = 'NOT_IMPLEMENTED';

  dispatchEnvelope(): SignatureDispatchResult {
    throw new TaxGuardStageError(
      503,
      'SIGNATURE_PROVIDER_NOT_CONFIGURED',
      'Live electronic signature dispatch is blocked: no commissioned e-signature provider is configured.'
    );
  }

  verifyWebhookSignature(rawPayload: string, signatureHeader: string, secret: string): boolean {
    return verifyHmacSha256(rawPayload, signatureHeader, secret);
  }
}

/** Default Fail-Closed Filing Transmitter — refuses live transmission until commissioned */
export class FailClosedFilingTransmitter implements FilingTransmitterAdapter {
  readonly providerName = 'UNCOMMISSIONED_FILING_TRANSMITTER';
  readonly commissioningStatus: CommissioningStatus = 'NOT_IMPLEMENTED';
  readonly efinConfigured = false;

  transmitReturn(): FilingTransmitResult {
    throw new TaxGuardStageError(
      503,
      'FILING_PROVIDER_NOT_COMMISSIONED',
      'Live IRS/state e-file transmission is disabled until an authorized transmitter and EFIN are commissioned.'
    );
  }
}

/** Default Fail-Closed Notification Delivery — never fakes external email/SMS delivery */
export class FailClosedNotificationProvider implements NotificationDeliveryAdapter {
  readonly providerName = 'UNCOMMISSIONED_NOTIFICATION_PROVIDER';
  readonly commissioningStatus: CommissioningStatus = 'NOT_IMPLEMENTED';

  sendExternal(): { delivered: boolean; errorCode?: string } {
    return {
      delivered: false,
      errorCode: 'NOTIFICATION_PROVIDER_NOT_COMMISSIONED',
    };
  }
}

/**
 * Bounded AI Advisory Shield (A00–A60 Deny-by-Default Governance)
 * - Strips/blocks prompt injection attempts from untrusted external inputs (notices, uploads, forms)
 * - Outputs are ALWAYS tagged advisory-only (`isAuthoritative: false`)
 * - Never executes tax calculations, approvals, signatures, or filings
 */
const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /system\s+prompt/i,
  /override\s+(approval|governance|maker[- ]checker|policy|rule)/i,
  /auto[- ]?approve|bypass\s+review|execute\s+filing|mark\s+as\s+accepted/i,
  /<\s*script\b/i,
  /\b(DROP\s+TABLE|DELETE\s+FROM|UNION\s+SELECT)\b/i,
  /\byou\s+are\s+now\s+(an?\s+)?(admin|approver|system)/i,
];

export interface BoundedAiAdvisoryOutput {
  advisoryId: string;
  agentCode: 'A14_PREPARATION_ADVISOR' | 'A28_NOTICE_TRIAGE_ADVISOR' | 'A42_CONTINUITY_ADVISOR';
  isAuthoritative: false;
  requiresHumanVerification: true;
  canMutateAuthoritativeState: false;
  summary: string;
  disclaimers: string[];
  generatedAt: string;
}

export class BoundedAiAdvisoryShield {
  static detectPromptInjection(rawText: string): { detected: boolean; matchedPattern?: string } {
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(rawText)) {
        return { detected: true, matchedPattern: pattern.source };
      }
    }
    return { detected: false };
  }

  static sanitizeUntrustedText(rawText: string): string {
    const check = this.detectPromptInjection(rawText);
    if (check.detected) {
      throw new TaxGuardStageError(
        400,
        'PROMPT_INJECTION_DETECTED',
        'Untrusted external input contains disallowed instruction-override or injection patterns and was rejected.',
        { matchedPattern: check.matchedPattern }
      );
    }
    return rawText
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
  }

  static generateAdvisory(params: {
    agentCode: BoundedAiAdvisoryOutput['agentCode'];
    untrustedInput: string;
    contextLabel: string;
  }): BoundedAiAdvisoryOutput {
    const sanitized = this.sanitizeUntrustedText(params.untrustedInput);
    return {
      advisoryId: `adv_${sha256Hex(`${params.agentCode}:${sanitized}`).slice(0, 16)}`,
      agentCode: params.agentCode,
      isAuthoritative: false,
      requiresHumanVerification: true,
      canMutateAuthoritativeState: false,
      summary: `[Advisory — Non-Authoritative] ${params.contextLabel}: Reviewed sanitized context (${sanitized.length} chars). Human practitioner verification and deterministic rule validation are required before relying on any recommendation.`,
      disclaimers: [
        'AI proposes; deterministic rules validate; authorized humans approve.',
        'This output cannot modify tax calculations, approvals, signatures, or filing state.',
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export function buildProviderCommissioningMatrix(adapters: {
  signature: SignatureProviderAdapter;
  filing: FilingTransmitterAdapter;
  notifications: NotificationDeliveryAdapter;
}): ProviderCommissioningRecord[] {
  const checkedAt = new Date().toISOString();
  const rows: Record<ExternalProviderKey, ProviderCommissioningRecord> = {
    E_SIGNATURE_PROVIDER: {
      providerKey: 'E_SIGNATURE_PROVIDER',
      displayName: 'Electronic Signature Provider (Stage 11)',
      status: adapters.signature.commissioningStatus,
      liveExecutionPermitted: adapters.signature.commissioningStatus === 'PRODUCTION_VERIFIED',
      blockingCode:
        adapters.signature.commissioningStatus === 'PRODUCTION_VERIFIED'
          ? null
          : 'SIGNATURE_PROVIDER_NOT_CONFIGURED',
      requiredPreconditions: [
        'Commissioned vendor credentials & KBA/IRS Form 8879 compliance sign-off',
        'Signed webhook HMAC verification & replay tests in staging',
        'Owner production authorization',
      ],
      checkedAt,
    },
    E_FILE_TRANSMITTER: {
      providerKey: 'E_FILE_TRANSMITTER',
      displayName: 'IRS MeF / State E-File Transmitter (Stage 12)',
      status: adapters.filing.commissioningStatus,
      liveExecutionPermitted: adapters.filing.commissioningStatus === 'PRODUCTION_VERIFIED',
      blockingCode:
        adapters.filing.commissioningStatus === 'PRODUCTION_VERIFIED'
          ? null
          : 'FILING_PROVIDER_NOT_COMMISSIONED',
      requiredPreconditions: [
        'Active IRS EFIN & authorized MeF/state transmitter contract',
        'ATS (Assurance Testing System) acceptance & schema validation verification',
        'Owner production filing authorization',
      ],
      checkedAt,
    },
    GOVERNMENT_TRANSCRIPT_PROVIDER: {
      providerKey: 'GOVERNMENT_TRANSCRIPT_PROVIDER',
      displayName: 'IRS / State Transcript Retrieval (Stage 13)',
      status: 'DISABLED',
      liveExecutionPermitted: false,
      blockingCode: 'TRANSCRIPT_PROVIDER_NOT_COMMISSIONED',
      requiredPreconditions: [
        'IRS TDS / authorized transcript provider integration',
        'Verified Form 2848 / 8821 representation authority & taxpayer consent',
      ],
      checkedAt,
    },
    EMAIL_SMS_NOTIFICATION_PROVIDER: {
      providerKey: 'EMAIL_SMS_NOTIFICATION_PROVIDER',
      displayName: 'External Email / SMS Delivery (Stage 15 & 17)',
      status: adapters.notifications.commissioningStatus,
      liveExecutionPermitted: adapters.notifications.commissioningStatus === 'PRODUCTION_VERIFIED',
      blockingCode:
        adapters.notifications.commissioningStatus === 'PRODUCTION_VERIFIED'
          ? null
          : 'NOTIFICATION_PROVIDER_NOT_COMMISSIONED',
      requiredPreconditions: [
        'Commissioned transactional email/SMS provider with DKIM/SPF/DMARC',
        'PII redaction policy verification for tax notifications',
      ],
      checkedAt,
    },
    ARCHIVE_WORM_STORAGE: {
      providerKey: 'ARCHIVE_WORM_STORAGE',
      displayName: 'Immutable WORM Archive Storage (Stage 16)',
      status: 'IMPLEMENTED_UNVERIFIED',
      liveExecutionPermitted: false,
      blockingCode: 'WORM_OBJECT_LOCK_NOT_COMMISSIONED',
      requiredPreconditions: [
        'Provisioned Object Lock / WORM storage bucket with KMS encryption',
        'Staging restore & integrity checksum verification',
      ],
      checkedAt,
    },
    AI_ADVISORY_GATEWAY: {
      providerKey: 'AI_ADVISORY_GATEWAY',
      displayName: 'Bounded AI Advisory Gateway (A00–A60)',
      status: process.env.OPENAI_API_KEY ? 'IMPLEMENTED_UNVERIFIED' : 'DISABLED',
      liveExecutionPermitted: false,
      blockingCode: 'AI_ADVISORY_ONLY_NEVER_AUTHORITATIVE',
      requiredPreconditions: [
        'Advisory-only boundary enforced; cannot calculate, approve, sign, or file',
      ],
      checkedAt,
    },
  };

  return Object.values(rows);
}
