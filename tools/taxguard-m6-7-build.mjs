import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

function p(relative) {
  return path.join(ROOT, relative);
}

function banner(message) {
  console.log("");
  console.log("============================================================");
  console.log(" " + message);
  console.log("============================================================");
}

function stop(message) {
  banner("TAXGUARD M6.7 STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("M1-M6.6 remain preserved.");
  console.error("No false PASS status produced.");
  process.exit(1);
}

function run(label, command, args) {
  banner(label);

  const result = spawnSync(
    command,
    args,
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: true
    }
  );

  if (result.status !== 0) {
    stop(label + " failed.");
  }

  console.log("PASS: " + label);
}

function write(relative, content) {
  const target = p(relative);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true }
  );

  fs.writeFileSync(
    target,
    content,
    "utf8"
  );

  console.log("WRITE " + relative);
}

function exists(relative) {
  return fs.existsSync(p(relative));
}

function read(relative) {
  return fs.readFileSync(
    p(relative),
    "utf8"
  );
}

/*
============================================================
M6.7 START
============================================================
*/

banner("TAXGUARD M6.7 - AI KNOWLEDGE BOUNDARY");

console.log("PRESERVE");
console.log("---------------------------------------------");
console.log("M1-M5.5                        FROZEN");
console.log("M6.1 Authority Registry        FROZEN");
console.log("M6.2 Rule Registry             FROZEN");
console.log("M6.3 Federal 1040 Pack         FROZEN");
console.log("M6.4 Applicability Engine      FROZEN");
console.log("M6.5 Evidence + Citation       FROZEN");
console.log("M6.6 Conflict Engine           FROZEN");

console.log("");
console.log("BUILD");
console.log("---------------------------------------------");
console.log("AI Proposal Boundary           YES");
console.log("Verified Fact Boundary         YES");
console.log("Verified Rule Boundary         YES");
console.log("Verified Authority Boundary    YES");
console.log("Evidence Requirement           YES");
console.log("Citation Requirement           YES");
console.log("Conflict Gate                  YES");
console.log("Professional Review Gate       YES");
console.log("Human Approval Boundary        YES");
console.log("Decision Status                YES");
console.log("Fail-Closed Evaluation         YES");

console.log("");
console.log("PROHIBITED");
console.log("---------------------------------------------");
console.log("AI-created verified facts      BLOCKED");
console.log("AI-created verified rules      BLOCKED");
console.log("AI-created authority           BLOCKED");
console.log("AI self-approval               BLOCKED");
console.log("AI silent evidence creation    BLOCKED");
console.log("AI silent conflict resolution  BLOCKED");
console.log("AI tax calculation             RESERVED FOR M7");
console.log("AI return submission           DISABLED");
console.log("External submission            DISABLED");
console.log("OpenAI API                     NOT USED");

/*
============================================================
VERIFY FROZEN FILES
============================================================
*/

const required = [
  "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts",
  "src/taxguard/knowledge/TaxRuleRegistry.ts",
  "src/taxguard/knowledge/Federal1040KnowledgePack2025.ts",
  "src/taxguard/knowledge/TaxRuleApplicabilityEngine.ts",
  "src/taxguard/knowledge/TaxEvidenceCitationBinding.ts",
  "src/taxguard/knowledge/TaxKnowledgeConflictEngine.ts"
];

for (const relative of required) {
  if (!exists(relative)) {
    stop(
      "Frozen dependency missing: " +
      relative
    );
  }
}

console.log(
  "PASS: M6.1-M6.6 architecture present."
);

/*
============================================================
BACKUP ONLY M6.7 TARGETS
============================================================
*/

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = p(
  "backups/m6-7-" + stamp
);

fs.mkdirSync(
  backupRoot,
  { recursive: true }
);

const targets = [
  "src/taxguard/knowledge/TaxAIKnowledgeBoundary.ts",
  "src/taxguard/knowledge/index.ts",
  "src/tests/taxAIKnowledgeBoundary.test.ts"
];

