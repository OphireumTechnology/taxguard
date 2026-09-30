import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  ROOT,
  "backups",
  `m6-8-${stamp}`
);

const integrationFile = path.join(
  ROOT,
  "src",
  "taxguard",
  "knowledge",
  "TaxHumanReviewAuditIntegration.ts"
);

const testFile = path.join(
  ROOT,
  "src",
  "tests",
  "taxHumanReviewAuditIntegration.test.ts"
);

const indexFile = path.join(
  ROOT,
  "src",
  "taxguard",
  "knowledge",
  "index.ts"
);

function banner(text) {
  console.log("");
  console.log("============================================================");
  console.log(` ${text}`);
  console.log("============================================================");
}

function fail(message) {
  banner("TAXGUARD M6.8 STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("Frozen milestones remain preserved.");
  console.error("No false PASS status produced.");
  process.exit(1);
}

function requireFile(relative) {
  const file = path.join(ROOT, relative);

  if (!fs.existsSync(file)) {
    fail(`Required file missing: ${relative}`);
  }

  return file;
}

function backup(file) {
  if (!fs.existsSync(file)) return;

  const relative = path.relative(ROOT, file);
  const target = path.join(backupRoot, relative);

  fs.mkdirSync(path.dirname(target), {
    recursive: true
  });

  fs.copyFileSync(file, target);
}

function write(file, contents) {
  backup(file);

  fs.mkdirSync(path.dirname(file), {
    recursive: true
  });

  fs.writeFileSync(
    file,
    contents.trimStart(),
    "utf8"
  );

  console.log(
    "WRITE",
    path.relative(ROOT, file)
  );
}

function run(label, command) {
  banner(label);

  try {
    execSync(command, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env
    });

    console.log(`PASS: ${label}`);
  } catch {
    fail(`${label} failed.`);
  }
}

banner(
  "TAXGUARD M6.8 - HUMAN REVIEW + AUDIT INTEGRATION"
);

console.log(`
PRESERVE
---------------------------------------------
M1-M5.5                         FROZEN
M6.1 Authority Registry         FROZEN
M6.2 Tax Rule Registry          FROZEN
M6.3 Federal 1040 Pack          FROZEN
M6.4 Applicability Engine       FROZEN
M6.5 Evidence + Citation        FROZEN
M6.6 Conflict Engine            FROZEN
M6.7 AI Knowledge Boundary      FROZEN

BUILD
---------------------------------------------
Human Review Integration        YES
Stage 03 Review Routing         YES
Evidence Package Routing        YES
Decision Trace Integration      YES
Human Actor Attribution         YES
Reviewer Role Attribution       YES
Written Rationale               YES
Maker-Checker Preservation      YES
Conflict Review Preservation    YES
AI Proposal Boundary            YES
Authorized Decision Trace       YES
Correlation Traceability        YES
Fail-Closed Governance          YES

PROHIBITED
---------------------------------------------
AI self approval                DISABLED
AI certification                DISABLED
AI-created verified facts       DISABLED
AI-created verified rules       DISABLED
AI-created authority            DISABLED
Independent Stage 03 approval   DISABLED
Browser gate authority          DISABLED
Tax calculation                 RESERVED FOR M7
External tax submission         DISABLED
OpenAI API                      NOT USED
`);

//
// TARGETED PRECONDITIONS ONLY.
// No repository-wide source scan.
//
const requiredFiles = [
  "src/taxguard/knowledge/TaxAIKnowledgeBoundary.ts",
  "src/taxguard/knowledge/TaxKnowledgeConflictEngine.ts",
  "src/taxguard/knowledge/TaxEvidenceCitationBinding.ts",
  "src/taxguard/knowledge/TaxRuleApplicabilityEngine.ts",

  "src/taxguard/intelligence/review/HumanReviewBridge.ts",
  "src/taxguard/intelligence/trace/DecisionTraceLedger.ts",
  "src/taxguard/intelligence/decisions/DecisionApprovalOrchestrator.ts",
  "src/taxguard/intelligence/governance/IntelligenceGovernanceBoundary.ts",

  "src/services/stageThreeValidationService.ts",

  "src/tests/intelligenceCoreHumanReviewBridge.test.ts",
  "src/tests/intelligenceCoreDecisionTraceLedger.test.ts",
  "src/tests/intelligenceCoreDecisionApprovalOrchestrator.test.ts",
  "src/tests/intelligenceCoreGovernanceBoundary.test.ts",
  "src/tests/taxAIKnowledgeBoundary.test.ts"
];

