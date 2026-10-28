export type TaxGuardReadinessStatus =
  | 'NOT_CHECKED'
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED';

export type TaxGuardReadinessArea =
  | 'FRONTEND'
  | 'API'
  | 'AUTHENTICATION'
  | 'SESSION'
  | 'DATABASE'
  | 'TENANT_ISOLATION'
  | 'DOCUMENT_INTELLIGENCE'
  | 'AUDIT'
  | 'MONITORING'
  | 'BACKUP_RESTORE'
  | 'SECURITY'
  | 'REGRESSION'
  | 'BUILD'
  | 'TYPECHECK';

export interface TaxGuardReadinessCheck {
  checkId: string;
  area: TaxGuardReadinessArea;
  name: string;
  required: boolean;
  status: TaxGuardReadinessStatus;
  checkedAt?: string;
  evidence: readonly string[];
  blockerReason?: string;
}

export interface TaxGuardReadinessSummary {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  notChecked: number;
  requiredIncomplete: number;
  releaseAllowed: boolean;
  blockers: readonly string[];
}

function requireReadinessText(
  value: string,
  errorCode: string
): string {

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
}

export class TaxGuardReadinessRegistry {

  private readonly checks =
    new Map<
      string,
      Readonly<TaxGuardReadinessCheck>
    >();

  register(
    check:
      TaxGuardReadinessCheck
  ):
    Readonly<TaxGuardReadinessCheck> {

    requireReadinessText(
      check.checkId,
      'TG_READINESS_CHECK_ID_REQUIRED'
    );

    requireReadinessText(
      check.name,
      'TG_READINESS_CHECK_NAME_REQUIRED'
    );

    if (
      this.checks.has(
        check.checkId
      )
    ) {
      throw new Error(
        'TG_READINESS_DUPLICATE_CHECK'
      );
    }

    if (
      check.status === 'PASS' &&
      check.evidence.length === 0
    ) {
      throw new Error(
        'TG_READINESS_PASS_REQUIRES_EVIDENCE'
      );
    }

    if (
      check.checkedAt &&
      !Number.isFinite(
        Date.parse(
          check.checkedAt
        )
      )
    ) {
      throw new Error(
        'TG_READINESS_TIMESTAMP_INVALID'
      );
    }

    if (
      (
        check.status === 'FAIL' ||
        check.status === 'BLOCKED'
      ) &&
      !check.blockerReason
    ) {
      throw new Error(
        'TG_READINESS_BLOCKER_REASON_REQUIRED'
      );
    }

    const stored =
      Object.freeze({
        ...check,

        evidence:
          Object.freeze([
            ...check.evidence
          ])
      });

    this.checks.set(
      check.checkId,
      stored
    );

    return stored;
  }

  get(
    checkId: string
  ):
    Readonly<TaxGuardReadinessCheck> |
    undefined {

    return this.checks.get(
      checkId
    );
  }

  list():
    readonly Readonly<TaxGuardReadinessCheck>[] {

    return Object.freeze(
      [
        ...this.checks.values()
      ]
    );
  }

  summarize():
    Readonly<TaxGuardReadinessSummary> {

    const checks =
      this.list();

    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let notChecked = 0;
    let requiredIncomplete = 0;

    const blockers:
      string[] = [];

    for (
      const check
      of checks
    ) {
      if (
        check.status === 'PASS'
      ) {
        passed += 1;
      }

      if (
        check.status === 'FAIL'
      ) {
        failed += 1;
      }

      if (
        check.status === 'BLOCKED'
      ) {
        blocked += 1;
      }

      if (
        check.status === 'NOT_CHECKED'
      ) {
        notChecked += 1;
      }

      if (
        check.required &&
        check.status !== 'PASS'
      ) {
        requiredIncomplete += 1;

        blockers.push(
          check.blockerReason ??
          (
            check.checkId +
            '_NOT_PASSED'
          )
        );
      }
    }

    return Object.freeze({
      total:
        checks.length,

      passed,
      failed,
      blocked,
      notChecked,
      requiredIncomplete,

      releaseAllowed:
        requiredIncomplete === 0,

      blockers:
        Object.freeze([
          ...blockers
        ])
    });
  }
}

export interface TaxGuardGoLiveAcceptance {
  acceptanceId: string;

  environment:
    'PRODUCTION';

  frontendVerified:
    boolean;

  apiVerified:
    boolean;

  authenticationVerified:
    boolean;

  sessionVerified:
    boolean;

  databaseVerified:
    boolean;

  tenantIsolationVerified:
    boolean;

  documentIntelligenceVerified:
    boolean;

  auditVerified:
    boolean;

  monitoringVerified:
    boolean;

  backupRestoreVerified:
    boolean;

  securityVerified:
    boolean;

  regressionPassed:
    boolean;

  buildPassed:
    boolean;

  typecheckPassed:
    boolean;

  externalTaxFilingEnabled:
    false;

  acceptedBy?:
    string;

  acceptedAt?:
    string;
}

export interface TaxGuardGoLiveAcceptanceDecision {
  accepted: boolean;
  blockers: readonly string[];
}

export class TaxGuardGoLiveAcceptanceGate {

