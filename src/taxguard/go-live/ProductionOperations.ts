export type TaxGuardProductionDependency =
  | 'FRONTEND'
  | 'API'
  | 'AUTHENTICATION'
  | 'FIREBASE'
  | 'DATABASE'
  | 'DOCUMENT_INTELLIGENCE'
  | 'MONITORING'
  | 'BACKUP';

export type TaxGuardProductionDependencyStatus =
  | 'UNKNOWN'
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'BLOCKED';

export interface TaxGuardProductionDependencyHealth {
  dependency:
    TaxGuardProductionDependency;

  status:
    TaxGuardProductionDependencyStatus;

  checkedAt:
    string;

  latencyMs?:
    number;

  evidence:
    readonly string[];
}

export interface TaxGuardProductionHealthSummary {
  healthy:
    boolean;

  degraded:
    boolean;

  unavailable:
    readonly TaxGuardProductionDependency[];

  blocked:
    readonly TaxGuardProductionDependency[];
}

function requireOperationsText(
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

export class TaxGuardProductionHealthMonitor {

  static summarize(
    checks:
      readonly TaxGuardProductionDependencyHealth[]
  ):
    Readonly<TaxGuardProductionHealthSummary> {

    const unavailable:
      TaxGuardProductionDependency[] = [];

    const blocked:
      TaxGuardProductionDependency[] = [];

    let degraded =
      false;

    for (
      const check
      of checks
    ) {
      if (
        !Number.isFinite(
          Date.parse(
            check.checkedAt
          )
        )
      ) {
        throw new Error(
          'TG_PRODUCTION_HEALTH_TIMESTAMP_INVALID'
        );
      }

      if (
        check.latencyMs !== undefined &&
        (
          !Number.isFinite(
            check.latencyMs
          ) ||
          check.latencyMs < 0
        )
      ) {
        throw new Error(
          'TG_PRODUCTION_HEALTH_LATENCY_INVALID'
        );
      }

      if (
        check.status === 'DEGRADED'
      ) {
        degraded =
          true;
      }

      if (
        check.status === 'UNAVAILABLE'
      ) {
        unavailable.push(
          check.dependency
        );
      }

      if (
        check.status === 'BLOCKED' ||
        check.status === 'UNKNOWN'
      ) {
        blocked.push(
          check.dependency
        );
      }
    }

    return Object.freeze({
      healthy:
        unavailable.length === 0 &&
        blocked.length === 0 &&
        !degraded,

      degraded,

      unavailable:
        Object.freeze([
          ...unavailable
        ]),

      blocked:
        Object.freeze([
          ...blocked
        ])
    });
  }
}

export type TaxGuardProductionIncidentSeverity =
  | 'INFO'
  | 'WARNING'
  | 'MATERIAL'
  | 'CRITICAL';

export type TaxGuardProductionIncidentStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'MITIGATING'
  | 'RESOLVED';

export interface TaxGuardProductionIncident {
  incidentId: string;

  severity:
    TaxGuardProductionIncidentSeverity;

  status:
    TaxGuardProductionIncidentStatus;

  component:
    TaxGuardProductionDependency;

  summary: string;

  detectedAt: string;

  acknowledgedBy?:
    string;

  resolvedAt?:
    string;

  evidence:
    readonly string[];
}

export class TaxGuardProductionIncidentRegistry {

  private readonly incidents =
    new Map<
      string,
      Readonly<TaxGuardProductionIncident>
    >();

  register(
    incident:
      TaxGuardProductionIncident
  ):
    Readonly<TaxGuardProductionIncident> {

    requireOperationsText(
      incident.incidentId,
      'TG_PRODUCTION_INCIDENT_ID_REQUIRED'
    );

    requireOperationsText(
      incident.summary,
      'TG_PRODUCTION_INCIDENT_SUMMARY_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          incident.detectedAt
        )
      )
    ) {
      throw new Error(
        'TG_PRODUCTION_INCIDENT_TIMESTAMP_INVALID'
      );
    }

    if (
      incident.resolvedAt &&
      !Number.isFinite(
        Date.parse(
          incident.resolvedAt
        )
      )
    ) {
      throw new Error(
        'TG_PRODUCTION_INCIDENT_RESOLVED_TIMESTAMP_INVALID'
      );
    }

    if (
      incident.status === 'RESOLVED' &&
      !incident.resolvedAt
    ) {
      throw new Error(
        'TG_PRODUCTION_INCIDENT_RESOLUTION_REQUIRED'
      );
    }

    if (
      this.incidents.has(
        incident.incidentId
      )
    ) {
      throw new Error(
        'TG_PRODUCTION_INCIDENT_DUPLICATE'
      );
    }

    const stored =
      Object.freeze({
        ...incident,

        evidence:
          Object.freeze([
            ...incident.evidence
          ])
      });

    this.incidents.set(
      incident.incidentId,
      stored
    );

    return stored;
  }

  get(
    incidentId: string
  ):
    Readonly<TaxGuardProductionIncident> |
    undefined {

    return this.incidents.get(
      incidentId
    );
  }

  listOpen():
    readonly Readonly<TaxGuardProductionIncident>[] {

    return Object.freeze(
      [
        ...this.incidents
          .values()
      ].filter(
        incident =>
          incident.status !==
            'RESOLVED'
      )
    );
  }

  hasCriticalOpenIncident():
    boolean {

    return this.listOpen()
      .some(
        incident =>
          incident.severity ===
            'CRITICAL'
      );
  }
}