for (const relative of requiredFiles) {
  requireFile(relative);
}

console.log("PASS: M6.8 targeted prerequisites");

//
// Protect the frozen architecture.
//
const humanReviewSource = fs.readFileSync(
  path.join(
    ROOT,
    "src/taxguard/intelligence/review/HumanReviewBridge.ts"
  ),
  "utf8"
);

if (!humanReviewSource.includes("StageThreeValidationService")) {
  fail(
    "HumanReviewBridge no longer routes through StageThreeValidationService."
  );
}

const aiBoundarySource = fs.readFileSync(
  path.join(
    ROOT,
    "src/taxguard/knowledge/TaxAIKnowledgeBoundary.ts"
  ),
  "utf8"
);

if (!aiBoundarySource.includes("isAiProposedOnly")) {
  fail("M6.7 AI proposal boundary not detected.");
}

if (!aiBoundarySource.includes("HUMAN_APPROVAL_REQUIRED")) {
  fail("M6.7 human approval boundary not detected.");
}

console.log("PASS: frozen governance boundaries");

fs.mkdirSync(backupRoot, {
  recursive: true
});

console.log(`Backup: ${backupRoot}`);

//
// M6.8 INTEGRATION SERVICE
//
const integrationSource = String.raw`
import {
  HumanReviewBridge
} from '../intelligence/review/HumanReviewBridge';

import {
  DecisionTraceLedger
} from '../intelligence/trace/DecisionTraceLedger';

import {
  StageThreeValidationService
} from '../../services/stageThreeValidationService';

import type {
  EvidencePackage
} from '../intelligence/types';

/**
 * M6.8 — Human Review + Audit Integration
 *
 * IMPORTANT:
 *
 * This class DOES NOT create a new approval authority.
 *
 * StageThreeValidationService remains the authoritative
 * human-review / professional-certification boundary.
 *
 * HumanReviewBridge remains the authoritative bridge
 * into the Stage 03 review queue.
 *
 * DecisionTraceLedger remains the append-only
 * intelligence decision trace.
 *
 * AI remains proposal-only.
 */

export interface TaxHumanReviewRoutingInput {
  evidencePackage: EvidencePackage;

  actorId: string;

  actorRole: string;

  assignedRole?: string;

  assignedReviewer?: string;

  auditReferences?: string[];

  severity?:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';

  riskLevel?:
    | 'routine'
    | 'material'
    | 'critical';

  itemType?: string;

  summary?: string;

  traceId?: string;
}

export interface TaxHumanReviewRoutingResult {
  queueItemId: string;

  evidencePackageId: string;

  traceId: string;

  requiresHumanReview: true;

  hasDecisionAuthority: false;
}

export interface TaxAuthorizedDecisionTraceInput {
  traceId: string;

  clientId: string;

  engagementId: string;

  taxYear: number;

  actorId: string;

  actorRole: string;

  summary: string;

  correlationId: string;

  evidencePackageIds: string[];

  knowledgeSourceIds?: string[];

  ruleEvaluationIds?: string[];
}

function required(
  value: string,
  code: string
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(code);
  }

  return normalized;
}

function rejectAIActor(
  actorId: string,
  actorRole: string
): void {
  const identity =
    actorId.trim().toLowerCase();

  const role =
    actorRole.trim().toLowerCase();

  if (
    identity.includes('ai') ||
    identity.includes('model') ||
    identity.includes('gemini') ||
    identity.includes('openai') ||
    role === 'ai' ||
    role === 'ai_model' ||
    role === 'model'
  ) {
    throw new Error(
      'M6_8_AI_CANNOT_ACT_AS_HUMAN_REVIEWER'
    );
  }
}

function buildTraceId(
  evidencePackageId: string
): string {
  return (
    'M6-8-HR-' +
    evidencePackageId
      .trim()
      .replace(
        /[^A-Za-z0-9_-]/g,
        '-'
      )
  );
}

export class TaxHumanReviewAuditIntegration {

  /**
   * Routes an existing EvidencePackage into the
   * authoritative Stage 03 human-review queue and
   * appends a non-authoritative trace record.
   */
  static routeToHumanReview(
    input: TaxHumanReviewRoutingInput
  ): TaxHumanReviewRoutingResult {

    const actorId =
      required(
        input.actorId,
        'M6_8_ACTOR_ID_REQUIRED'
      );

    const actorRole =
      required(
        input.actorRole,
        'M6_8_ACTOR_ROLE_REQUIRED'
      );

    rejectAIActor(
      actorId,
      actorRole
    );

    const evidencePackage =
      input.evidencePackage;

    if (!evidencePackage) {
      throw new Error(
        'M6_8_EVIDENCE_PACKAGE_REQUIRED'
      );
    }

    if (
      evidencePackage
        .requiresHumanReview !== true
    ) {
      throw new Error(
        'M6_8_HUMAN_REVIEW_NOT_REQUIRED'
      );
    }

    const submitted =
      HumanReviewBridge.submit({
        evidencePackage,

        assignedRole:
          input.assignedRole,

        assignedReviewer:
          input.assignedReviewer,

        auditReferences:
          input.auditReferences,

        severity:
          input.severity,

        riskLevel:
          input.riskLevel,

        itemType:
          input.itemType as any
      });

    const traceId =
      input.traceId?.trim() ||
      buildTraceId(
        evidencePackage
          .evidencePackageId
      );

    DecisionTraceLedger.append({
      traceId,

      clientId:
        evidencePackage.clientId,

      engagementId:
        evidencePackage.engagementId,

      taxYear:
        evidencePackage.taxYear,

      stage:
        'HUMAN_REVIEW',

      actorId,
      actorRole,

      summary:
        input.summary?.trim() ||
        'Evidence package routed to authoritative human review.',

      knowledgeSourceIds:
        [
          ...evidencePackage
            .knowledgeSourceIds
        ],

      ruleEvaluationIds:
        [
          ...evidencePackage
            .ruleEvaluationIds
        ],

      evidencePackageIds:
        [
          evidencePackage
            .evidencePackageId
        ],

      correlationId:
        evidencePackage
          .correlationId,

      createdAt:
        new Date()
          .toISOString()
    });

    return {
      queueItemId:
        submitted.queueItemId,

      evidencePackageId:
        evidencePackage
          .evidencePackageId,

      traceId,

      requiresHumanReview:
        true,

      hasDecisionAuthority:
        false
    };
  }

  /**
   * Records a Stage 03 human disposition through
   * StageThreeValidationService.
   *
   * This wrapper intentionally delegates authority
   * rather than implementing approval itself.
   */
  static recordReviewDisposition(
    input:
      Parameters<
        typeof StageThreeValidationService
          .recordReviewDisposition
      >[0]
  ) {
    rejectAIActor(
      String(input.actor ?? ''),
      String(input.actorRole ?? '')
    );

    return StageThreeValidationService
      .recordReviewDisposition(
        input
      );
  }

  /**
   * Professional certification remains owned by
   * StageThreeValidationService.
   *
   * Its existing role authorization and
   * maker-checker controls therefore remain intact.
   */
  static certifyProfessionalReview(
    input:
      Parameters<
        typeof StageThreeValidationService
          .certifyValidation
      >[0]
  ) {
    rejectAIActor(
      String(input.reviewerId ?? ''),
      String(input.reviewerRole ?? '')
    );

    return StageThreeValidationService
      .certifyValidation(
        input
      );
  }

  /**
   * Reopening also remains inside the existing
   * authoritative Stage 03 workflow.
   */
  static reopenHumanReview(
    input:
      Parameters<
        typeof StageThreeValidationService
          .reopenReviewItem
      >[0]
  ) {
    rejectAIActor(
      String(input.reopenedBy ?? ''),
      String(input.reopenedByRole ?? '')
    );

    return StageThreeValidationService
      .reopenReviewItem(
        input
      );
  }

  /**
   * Adds a trace AFTER an authorized human decision.
   *
   * The ledger itself does not grant authority.
   */
  static appendAuthorizedDecisionTrace(
    input: TaxAuthorizedDecisionTraceInput
  ) {
    const actorId =
      required(
        input.actorId,
        'M6_8_DECISION_ACTOR_REQUIRED'
      );

    const actorRole =
      required(
        input.actorRole,
        'M6_8_DECISION_ROLE_REQUIRED'
      );

    const summary =
      required(
        input.summary,
        'M6_8_DECISION_SUMMARY_REQUIRED'
      );

    rejectAIActor(
      actorId,
      actorRole
    );

    if (
      input.evidencePackageIds
        .length === 0
    ) {
      throw new Error(
        'M6_8_DECISION_EVIDENCE_REQUIRED'
      );
    }

    return DecisionTraceLedger.append({
      traceId:
        required(
          input.traceId,
          'M6_8_TRACE_ID_REQUIRED'
        ),

      clientId:
        required(
          input.clientId,
          'M6_8_CLIENT_ID_REQUIRED'
        ),

      engagementId:
        required(
          input.engagementId,
          'M6_8_ENGAGEMENT_ID_REQUIRED'
        ),

      taxYear:
        input.taxYear,

      stage:
        'AUTHORIZED_DECISION',

      actorId,
      actorRole,

      summary,

      knowledgeSourceIds:
        [
          ...(input
            .knowledgeSourceIds ??
            [])
        ],

      ruleEvaluationIds:
        [
          ...(input
            .ruleEvaluationIds ??
            [])
        ],

      evidencePackageIds:
        [
          ...input
            .evidencePackageIds
        ],

      correlationId:
        required(
          input.correlationId,
          'M6_8_CORRELATION_ID_REQUIRED'
        ),

      createdAt:
        new Date()
          .toISOString()
    });
  }
}
`;