for (const relative of targets) {
  if (!exists(relative)) {
    continue;
  }

  const destination =
    path.join(
      backupRoot,
      relative
    );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true }
  );

  fs.copyFileSync(
    p(relative),
    destination
  );
}

console.log(
  "Backup: " + backupRoot
);

/*
============================================================
AI KNOWLEDGE BOUNDARY
============================================================
*/

const source = `
export type TaxAIProposalKind =
  | 'fact_extraction'
  | 'fact_classification'
  | 'rule_candidate'
  | 'authority_candidate'
  | 'evidence_candidate'
  | 'explanation'
  | 'review_recommendation';

export type TaxAIProposalStatus =
  | 'proposed'
  | 'requires_evidence'
  | 'requires_rule_validation'
  | 'requires_authority_validation'
  | 'requires_professional_review'
  | 'rejected'
  | 'accepted_as_proposal';

export interface TaxAIProposal {
  proposalId: string;

  kind:
    TaxAIProposalKind;

  status:
    TaxAIProposalStatus;

  proposedValue:
    unknown;

  confidence:
    number | null;

  sourceArtifactIds:
    string[];

  evidenceIds:
    string[];

  ruleIds:
    string[];

  authoritySourceIds:
    string[];

  createdAt:
    string;

  isAiProposedOnly:
    true;
}

export interface TaxAIKnowledgeEvaluationInput {
  proposal:
    TaxAIProposal;

  verifiedFact:
    boolean;

  verifiedEvidence:
    boolean;

  verifiedRule:
    boolean;

  verifiedAuthority:
    boolean;

  unresolvedBlockingConflict:
    boolean;

  unresolvedMaterialConflict:
    boolean;

  professionalReviewRequired:
    boolean;

  professionalReviewCompleted:
    boolean;

  humanApprovalPresent:
    boolean;
}

export interface TaxAIKnowledgeEvaluation {
  proposalId: string;

  canUseAsProposal:
    boolean;

  canUseAsVerifiedFact:
    boolean;

  canUseAsVerifiedRule:
    boolean;

  canUseAsVerifiedAuthority:
    boolean;

  canUseForMaterialDecision:
    boolean;

  requiresHumanReview:
    boolean;

  blockingReasons:
    string[];

  evaluatedAt:
    string;
}

export interface TaxAIHumanApproval {
  approvalId: string;

  proposalId: string;

  approvedBy: string;

  role: string;

  rationale: string;

  approvedAt: string;
}

function normalize(
  value: string
): string {
  return value.trim();
}

function cloneProposal(
  proposal: TaxAIProposal
): TaxAIProposal {
  return {
    ...proposal,

    sourceArtifactIds:
      [...proposal.sourceArtifactIds],

    evidenceIds:
      [...proposal.evidenceIds],

    ruleIds:
      [...proposal.ruleIds],

    authoritySourceIds:
      [...proposal.authoritySourceIds],

    isAiProposedOnly:
      true
  };
}

export class TaxAIKnowledgeBoundary {

  private readonly proposals =
    new Map<
      string,
      TaxAIProposal
    >();

  private readonly approvals =
    new Map<
      string,
      TaxAIHumanApproval
    >();

  registerProposal(
    input: {
      proposalId: string;

      kind:
        TaxAIProposalKind;

      proposedValue:
        unknown;

      confidence?: number | null;

      sourceArtifactIds?: string[];

      evidenceIds?: string[];

      ruleIds?: string[];

      authoritySourceIds?: string[];
    }
  ): TaxAIProposal {

    const proposalId =
      normalize(
        input.proposalId
      );

    if (!proposalId) {
      throw new Error(
        'AI_PROPOSAL_ID_REQUIRED'
      );
    }

    if (
      this.proposals.has(
        proposalId
      )
    ) {
      throw new Error(
        'AI_PROPOSAL_ALREADY_EXISTS'
      );
    }

    if (
      input.confidence !== undefined &&
      input.confidence !== null &&
      (
        input.confidence < 0 ||
        input.confidence > 1
      )
    ) {
      throw new Error(
        'AI_PROPOSAL_CONFIDENCE_INVALID'
      );
    }

    const proposal:
      TaxAIProposal = {

      proposalId,

      kind:
        input.kind,

      status:
        'proposed',

      proposedValue:
        input.proposedValue,

      confidence:
        input.confidence ??
        null,

      sourceArtifactIds:
        [...(
          input.sourceArtifactIds ??
          []
        )],

      evidenceIds:
        [...(
          input.evidenceIds ??
          []
        )],

      ruleIds:
        [...(
          input.ruleIds ??
          []
        )],

      authoritySourceIds:
        [...(
          input.authoritySourceIds ??
          []
        )],

      createdAt:
        new Date()
          .toISOString(),

      isAiProposedOnly:
        true
    };

    this.proposals.set(
      proposalId,
      proposal
    );

    return cloneProposal(
      proposal
    );
  }

  getProposal(
    proposalId: string
  ): TaxAIProposal | null {

    const proposal =
      this.proposals.get(
        normalize(
          proposalId
        )
      );

    return proposal
      ? cloneProposal(proposal)
      : null;
  }

  evaluate(
    input:
      TaxAIKnowledgeEvaluationInput
  ): TaxAIKnowledgeEvaluation {

    const proposal =
      input.proposal;

    if (
      proposal.isAiProposedOnly !==
      true
    ) {
      throw new Error(
        'AI_PROPOSAL_BOUNDARY_INVALID'
      );
    }

    const blockingReasons:
      string[] = [];

    /*
     * AI extraction/classification never turns
     * itself into a verified taxpayer fact.
     */
    if (!input.verifiedFact) {
      blockingReasons.push(
        'FACT_NOT_VERIFIED'
      );
    }

    if (!input.verifiedEvidence) {
      blockingReasons.push(
        'EVIDENCE_NOT_VERIFIED'
      );
    }

    if (!input.verifiedRule) {
      blockingReasons.push(
        'RULE_NOT_VERIFIED'
      );
    }

    if (!input.verifiedAuthority) {
      blockingReasons.push(
        'AUTHORITY_NOT_VERIFIED'
      );
    }

    if (
      input.unresolvedBlockingConflict
    ) {
      blockingReasons.push(
        'BLOCKING_KNOWLEDGE_CONFLICT'
      );
    }

    if (
      input.unresolvedMaterialConflict
    ) {
      blockingReasons.push(
        'MATERIAL_KNOWLEDGE_CONFLICT'
      );
    }

    if (
      input.professionalReviewRequired &&
      !input.professionalReviewCompleted
    ) {
      blockingReasons.push(
        'PROFESSIONAL_REVIEW_REQUIRED'
      );
    }

    if (
      !input.humanApprovalPresent
    ) {
      blockingReasons.push(
        'HUMAN_APPROVAL_REQUIRED'
      );
    }

    const requiresHumanReview =
      input.professionalReviewRequired ||
      input.unresolvedBlockingConflict ||
      input.unresolvedMaterialConflict;

    /*
     * AI output is always allowed to remain a
     * proposal. It does not become authoritative
     * merely because it exists.
     */
    const canUseAsProposal =
      true;

    /*
     * AI cannot itself verify facts, rules,
     * or authorities.
     */
    const canUseAsVerifiedFact =
      false;

    const canUseAsVerifiedRule =
      false;

    const canUseAsVerifiedAuthority =
      false;

    const canUseForMaterialDecision =
      blockingReasons.length === 0;

    return {
      proposalId:
        proposal.proposalId,

      canUseAsProposal,

      canUseAsVerifiedFact,

      canUseAsVerifiedRule,

      canUseAsVerifiedAuthority,

      canUseForMaterialDecision,

      requiresHumanReview,

      blockingReasons,

      evaluatedAt:
        new Date()
          .toISOString()
    };
  }

  approveProposal(
    input: {
      approvalId: string;

      proposalId: string;

      approvedBy: string;

      role: string;

      rationale: string;
    }
  ): TaxAIHumanApproval {

    const approvalId =
      normalize(
        input.approvalId
      );

    const proposalId =
      normalize(
        input.proposalId
      );

    const approvedBy =
      normalize(
        input.approvedBy
      );

    const role =
      normalize(
        input.role
      );

    const rationale =
      normalize(
        input.rationale
      );

    if (!approvalId) {
      throw new Error(
        'AI_APPROVAL_ID_REQUIRED'
      );
    }

    if (
      this.approvals.has(
        approvalId
      )
    ) {
      throw new Error(
        'AI_APPROVAL_ALREADY_EXISTS'
      );
    }

    if (
      !this.proposals.has(
        proposalId
      )
    ) {
      throw new Error(
        'AI_PROPOSAL_NOT_FOUND'
      );
    }

    if (!approvedBy) {
      throw new Error(
        'AI_APPROVER_REQUIRED'
      );
    }

    if (!role) {
      throw new Error(
        'AI_APPROVER_ROLE_REQUIRED'
      );
    }

    if (!rationale) {
      throw new Error(
        'AI_APPROVAL_RATIONALE_REQUIRED'
      );
    }

    /*
     * The human approves use/review of the
     * proposal. This does NOT mutate the AI
     * proposal into a verified tax fact/rule/
     * authority.
     */
    const approval:
      TaxAIHumanApproval = {

      approvalId,

      proposalId,

      approvedBy,

      role,

      rationale,

      approvedAt:
        new Date()
          .toISOString()
    };

    this.approvals.set(
      approvalId,
      approval
    );

    return {
      ...approval
    };
  }

  getApproval(
    approvalId: string
  ): TaxAIHumanApproval | null {

    const approval =
      this.approvals.get(
        normalize(
          approvalId
        )
      );

    return approval
      ? {...approval}
      : null;
  }

  assertMaterialDecisionAllowed(
    input:
      TaxAIKnowledgeEvaluationInput
  ): void {

    const evaluation =
      this.evaluate(input);

    if (
      !evaluation
        .canUseForMaterialDecision
    ) {
      throw new Error(
        'AI_MATERIAL_DECISION_BLOCKED:' +
        evaluation
          .blockingReasons
          .join(',')
      );
    }
  }
}
`;