export interface TaxGuardBackupVerification {
  verificationId: string;
  backupCreated: boolean;
  backupEncrypted: boolean;
  backupIntegrityVerified: boolean;
  restoreTestPerformed: boolean;
  restoreTestPassed: boolean;
  tenantIsolationPreserved: boolean;
  verifiedAt: string;
  verifiedBy: string;
}

export interface TaxGuardBackupDecision {
  productionReady: boolean;
  blockers: readonly string[];
}

export class TaxGuardBackupRecoveryGate {

  static evaluate(
    verification:
      TaxGuardBackupVerification
  ):
    Readonly<TaxGuardBackupDecision> {

    requireOperationsText(
      verification.verificationId,
      'TG_BACKUP_VERIFICATION_ID_REQUIRED'
    );

    requireOperationsText(
      verification.verifiedBy,
      'TG_BACKUP_VERIFIER_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          verification.verifiedAt
        )
      )
    ) {
      throw new Error(
        'TG_BACKUP_VERIFICATION_TIMESTAMP_INVALID'
      );
    }

    const blockers:
      string[] = [];

    if (
      !verification.backupCreated
    ) {
      blockers.push(
        'BACKUP_NOT_CREATED'
      );
    }

    if (
      !verification.backupEncrypted
    ) {
      blockers.push(
        'BACKUP_NOT_ENCRYPTED'
      );
    }

    if (
      !verification.backupIntegrityVerified
    ) {
      blockers.push(
        'BACKUP_INTEGRITY_NOT_VERIFIED'
      );
    }

    if (
      !verification.restoreTestPerformed
    ) {
      blockers.push(
        'RESTORE_TEST_NOT_PERFORMED'
      );
    }

    if (
      !verification.restoreTestPassed
    ) {
      blockers.push(
        'RESTORE_TEST_NOT_PASSED'
      );
    }

    if (
      !verification.tenantIsolationPreserved
    ) {
      blockers.push(
        'RESTORE_TENANT_ISOLATION_NOT_VERIFIED'
      );
    }

    return Object.freeze({
      productionReady:
        blockers.length === 0,

      blockers:
        Object.freeze([
          ...blockers
        ])
    });
  }
}

export interface TaxGuardOperationalAlert {
  alertId: string;

  severity:
    TaxGuardProductionIncidentSeverity;

  source:
    TaxGuardProductionDependency;

  message:
    string;

  createdAt:
    string;

  requiresHumanResponse:
    boolean;
}

export class TaxGuardOperationalAlertGuard {