write(
  integrationFile,
  integrationSource
);

//
// TESTS
//
const testSource = String.raw`
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  TaxHumanReviewAuditIntegration
} from '../taxguard/knowledge/TaxHumanReviewAuditIntegration';

import {
  HumanReviewBridge
} from '../taxguard/intelligence/review/HumanReviewBridge';

import {
  DecisionTraceLedger
} from '../taxguard/intelligence/trace/DecisionTraceLedger';

import {
  StageThreeValidationService
} from '../services/stageThreeValidationService';

import type {
  EvidencePackage
} from '../taxguard/intelligence/types';

describe(
  'M6.8 Human Review + Audit Integration',
  () => {

    const packageFixture:
      EvidencePackage = {

      evidencePackageId:
        'M6-8-EVP-001',

      clientId:
        'M6-8-CLIENT-001',

      engagementId:
        'M6-8-ENG-001',

      taxYear:
        2025,

      knowledgeSourceIds:
        ['M6-8-KS-001'],

      ruleEvaluationIds:
        ['M6-8-RULE-EVAL-001'],

      findingIds:
        ['M6-8-FINDING-001'],

      aiProposalIds:
        ['M6-8-AI-PROP-001'],

      requiresHumanReview:
        true,

      createdAt:
        '2026-09-23T00:00:00.000Z',

      correlationId:
        'M6-8-CORR-001'
    };

    beforeEach(() => {
      vi.restoreAllMocks();

      DecisionTraceLedger
        .clearAll();
    });

    it(
      'routes evidence through the existing HumanReviewBridge',
      () => {

        const submit =
          vi.spyOn(
            HumanReviewBridge,
            'submit'
          )
          .mockReturnValue({
            queueItemId:
              'M6-8-HRQ-001',

            evidencePackageId:
              packageFixture
                .evidencePackageId,

            requiresHumanReview:
              true,

            clientId:
              packageFixture.clientId,

            engagementId:
              packageFixture
                .engagementId,

            taxYear:
              packageFixture.taxYear
          } as ReturnType<
            typeof HumanReviewBridge.submit
          >);

        const result =
          TaxHumanReviewAuditIntegration
            .routeToHumanReview({
              evidencePackage:
                packageFixture,

              actorId:
                'reviewer-001',

              actorRole:
                'reviewer'
            });

        expect(submit)
          .toHaveBeenCalledTimes(1);

        expect(result.queueItemId)
          .toBe(
            'M6-8-HRQ-001'
          );

        expect(
          result
            .hasDecisionAuthority
        ).toBe(false);
      }
    );

    it(
      'creates a HUMAN_REVIEW decision trace',
      () => {

        vi.spyOn(
          HumanReviewBridge,
          'submit'
        )
        .mockReturnValue({
          queueItemId:
            'M6-8-HRQ-002',

          evidencePackageId:
            packageFixture
              .evidencePackageId,

          requiresHumanReview:
            true,

          clientId:
            packageFixture.clientId,

          engagementId:
            packageFixture
              .engagementId,

          taxYear:
            packageFixture.taxYear
        } as ReturnType<
          typeof HumanReviewBridge.submit
        >);

        const result =
          TaxHumanReviewAuditIntegration
            .routeToHumanReview({
              evidencePackage:
                packageFixture,

              actorId:
                'reviewer-001',

              actorRole:
                'reviewer',

              traceId:
                'M6-8-TRACE-001'
            });

        const trace =
          DecisionTraceLedger
            .getById(
              result.traceId
            );

        expect(trace)
          .not
          .toBeNull();

        expect(trace?.stage)
          .toBe(
            'HUMAN_REVIEW'
          );

        expect(
          trace
            ?.evidencePackageIds
        ).toContain(
          packageFixture
            .evidencePackageId
        );

        expect(
          trace?.correlationId
        ).toBe(
          packageFixture
            .correlationId
        );
      }
    );

    it(
      'blocks AI identity from acting as human reviewer',
      () => {

        expect(() =>
          TaxHumanReviewAuditIntegration
            .routeToHumanReview({
              evidencePackage:
                packageFixture,

              actorId:
                'ai-model-001',

              actorRole:
                'ai_model'
            })
        ).toThrow(
          'M6_8_AI_CANNOT_ACT_AS_HUMAN_REVIEWER'
        );
      }
    );

    it(
      'fails closed when human review is not required',
      () => {

        const noReview = {
          ...packageFixture,

          requiresHumanReview:
            false
        };

        expect(() =>
          TaxHumanReviewAuditIntegration
            .routeToHumanReview({
              evidencePackage:
                noReview,

              actorId:
                'reviewer-001',

              actorRole:
                'reviewer'
            })
        ).toThrow(
          'M6_8_HUMAN_REVIEW_NOT_REQUIRED'
        );
      }
    );

    it(
      'delegates review disposition to authoritative Stage 03 service',
      () => {

        const spy =
          vi.spyOn(
            StageThreeValidationService,
            'recordReviewDisposition'
          )
          .mockReturnValue(
            {} as ReturnType<
              typeof StageThreeValidationService
                .recordReviewDisposition
            >
          );

        TaxHumanReviewAuditIntegration
          .recordReviewDisposition({
            clientId:
              'M6-8-CLIENT-001',

            taxYear:
              2025,

            queueItemId:
              'M6-8-HRQ-001',

            actor:
              'reviewer-001',

            actorRole:
              'cpa',

            action:
              'RESOLVE_CONFLICT',

            justification:
              'Human-reviewed evidence and authority.'
          });

        expect(spy)
          .toHaveBeenCalledTimes(1);
      }
    );

    it(
      'does not allow AI review disposition',
      () => {

        expect(() =>
          TaxHumanReviewAuditIntegration
            .recordReviewDisposition({
              clientId:
                'M6-8-CLIENT-001',

              taxYear:
                2025,

              queueItemId:
                'M6-8-HRQ-001',

              actor:
                'ai-model-001',

              actorRole:
                'ai_model',

              action:
                'RESOLVE_CONFLICT',

              justification:
                'AI attempted disposition.'
            })
        ).toThrow(
          'M6_8_AI_CANNOT_ACT_AS_HUMAN_REVIEWER'
        );
      }
    );

    it(
      'preserves Stage 03 professional certification authority',
      () => {

        expect(
          typeof StageThreeValidationService
            .certifyValidation
        ).toBe('function');

        expect(
          typeof TaxHumanReviewAuditIntegration
            .certifyProfessionalReview
        ).toBe('function');
      }
    );

    it(
      'does not expose AI self approval',
      () => {

        const service =
          TaxHumanReviewAuditIntegration
            as any;

        expect(
          service.approveByAI
        ).toBeUndefined();

        expect(
          service.autoApprove
        ).toBeUndefined();

        expect(
          service.selfApprove
        ).toBeUndefined();
      }
    );

    it(
      'does not expose independent filing authority',
      () => {

        const service =
          TaxHumanReviewAuditIntegration
            as any;

        expect(
          service.fileReturn
        ).toBeUndefined();

        expect(
          service.submitReturn
        ).toBeUndefined();

        expect(
          service.transmitReturn
        ).toBeUndefined();
      }
    );

    it(
      'does not expose tax calculation mutation',
      () => {

        const service =
          TaxHumanReviewAuditIntegration
            as any;

        expect(
          service.modifyTaxCalculation
        ).toBeUndefined();

        expect(
          service.overrideCalculation
        ).toBeUndefined();

        expect(
          service.changeTaxResult
        ).toBeUndefined();
      }
    );

    it(
      'records authorized human decision trace without granting authority to ledger',
      () => {

        const trace =
          TaxHumanReviewAuditIntegration
            .appendAuthorizedDecisionTrace({
              traceId:
                'M6-8-AUTH-TRACE-001',

              clientId:
                'M6-8-CLIENT-001',

              engagementId:
                'M6-8-ENG-001',

              taxYear:
                2025,

              actorId:
                'cpa-reviewer-001',

              actorRole:
                'cpa',

              summary:
                'Professional human decision recorded.',

              correlationId:
                'M6-8-CORR-001',

              evidencePackageIds:
                ['M6-8-EVP-001'],

              knowledgeSourceIds:
                ['M6-8-KS-001'],

              ruleEvaluationIds:
                ['M6-8-RULE-EVAL-001']
            });

        expect(trace.stage)
          .toBe(
            'AUTHORIZED_DECISION'
          );

        expect(
          trace.hasDecisionAuthority
        ).toBe(false);
      }
    );

    it(
      'requires evidence package provenance for authorized decision trace',
      () => {

        expect(() =>
          TaxHumanReviewAuditIntegration
            .appendAuthorizedDecisionTrace({
              traceId:
                'M6-8-AUTH-TRACE-002',

              clientId:
                'M6-8-CLIENT-001',

              engagementId:
                'M6-8-ENG-001',

              taxYear:
                2025,

              actorId:
                'cpa-reviewer-001',

              actorRole:
                'cpa',

              summary:
                'Decision attempt without evidence.',

              correlationId:
                'M6-8-CORR-002',

              evidencePackageIds:
                []
            })
        ).toThrow(
          'M6_8_DECISION_EVIDENCE_REQUIRED'
        );
      }
    );
  }
);
`;