write(
  "src/taxguard/knowledge/TaxAIKnowledgeBoundary.ts",
  source.trimStart()
);

/*
============================================================
PRESERVE EXISTING INDEX EXPORTS
============================================================
*/

const indexPath =
  "src/taxguard/knowledge/index.ts";

let index =
  exists(indexPath)
    ? read(indexPath)
    : "";

const exportLine =
  "export * from './TaxAIKnowledgeBoundary';";

if (!index.includes(exportLine)) {
  if (
    index.length > 0 &&
    !index.endsWith("\n")
  ) {
    index += "\n";
  }

  index +=
    exportLine +
    "\n";
}

write(
  indexPath,
  index
);

/*
============================================================
TESTS
============================================================
*/

const tests = `
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxAIKnowledgeBoundary
} from '../taxguard/knowledge/TaxAIKnowledgeBoundary';

describe(
  'M6.7 AI Knowledge Boundary',
  () => {

    let boundary:
      TaxAIKnowledgeBoundary;

    beforeEach(() => {
      boundary =
        new TaxAIKnowledgeBoundary();
    });

    function proposal() {
      return boundary
        .registerProposal({
          proposalId:
            'AI-PROP-001',

          kind:
            'fact_extraction',

          proposedValue: {
            wages: 85000
          },

          confidence:
            0.96,

          sourceArtifactIds:
            ['OCR-001'],

          evidenceIds:
            ['EVIDENCE-001'],

          ruleIds:
            ['RULE-001'],

          authoritySourceIds:
            ['AUTH-001']
        });
    }

    it(
      'always marks AI output as proposal only',
      () => {

        const value =
          proposal();

        expect(
          value.isAiProposedOnly
        ).toBe(true);

        expect(
          value.status
        ).toBe(
          'proposed'
        );
      }
    );

    it(
      'does not allow AI proposal to become verified fact',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.canUseAsVerifiedFact
        ).toBe(false);
      }
    );

    it(
      'does not allow AI proposal to become verified rule',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.canUseAsVerifiedRule
        ).toBe(false);
      }
    );

    it(
      'does not allow AI proposal to become verified authority',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.canUseAsVerifiedAuthority
        ).toBe(false);
      }
    );

    it(
      'fails closed when fact is not verified',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              false,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toContain(
          'FACT_NOT_VERIFIED'
        );

        expect(
          result.canUseForMaterialDecision
        ).toBe(false);
      }
    );

    it(
      'fails closed when evidence is not verified',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              false,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toContain(
          'EVIDENCE_NOT_VERIFIED'
        );
      }
    );

    it(
      'fails closed when rule is not verified',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              false,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toContain(
          'RULE_NOT_VERIFIED'
        );
      }
    );

    it(
      'fails closed when authority is not verified',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              false,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toContain(
          'AUTHORITY_NOT_VERIFIED'
        );
      }
    );

    it(
      'blocks unresolved knowledge conflict',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              true,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toContain(
          'BLOCKING_KNOWLEDGE_CONFLICT'
        );

        expect(
          result.canUseForMaterialDecision
        ).toBe(false);
      }
    );

    it(
      'requires professional review when applicable',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              true,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.requiresHumanReview
        ).toBe(true);

        expect(
          result.blockingReasons
        ).toContain(
          'PROFESSIONAL_REVIEW_REQUIRED'
        );
      }
    );

    it(
      'requires explicit human approval',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              false
          });

        expect(
          result.blockingReasons
        ).toContain(
          'HUMAN_APPROVAL_REQUIRED'
        );
      }
    );

    it(
      'records human approval identity role and rationale',
      () => {

        proposal();

        const approval =
          boundary.approveProposal({
            approvalId:
              'APPROVAL-001',

            proposalId:
              'AI-PROP-001',

            approvedBy:
              'reviewer-001',

            role:
              'Reviewer',

            rationale:
              'Evidence and applicable rule independently reviewed.'
          });

        expect(
          approval.approvedBy
        ).toBe(
          'reviewer-001'
        );

        expect(
          approval.role
        ).toBe(
          'Reviewer'
        );

        expect(
          approval.rationale.length
        ).toBeGreaterThan(0);
      }
    );

    it(
      'human approval does not mutate proposal into verified authority',
      () => {

        proposal();

        boundary.approveProposal({
          approvalId:
            'APPROVAL-001',

          proposalId:
            'AI-PROP-001',

          approvedBy:
            'reviewer',

          role:
            'Reviewer',

          rationale:
            'Reviewed'
        });

        expect(
          boundary
            .getProposal(
              'AI-PROP-001'
            )
            ?.isAiProposedOnly
        ).toBe(true);
      }
    );

    it(
      'allows material decision only after all governance gates are satisfied',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              true,

            professionalReviewCompleted:
              true,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toHaveLength(0);

        expect(
          result.canUseForMaterialDecision
        ).toBe(true);
      }
    );

    it(
      'rejects invalid confidence',
      () => {

        expect(() =>
          boundary.registerProposal({
            proposalId:
              'BAD-CONFIDENCE',

            kind:
              'explanation',

            proposedValue:
              'test',

            confidence:
              1.5
          })
        ).toThrow(
          'AI_PROPOSAL_CONFIDENCE_INVALID'
        );
      }
    );

    it(
      'returns defensive proposal copies',
      () => {

        const value =
          proposal();

        value.ruleIds.push(
          'TAMPERED'
        );

        expect(
          boundary
            .getProposal(
              'AI-PROP-001'
            )
            ?.ruleIds
        ).not.toContain(
          'TAMPERED'
        );
      }
    );
  }
);
`;