  static validate(
    alert:
      TaxGuardOperationalAlert
  ):
    Readonly<TaxGuardOperationalAlert> {

    requireOperationsText(
      alert.alertId,
      'TG_OPERATIONAL_ALERT_ID_REQUIRED'
    );

    requireOperationsText(
      alert.message,
      'TG_OPERATIONAL_ALERT_MESSAGE_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          alert.createdAt
        )
      )
    ) {
      throw new Error(
        'TG_OPERATIONAL_ALERT_TIMESTAMP_INVALID'
      );
    }

    if (
      (
        alert.severity === 'MATERIAL' ||
        alert.severity === 'CRITICAL'
      ) &&
      !alert.requiresHumanResponse
    ) {
      throw new Error(
        'TG_OPERATIONAL_ALERT_HUMAN_RESPONSE_REQUIRED'
      );
    }

    return Object.freeze({
      ...alert
    });
  }
}

export interface TaxGuardProductionReleaseSnapshot {
  snapshotId: string;
  releaseVersion: string;
  commitId: string;
  createdAt: string;

  regressionPassed:
    boolean;

  buildPassed:
    boolean;

  typecheckPassed:
    boolean;

  productionEndpointVerified:
    boolean;

  authenticationVerified:
    boolean;

  databaseVerified:
    boolean;

  documentIntelligenceVerified:
    boolean;

  monitoringVerified:
    boolean;

  backupRestoreVerified:
    boolean;

  criticalIncidentsOpen:
    number;

  externalTaxFilingEnabled:
    false;
}

export interface TaxGuardProductionReleaseDecision {
  releasable: boolean;
  blockers: readonly string[];
}

export class TaxGuardProductionReleaseGate {

  static evaluate(
    snapshot:
      TaxGuardProductionReleaseSnapshot
  ):
    Readonly<TaxGuardProductionReleaseDecision> {

    requireOperationsText(
      snapshot.snapshotId,
      'TG_RELEASE_SNAPSHOT_ID_REQUIRED'
    );

    requireOperationsText(
      snapshot.releaseVersion,
      'TG_RELEASE_VERSION_REQUIRED'
    );

    requireOperationsText(
      snapshot.commitId,
      'TG_RELEASE_COMMIT_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          snapshot.createdAt
        )
      )
    ) {
      throw new Error(
        'TG_RELEASE_TIMESTAMP_INVALID'
      );
    }

    if (
      !Number.isInteger(
        snapshot.criticalIncidentsOpen
      ) ||
      snapshot.criticalIncidentsOpen < 0
    ) {
      throw new Error(
        'TG_RELEASE_INCIDENT_COUNT_INVALID'
      );
    }

    const blockers:
      string[] = [];

    const checks:
      readonly [
        keyof TaxGuardProductionReleaseSnapshot,
        string
      ][] = [
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
        ],
        [
          'productionEndpointVerified',
          'PRODUCTION_ENDPOINT_NOT_VERIFIED'
        ],
        [
          'authenticationVerified',
          'PRODUCTION_AUTH_NOT_VERIFIED'
        ],
        [
          'databaseVerified',
          'PRODUCTION_DATABASE_NOT_VERIFIED'
        ],
        [
          'documentIntelligenceVerified',
          'DOCUMENT_INTELLIGENCE_NOT_VERIFIED'
        ],
        [
          'monitoringVerified',
          'MONITORING_NOT_VERIFIED'
        ],
        [
          'backupRestoreVerified',
          'BACKUP_RESTORE_NOT_VERIFIED'
        ]
      ];

    for (
      const [
        key,
        reason
      ]
      of checks
    ) {
      if (
        snapshot[key] !== true
      ) {
        blockers.push(
          reason
        );
      }
    }

    if (
      snapshot.criticalIncidentsOpen > 0
    ) {
      blockers.push(
        'CRITICAL_PRODUCTION_INCIDENT_OPEN'
      );
    }

    if (
      snapshot.externalTaxFilingEnabled
    ) {
      blockers.push(
        'EXTERNAL_TAX_FILING_MUST_REMAIN_DISABLED'
      );
    }

    return Object.freeze({
      releasable:
        blockers.length === 0,

      blockers:
        Object.freeze([
          ...blockers
        ])
    });
  }
}