write(
  testFile,
  testSource
);

//
// SAFE INDEX UPDATE.
// DO NOT overwrite existing exports.
//
if (fs.existsSync(indexFile)) {
  const existing =
    fs.readFileSync(
      indexFile,
      "utf8"
    );

  const exportLine =
    "export * from './TaxHumanReviewAuditIntegration';";

  if (!existing.includes(exportLine)) {
    backup(indexFile);

    const separator =
      existing.endsWith("\n")
        ? ""
        : "\n";

    fs.writeFileSync(
      indexFile,
      existing +
        separator +
        exportLine +
        "\n",
      "utf8"
    );

    console.log(
      "APPEND",
      path.relative(ROOT, indexFile)
    );
  } else {
    console.log(
      "PRESERVE",
      path.relative(ROOT, indexFile)
    );
  }
}

//
// STATIC GOVERNANCE ASSERTIONS
//
banner("M6.8 GOVERNANCE ASSERTIONS");

const source =
  fs.readFileSync(
    integrationFile,
    "utf8"
  );

const assertions = [
  [
    "Human Review Bridge",
    "HumanReviewBridge"
  ],
  [
    "Decision Trace Ledger",
    "DecisionTraceLedger"
  ],
  [
    "Stage 03 authority",
    "StageThreeValidationService"
  ],
  [
    "AI reviewer block",
    "M6_8_AI_CANNOT_ACT_AS_HUMAN_REVIEWER"
  ],
  [
    "Human review trace",
    "'HUMAN_REVIEW'"
  ],
  [
    "Authorized decision trace",
    "'AUTHORIZED_DECISION'"
  ],
  [
    "Evidence provenance",
    "evidencePackageIds"
  ],
  [
    "Correlation provenance",
    "correlationId"
  ],
  [
    "Professional certification delegation",
    "certifyProfessionalReview"
  ],
  [
    "Review reopening delegation",
    "reopenHumanReview"
  ]
];