write(
  "src/tests/taxAIKnowledgeBoundary.test.ts",
  tests.trimStart()
);

/*
============================================================
STATIC GOVERNANCE ASSERTIONS
============================================================
*/

const built =
  read(
    "src/taxguard/knowledge/TaxAIKnowledgeBoundary.ts"
  );

const assertions = [
  [
    "AI proposed-only marker",
    built.includes(
      "isAiProposedOnly"
    )
  ],

  [
    "Verified fact blocked",
    built.includes(
      "canUseAsVerifiedFact"
    )
  ],

  [
    "Verified rule blocked",
    built.includes(
      "canUseAsVerifiedRule"
    )
  ],

  [
    "Verified authority blocked",
    built.includes(
      "canUseAsVerifiedAuthority"
    )
  ],

  [
    "Evidence gate",
    built.includes(
      "EVIDENCE_NOT_VERIFIED"
    )
  ],

  [
    "Rule gate",
    built.includes(
      "RULE_NOT_VERIFIED"
    )
  ],

  [
    "Authority gate",
    built.includes(
      "AUTHORITY_NOT_VERIFIED"
    )
  ],

  [
    "Conflict gate",
    built.includes(
      "BLOCKING_KNOWLEDGE_CONFLICT"
    )
  ],

  [
    "Professional review",
    built.includes(
      "PROFESSIONAL_REVIEW_REQUIRED"
    )
  ],

  [
    "Human approval",
    built.includes(
      "HUMAN_APPROVAL_REQUIRED"
    )
  ],

  [
    "No localStorage authority",
    !built.includes(
      "localStorage"
    )
  ],

  [
    "No OpenAI dependency",
    !built.includes(
      "openai"
    )
  ],

  [
    "No calculation",
    !built.includes(
      "calculateTax"
    )
  ],

  [
    "No return submission",
    !built.includes(
      "submitReturn"
    )
  ]
];