  static evaluate(
    acceptance:
      TaxGuardGoLiveAcceptance
  ):
    Readonly<TaxGuardGoLiveAcceptanceDecision> {

    requireReadinessText(
      acceptance.acceptanceId,
      'TG_GO_LIVE_ACCEPTANCE_ID_REQUIRED'
    );

    if (
      acceptance.environment !==
        'PRODUCTION'
    ) {
      throw new Error(
        'TG_GO_LIVE_PRODUCTION_ENVIRONMENT_REQUIRED'
      );
    }

    const blockers:
      string[] = [];

    const requiredChecks:
      readonly [
        keyof TaxGuardGoLiveAcceptance,
        string
      ][] = [
        [
          'frontendVerified',
          'FRONTEND_NOT_VERIFIED'
        ],
        [
          'apiVerified',
          'API_NOT_VERIFIED'
        ],
        [
          'authenticationVerified',
          'AUTHENTICATION_NOT_VERIFIED'
        ],
        [
          'sessionVerified',
          'SESSION_NOT_VERIFIED'
        ],
        [
          'databaseVerified',
          'DATABASE_NOT_VERIFIED'
        ],
        [
          'tenantIsolationVerified',
          'TENANT_ISOLATION_NOT_VERIFIED'
        ],
        [
          'documentIntelligenceVerified',
          'DOCUMENT_INTELLIGENCE_NOT_VERIFIED'
        ],
        [
          'auditVerified',
          'AUDIT_NOT_VERIFIED'
        ],
        [
          'monitoringVerified',
          'MONITORING_NOT_VERIFIED'
        ],
        [
          'backupRestoreVerified',
          'BACKUP_RESTORE_NOT_VERIFIED'
        ],
        [
          'securityVerified',
          'SECURITY_NOT_VERIFIED'
        ],
        [
          'regressionPassed',
          'REGRESSION_NOT_PASSED'
        ],
        [
          'buildPassed',
          'BUILD_NOT_PASSED'
        ],
        [
          'typecheckPassed',
          'TYPECHECK_NOT_PASSED'
        ]
      ];

    for (
      const [
        key,
        reason
      ]
      of requiredChecks
    ) {
      if (
        acceptance[key] !== true
      ) {
        blockers.push(
          reason
        );
      }
    }

    if (
      acceptance.externalTaxFilingEnabled
    ) {
      blockers.push(
        'EXTERNAL_TAX_FILING_MUST_REMAIN_DISABLED'
      );
    }

    if (
      acceptance.acceptedAt &&
      !Number.isFinite(
        Date.parse(
          acceptance.acceptedAt
        )
      )
    ) {
      throw new Error(
        'TG_GO_LIVE_ACCEPTED_AT_INVALID'
      );
    }

    if (
      blockers.length === 0 &&
      !acceptance.acceptedBy
    ) {
      blockers.push(
        'AUTHORIZED_ACCEPTANCE_REQUIRED'
      );
    }

    return Object.freeze({
      accepted:
        blockers.length === 0,

      blockers:
        Object.freeze([
          ...blockers
        ])
    });
  }
}

export interface TaxGuardProductionVerificationEvidence {
  evidenceId: string;
  checkId: string;
  source: string;
  capturedAt: string;
  description: string;
  verifiedBy: string;
  immutable: true;
}

export class TaxGuardProductionVerificationEvidenceRegistry {

  private readonly evidence =
    new Map<
      string,
      Readonly<TaxGuardProductionVerificationEvidence>
    >();

  register(
    record:
      TaxGuardProductionVerificationEvidence
  ):
    Readonly<TaxGuardProductionVerificationEvidence> {

    requireReadinessText(
      record.evidenceId,
      'TG_PRODUCTION_EVIDENCE_ID_REQUIRED'
    );

    requireReadinessText(
      record.checkId,
      'TG_PRODUCTION_EVIDENCE_CHECK_ID_REQUIRED'
    );

    requireReadinessText(
      record.source,
      'TG_PRODUCTION_EVIDENCE_SOURCE_REQUIRED'
    );

    requireReadinessText(
      record.description,
      'TG_PRODUCTION_EVIDENCE_DESCRIPTION_REQUIRED'
    );

    requireReadinessText(
      record.verifiedBy,
      'TG_PRODUCTION_EVIDENCE_VERIFIER_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          record.capturedAt
        )
      )
    ) {
      throw new Error(
        'TG_PRODUCTION_EVIDENCE_TIMESTAMP_INVALID'
      );
    }

    if (
      record.immutable !== true
    ) {
      throw new Error(
        'TG_PRODUCTION_EVIDENCE_MUST_BE_IMMUTABLE'
      );
    }

    if (
      this.evidence.has(
        record.evidenceId
      )
    ) {
      throw new Error(
        'TG_PRODUCTION_EVIDENCE_DUPLICATE'
      );
    }

    const stored =
      Object.freeze({
        ...record
      });

    this.evidence.set(
      record.evidenceId,
      stored
    );

    return stored;
  }

  get(
    evidenceId: string
  ):
    Readonly<TaxGuardProductionVerificationEvidence> |
    undefined {

    return this.evidence.get(
      evidenceId
    );
  }

  list():
    readonly Readonly<TaxGuardProductionVerificationEvidence>[] {

    return Object.freeze(
      [
        ...this.evidence.values()
      ]
    );
  }
}
