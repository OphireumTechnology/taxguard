export type TaxGuardProductionHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNHEALTHY';

export type TaxGuardDependencyName =
  | 'DATABASE'
  | 'AUTH'
  | 'DOCUMENT_INTELLIGENCE'
  | 'AUDIT_LEDGER';

export interface TaxGuardDependencyHealth {
  dependency:
    TaxGuardDependencyName;

  healthy:
    boolean;

  checkedAt:
    string;

  latencyMs?:
    number;

  reason?:
    string;
}

export interface TaxGuardReadinessResult {
  status:
    TaxGuardProductionHealthStatus;

  dependencies:
    readonly TaxGuardDependencyHealth[];

  ready:
    boolean;

  checkedAt:
    string;
}

function requireText(
  value: string,
  code: string
): string {

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(code);
  }

  return normalized;
}

export class TaxGuardProductionReadinessGate {

  static evaluate(
    dependencies:
      readonly TaxGuardDependencyHealth[]
  ):
    TaxGuardReadinessResult {

    if (
      dependencies.length === 0
    ) {
      throw new Error(
        'TG_PROD_HEALTH_DEPENDENCIES_REQUIRED'
      );
    }

    const required:
      readonly TaxGuardDependencyName[] = [
        'DATABASE',
        'AUTH',
        'AUDIT_LEDGER'
      ];

    for (
      const dependency
      of required
    ) {
      if (
        !dependencies.some(
          candidate =>
            candidate.dependency ===
              dependency
        )
      ) {
        throw new Error(
          'TG_PROD_HEALTH_REQUIRED_DEPENDENCY_MISSING:' +
          dependency
        );
      }
    }

    const unhealthy =
      dependencies.filter(
        dependency =>
          !dependency.healthy
      );

    const criticalUnhealthy =
      unhealthy.some(
        dependency =>
          required.includes(
            dependency.dependency
          )
      );

    const status:
      TaxGuardProductionHealthStatus =
        criticalUnhealthy
          ? 'UNHEALTHY'
          : unhealthy.length > 0
            ? 'DEGRADED'
            : 'HEALTHY';

    return {
      status,

      dependencies:
        dependencies.map(
          dependency => ({
            ...dependency
          })
        ),

      ready:
        status ===
          'HEALTHY',

      checkedAt:
        new Date()
          .toISOString()
    };
  }

  static assertReady(
    result:
      TaxGuardReadinessResult
  ): true {

    if (!result.ready) {
      throw new Error(
        'TG_PROD_NOT_READY:' +
        result.status
      );
    }

    return true;
  }
}

export interface TaxGuardRateLimitPolicy {
  policyId: string;

  windowSeconds: number;

  maximumRequests: number;

  blockSeconds: number;
}

export interface TaxGuardRateLimitObservation {
  principalKey: string;

  requestCount: number;

  windowStartedAt: string;
}

export class TaxGuardRateLimitGuard {

  static validatePolicy(
    policy:
      TaxGuardRateLimitPolicy
  ):
    TaxGuardRateLimitPolicy {

    requireText(
      policy.policyId,
      'TG_RATE_LIMIT_POLICY_ID_REQUIRED'
    );

    if (
      !Number.isInteger(
        policy.windowSeconds
      ) ||
      policy.windowSeconds <= 0
    ) {
      throw new Error(
        'TG_RATE_LIMIT_WINDOW_INVALID'
      );
    }

    if (
      !Number.isInteger(
        policy.maximumRequests
      ) ||
      policy.maximumRequests <= 0
    ) {
      throw new Error(
        'TG_RATE_LIMIT_MAX_REQUESTS_INVALID'
      );
    }

    if (
      !Number.isInteger(
        policy.blockSeconds
      ) ||
      policy.blockSeconds < 0
    ) {
      throw new Error(
        'TG_RATE_LIMIT_BLOCK_INVALID'
      );
    }

    return Object.freeze({
      ...policy
    });
  }

  static assertAllowed(
    policy:
      TaxGuardRateLimitPolicy,

    observation:
      TaxGuardRateLimitObservation
  ): true {

    requireText(
      observation.principalKey,
      'TG_RATE_LIMIT_PRINCIPAL_REQUIRED'
    );

    if (
      observation.requestCount >
        policy.maximumRequests
    ) {
      throw new Error(
        'TG_RATE_LIMIT_EXCEEDED'
      );
    }

    return true;
  }
}

export interface TaxGuardSecurityHeaderPolicy {
  contentTypeOptions:
    'nosniff';

  frameOptions:
    'DENY';

  referrerPolicy:
    'no-referrer';

  permissionsPolicy:
    string;

  strictTransportSecurity:
    string;

  contentSecurityPolicy:
    string;
}

export class TaxGuardSecurityHeaders {