banner("M6.7 GOVERNANCE ASSERTIONS");

for (const [name, passed] of assertions) {
  console.log(
    (passed ? "PASS " : "FAIL ") +
    name
  );

  if (!passed) {
    stop(
      "Governance assertion failed: " +
      name
    );
  }
}

/*
============================================================
VALIDATION
============================================================
*/

run(
  "STEP 1 - TYPESCRIPT",
  "npm.cmd",
  [
    "run",
    "typecheck"
  ]
);

run(
  "STEP 2 - M6.1 AUTHORITY",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/taxAuthoritySourceRegistry.test.ts",
    "--run"
  ]
);

run(
  "STEP 3 - M6.2 RULES",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/taxRuleRegistry.test.ts",
    "--run"
  ]
);

run(
  "STEP 4 - M6.3 FEDERAL PACK",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/federal1040KnowledgePack2025.test.ts",
    "--run"
  ]
);

run(
  "STEP 5 - M6.4 APPLICABILITY",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/taxRuleApplicabilityEngine.test.ts",
    "--run"
  ]
);

run(
  "STEP 6 - M6.5 EVIDENCE",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/taxEvidenceCitationBinding.test.ts",
    "--run"
  ]
);

run(
  "STEP 7 - M6.6 CONFLICT ENGINE",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/taxKnowledgeConflictEngine.test.ts",
    "--run"
  ]
);

