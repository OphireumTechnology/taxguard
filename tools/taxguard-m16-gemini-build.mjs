import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function write(relativePath, content) {
  const fullPath = path.join(root, relativePath);

  fs.mkdirSync(
    path.dirname(fullPath),
    { recursive: true }
  );

  fs.writeFileSync(
    fullPath,
    content.trimStart(),
    'utf8'
  );

  console.log('WROTE:', relativePath);
}

/* ============================================================
   M16.1 — GEMINI GATEWAY
   ============================================================ */

write(
  'src/server/ai/TaxGuardGeminiGateway.ts',
  String.raw`
import { GoogleGenAI } from '@google/genai';

export type TaxGuardAiRisk =
  | 'routine'
  | 'material'
  | 'critical';

export interface TaxGuardAiRequest {
  task: string;
  context?: string;
  evidence?: readonly string[];
  riskLevel?: TaxGuardAiRisk;
}

export interface TaxGuardAiProposal {
  provider: 'GOOGLE_GEMINI';

  model: string;

  proposal: string;

  isAiProposedOnly: true;

  requiresHumanReview: true;

  authorityVerified: false;

  externalSubmissionAllowed: false;

  riskLevel: TaxGuardAiRisk;

  generatedAt: string;
}

function required(
  value: string | undefined,
  code: string
): string {
  const normalized =
    value?.trim() ?? '';

  if (!normalized) {
    throw new Error(code);
  }

  return normalized;
}

function sanitizeText(
  value: string
): string {
  return value
    .replace(
      /\b\d{3}-\d{2}-\d{4}\b/g,
      '[REDACTED_SSN]'
    )
    .replace(
      /\b(?:\d[ -]*?){13,19}\b/g,
      '[REDACTED_PAYMENT_NUMBER]'
    )
    .replace(
      /-----BEGIN[\s\S]*?PRIVATE KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE KEY-----/gi,
      '[REDACTED_PRIVATE_KEY]'
    )
    .replace(
      /\bBearer\s+[A-Za-z0-9._~-]+/gi,
      '[REDACTED_BEARER_TOKEN]'
    );
}

function buildPrompt(
  request: TaxGuardAiRequest
): string {
  const task =
    sanitizeText(
      required(
        request.task,
        'TAXGUARD_AI_TASK_REQUIRED'
      )
    );

  const context =
    sanitizeText(
      request.context ?? ''
    );

  const evidence =
    (request.evidence ?? [])
      .map(sanitizeText)
      .filter(Boolean)
      .map(
        (item, index) =>
          '[' +
          (index + 1) +
          '] ' +
          item
      )
      .join('\n');

  return [
    'You are the TaxGuard AI assistance layer.',
    '',
    'MANDATORY TAXGUARD GOVERNANCE:',
    '- AI output is a proposal only.',
    '- Never claim a tax position is approved.',
    '- Never claim authority is verified unless TaxGuard supplies verified authority.',
    '- Never invent statutes, regulations, forms, facts, evidence, citations, calculations, taxpayer data, or filing status.',
    '- Never silently repair missing facts.',
    '- Explicitly identify uncertainty and missing information.',
    '- Material tax decisions require authorized human review.',
    '- External tax filing is disabled.',
    '- Deterministic TaxGuard calculation engines remain authoritative for tax calculations.',
    '- Human review and TaxGuard governance remain authoritative.',
    '',
    'TASK:',
    task,
    '',
    context
      ? 'CONTEXT:\n' + context
      : 'CONTEXT:\nNo additional context supplied.',
    '',
    evidence
      ? 'EVIDENCE:\n' + evidence
      : 'EVIDENCE:\nNo evidence supplied.',
    '',
    'OUTPUT REQUIREMENTS:',
    '- Be concise and professional.',
    '- Identify assumptions.',
    '- Identify missing information.',
    '- Identify material uncertainties.',
    '- Identify any required human review.',
    '- Do not state that the proposal is approved.',
    '- Do not authorize filing.'
  ].join('\n');
}

function extractText(
  response: unknown
): string {
  const candidate =
    response as {
      text?: string | (() => string);
    };

  if (
    typeof candidate.text ===
    'string'
  ) {
    return candidate.text.trim();
  }

  if (
    typeof candidate.text ===
    'function'
  ) {
    return candidate.text().trim();
  }

  throw new Error(
    'TAXGUARD_AI_EMPTY_RESPONSE'
  );
}

export class TaxGuardGeminiGateway {
  static readonly model =
    process.env.GEMINI_MODEL?.trim() ||
    'gemini-2.5-flash';

  static isConfigured(): boolean {
    return Boolean(
      process.env.GEMINI_API_KEY?.trim()
    );
  }

  static async propose(
    request: TaxGuardAiRequest
  ): Promise<TaxGuardAiProposal> {
    const apiKey =
      required(
        process.env.GEMINI_API_KEY,
        'TAXGUARD_AI_NOT_CONFIGURED'
      );

    const ai =
      new GoogleGenAI({
        apiKey
      });

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        30000
      );

    try {
      const response =
        await ai.models.generateContent({
          model:
            this.model,

          contents:
            buildPrompt(request),

          config: {
            temperature:
              0.1,

            maxOutputTokens:
              2048,

            abortSignal:
              controller.signal
          }
        });

      const proposal =
        extractText(response);

      if (!proposal) {
        throw new Error(
          'TAXGUARD_AI_EMPTY_RESPONSE'
        );
      }

      return {
        provider:
          'GOOGLE_GEMINI',

        model:
          this.model,

        proposal,

        isAiProposedOnly:
          true,

        requiresHumanReview:
          true,

        authorityVerified:
          false,

        externalSubmissionAllowed:
          false,

        riskLevel:
          request.riskLevel ??
          'material',

        generatedAt:
          new Date()
            .toISOString()
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.name ===
          'AbortError'
      ) {
        throw new Error(
          'TAXGUARD_AI_TIMEOUT'
        );
      }

      if (
        error instanceof Error &&
        error.message.startsWith(
          'TAXGUARD_AI_'
        )
      ) {
        throw error;
      }

      throw new Error(
        'TAXGUARD_AI_PROVIDER_FAILURE'
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
`
);

