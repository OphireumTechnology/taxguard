import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardProductionEnvironmentValidator,
  TaxGuardProductionSecretGuard,
  TaxGuardAuthenticationGuard,
  TaxGuardRoleAuthorizationGuard,
  TaxGuardTenantIsolationGuard,
  TaxGuardProductionSessionPolicy,
  TaxGuardCorsGuard,
  TaxGuardApiRouteRegistry,
  TaxGuardApiRequestGuard,
  TaxGuardFrontendApiBindingValidator,
  TaxGuardProductionRoutingBoundary,
  TaxGuardProductionReadinessGate,
  TaxGuardRateLimitGuard,
  TaxGuardSecurityHeaders,
  TaxGuardAuditIntegrityGuard,
  TaxGuardBackupRecoveryGuard,
  TaxGuardBusinessContinuityGuard,
  TaxGuardProductionReleaseGate,
  TaxGuardDeploymentCheckGuard,
  TaxGuardDeploymentReportBuilder,
  TaxGuardAuthenticationRouteGuard,
  TaxGuardHttp405Guard,
  TaxGuardRuntimeRoutingGuard,
  TaxGuardOperationalEventGuard,
  TaxGuardOperationalAlertEngine,
  TaxGuardProductionMetricGuard,
  TaxGuardProductionLoggingBoundary
} from '../taxguard/production';

