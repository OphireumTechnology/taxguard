import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardAiPolicy
} from '../server/ai/TaxGuardAiPolicy';

import {
  TaxGuardAiAudit
} from '../server/ai/TaxGuardAiAudit';

import {
  TaxGuardGeminiGateway
} from '../server/ai/TaxGuardGeminiGateway';

describe(
  'M16 TaxGuard Gemini Intelligence Layer',
  () => {
    beforeEach(() => {
      TaxGuardAiAudit
        .clearForTests();
    });

    it(
      'requires an AI task',
      () => {
        expect(() =>
          TaxGuardAiPolicy
            .validate({
              task: ''
            })
        ).toThrow(
          'TAXGUARD_AI_TASK_REQUIRED'
        );
      }
    );

    it(
      'blocks private key material',
      () => {
        expect(() =>
          TaxGuardAiPolicy
            .validate({
              task:
                'Review this material',

              context:
                '-----BEGIN PRIVATE KEY----- secret -----END PRIVATE KEY-----'
            })
        ).toThrow(
          'TAXGUARD_AI_SECRET_MATERIAL_BLOCKED'
        );
      }
    );

    it(
      'blocks password material',
      () => {
        expect(() =>
          TaxGuardAiPolicy
            .validate({
              task:
                'Review',

              context:
                'password=secret'
            })
        ).toThrow(
          'TAXGUARD_AI_SECRET_MATERIAL_BLOCKED'
        );
      }
    );

    it(
      'blocks API key material',
      () => {
        expect(() =>
          TaxGuardAiPolicy
            .validate({
              task:
                'Review',

              context:
                'api_key=secret'
            })
        ).toThrow(
          'TAXGUARD_AI_SECRET_MATERIAL_BLOCKED'
        );
      }
    );

    it(
      'accepts bounded proposal request',
      () => {
        expect(() =>
          TaxGuardAiPolicy
            .validate({
              task:
                'Identify missing tax information',

              context:
                'W-2 evidence supplied',

              evidence: [
                'Document evidence package EVP-001'
              ],

              riskLevel:
                'material'
            })
        ).not.toThrow();
      }
    );

    it(
      'blocks excessive evidence count',
      () => {
        const evidence =
          Array.from(
            {
              length: 51
            },
            (_, index) =>
              'Evidence ' +
              index
          );

        expect(() =>
          TaxGuardAiPolicy
            .validate({
              task:
                'Review evidence',

              evidence
            })
        ).toThrow(
          'TAXGUARD_AI_TOO_MUCH_EVIDENCE'
        );
      }
    );

    it(
      'records proposal-only audit metadata',
      () => {
        const entry =
          TaxGuardAiAudit
            .record({
              eventType:
                'AI_REQUEST_ACCEPTED',

              actorId:
                'USER-001',

              correlationId:
                'CORR-001'
            });

        expect(
          entry.isAiProposedOnly
        ).toBe(
          true
        );

        expect(
          entry.externalSubmissionAllowed
        ).toBe(
          false
        );
      }
    );

    it(
      'returns defensive audit copies',
      () => {
        TaxGuardAiAudit
          .record({
            eventType:
              'AI_REQUEST_ACCEPTED',

            actorId:
              'USER-001',

            correlationId:
              'CORR-001'
          });

        const first =
          TaxGuardAiAudit
            .listForTests();

        const second =
          TaxGuardAiAudit
            .listForTests();

        expect(first)
          .toHaveLength(1);

        expect(second)
          .toHaveLength(1);

        expect(
          second[0]
        ).not.toBe(
          first[0]
        );
      }
    );

    it(
      'reports configuration without exposing API key',
      () => {
        const configured =
          TaxGuardGeminiGateway
            .isConfigured();

        expect(
          typeof configured
        ).toBe(
          'boolean'
        );
      }
    );

    it(
      'uses a server-selected Gemini model',
      () => {
        expect(
          TaxGuardGeminiGateway
            .model.length
        ).toBeGreaterThan(
          0
        );
      }
    );
  }
);