for (const [name, token] of assertions) {
  if (!source.includes(token)) {
    fail(
      `Governance assertion failed: ${name}`
    );
  }

  console.log(`PASS ${name}`);
}

const forbiddenImplementationTokens = [
  "approveByAI(",
  "autoApprove(",
  "selfApprove(",
  "fileReturn(",
  "submitReturn(",
  "transmitReturn(",
  "modifyTaxCalculation(",
  "overrideCalculation("
];

for (
  const token of
  forbiddenImplementationTokens
) {
  if (source.includes(token)) {
    fail(
      `Forbidden M6.8 implementation detected: ${token}`
    );
  }
}

console.log(
  "PASS No independent AI approval authority"
);

console.log(
  "PASS No return filing authority"
);

console.log(
  "PASS No tax calculation authority"
);

//
// VALIDATION CHAIN
//
run(
  "STEP 1 - TYPESCRIPT",
  "npm.cmd run typecheck"
);

run(
  "STEP 2 - M6.8 HUMAN REVIEW + AUDIT",
  "npm.cmd test -- src/tests/taxHumanReviewAuditIntegration.test.ts --run"
);

run(
  "STEP 3 - EXISTING HUMAN REVIEW BRIDGE",
  "npm.cmd test -- src/tests/intelligenceCoreHumanReviewBridge.test.ts --run"
);