/* ============================================================
   M16.2 — AI POLICY / SECURITY BOUNDARY
   ============================================================ */

write(
  'src/server/ai/TaxGuardAiPolicy.ts',
  String.raw`
import type {
  TaxGuardAiRequest
} from './TaxGuardGeminiGateway';

const BLOCKED_PATTERNS:
  readonly RegExp[] = [
    /-----BEGIN[\s\S]*PRIVATE KEY-----/i,

    /\bpassword\s*[:=]/i,

    /\bapi[_ -]?key\s*[:=]/i,

    /\bbearer\s+[a-z0-9._~-]+/i,

    /\bx-session-token\s*[:=]/i
  ];

function combined(
  request: TaxGuardAiRequest
): string {
  return [
    request.task,
    request.context ?? '',
    ...(request.evidence ?? [])
  ].join('\n');
}

export class TaxGuardAiPolicy {
  static validate(
    request: TaxGuardAiRequest
  ): void {
    if (
      !request ||
      typeof request !==
        'object'
    ) {
      throw new Error(
        'TAXGUARD_AI_REQUEST_REQUIRED'
      );
    }

    if (
      !request.task ||
      !request.task.trim()
    ) {
      throw new Error(
        'TAXGUARD_AI_TASK_REQUIRED'
      );
    }

    if (
      request.task.length >
      12000
    ) {
      throw new Error(
        'TAXGUARD_AI_TASK_TOO_LARGE'
      );
    }

    if (
      request.context &&
      request.context.length >
        50000
    ) {
      throw new Error(
        'TAXGUARD_AI_CONTEXT_TOO_LARGE'
      );
    }

    if (
      (request.evidence?.length ?? 0) >
      50
    ) {
      throw new Error(
        'TAXGUARD_AI_TOO_MUCH_EVIDENCE'
      );
    }

    for (
      const evidence
      of request.evidence ?? []
    ) {
      if (
        evidence.length >
        20000
      ) {
        throw new Error(
          'TAXGUARD_AI_EVIDENCE_TOO_LARGE'
        );
      }
    }

    const payload =
      combined(request);

    for (
      const pattern
      of BLOCKED_PATTERNS
    ) {
      if (
        pattern.test(
          payload
        )
      ) {
        throw new Error(
          'TAXGUARD_AI_SECRET_MATERIAL_BLOCKED'
        );
      }
    }
  }
}
`
);

/* ============================================================
   M16.3 — AI AUDIT CONTRACT
   ============================================================ */

write(
  'src/server/ai/TaxGuardAiAudit.ts',
  String.raw`
export type TaxGuardAiAuditEventType =
  | 'AI_REQUEST_ACCEPTED'
  | 'AI_REQUEST_REJECTED'
  | 'AI_PROPOSAL_CREATED'
  | 'AI_PROVIDER_FAILURE';

export interface TaxGuardAiAuditEntry {
  eventType:
    TaxGuardAiAuditEventType;

  actorId: string;

  correlationId: string;

  timestamp: string;

  provider?:
    'GOOGLE_GEMINI';

  model?: string;

  isAiProposedOnly: true;

  externalSubmissionAllowed: false;
}

export class TaxGuardAiAudit {
  private static readonly entries:
    TaxGuardAiAuditEntry[] = [];

  static record(
    entry:
      Omit<
        TaxGuardAiAuditEntry,
        | 'timestamp'
        | 'isAiProposedOnly'
        | 'externalSubmissionAllowed'
      >
  ): TaxGuardAiAuditEntry {
    const complete:
      TaxGuardAiAuditEntry = {
        ...entry,

        timestamp:
          new Date()
            .toISOString(),

        isAiProposedOnly:
          true,

        externalSubmissionAllowed:
          false
      };

    this.entries.push(
      Object.freeze({
        ...complete
      })
    );

    return {
      ...complete
    };
  }

  static listForTests():
    readonly TaxGuardAiAuditEntry[] {
    return this.entries.map(
      entry => ({
        ...entry
      })
    );
  }

  static clearForTests(): void {
    this.entries.length = 0;
  }
}
`
);