  static production():
    TaxGuardSecurityHeaderPolicy {

    return Object.freeze({
      contentTypeOptions:
        'nosniff',

      frameOptions:
        'DENY',

      referrerPolicy:
        'no-referrer',

      permissionsPolicy:
        'camera=(), microphone=(), geolocation=()',

      strictTransportSecurity:
        'max-age=31536000; includeSubDomains',

      contentSecurityPolicy:
        "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    });
  }
}

export interface TaxGuardAuditIntegrityRecord {
  auditId: string;

  eventType: string;

  actorId: string;

  tenantId: string;

  correlationId: string;

  occurredAt: string;

  previousHash:
    string | null;

  payloadHash: string;

  recordHash: string;

  immutable: true;
}

export class TaxGuardAuditIntegrityGuard {

  static validate(
    record:
      TaxGuardAuditIntegrityRecord
  ): true {

    requireText(
      record.auditId,
      'TG_AUDIT_ID_REQUIRED'
    );

    requireText(
      record.eventType,
      'TG_AUDIT_EVENT_TYPE_REQUIRED'
    );

    requireText(
      record.actorId,
      'TG_AUDIT_ACTOR_REQUIRED'
    );

    requireText(
      record.tenantId,
      'TG_AUDIT_TENANT_REQUIRED'
    );

    requireText(
      record.correlationId,
      'TG_AUDIT_CORRELATION_REQUIRED'
    );

    if (
      !/^[a-f0-9]{64}$/i.test(
        record.payloadHash
      )
    ) {
      throw new Error(
        'TG_AUDIT_PAYLOAD_HASH_INVALID'
      );
    }

    if (
      !/^[a-f0-9]{64}$/i.test(
        record.recordHash
      )
    ) {
      throw new Error(
        'TG_AUDIT_RECORD_HASH_INVALID'
      );
    }

    if (
      record.previousHash !==
        null &&
      !/^[a-f0-9]{64}$/i.test(
        record.previousHash
      )
    ) {
      throw new Error(
        'TG_AUDIT_PREVIOUS_HASH_INVALID'
      );
    }

    if (
      !Number.isFinite(
        Date.parse(
          record.occurredAt
        )
      )
    ) {
      throw new Error(
        'TG_AUDIT_TIMESTAMP_INVALID'
      );
    }

    return true;
  }

  static mutateRecord():
    never {

    throw new Error(
      'TG_AUDIT_MUTATION_BLOCKED'
    );
  }

  static deleteRecord():
    never {

    throw new Error(
      'TG_AUDIT_DELETION_BLOCKED'
    );
  }
}

export interface TaxGuardBackupPolicy {
  policyId: string;

  encrypted:
    true;

  retentionDays:
    number;

  recoveryPointObjectiveMinutes:
    number;

  recoveryTimeObjectiveMinutes:
    number;

  restoreTestRequired:
    true;
}

export class TaxGuardBackupRecoveryGuard {

  static validatePolicy(
    policy:
      TaxGuardBackupPolicy
  ):
    TaxGuardBackupPolicy {

    requireText(
      policy.policyId,
      'TG_BACKUP_POLICY_ID_REQUIRED'
    );

    if (
      !policy.encrypted
    ) {
      throw new Error(
        'TG_BACKUP_ENCRYPTION_REQUIRED'
      );
    }

    if (
      !Number.isInteger(
        policy.retentionDays
      ) ||
      policy.retentionDays <= 0
    ) {
      throw new Error(
        'TG_BACKUP_RETENTION_INVALID'
      );
    }

    if (
      !Number.isInteger(
        policy.recoveryPointObjectiveMinutes
      ) ||
      policy.recoveryPointObjectiveMinutes <= 0
    ) {
      throw new Error(
        'TG_BACKUP_RPO_INVALID'
      );
    }

    if (
      !Number.isInteger(
        policy.recoveryTimeObjectiveMinutes
      ) ||
      policy.recoveryTimeObjectiveMinutes <= 0
    ) {
      throw new Error(
        'TG_BACKUP_RTO_INVALID'
      );
    }

    if (
      !policy.restoreTestRequired
    ) {
      throw new Error(
        'TG_BACKUP_RESTORE_TEST_REQUIRED'
      );
    }

    return Object.freeze({
      ...policy
    });
  }
}

export interface TaxGuardFailureEvent {
  failureId: string;

  component: string;

  severity:
    'ROUTINE' |
    'MATERIAL' |
    'CRITICAL';

  correlationId: string;

  detectedAt: string;

  failClosed:
    boolean;
}

export class TaxGuardBusinessContinuityGuard {

  static assertFailureSafe(
    event:
      TaxGuardFailureEvent
  ): true {

    requireText(
      event.failureId,
      'TG_BCP_FAILURE_ID_REQUIRED'
    );

    requireText(
      event.component,
      'TG_BCP_COMPONENT_REQUIRED'
    );

    requireText(
      event.correlationId,
      'TG_BCP_CORRELATION_REQUIRED'
    );

    if (
      event.severity ===
        'CRITICAL' &&
      !event.failClosed
    ) {
      throw new Error(
        'TG_BCP_CRITICAL_FAILURE_MUST_FAIL_CLOSED'
      );
    }

    return true;
  }
}
