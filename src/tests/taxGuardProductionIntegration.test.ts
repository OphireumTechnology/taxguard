import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardProductionEndpointGuard,
  TaxGuardProductionProbeGuard,
  TaxGuardProductionTopologyGuard,
  TaxGuardProductionRouteRegistry,
  TaxGuardProduction405Analyzer,
  TaxGuardProductionIntegrationGate
} from '../taxguard/go-live/ProductionIntegration';

import {
  TaxGuardAuthenticationAnalyzer,
  TaxGuardSessionIdentityGuard,
  TaxGuardApiRuntimeBindingGuard,
  TaxGuardProductionRouteDiagnoser
} from '../taxguard/go-live/ProductionAuthentication';

import {
  TaxGuardReadinessRegistry,
  TaxGuardGoLiveAcceptanceGate,
  TaxGuardProductionVerificationEvidenceRegistry
} from '../taxguard/go-live/ProductionReadiness';

import {
  TaxGuardProductionHealthMonitor,
  TaxGuardProductionIncidentRegistry,
  TaxGuardBackupRecoveryGate,
  TaxGuardOperationalAlertGuard,
  TaxGuardProductionReleaseGate
} from '../taxguard/go-live/ProductionOperations';


describe(
  'TaxGuard Production Integration and Go-Live',
  () => {

    it(
      'P1 validates a production API endpoint contract',
      () => {

        const endpoint =
          TaxGuardProductionEndpointGuard
            .validate({
              endpointId:
                'AUTH_SESSION',

              name:
                'Firebase Session',

              url:
                'https://api.example.com/api/auth/firebase-session',

              method:
                'POST',

              expectedRuntime:
                'NODE_API',

              expectedStatusCodes:
                [200],

              authenticationRequired:
                false
            });

        expect(
          endpoint.expectedRuntime
        ).toBe(
          'NODE_API'
        );

        expect(
          endpoint.method
        ).toBe(
          'POST'
        );
      }
    );


    it(
      'P1 rejects invalid production endpoint URL',
      () => {

        expect(
          () =>
            TaxGuardProductionEndpointGuard
              .validate({
                endpointId:
                  'BAD',

                name:
                  'Bad Endpoint',

                url:
                  'not-a-url',

                method:
                  'POST',

                expectedRuntime:
                  'NODE_API',

                expectedStatusCodes:
                  [200],

                authenticationRequired:
                  false
              })
        ).toThrow(
          'TG_GO_LIVE_ENDPOINT_URL_INVALID'
        );
      }
    );


    it(
      'P1 verifies matching API probe evidence',
      () => {

        const endpoint = {
          endpointId:
            'API_HEALTH',

          name:
            'API Health',

          url:
            'https://api.example.com/api/health',

          method:
            'GET' as const,

          expectedRuntime:
            'NODE_API' as const,

          expectedStatusCodes:
            [200],

          authenticationRequired:
            false
        };

        const result =
          TaxGuardProductionProbeGuard
            .validate(
              endpoint,
              {
                endpointId:
                  'API_HEALTH',

                url:
                  'https://api.example.com/api/health',

                method:
                  'GET',

                expectedRuntime:
                  'NODE_API',

                observedRuntime:
                  'NODE_API',

                statusCode:
                  200,

                status:
                  'PASS',

                checkedAt:
                  '2026-09-24T00:00:00.000Z',

                evidence:
                  [
                    'HTTP 200',
                    'JSON health response'
                  ]
              }
            );

        expect(
          result.status
        ).toBe(
          'PASS'
        );
      }
    );


    it(
      'P1 blocks static frontend from pretending to be Node API',
      () => {

        const registry =
          new TaxGuardProductionRouteRegistry();

        expect(
          () =>
            registry.register({
              routeId:
                'AUTH',

              method:
                'POST',

              path:
                '/api/auth/firebase-session',

              runtime:
                'NODE_API',

              authenticationRequired:
                false,

              staticHostingAllowed:
                true
            })
        ).toThrow(
          'TG_GO_LIVE_API_STATIC_HOSTING_BLOCKED'
        );
      }
    );


    it(
      'P1 validates separated HTTPS frontend and API topology',
      () => {

        const topology =
          TaxGuardProductionTopologyGuard
            .validate({
              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://api.example.com',

              frontendRuntime:
                'STATIC_FRONTEND',

              apiRuntime:
                'NODE_API',

              authenticationRuntime:
                'NODE_API',

              databaseRuntime:
                'DATABASE',

              externalTaxFilingEnabled:
                false
            });

        expect(
          topology.apiRuntime
        ).toBe(
          'NODE_API'
        );

        expect(
          topology.externalTaxFilingEnabled
        ).toBe(
          false
        );
      }
    );


    it(
      'P1 identifies HTTP 405 as a production release blocker',
      () => {

        const assessment =
          TaxGuardProduction405Analyzer
            .analyze({
              method:
                'POST',

              url:
                'https://app.example.com/api/auth/firebase-session',

              statusCode:
                405,

              expectedRuntime:
                'NODE_API',

              observedRuntime:
                'STATIC_FRONTEND',

              responseAllowHeader:
                'GET, HEAD'
            });

        expect(
          assessment.is405
        ).toBe(
          true
        );

        expect(
          assessment.runtimeMismatch
        ).toBe(
          true
        );

        expect(
          assessment.productionReleaseBlocked
        ).toBe(
          true
        );

        expect(
          () =>
            TaxGuardProduction405Analyzer
              .assertProductionSafe(
                assessment
              )
        ).toThrow(
          'TG_GO_LIVE_405_RELEASE_BLOCKED'
        );
      }
    );


    it(
      'P2 accepts successful production authentication probe',
      () => {

        const result =
          TaxGuardAuthenticationAnalyzer
            .analyze({
              probeId:
                'AUTH-001',

              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://api.example.com',

              sessionPath:
                '/api/auth/firebase-session',

              method:
                'POST',

              firebaseTokenPresent:
                true,

              statusCode:
                200,

              responseReceived:
                true,

              corsAccepted:
                true,

              sessionCreated:
                true,

              authenticatedUserId:
                'USER-001',

              clientId:
                'CLIENT-001',

              tenantId:
                'TENANT-001',

              checkedAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.status
        ).toBe(
          'PASS'
        );

        expect(
          result.releaseBlocked
        ).toBe(
          false
        );
      }
    );


    it(
      'P2 diagnoses HTTP 405 authentication failure',
      () => {

        const result =
          TaxGuardAuthenticationAnalyzer
            .analyze({
              probeId:
                'AUTH-405',

              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://app.example.com',

              sessionPath:
                '/api/auth/firebase-session',

              method:
                'POST',

              firebaseTokenPresent:
                true,

              statusCode:
                405,

              responseReceived:
                true,

              corsAccepted:
                true,

              sessionCreated:
                false,

              checkedAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.failure
        ).toBe(
          'HTTP_405'
        );

        expect(
          result.releaseBlocked
        ).toBe(
          true
        );
      }
    );


    it(
      'P2 blocks cross-client and cross-tenant session access',
      () => {

        const identity = {
          userId:
            'USER-001',

          clientId:
            'CLIENT-001',

          tenantId:
            'TENANT-001',

          roles:
            ['CLIENT'],

          issuedAt:
            '2026-09-24T00:00:00.000Z',

          expiresAt:
            '2026-09-24T01:00:00.000Z'
        };

        expect(
          () =>
            TaxGuardSessionIdentityGuard
              .assertClientAccess(
                identity,
                'CLIENT-999',
                'TENANT-001'
              )
        ).toThrow(
          'TG_SESSION_CROSS_CLIENT_BLOCKED'
        );

        expect(
          () =>
            TaxGuardSessionIdentityGuard
              .assertClientAccess(
                identity,
                'CLIENT-001',
                'TENANT-999'
              )
        ).toThrow(
          'TG_SESSION_CROSS_TENANT_BLOCKED'
        );
      }
    );


    it(
      'P2 validates API runtime binding',
      () => {

        const binding =
          TaxGuardApiRuntimeBindingGuard
            .validate({
              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://api.example.com',

              sessionEndpoint:
                '/api/auth/firebase-session',

              healthEndpoint:
                '/api/health',

              apiRuntime:
                'NODE_API',

              staticFrontendMayHandleApi:
                false
            });

        expect(
          binding.staticFrontendMayHandleApi
        ).toBe(
          false
        );
      }
    );


    it(
      'P2 detects HTML returned from an API route',
      () => {

        const diagnosis =
          TaxGuardProductionRouteDiagnoser
            .diagnose({
              route:
                '/api/auth/firebase-session',

              method:
                'POST',

              statusCode:
                200,

              contentType:
                'text/html',

              responseLooksLikeHtml:
                true,

              responseLooksLikeJson:
                false
            });

        expect(
          diagnosis.staticFrontendLikely
        ).toBe(
          true
        );

        expect(
          diagnosis.releaseBlocked
        ).toBe(
          true
        );
      }
    );


    it(
      'P3 requires evidence before readiness check can pass',
      () => {

        const registry =
          new TaxGuardReadinessRegistry();

        expect(
          () =>
            registry.register({
              checkId:
                'DATABASE',

              area:
                'DATABASE',

              name:
                'Production database',

              required:
                true,

              status:
                'PASS',

              checkedAt:
                '2026-09-24T00:00:00.000Z',

              evidence:
                []
            })
        ).toThrow(
          'TG_READINESS_PASS_REQUIRES_EVIDENCE'
        );
      }
    );


    it(
      'P3 summarizes incomplete production readiness fail closed',
      () => {

        const registry =
          new TaxGuardReadinessRegistry();

        registry.register({
          checkId:
            'FRONTEND',

          area:
            'FRONTEND',

          name:
            'Frontend',

          required:
            true,

          status:
            'PASS',

          checkedAt:
            '2026-09-24T00:00:00.000Z',

          evidence:
            ['HTTPS page loaded']
        });

        registry.register({
          checkId:
            'API',

          area:
            'API',

          name:
            'API',

          required:
            true,

          status:
            'BLOCKED',

          checkedAt:
            '2026-09-24T00:00:00.000Z',

          evidence:
            ['HTTP 405 observed'],

          blockerReason:
            'API_RUNTIME_NOT_VERIFIED'
        });

        const summary =
          registry.summarize();

        expect(
          summary.releaseAllowed
        ).toBe(
          false
        );

        expect(
          summary.requiredIncomplete
        ).toBe(
          1
        );
      }
    );


    it(
      'P3 stores immutable production verification evidence',
      () => {

        const registry =
          new TaxGuardProductionVerificationEvidenceRegistry();

        const evidence =
          registry.register({
            evidenceId:
              'EVIDENCE-001',

            checkId:
              'API',

            source:
              'production-probe',

            capturedAt:
              '2026-09-24T00:00:00.000Z',

            description:
              'API health endpoint returned expected response.',

            verifiedBy:
              'authorized-reviewer',

            immutable:
              true
          });

        expect(
          Object.isFrozen(
            evidence
          )
        ).toBe(
          true
        );
      }
    );


    it(
      'P4 detects unavailable production dependencies',
      () => {

        const summary =
          TaxGuardProductionHealthMonitor
            .summarize([
              {
                dependency:
                  'FRONTEND',

                status:
                  'HEALTHY',

                checkedAt:
                  '2026-09-24T00:00:00.000Z',

                latencyMs:
                  50,

                evidence:
                  ['HTTP 200']
              },
              {
                dependency:
                  'API',

                status:
                  'UNAVAILABLE',

                checkedAt:
                  '2026-09-24T00:00:00.000Z',

                evidence:
                  ['Connection failed']
              }
            ]);

        expect(
          summary.healthy
        ).toBe(
          false
        );

        expect(
          summary.unavailable
        ).toContain(
          'API'
        );
      }
    );


    it(
      'P5 requires encrypted backup and successful restore test',
      () => {

        const result =
          TaxGuardBackupRecoveryGate
            .evaluate({
              verificationId:
                'BACKUP-001',

              backupCreated:
                true,

              backupEncrypted:
                true,

              backupIntegrityVerified:
                true,

              restoreTestPerformed:
                true,

              restoreTestPassed:
                true,

              tenantIsolationPreserved:
                true,

              verifiedAt:
                '2026-09-24T00:00:00.000Z',

              verifiedBy:
                'authorized-reviewer'
            });

        expect(
          result.productionReady
        ).toBe(
          true
        );
      }
    );


    it(
      'P5 requires human response for critical operational alerts',
      () => {

        expect(
          () =>
            TaxGuardOperationalAlertGuard
              .validate({
                alertId:
                  'ALERT-001',

                severity:
                  'CRITICAL',

                source:
                  'DATABASE',

                message:
                  'Production database unavailable.',

                createdAt:
                  '2026-09-24T00:00:00.000Z',

                requiresHumanResponse:
                  false
              })
        ).toThrow(
          'TG_OPERATIONAL_ALERT_HUMAN_RESPONSE_REQUIRED'
        );
      }
    );


    it(
      'P5 detects open critical production incidents',
      () => {

        const registry =
          new TaxGuardProductionIncidentRegistry();

        registry.register({
          incidentId:
            'INCIDENT-001',

          severity:
            'CRITICAL',

          status:
            'OPEN',

          component:
            'API',

          summary:
            'Production API unavailable.',

          detectedAt:
            '2026-09-24T00:00:00.000Z',

          evidence:
            ['Health probe failed']
        });

        expect(
          registry.hasCriticalOpenIncident()
        ).toBe(
          true
        );
      }
    );


    it(
      'P6 production integration gate fails closed',
      () => {

        const result =
          TaxGuardProductionIntegrationGate
            .evaluate({
              frontendVerified:
                true,

              apiHealthVerified:
                false,

              authenticationVerified:
                false,

              sessionVerified:
                false,

              databaseVerified:
                true,

              tenantIsolationVerified:
                true,

              auditVerified:
                true,

              documentIntelligenceVerified:
                false,

              monitoringVerified:
                true,

              backupRestoreVerified:
                true,

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              externalTaxFilingEnabled:
                false
            });

        expect(
          result.releaseAllowed
        ).toBe(
          false
        );

        expect(
          result.blockers
        ).toContain(
          'API_HEALTH_NOT_VERIFIED'
        );
      }
    );


    it(
      'P6 release gate blocks unresolved production requirements',
      () => {

        const decision =
          TaxGuardProductionReleaseGate
            .evaluate({
              snapshotId:
                'RELEASE-001',

              releaseVersion:
                'production-candidate',

              commitId:
                'local-test-commit',

              createdAt:
                '2026-09-24T00:00:00.000Z',

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              productionEndpointVerified:
                false,

              authenticationVerified:
                false,

              databaseVerified:
                true,

              documentIntelligenceVerified:
                false,

              monitoringVerified:
                true,

              backupRestoreVerified:
                true,

              criticalIncidentsOpen:
                0,

              externalTaxFilingEnabled:
                false
            });

        expect(
          decision.releasable
        ).toBe(
          false
        );

        expect(
          decision.blockers
        ).toContain(
          'PRODUCTION_ENDPOINT_NOT_VERIFIED'
        );
      }
    );


    it(
      'P7 requires authorized acceptance before go-live',
      () => {

        const result =
          TaxGuardGoLiveAcceptanceGate
            .evaluate({
              acceptanceId:
                'ACCEPTANCE-001',

              environment:
                'PRODUCTION',

              frontendVerified:
                true,

              apiVerified:
                true,

              authenticationVerified:
                true,

              sessionVerified:
                true,

              databaseVerified:
                true,

              tenantIsolationVerified:
                true,

              documentIntelligenceVerified:
                true,

              auditVerified:
                true,

              monitoringVerified:
                true,

              backupRestoreVerified:
                true,

              securityVerified:
                true,

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              externalTaxFilingEnabled:
                false
            });

        expect(
          result.accepted
        ).toBe(
          false
        );

        expect(
          result.blockers
        ).toContain(
          'AUTHORIZED_ACCEPTANCE_REQUIRED'
        );
      }
    );


    it(
      'P7 permits acceptance only after every production gate passes',
      () => {

        const result =
          TaxGuardGoLiveAcceptanceGate
            .evaluate({
              acceptanceId:
                'ACCEPTANCE-002',

              environment:
                'PRODUCTION',

              frontendVerified:
                true,

              apiVerified:
                true,

              authenticationVerified:
                true,

              sessionVerified:
                true,

              databaseVerified:
                true,

              tenantIsolationVerified:
                true,

              documentIntelligenceVerified:
                true,

              auditVerified:
                true,

              monitoringVerified:
                true,

              backupRestoreVerified:
                true,

              securityVerified:
                true,

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              externalTaxFilingEnabled:
                false,

              acceptedBy:
                'authorized-production-reviewer',

              acceptedAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.accepted
        ).toBe(
          true
        );

        expect(
          result.blockers
        ).toHaveLength(
          0
        );
      }
    );


    it(
      'P7 keeps external tax submission disabled',
      () => {

        const release =
          TaxGuardProductionReleaseGate
            .evaluate({
              snapshotId:
                'RELEASE-002',

              releaseVersion:
                'production-candidate',

              commitId:
                'local-test-commit',

              createdAt:
                '2026-09-24T00:00:00.000Z',

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              productionEndpointVerified:
                true,

              authenticationVerified:
                true,

              databaseVerified:
                true,

              documentIntelligenceVerified:
                true,

              monitoringVerified:
                true,

              backupRestoreVerified:
                true,

              criticalIncidentsOpen:
                0,

              externalTaxFilingEnabled:
                false
            });

        expect(
          release.releasable
        ).toBe(
          true
        );
      }
    );
  }
);