describe(
  'TaxGuard M15 Production Hardening',
  () => {

    it(
      'M15.1 validates a production environment',
      () => {

        const result =
          TaxGuardProductionEnvironmentValidator
            .validate({
              environment:
                'production',

              frontendOrigin:
                'https://artaxserv.com',

              apiBaseUrl:
                'https://api.artaxserv.com',

              firebaseProjectId:
                'taxguard2026',

              firestoreDatabaseId:
                '(default)',

              sessionCookieName:
                'taxguard_session',

              trustProxy:
                true,

              externalTaxFilingEnabled:
                false
            });

        expect(
          result.productionValidated
        ).toBe(true);

        expect(
          result.immutable
        ).toBe(true);
      }
    );

    it(
      'M15.2 blocks production without HTTPS',
      () => {

        expect(
          () =>
            TaxGuardProductionEnvironmentValidator
              .validate({
                environment:
                  'production',

                frontendOrigin:
                  'http://artaxserv.com',

                apiBaseUrl:
                  'https://api.artaxserv.com',

                firebaseProjectId:
                  'taxguard2026',

                firestoreDatabaseId:
                  '(default)',

                sessionCookieName:
                  'taxguard_session',

                trustProxy:
                  true,

                externalTaxFilingEnabled:
                  false
              })
        ).toThrow(
          'TG_PROD_FRONTEND_HTTPS_REQUIRED'
        );
      }
    );

    it(
      'M15.3 detects missing production secrets without exposing values',
      () => {

        const result =
          TaxGuardProductionSecretGuard
            .validate(
              'production',
              {
                GOOGLE_APPLICATION_CREDENTIALS:
                  'configured',

                FIREBASE_FIRESTORE_DATABASE_ID:
                  '(default)'
              }
            );

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.missingSecretNames
        ).toContain(
          'SESSION_SECRET'
        );

        expect(
          result.secretValuesExposed
        ).toBe(false);
      }
    );

    it(
      'M15.4 validates authenticated sessions',
      () => {

        expect(
          TaxGuardAuthenticationGuard
            .validatePrincipal({
              userId:
                'user-001',

              clientId:
                'client-001',

              tenantId:
                'tenant-001',

              roles: [
                'CLIENT'
              ],

              authenticated:
                true,

              sessionId:
                'session-001',

              issuedAt:
                '2026-09-24T00:00:00.000Z',

              expiresAt:
                '2099-09-24T00:00:00.000Z'
            })
        ).toBe(true);
      }
    );

    it(
      'M15.5 enforces role authorization',
      () => {

        const principal = {
          userId:
            'reviewer-001',

          tenantId:
            'tenant-001',

          roles: [
            'REVIEWER'
          ] as const,

          authenticated:
            true as const,

          sessionId:
            'session-002',

          issuedAt:
            '2026-09-24T00:00:00.000Z',

          expiresAt:
            '2099-09-24T00:00:00.000Z'
        };

        expect(
          TaxGuardRoleAuthorizationGuard
            .requireAnyRole(
              principal,
              [
                'REVIEWER',
                'CPA',
                'EA'
              ]
            )
        ).toBe(true);

        expect(
          () =>
            TaxGuardRoleAuthorizationGuard
              .requireAnyRole(
                principal,
                [
                  'ADMIN'
                ]
              )
        ).toThrow(
          'TG_AUTH_ROLE_FORBIDDEN'
        );
      }
    );

    it(
      'M15.6 blocks cross-tenant and cross-client access',
      () => {

        const principal = {
          userId:
            'user-001',

          clientId:
            'client-001',

          tenantId:
            'tenant-001',

          roles: [
            'CLIENT'
          ] as const,

          authenticated:
            true as const,

          sessionId:
            'session-003',

          issuedAt:
            '2026-09-24T00:00:00.000Z',

          expiresAt:
            '2099-09-24T00:00:00.000Z'
        };

        expect(
          () =>
            TaxGuardTenantIsolationGuard
              .assertAccess(
                principal,
                {
                  tenantId:
                    'tenant-002',

                  clientId:
                    'client-001'
                }
              )
        ).toThrow(
          'TG_TENANT_CROSS_TENANT_ACCESS_BLOCKED'
        );

        expect(
          () =>
            TaxGuardTenantIsolationGuard
              .assertAccess(
                principal,
                {
                  tenantId:
                    'tenant-001',

                  clientId:
                    'client-999'
                }
              )
        ).toThrow(
          'TG_TENANT_CROSS_CLIENT_ACCESS_BLOCKED'
        );
      }
    );

    it(
      'M15.7 creates hardened production session cookie policy',
      () => {

        const policy =
          TaxGuardProductionSessionPolicy
            .create(
              3600
            );

        expect(
          policy.httpOnly
        ).toBe(true);

        expect(
          policy.secure
        ).toBe(true);

        expect(
          policy.path
        ).toBe('/');
      }
    );

    it(
      'M15.8 enforces explicit CORS origins',
      () => {

        const policy =
          TaxGuardCorsGuard
            .createPolicy([
              'https://artaxserv.com'
            ]);

        expect(
          TaxGuardCorsGuard
            .assertOrigin(
              policy,
              'https://artaxserv.com'
            )
        ).toBe(true);

        expect(
          () =>
            TaxGuardCorsGuard
              .assertOrigin(
                policy,
                'https://attacker.example'
              )
        ).toThrow(
          'TG_API_ORIGIN_FORBIDDEN'
        );
      }
    );

    it(
      'M15.9 validates protected production API routes',
      () => {

        const registry =
          new TaxGuardApiRouteRegistry();

        const route =
          registry.register({
            routeId:
              'firebase-session',

            method:
              'POST',

            path:
              '/api/auth/firebase-session',

            authenticationRequired:
              false,

            csrfProtected:
              true,

            productionEnabled:
              true
          });

        expect(
          TaxGuardApiRequestGuard
            .assertAllowed(
              route,
              {
                method:
                  'POST',

                path:
                  '/api/auth/firebase-session',

                authenticated:
                  false,

                csrfValid:
                  true
              }
            )
        ).toBe(true);

        expect(
          () =>
            TaxGuardApiRequestGuard
              .assertAllowed(
                route,
                {
                  method:
                    'GET',

                  path:
                    '/api/auth/firebase-session',

                  authenticated:
                    false,

                  csrfValid:
                    true
                }
              )
        ).toThrow(
          'TG_API_METHOD_NOT_ALLOWED'
        );
      }
    );

    it(
      'M15.10 validates frontend to API production binding',
      () => {

        const binding =
          TaxGuardFrontendApiBindingValidator
            .validate({
              frontendOrigin:
                'https://artaxserv.com',

              apiBaseUrl:
                'https://api.artaxserv.com',

              authSessionPath:
                '/api/auth/firebase-session',

              healthPath:
                '/health',

              productionReady:
                true
            });

        expect(
          binding.apiBaseUrl
        ).toBe(
          'https://api.artaxserv.com'
        );
      }
    );

    it(
      'M15.11 blocks static hosting from pretending to be the API backend',
      () => {

        expect(
          () =>
            TaxGuardProductionRoutingBoundary
              .staticHostingAsApiBackend()
        ).toThrow(
          'TG_API_STATIC_HOSTING_BACKEND_BLOCKED'
        );
      }
    );

    it(
      'M15.12 requires critical dependencies before production readiness',
      () => {

        const readiness =
          TaxGuardProductionReadinessGate
            .evaluate([
              {
                dependency:
                  'DATABASE',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                dependency:
                  'AUTH',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                dependency:
                  'AUDIT_LEDGER',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                dependency:
                  'DOCUMENT_INTELLIGENCE',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              }
            ]);

        expect(
          readiness.ready
        ).toBe(true);

        expect(
          readiness.status
        ).toBe(
          'HEALTHY'
        );
      }
    );

    it(
      'M15.13 blocks requests exceeding configured rate limits',
      () => {

        const policy =
          TaxGuardRateLimitGuard
            .validatePolicy({
              policyId:
                'auth-login',

              windowSeconds:
                60,

              maximumRequests:
                10,

              blockSeconds:
                300
            });

        expect(
          () =>
            TaxGuardRateLimitGuard
              .assertAllowed(
                policy,
                {
                  principalKey:
                    'ip-hash-001',

                  requestCount:
                    11,

                  windowStartedAt:
                    '2026-09-24T00:00:00.000Z'
                }
              )
        ).toThrow(
          'TG_RATE_LIMIT_EXCEEDED'
        );
      }
    );

    it(
      'M15.14 creates hardened production security headers',
      () => {

        const headers =
          TaxGuardSecurityHeaders
            .production();

        expect(
          headers.contentTypeOptions
        ).toBe(
          'nosniff'
        );

        expect(
          headers.frameOptions
        ).toBe(
          'DENY'
        );

        expect(
          headers.strictTransportSecurity
        ).toContain(
          'max-age='
        );
      }
    );

    it(
      'M15.15 validates immutable audit integrity records',
      () => {

        const hash =
          'a'.repeat(64);

        expect(
          TaxGuardAuditIntegrityGuard
            .validate({
              auditId:
                'audit-001',

              eventType:
                'PRODUCTION_TEST',

              actorId:
                'reviewer-001',

              tenantId:
                'tenant-001',

              correlationId:
                'corr-001',

              occurredAt:
                '2026-09-24T00:00:00.000Z',

              previousHash:
                null,

              payloadHash:
                hash,

              recordHash:
                hash,

              immutable:
                true
            })
        ).toBe(true);

        expect(
          () =>
            TaxGuardAuditIntegrityGuard
              .mutateRecord()
        ).toThrow(
          'TG_AUDIT_MUTATION_BLOCKED'
        );
      }
    );

    it(
      'M15.16 requires encrypted backup and restore-test policy',
      () => {

        const policy =
          TaxGuardBackupRecoveryGuard
            .validatePolicy({
              policyId:
                'production-primary',

              encrypted:
                true,

              retentionDays:
                30,

              recoveryPointObjectiveMinutes:
                60,

              recoveryTimeObjectiveMinutes:
                240,

              restoreTestRequired:
                true
            });

        expect(
          policy.encrypted
        ).toBe(true);

        expect(
          policy.restoreTestRequired
        ).toBe(true);
      }
    );

    it(
      'M15.17 requires critical failures to fail closed',
      () => {

        expect(
          () =>
            TaxGuardBusinessContinuityGuard
              .assertFailureSafe({
                failureId:
                  'failure-001',

                component:
                  'AUTH',

                severity:
                  'CRITICAL',

                correlationId:
                  'corr-002',

                detectedAt:
                  '2026-09-24T00:00:00.000Z',

                failClosed:
                  false
              })
        ).toThrow(
          'TG_BCP_CRITICAL_FAILURE_MUST_FAIL_CLOSED'
        );
      }
    );

    it(
      'M15.18 blocks release when deployment verification fails',
      () => {

        const environment =
          TaxGuardProductionEnvironmentValidator
            .validate({
              environment:
                'production',

              frontendOrigin:
                'https://artaxserv.com',

              apiBaseUrl:
                'https://api.artaxserv.com',

              firebaseProjectId:
                'taxguard2026',

              firestoreDatabaseId:
                '(default)',

              sessionCookieName:
                'taxguard_session',

              trustProxy:
                true,

              externalTaxFilingEnabled:
                false
            });

        const secrets =
          TaxGuardProductionSecretGuard
            .validate(
              'production',
              {
                GOOGLE_APPLICATION_CREDENTIALS:
                  'configured',

                FIREBASE_FIRESTORE_DATABASE_ID:
                  '(default)',

                SESSION_SECRET:
                  'configured'
              }
            );

        const readiness =
          TaxGuardProductionReadinessGate
            .evaluate([
              {
                dependency:
                  'DATABASE',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                dependency:
                  'AUTH',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                dependency:
                  'AUDIT_LEDGER',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              }
            ]);

        const decision =
          TaxGuardProductionReleaseGate
            .evaluate({
              environment,

              secrets,

              readiness,

              database: {
                connected:
                  true,

                tenantIsolationEnabled:
                  true,

                encryptedInTransit:
                  true,

                backupConfigured:
                  true,

                migrationCurrent:
                  true
              },

              deployment: {
                deploymentId:
                  'deployment-001',

                environment:
                  'production',

                frontendReachable:
                  true,

                apiReachable:
                  false,

                authRouteReachable:
                  false,

                healthRouteReachable:
                  false,

                databaseReachable:
                  true,

                corsValidated:
                  false,

                sessionValidated:
                  false,

                testedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              securityRegressionPassed:
                true,

              externalTaxFilingEnabled:
                false
            });

        expect(
          decision.releaseAllowed
        ).toBe(false);

        expect(
          decision.blockers
        ).toContain(
          'DEPLOYMENT_VERIFICATION_FAILED'
        );
      }
    );

    it(
      'M15.19 validates authentication as a server API route',
      () => {

        const route =
          TaxGuardAuthenticationRouteGuard
            .validate({
              method:
                'POST',

              path:
                '/api/auth/firebase-session',

              acceptsFirebaseIdToken:
                true,

              createsServerSession:
                true,

              staticHostingRoute:
                false
            });

        expect(
          route.createsServerSession
        ).toBe(true);
      }
    );

    it(
      'M15.20 detects HTTP 405 as a production release blocker',
      () => {

        const result =
          TaxGuardHttp405Guard
            .diagnose({
              requestedMethod:
                'POST',

              requestedUrl:
                'https://artaxserv.com/api/auth/firebase-session',

              responseStatus:
                405,

              backendExpected:
                true,

              staticHostingDetected:
                true,

              routeConfigured:
                false
            });

        expect(
          result.is405
        ).toBe(true);

        expect(
          result.probableRoutingFailure
        ).toBe(true);

        expect(
          result.productionBlocked
        ).toBe(true);

        expect(
          () =>
            TaxGuardHttp405Guard
              .assertNo405(
                result
              )
        ).toThrow(
          'TG_PROD_HTTP_405_BLOCKS_RELEASE'
        );
      }
    );

    it(
      'M15.21 detects frontend and backend runtime routing mismatch',
      () => {

        expect(
          () =>
            TaxGuardRuntimeRoutingGuard
              .validate({
                method:
                  'POST',

                path:
                  '/api/auth/firebase-session',

                expectedRuntime:
                  'NODE_API',

                observedRuntime:
                  'STATIC_FRONTEND'
              })
        ).toThrow(
          'TG_RUNTIME_ROUTE_MISMATCH'
        );
      }
    );

    it(
      'M15.22 validates deployment endpoint checks',
      () => {

        const result =
          TaxGuardDeploymentCheckGuard
            .validate({
              checkId:
                'health-001',

              name:
                'Production API health',

              url:
                'https://api.artaxserv.com/health',

              expectedMethod:
                'GET',

              expectedStatusCodes: [
                200
              ],

              actualStatusCode:
                200,

              status:
                'PASS',

              checkedAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.status
        ).toBe(
          'PASS'
        );
      }
    );

    it(
      'M15.23 requires all deployment checks to pass',
      () => {

        const report =
          TaxGuardDeploymentReportBuilder
            .build(
              'deployment-002',

              {
                checkId:
                  'frontend',

                name:
                  'Frontend',

                url:
                  'https://artaxserv.com',

                expectedMethod:
                  'GET',

                expectedStatusCodes: [
                  200
                ],

                actualStatusCode:
                  200,

                status:
                  'PASS'
              },

              {
                checkId:
                  'health',

                name:
                  'API health',

                url:
                  'https://api.artaxserv.com/health',

                expectedMethod:
                  'GET',

                expectedStatusCodes: [
                  200
                ],

                actualStatusCode:
                  200,

                status:
                  'PASS'
              },

              {
                checkId:
                  'auth',

                name:
                  'Authentication',

                url:
                  'https://api.artaxserv.com/api/auth/firebase-session',

                expectedMethod:
                  'POST',

                expectedStatusCodes: [
                  200,
                  401
                ],

                actualStatusCode:
                  401,

                status:
                  'PASS'
              }
            );

        expect(
          report.allRequiredChecksPassed
        ).toBe(true);
      }
    );

    it(
      'M15.24 creates human-response alerts for production errors',
      () => {

        const event = {
          eventId:
            'event-001',

          component:
            'AUTH',

          eventType:
            'LOGIN_FAILURE_SPIKE',

          severity:
            'ERROR' as const,

          correlationId:
            'corr-003',

          occurredAt:
            '2026-09-24T00:00:00.000Z',

          containsSensitiveData:
            false as const,

          message:
            'Authentication failure threshold exceeded'
        };

        expect(
          TaxGuardOperationalEventGuard
            .validate(
              event
            ).eventId
        ).toBe(
          'event-001'
        );

        const alert =
          TaxGuardOperationalAlertEngine
            .createAlert(
              event
            );

        expect(
          alert?.requiresHumanResponse
        ).toBe(true);
      }
    );

    it(
      'M15.25 validates operational metrics',
      () => {

        const metric =
          TaxGuardProductionMetricGuard
            .validate({
              metricId:
                'metric-001',

              name:
                'api_latency',

              value:
                125,

              unit:
                'milliseconds',

              recordedAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          metric.value
        ).toBe(125);
      }
    );

    it(
      'M15.26 blocks sensitive information from production logs',
      () => {

        expect(
          () =>
            TaxGuardProductionLoggingBoundary
              .logPassword()
        ).toThrow(
          'TG_LOG_PASSWORD_BLOCKED'
        );

        expect(
          () =>
            TaxGuardProductionLoggingBoundary
              .logPrivateKey()
        ).toThrow(
          'TG_LOG_PRIVATE_KEY_BLOCKED'
        );

        expect(
          () =>
            TaxGuardProductionLoggingBoundary
              .logFullSsn()
        ).toThrow(
          'TG_LOG_FULL_SSN_BLOCKED'
        );
      }
    );

    it(
      'M15.27 keeps external tax submission disabled',
      () => {

        expect(
          () =>
            TaxGuardProductionRoutingBoundary
              .externalTaxSubmission()
        ).toThrow(
          'TG_EXTERNAL_TAX_SUBMISSION_DISABLED'
        );
      }
    );
  }
);