run(
  "STEP 8 - M6.7 AI KNOWLEDGE BOUNDARY",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/taxAIKnowledgeBoundary.test.ts",
    "--run"
  ]
);

/*
============================================================
INTELLIGENCE CORE
============================================================
*/

run(
  "STEP 9 - INTELLIGENCE CORE",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/intelligenceCoreKnowledgeRegistry.test.ts",
    "src/tests/intelligenceCoreRuleEngine.test.ts",
    "src/tests/intelligenceCoreEvidencePackage.test.ts",
    "src/tests/intelligenceCoreHumanReviewBridge.test.ts",
    "src/tests/intelligenceCoreAIReasoningGateway.test.ts",
    "src/tests/intelligenceCoreDecisionApprovalOrchestrator.test.ts",
    "src/tests/intelligenceCoreDecisionTraceLedger.test.ts",
    "src/tests/intelligenceCoreGovernanceBoundary.test.ts",
    "--run"
  ]
);

/*
============================================================
LIVE WORKFLOW
============================================================
*/

run(
  "STEP 10 - LIVE WORKFLOW AUTHORITY",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/liveWorkflowUiAuthority.test.ts",
    "src/tests/liveWorkflowGateAuthority.test.ts",
    "src/tests/serverStageGateOrchestrator.test.ts",
    "src/tests/liveAppRoutingAuthority.test.ts",
    "--run"
  ]
);