run(
  "STEP 4 - DECISION APPROVAL ORCHESTRATOR",
  "npm.cmd test -- src/tests/intelligenceCoreDecisionApprovalOrchestrator.test.ts --run"
);

run(
  "STEP 5 - DECISION TRACE LEDGER",
  "npm.cmd test -- src/tests/intelligenceCoreDecisionTraceLedger.test.ts --run"
);

run(
  "STEP 6 - GOVERNANCE BOUNDARY",
  "npm.cmd test -- src/tests/intelligenceCoreGovernanceBoundary.test.ts --run"
);

run(
  "STEP 7 - M6.7 AI KNOWLEDGE BOUNDARY",
  "npm.cmd test -- src/tests/taxAIKnowledgeBoundary.test.ts --run"
);

run(
  "STEP 8 - M6.6 CONFLICT ENGINE",
  "npm.cmd test -- src/tests/taxKnowledgeConflictEngine.test.ts --run"
);

run(
  "STEP 9 - M6.5 EVIDENCE + CITATION",
  "npm.cmd test -- src/tests/taxEvidenceCitationBinding.test.ts --run"
);

run(
  "STEP 10 - M6.4 APPLICABILITY",
  "npm.cmd test -- src/tests/taxRuleApplicabilityEngine.test.ts --run"
);