/* ============================================================
   M16.4 — BARREL EXPORT
   ============================================================ */

write(
  'src/server/ai/index.ts',
  String.raw`
export * from './TaxGuardGeminiGateway';

export * from './TaxGuardAiPolicy';

export * from './TaxGuardAiAudit';
`
);

/* ============================================================
   M16.5 — AUTHENTICATED EXPRESS ROUTER
   ============================================================ */

write(
  'src/server/routes/taxguard-ai.routes.ts',
  String.raw`
import {
  Router
} from 'express';

import {
  authenticateToken
} from '../auth';

import {
  TaxGuardGeminiGateway,
  TaxGuardAiPolicy,
  TaxGuardAiAudit,
  type TaxGuardAiRequest
} from '../ai';

const router =
  Router();

function correlationId(): string {
  return (
    'AI-' +
    Date.now()
      .toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 10)
  ).toUpperCase();
}

router.get(
  '/health',
  authenticateToken,
  (_req, res) => {
    res.status(200).json({
      service:
        'taxguard-ai',

      provider:
        'GOOGLE_GEMINI',

      configured:
        TaxGuardGeminiGateway
          .isConfigured(),

      model:
        TaxGuardGeminiGateway
          .model,

      governance: {
        isAiProposedOnly:
          true,

        requiresHumanReview:
          true,

        authorityVerified:
          false,

        externalSubmissionAllowed:
          false
      }
    });
  }
);

router.post(
  '/propose',
  authenticateToken,
  async (
    req,
    res
  ) => {
    const id =
      correlationId();

    /*
     * Authentication has already been
     * enforced by authenticateToken.
     *
     * M16 deliberately does not assume
     * a particular AuthenticatedRequest
     * property shape.
     */
    const actorId =
      'authenticated-taxguard-user';

    try {
      const request =
        req.body as
          TaxGuardAiRequest;

      TaxGuardAiPolicy
        .validate(
          request
        );

      TaxGuardAiAudit
        .record({
          eventType:
            'AI_REQUEST_ACCEPTED',

          actorId,

          correlationId:
            id
        });

      const proposal =
        await TaxGuardGeminiGateway
          .propose(
            request
          );

      TaxGuardAiAudit
        .record({
          eventType:
            'AI_PROPOSAL_CREATED',

          actorId,

          correlationId:
            id,

          provider:
            proposal.provider,

          model:
            proposal.model
        });

      res.status(200).json({
        correlationId:
          id,

        proposal
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'TAXGUARD_AI_UNKNOWN_FAILURE';

      const rejected =
        message ===
          'TAXGUARD_AI_REQUEST_REQUIRED' ||

        message ===
          'TAXGUARD_AI_TASK_REQUIRED' ||

        message ===
          'TAXGUARD_AI_TASK_TOO_LARGE' ||

        message ===
          'TAXGUARD_AI_CONTEXT_TOO_LARGE' ||

        message ===
          'TAXGUARD_AI_TOO_MUCH_EVIDENCE' ||

        message ===
          'TAXGUARD_AI_EVIDENCE_TOO_LARGE' ||

        message ===
          'TAXGUARD_AI_SECRET_MATERIAL_BLOCKED';

      TaxGuardAiAudit
        .record({
          eventType:
            rejected
              ? 'AI_REQUEST_REJECTED'
              : 'AI_PROVIDER_FAILURE',

          actorId,

          correlationId:
            id
        });

      const status =
        rejected
          ? 400
          : message ===
              'TAXGUARD_AI_NOT_CONFIGURED'
            ? 503
            : 502;

      res.status(status).json({
        error:
          message,

        correlationId:
          id,

        isAiProposedOnly:
          true,

        requiresHumanReview:
          true,

        externalSubmissionAllowed:
          false
      });
    }
  }
);

export default router;
`
);

/* ============================================================
   M16.6 — TEST SUITE
   ============================================================ */

write(
  'src/tests/taxGuardGeminiIntegration.test.ts',
  String.raw`
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
`
);

/* ============================================================
   COMPLETE
   ============================================================ */

console.log('');
console.log(
  '============================================'
);

console.log(
  ' TaxGuard M16 Gemini files created'
);

console.log(
  '============================================'
);

console.log('');

console.log(
  'Created:'
);

console.log(
  '  src/server/ai/TaxGuardGeminiGateway.ts'
);

console.log(
  '  src/server/ai/TaxGuardAiPolicy.ts'
);

console.log(
  '  src/server/ai/TaxGuardAiAudit.ts'
);

console.log(
  '  src/server/ai/index.ts'
);

console.log(
  '  src/server/routes/taxguard-ai.routes.ts'
);

console.log(
  '  src/tests/taxGuardGeminiIntegration.test.ts'
);

console.log('');

console.log(
  'NEXT: Mount taxguardAiRouter in server.ts.'
);

console.log('');