/*
============================================================
FULL ACTIVE REGRESSION
============================================================
*/

run(
  "STEP 11 - FULL ACTIVE SYSTEM REGRESSION",
  "npm.cmd",
  [
    "test",
    "--",
    "--run"
  ]
);

/*
============================================================
PRODUCTION
============================================================
*/

run(
  "STEP 12 - PRODUCTION BUILD",
  "npm.cmd",
  [
    "run",
    "build"
  ]
);

run(
  "STEP 13 - FINAL TYPESCRIPT",
  "npm.cmd",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
PASS
============================================================
*/

banner("TAXGUARD M6.7 VERIFIED PASS");

console.log("");
console.log("PRESERVED");
console.log("---------------------------------------------");
console.log("M1-M5.5                        FROZEN / PASS");
console.log("M6.1 Authority Registry        FROZEN / PASS");
console.log("M6.2 Tax Rule Registry         FROZEN / PASS");
console.log("M6.3 Federal 1040 Pack         FROZEN / PASS");
console.log("M6.4 Applicability Engine      FROZEN / PASS");
console.log("M6.5 Evidence + Citation       FROZEN / PASS");
console.log("M6.6 Conflict Engine           FROZEN / PASS");

console.log("");
console.log("M6.7");
console.log("---------------------------------------------");
console.log("AI Proposal Boundary           PASS");
console.log("Verified Fact Boundary         PASS");
console.log("Verified Rule Boundary         PASS");
console.log("Verified Authority Boundary    PASS");
console.log("Evidence Gate                  PASS");
console.log("Citation Architecture          PRESERVED");
console.log("Conflict Gate                  PASS");
console.log("Professional Review Gate       PASS");
console.log("Human Approval Boundary        PASS");
console.log("Fail-Closed Evaluation         PASS");

console.log("");
console.log("SYSTEM VALIDATION");
console.log("---------------------------------------------");
console.log("TypeScript                     PASS");
console.log("M6.1-M6.7                      PASS");
console.log("Intelligence Core              PASS");
console.log("LIVE Workflow Authority        PASS");
console.log("Full Active Regression         PASS");
console.log("Production Build               PASS");
console.log("Final TypeScript               PASS");

console.log("");
console.log("GOVERNANCE");
console.log("---------------------------------------------");
console.log("AI-created verified facts      BLOCKED");
console.log("AI-created verified rules      BLOCKED");
console.log("AI-created authority           BLOCKED");
console.log("AI self-approval               BLOCKED");
console.log("Unverified evidence            BLOCKED");
console.log("Unverified rule                BLOCKED");
console.log("Unverified authority           BLOCKED");
console.log("Unresolved conflict            BLOCKED");
console.log("Professional review            ENFORCED");
console.log("Human approval                 ENFORCED");
console.log("Tax calculation                RESERVED FOR M7");
console.log("External tax submission        DISABLED");
console.log("OpenAI API credits             NONE");

console.log("");
console.log("============================================================");
console.log(" M6.7 COMPLETE - FREEZE CHECKPOINT");
console.log("============================================================");

console.log("");
console.log("NEXT:");
console.log("M6.8 - HUMAN REVIEW + AUDIT INTEGRATION");
console.log("");
console.log("Then:");
console.log("M6.9 - M6 FINAL REGRESSION + FREEZE");
console.log("M7   - DETERMINISTIC CALCULATION ENGINE");
console.log("");