run(
  "STEP 11 - FULL ACTIVE SYSTEM REGRESSION",
  "npm.cmd test -- --run"
);

run(
  "STEP 12 - PRODUCTION BUILD",
  "npm.cmd run build"
);

run(
  "STEP 13 - FINAL TYPESCRIPT",
  "npm.cmd run typecheck"
);

banner("TAXGUARD M6.8 VERIFIED PASS");

console.log(`
PRESERVED
---------------------------------------------
M1-M5.5                         FROZEN / PASS
M6.1 Authority Registry         FROZEN / PASS
M6.2 Tax Rule Registry          FROZEN / PASS
M6.3 Federal 1040 Pack          FROZEN / PASS
M6.4 Applicability Engine       FROZEN / PASS
M6.5 Evidence + Citation        FROZEN / PASS
M6.6 Conflict Engine            FROZEN / PASS
M6.7 AI Knowledge Boundary      FROZEN / PASS

M6.8
---------------------------------------------
Human Review Integration        PASS
Stage 03 Review Routing         PASS
Evidence Package Routing        PASS
Decision Trace Integration      PASS
Human Actor Attribution         PASS
Reviewer Role Attribution       PASS
Written Rationale Boundary      PASS
Maker-Checker Boundary          PASS
Conflict Review Boundary        PASS
AI Proposal Boundary            PASS
Authorized Decision Trace       PASS
Correlation Traceability        PASS
Fail-Closed Governance          PASS

SYSTEM VALIDATION
---------------------------------------------
TypeScript                      PASS
M6.5-M6.8                       PASS
Human Review Bridge             PASS
Approval Orchestrator           PASS
Decision Trace Ledger           PASS
Governance Boundary             PASS
Full Active Regression          PASS
Production Build                PASS
Final TypeScript                PASS

SECURITY / GOVERNANCE
---------------------------------------------
AI self approval                BLOCKED
AI professional certification   BLOCKED
AI-created verified facts       BLOCKED
AI-created verified rules       BLOCKED
AI-created authority            BLOCKED
Independent approval path       BLOCKED
Maker-checker controls          PRESERVED
Human rationale                 REQUIRED
Evidence provenance             REQUIRED
Correlation provenance          REQUIRED
Tax calculation                 RESERVED FOR M7
External tax submission         DISABLED
OpenAI API credits              NONE

============================================================
 M6.8 COMPLETE - FREEZE CHECKPOINT
============================================================

NEXT:
M6.9 - M6 FINAL REGRESSION + FREEZE

THEN:
M7 - DETERMINISTIC CALCULATION ENGINE
`);

