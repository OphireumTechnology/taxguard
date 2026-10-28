import type {
  TaxGuardProductionEnvironmentRecord,
  TaxGuardSecretValidationResult
} from './TaxGuardProductionEnvironment';

import type {
  TaxGuardReadinessResult
} from './TaxGuardProductionOperations';

export interface TaxGuardProductionDatabaseState {
  connected: boolean;

  tenantIsolationEnabled:
    boolean;

  encryptedInTransit:
    boolean;

  backupConfigured:
    boolean;

  migrationCurrent:
    boolean;
}

export interface TaxGuardDeploymentVerification {
  deploymentId: string;

  environment:
    'production';

  frontendReachable:
    boolean;

  apiReachable:
    boolean;

  authRouteReachable:
    boolean;

  healthRouteReachable:
    boolean;

  databaseReachable:
    boolean;

  corsValidated:
    boolean;

  sessionValidated:
    boolean;

  testedAt: string;
}

export interface TaxGuardProductionReleaseInput {
  environment:
    TaxGuardProductionEnvironmentRecord;

  secrets:
    TaxGuardSecretValidationResult;

  readiness:
    TaxGuardReadinessResult;

  database:
    TaxGuardProductionDatabaseState;

  deployment:
    TaxGuardDeploymentVerification;

  regressionPassed:
    boolean;

  buildPassed:
    boolean;

  typecheckPassed:
    boolean;

  securityRegressionPassed:
    boolean;

  externalTaxFilingEnabled:
    boolean;
}

export interface TaxGuardProductionReleaseDecision {
  releaseAllowed:
    boolean;

  blockers:
    readonly string[];

  evaluatedAt:
    string;

  externalTaxFilingEnabled:
    false;
}

export class TaxGuardProductionReleaseGate {

  static evaluate(
    input:
      TaxGuardProductionReleaseInput
  ):
    TaxGuardProductionReleaseDecision {

    const blockers:
      string[] = [];

    if (
      input.environment
        .environment !==
        'production' ||
      !input.environment
        .productionValidated
    ) {
      blockers.push(
        'PRODUCTION_ENVIRONMENT_NOT_VALIDATED'
      );
    }

    if (!input.secrets.valid) {
      blockers.push(
        'PRODUCTION_SECRETS_INVALID'
      );
    }

    if (!input.readiness.ready) {
      blockers.push(
        'PRODUCTION_NOT_READY'
      );
    }

    if (
      !input.database.connected
    ) {
      blockers.push(
        'DATABASE_NOT_CONNECTED'
      );
    }

    if (
      !input.database
        .tenantIsolationEnabled
    ) {
      blockers.push(
        'DATABASE_TENANT_ISOLATION_REQUIRED'
      );
    }

    if (
      !input.database
        .encryptedInTransit
    ) {
      blockers.push(
        'DATABASE_TRANSPORT_ENCRYPTION_REQUIRED'
      );
    }

    if (
      !input.database
        .backupConfigured
    ) {
      blockers.push(
        'DATABASE_BACKUP_REQUIRED'
      );
    }

    if (
      !input.database
        .migrationCurrent
    ) {
      blockers.push(
        'DATABASE_MIGRATION_NOT_CURRENT'
      );
    }

    const deploymentChecks = [
      input.deployment.frontendReachable,
      input.deployment.apiReachable,
      input.deployment.authRouteReachable,
      input.deployment.healthRouteReachable,
      input.deployment.databaseReachable,
      input.deployment.corsValidated,
      input.deployment.sessionValidated
    ];

    if (
      deploymentChecks.some(
        check => !check
      )
    ) {
      blockers.push(
        'DEPLOYMENT_VERIFICATION_FAILED'
      );
    }

    if (
      !input.regressionPassed
    ) {
      blockers.push(
        'REGRESSION_NOT_PASSED'
      );
    }

    if (
      !input.buildPassed
    ) {
      blockers.push(
        'BUILD_NOT_PASSED'
      );
    }

    if (
      !input.typecheckPassed
    ) {
      blockers.push(
        'TYPECHECK_NOT_PASSED'
      );
    }

    if (
      !input.securityRegressionPassed
    ) {
      blockers.push(
        'SECURITY_REGRESSION_NOT_PASSED'
      );
    }

    if (
      input.externalTaxFilingEnabled
    ) {
      blockers.push(
        'EXTERNAL_TAX_FILING_MUST_REMAIN_DISABLED'
      );
    }

    return Object.freeze({
      releaseAllowed:
        blockers.length === 0,

      blockers: [
        ...blockers
      ],

      evaluatedAt:
        new Date()
          .toISOString(),

      externalTaxFilingEnabled:
        false
    });
  }

  static assertReleaseAllowed(
    decision:
      TaxGuardProductionReleaseDecision
  ): true {

    if (
      !decision.releaseAllowed
    ) {
      throw new Error(
        'TG_PROD_RELEASE_BLOCKED:' +
        decision.blockers.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardProductionDeploymentBoundary {

  static deployWithoutRegression():
    never {

    throw new Error(
      'TG_PROD_DEPLOY_WITHOUT_REGRESSION_BLOCKED'
    );
  }

  static deployWithoutBackup():
    never {

    throw new Error(
      'TG_PROD_DEPLOY_WITHOUT_BACKUP_BLOCKED'
    );
  }

  static deployWithBrokenAuthentication():
    never {

    throw new Error(
      'TG_PROD_DEPLOY_WITH_BROKEN_AUTH_BLOCKED'
    );
  }

  static enableExternalTaxFiling():
    never {

    throw new Error(
      'TG_EXTERNAL_TAX_FILING_DISABLED'
    );
  }
}
