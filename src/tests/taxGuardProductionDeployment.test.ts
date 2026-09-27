import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardProductionDeploymentGuard,
  TaxGuardProductionEndpointGuard,
  TaxGuardGoLiveGate,
  createTaxGuardProductionRoutingPolicy
} from '../taxguard/deployment/TaxGuardProductionDeployment';

import {
  TaxGuardProductionRuntimeGuard,
  TaxGuardProductionCorsPolicy,
  TaxGuardRuntimeRouteGuard,
  TaxGuardProductionHealthEvaluator,
  TaxGuardProductionEnvironmentGuard,
  TAXGUARD_PRODUCTION_DEPLOYMENT_MANIFEST,
  TAXGUARD_SECRET_SAFETY_POLICY
} from '../taxguard/deployment/TaxGuardProductionRuntime';

import {
  TaxGuardProductionRequestRouter,
  TaxGuardAuthenticationReadinessGate,
  TaxGuardProductionSessionGate,
  TaxGuardProductionDatabaseGate,
  TaxGuardProductionVerificationRegistry,
  TaxGuardProductionAcceptanceGate,
  TAXGUARD_REQUIRED_PRODUCTION_VERIFICATIONS
} from '../taxguard/deployment/TaxGuardProductionAdapter';


describe(
  'TaxGuard Production Deployment',
  () => {

    it(
      'PD-01 validates production deployment context',
      () => {

        const result =
          TaxGuardProductionDeploymentGuard
            .validate({
              environment:
                'production',

              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://api.example.com',

              httpsRequired:
                true,

              externalTaxFilingEnabled:
                false,

              firebaseAuthenticationRequired:
                true,

              firebaseAdminRequired:
                true,

              persistentDatabaseRequired:
                true,

              staticHostingMayServeApi:
                false,

              deploymentId:
                'DEPLOY-001',

              correlationId:
                'CORR-001',

              createdAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.valid
        ).toBe(true);

        expect(
          result.status
        ).toBe(
          'READY_FOR_VERIFICATION'
        );
      }
    );


    it(
      'PD-02 blocks non-HTTPS production API',
      () => {

        const result =
          TaxGuardProductionDeploymentGuard
            .validate({
              environment:
                'production',

              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'http://api.example.com',

              httpsRequired:
                true,

              externalTaxFilingEnabled:
                false,

              firebaseAuthenticationRequired:
                true,

              firebaseAdminRequired:
                true,

              persistentDatabaseRequired:
                true,

              staticHostingMayServeApi:
                false,

              deploymentId:
                'DEPLOY-002',

              correlationId:
                'CORR-002',

              createdAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.blockers
        ).toContain(
          'PRODUCTION_API_REQUIRES_HTTPS'
        );
      }
    );


    it(
      'PD-03 treats HTTP 405 as release blocker',
      () => {

        const result =
          TaxGuardProductionEndpointGuard
            .evaluate({
              path:
                '/api/auth/firebase-session',

              method:
                'POST',

              status:
                405,

              contentType:
                'text/html',

              responseSource:
                'STATIC_FRONTEND'
            });

        expect(
          result.passed
        ).toBe(false);

        expect(
          result.releaseBlocked
        ).toBe(true);

        expect(
          result.reasons
        ).toContain(
          'HTTP_405_PRODUCTION_RELEASE_BLOCKER'
        );
      }
    );


    it(
      'PD-04 creates fail-closed production routing policy',
      () => {

        const policy =
          createTaxGuardProductionRoutingPolicy(
            'https://app.example.com',
            'https://api.example.com'
          );

        expect(
          policy.allowStaticFrontendFallbackForApi
        ).toBe(false);

        expect(
          policy.externalTaxFilingEnabled
        ).toBe(false);
      }
    );


    it(
      'PD-05 validates production runtime requirements',
      () => {

        const result =
          TaxGuardProductionRuntimeGuard
            .validate({
              mode:
                'PRODUCTION',

              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://api.example.com',

              port:
                8080,

              firebaseProjectIdPresent:
                true,

              firebaseAdminCredentialPresent:
                true,

              firestoreDatabaseIdPresent:
                true,

              sessionSecretPresent:
                true,

              documentIntelligenceConfigured:
                true,

              monitoringConfigured:
                true,

              externalTaxFilingEnabled:
                false
            });

        expect(
          result.valid
        ).toBe(true);
      }
    );


    it(
      'PD-06 blocks wildcard production CORS',
      () => {

        expect(
          () =>
            TaxGuardProductionCorsPolicy
              .create([
                '*'
              ])
        ).toThrow(
          'TG_CORS_PRODUCTION_ORIGIN_INVALID'
        );
      }
    );


    it(
      'PD-07 allows explicitly approved HTTPS origin',
      () => {

        const policy =
          TaxGuardProductionCorsPolicy
            .create([
              'https://app.example.com'
            ]);

        const decision =
          TaxGuardProductionCorsPolicy
            .evaluate(
              policy,
              'https://app.example.com',
              'POST',
              [
                'Content-Type',
                'Authorization'
              ]
            );

        expect(
          decision.allowed
        ).toBe(true);

        expect(
          decision.reason
        ).toBe(
          'ALLOWED'
        );
      }
    );


    it(
      'PD-08 forces API routes to Node runtime',
      () => {

        expect(
          () =>
            TaxGuardRuntimeRouteGuard
              .validate({
                path:
                  '/api/auth/firebase-session',

                runtime:
                  'STATIC_FRONTEND',

                spaFallbackAllowed:
                  false
              })
        ).toThrow(
          'TG_API_ROUTE_REQUIRES_NODE_RUNTIME'
        );
      }
    );


    it(
      'PD-09 blocks SPA fallback for API routes',
      () => {

        expect(
          () =>
            TaxGuardRuntimeRouteGuard
              .validate({
                path:
                  '/api/health',

                runtime:
                  'NODE_API',

                spaFallbackAllowed:
                  true
              })
        ).toThrow(
          'TG_API_ROUTE_SPA_FALLBACK_BLOCKED'
        );
      }
    );


    it(
      'PD-10 evaluates required production health',
      () => {

        const result =
          TaxGuardProductionHealthEvaluator
            .evaluate([
              {
                component:
                  'API',

                healthy:
                  true,

                required:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                component:
                  'FIREBASE_ADMIN',

                healthy:
                  true,

                required:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                component:
                  'DATABASE',

                healthy:
                  true,

                required:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              }
            ]);

        expect(
          result.ready
        ).toBe(true);

        expect(
          result.status
        ).toBe(
          'HEALTHY'
        );
      }
    );


    it(
      'PD-11 detects missing production environment values',
      () => {

        const result =
          TaxGuardProductionEnvironmentGuard
            .evaluate([
              {
                key:
                  'NODE_ENV',

                present:
                  true,

                secret:
                  false
              },

              {
                key:
                  'PORT',

                present:
                  true,

                secret:
                  false
              }
            ]);

        expect(
          result.ready
        ).toBe(false);

        expect(
          result.missing
        ).toContain(
          'TAXGUARD_API_ORIGIN'
        );

        expect(
          result.missing
        ).toContain(
          'TAXGUARD_SESSION_SECRET'
        );
      }
    );


    it(
      'PD-12 preserves deployment and secret-safety policy',
      () => {

        expect(
          TAXGUARD_PRODUCTION_DEPLOYMENT_MANIFEST
            .backendArtifact
        ).toBe(
          'dist/server.cjs'
        );

        expect(
          TAXGUARD_PRODUCTION_DEPLOYMENT_MANIFEST
            .spaFallbackExcludesApi
        ).toBe(true);

        expect(
          TAXGUARD_SECRET_SAFETY_POLICY
            .serviceAccountPrivateKeyInRepository
        ).toBe(false);

        expect(
          TAXGUARD_SECRET_SAFETY_POLICY
            .productionSecretsInFrontendBundle
        ).toBe(false);
      }
    );


    it(
      'PD-13 routes API requests to Node and frontend routes to SPA',
      () => {

        const api =
          TaxGuardProductionRequestRouter
            .route({
              path:
                '/api/auth/firebase-session',

              method:
                'POST'
            });

        const frontend =
          TaxGuardProductionRequestRouter
            .route({
              path:
                '/client/login',

              method:
                'GET'
            });

        expect(
          api.runtime
        ).toBe(
          'NODE_API'
        );

        expect(
          api.spaFallbackAllowed
        ).toBe(false);

        expect(
          frontend.runtime
        ).toBe(
          'STATIC_FRONTEND'
        );

        expect(
          frontend.spaFallbackAllowed
        ).toBe(true);
      }
    );


    it(
      'PD-14 authentication readiness fails closed',
      () => {

        const result =
          TaxGuardAuthenticationReadinessGate
            .evaluate({
              firebaseClientConfigured:
                true,

              firebaseAdminConfigured:
                true,

              firebaseTokenVerificationAvailable:
                true,

              firebaseSessionRouteAvailable:
                false,

              applicationSessionCreationAvailable:
                false,

              userProfilePersistenceAvailable:
                true,

              tenantIsolationAvailable:
                true,

              clientIsolationAvailable:
                true
            });

        expect(
          result.ready
        ).toBe(false);

        expect(
          result.blockers
        ).toContain(
          'FIREBASE_SESSION_ROUTE_UNAVAILABLE'
        );
      }
    );


    it(
      'PD-15 production session gate rejects 405',
      () => {

        const result =
          TaxGuardProductionSessionGate
            .evaluate({
              verificationId:
                'SESSION-001',

              firebaseAuthenticationPassed:
                true,

              idTokenObtained:
                true,

              idTokenAcceptedByServer:
                false,

              firebaseSessionPostReachedNodeApi:
                false,

              applicationSessionCreated:
                false,

              authenticatedUserResolved:
                false,

              permanentClientIdResolved:
                false,

              tenantBoundaryVerified:
                false,

              clientBoundaryVerified:
                false,

              statusCode:
                405,

              verifiedAt:
                '2026-09-24T00:00:00.000Z',

              verifiedBy:
                'authorized-reviewer'
            });

        expect(
          result.passed
        ).toBe(false);

        expect(
          result.blockers
        ).toContain(
          'HTTP_405_RELEASE_BLOCKER'
        );
      }
    );


    it(
      'PD-16 verifies complete server session path',
      () => {

        const result =
          TaxGuardProductionSessionGate
            .evaluate({
              verificationId:
                'SESSION-002',

              firebaseAuthenticationPassed:
                true,

              idTokenObtained:
                true,

              idTokenAcceptedByServer:
                true,

              firebaseSessionPostReachedNodeApi:
                true,

              applicationSessionCreated:
                true,

              authenticatedUserResolved:
                true,

              permanentClientIdResolved:
                true,

              tenantBoundaryVerified:
                true,

              clientBoundaryVerified:
                true,

              statusCode:
                200,

              verifiedAt:
                '2026-09-24T00:00:00.000Z',

              verifiedBy:
                'authorized-reviewer'
            });

        expect(
          result.passed
        ).toBe(true);
      }
    );


    it(
      'PD-17 verifies database isolation requirements',
      () => {

        const result =
          TaxGuardProductionDatabaseGate
            .evaluate({
              connected:
                true,

              authenticated:
                true,

              readPassed:
                true,

              writePassed:
                true,

              auditWritePassed:
                true,

              permanentClientIdPersistencePassed:
                true,

              tenantIsolationPassed:
                true,

              clientIsolationPassed:
                true
            });

        expect(
          result.passed
        ).toBe(true);
      }
    );


    it(
      'PD-18 requires evidence for passed production verification',
      () => {

        const registry =
          new TaxGuardProductionVerificationRegistry();

        expect(
          () =>
            registry.register({
              verificationId:
                'VERIFY-001',

              type:
                'API_ROUTING',

              passed:
                true,

              evidence:
                [],

              verifiedAt:
                '2026-09-24T00:00:00.000Z',

              verifiedBy:
                'authorized-reviewer',

              immutable:
                true
            })
        ).toThrow(
          'TG_PROD_PASS_REQUIRES_EVIDENCE'
        );
      }
    );


    it(
      'PD-19 stores immutable production verification',
      () => {

        const registry =
          new TaxGuardProductionVerificationRegistry();

        const record =
          registry.register({
            verificationId:
              'VERIFY-002',

            type:
              'HEALTH',

            passed:
              true,

            evidence:
              [
                'Production health endpoint HTTP 200'
              ],

            verifiedAt:
              '2026-09-24T00:00:00.000Z',

            verifiedBy:
              'authorized-reviewer',

            immutable:
              true
          });

        expect(
          Object.isFrozen(
            record
          )
        ).toBe(true);

        expect(
          registry.hasPassed(
            'HEALTH'
          )
        ).toBe(true);
      }
    );


    it(
      'PD-20 defines complete production verification matrix',
      () => {

        expect(
          TAXGUARD_REQUIRED_PRODUCTION_VERIFICATIONS
        ).toContain(
          'API_ROUTING'
        );

        expect(
          TAXGUARD_REQUIRED_PRODUCTION_VERIFICATIONS
        ).toContain(
          'AUTHENTICATION'
        );

        expect(
          TAXGUARD_REQUIRED_PRODUCTION_VERIFICATIONS
        ).toContain(
          'END_TO_END'
        );
      }
    );


    it(
      'PD-21 production acceptance fails closed',
      () => {

        const decision =
          TaxGuardProductionAcceptanceGate
            .evaluate({
              requiredVerifications:
                [],

              typecheckPassed:
                true,

              regressionPassed:
                true,

              buildPassed:
                true,

              http405Resolved:
                false,

              authorizedHumanApproval:
                false,

              externalTaxFilingEnabled:
                false
            });

        expect(
          decision.accepted
        ).toBe(false);

        expect(
          decision.blockers
        ).toContain(
          'HTTP_405_NOT_RESOLVED'
        );

        expect(
          decision.blockers
        ).toContain(
          'AUTHORIZED_HUMAN_APPROVAL_REQUIRED'
        );
      }
    );


    it(
      'PD-22 local success alone cannot authorize production',
      () => {

        const decision =
          TaxGuardGoLiveGate
            .evaluate({
              localTypecheckPassed:
                true,

              localTestsPassed:
                true,

              productionBuildPassed:
                true,

              productionHealthVerified:
                false,

              productionApiVerified:
                false,

              productionAuthenticationVerified:
                false,

              productionDatabaseVerified:
                false,

              http405Resolved:
                false,

              monitoringVerified:
                false,

              backupRestoreVerified:
                false,

              externalTaxFilingEnabled:
                false
            });

        expect(
          decision.approved
        ).toBe(false);

        expect(
          decision.status
        ).toBe(
          'BLOCKED'
        );
      }
    );
  }
);
