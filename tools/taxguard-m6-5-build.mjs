import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

function banner(text) {
  console.log("");
  console.log("============================================================");
  console.log(" " + text);
  console.log("============================================================");
}

function stop(message) {
  banner("TAXGUARD M6.5 STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("No false PASS status produced.");
  process.exit(1);
}

function run(label, args) {
  banner(label);

  const result = spawnSync("npm.cmd", args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true
  });

  if (result.status !== 0) {
    stop(label + " failed.");
  }

  console.log("PASS: " + label);
}

function file(relative) {
  return path.join(ROOT, relative);
}

function exists(relative) {
  return fs.existsSync(file(relative));
}

function read(relative) {
  return fs.readFileSync(file(relative), "utf8");
}

function write(relative, content) {
  const target = file(relative);

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

/*
============================================================
START
============================================================
*/

banner("TAXGUARD M6.5 - EVIDENCE + CITATION BINDING");

console.log("PRESERVE:");
console.log("M1-M5.5                         FROZEN");
console.log("M6.1 Authority Registry         FROZEN");
console.log("M6.2 Rule Registry              FROZEN");
console.log("M6.3 Federal 1040 Pack          FROZEN");
console.log("M6.4 Applicability Engine       FROZEN");

console.log("");
console.log("BUILD:");
console.log("Evidence Record                 YES");
console.log("Evidence Hash Binding           YES");
console.log("Source Document Binding         YES");
console.log("Validated Fact Binding          YES");
console.log("Rule Binding                    YES");
console.log("Authority Binding               YES");
console.log("Citation Binding                YES");
console.log("Tax-Year Binding                YES");
console.log("Decision Evidence Package       YES");
console.log("Integrity Validation            YES");
console.log("Professional Review Flag        YES");
console.log("Fail-Closed Provenance          YES");

console.log("");
console.log("PROHIBITED:");
console.log("AI-created evidence             DISABLED");
console.log("AI-created verified facts       DISABLED");
console.log("Unverified rule as decision     DISABLED");
console.log("Missing evidence guessing       DISABLED");
console.log("Missing citation guessing       DISABLED");
console.log("Tax calculation                 RESERVED FOR M7");
console.log("External tax submission         DISABLED");
console.log("OpenAI API                      NOT USED");

/*
============================================================
VERIFY FROZEN CHECKPOINTS
============================================================
*/

const requiredFiles = [
  "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts",
  "src/taxguard/knowledge/TaxRuleRegistry.ts",
  "src/taxguard/knowledge/Federal1040KnowledgePack2025.ts",
  "src/taxguard/knowledge/TaxRuleApplicabilityEngine.ts"
];

for (const required of requiredFiles) {
  if (!exists(required)) {
    stop(
      "Required frozen checkpoint missing: " +
      required
    );
  }
}

const authoritySource = read(
  "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts"
);

const ruleSource = read(
  "src/taxguard/knowledge/TaxRuleRegistry.ts"
);

const federalSource = read(
  "src/taxguard/knowledge/Federal1040KnowledgePack2025.ts"
);

const applicabilitySource = read(
  "src/taxguard/knowledge/TaxRuleApplicabilityEngine.ts"
);

const checkpointAssertions = [
  [
    "M6.1 Authority Registry",
    authoritySource.includes(
      "TaxAuthoritySourceRegistry"
    )
  ],
  [
    "M6.1 Usable Authority Gate",
    authoritySource.includes(
      "isUsableAuthority"
    )
  ],
  [
    "M6.2 Rule Registry",
    ruleSource.includes(
      "TaxRuleRegistry"
    )
  ],
  [
    "M6.2 Authority Validation",
    ruleSource.includes(
      "validateAuthority"
    )
  ],
  [
    "M6.3 Federal Pack",
    federalSource.includes(
      "FEDERAL_1040_2025_PACK_ID"
    )
  ],
  [
    "M6.4 Applicability Engine",
    applicabilitySource.includes(
      "TaxRuleApplicabilityEngine"
    )
  ],
  [
    "M6.4 Usable Rule Gate",
    applicabilitySource.includes(
      "isUsableRule"
    )
  ]
];

for (const [name, ok] of checkpointAssertions) {
  if (!ok) {
    stop(
      "Frozen checkpoint validation failed: " +
      name
    );
  }

  console.log("PASS: " + name);
}

/*
============================================================
BACKUP M6.5 TARGETS ONLY
============================================================
*/

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = file(
  "backups/m6-5-" + stamp
);

fs.mkdirSync(
  backupRoot,
  { recursive: true }
);

const targets = [
  "src/taxguard/knowledge/TaxEvidenceCitationBinding.ts",
  "src/taxguard/knowledge/index.ts",
  "src/tests/taxEvidenceCitationBinding.test.ts"
];

for (const relative of targets) {
  if (!exists(relative)) {
    continue;
  }

  const destination = path.join(
    backupRoot,
    relative
  );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true }
  );

  fs.copyFileSync(
    file(relative),
    destination
  );
}

console.log("Backup: " + backupRoot);

/*
============================================================
M6.5 EVIDENCE + CITATION BINDING
============================================================
*/

const bindingSource = `
import type {
  TaxAuthoritySourceRegistry
} from './TaxAuthoritySourceRegistry';

import type {
  TaxRule,
  TaxRuleRegistry
} from './TaxRuleRegistry';

import type {
  TaxRuleApplicabilityResult
} from './TaxRuleApplicabilityEngine';

export type EvidenceValidationState =
  | 'pending'
  | 'validated'
  | 'rejected'
  | 'quarantined';

export type EvidenceOrigin =
  | 'uploaded_document'
  | 'validated_taxpayer_fact'
  | 'system_record'
  | 'professional_review'
  | 'external_verified_source';

export interface EvidenceLocator {
  pageNumber?: number;

  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  fieldName?: string;

  sourcePath?: string;
}

export interface TaxEvidenceRecord {
  evidenceId: string;

  origin: EvidenceOrigin;

  documentId?: string;

  documentHash?: string;

  artifactId?: string;

  factPath?: string;

  factValue?: unknown;

  locator?: EvidenceLocator;

  validationState:
    EvidenceValidationState;

  validatedBy?: string;

  validatedAt?: string;

  createdAt: string;
}

export interface TaxEvidenceAuthorityCitation {
  sourceId: string;

  sourceTitle: string;

  sourceUrl?: string;

  taxYear: number;

  locator?: string;

  section?: string;

  explanation?: string;
}

export interface RuleEvidenceBinding {
  bindingId: string;

  ruleId: string;

  taxYear: number;

  jurisdictionCode: string;

  evidenceIds: string[];

  citations: TaxEvidenceAuthorityCitation[];

  createdAt: string;

  createdBy: string;
}

export interface DecisionEvidencePackage {
  packageId: string;

  ruleId: string;

  ruleName: string;

  taxYear: number;

  jurisdictionCode: string;

  applicabilityState:
    TaxRuleApplicabilityResult['state'];

  applicable: boolean;

  professionalReviewRequired: boolean;

  evidence: TaxEvidenceRecord[];

  citations: TaxEvidenceAuthorityCitation[];

  integrity: {
    evidenceComplete: boolean;
    citationComplete: boolean;
    authorityVerified: boolean;
    ruleVerified: boolean;
    taxYearAligned: boolean;
    jurisdictionAligned: boolean;
  };

  readyForDecisionUse: boolean;

  reasonCodes: string[];

  createdAt: string;
}

function normalize(value: string): string {
  return value.trim();
}

function normalizeCode(value: string): string {
  return value
    .trim()
    .toUpperCase();
}

function cloneEvidence(
  evidence: TaxEvidenceRecord
): TaxEvidenceRecord {
  return {
    ...evidence,

    locator:
      evidence.locator
        ? {
            ...evidence.locator,

            boundingBox:
              evidence.locator.boundingBox
                ? {
                    ...evidence.locator.boundingBox
                  }
                : undefined
          }
        : undefined
  };
}

function cloneCitation(
  citation: TaxEvidenceAuthorityCitation
): TaxEvidenceAuthorityCitation {
  return {
    ...citation
  };
}

function assertDate(
  value: string | undefined,
  errorCode: string
): void {
  if (!value) {
    return;
  }

  if (
    Number.isNaN(
      Date.parse(value)
    )
  ) {
    throw new Error(errorCode);
  }
}

function isValidHash(
  value: string
): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function uniqueStrings(
  values: string[]
): string[] {
  return [
    ...new Set(
      values
        .map(value => value.trim())
        .filter(Boolean)
    )
  ];
}

export class TaxEvidenceCitationBindingService {

  private readonly evidence =
    new Map<string, TaxEvidenceRecord>();

  private readonly bindings =
    new Map<string, RuleEvidenceBinding>();

  constructor(
    private readonly authorities:
      TaxAuthoritySourceRegistry,

    private readonly rules:
      TaxRuleRegistry
  ) {}

  registerEvidence(
    input: Omit<
      TaxEvidenceRecord,
      'createdAt'
    >
  ): TaxEvidenceRecord {

    const evidenceId =
      normalize(input.evidenceId);

    if (!evidenceId) {
      throw new Error(
        'EVIDENCE_ID_REQUIRED'
      );
    }

    if (
      this.evidence.has(
        evidenceId
      )
    ) {
      throw new Error(
        'EVIDENCE_ALREADY_EXISTS'
      );
    }

    /*
     * Uploaded documents must carry a cryptographic
     * source hash. M6.5 does not silently invent one.
     */

    if (
      input.origin ===
        'uploaded_document'
    ) {
      if (
        !input.documentId ||
        !normalize(input.documentId)
      ) {
        throw new Error(
          'EVIDENCE_DOCUMENT_ID_REQUIRED'
        );
      }

      if (
        !input.documentHash ||
        !isValidHash(
          input.documentHash
        )
      ) {
        throw new Error(
          'VALID_SHA256_DOCUMENT_HASH_REQUIRED'
        );
      }
    }

    /*
     * Validated taxpayer facts require a fact path.
     */

    if (
      input.origin ===
        'validated_taxpayer_fact' &&
      (
        !input.factPath ||
        !normalize(input.factPath)
      )
    ) {
      throw new Error(
        'EVIDENCE_FACT_PATH_REQUIRED'
      );
    }

    if (
      input.validationState ===
        'validated'
    ) {
      if (
        !input.validatedBy ||
        !normalize(
          input.validatedBy
        )
      ) {
        throw new Error(
          'EVIDENCE_VALIDATOR_REQUIRED'
        );
      }

      if (!input.validatedAt) {
        throw new Error(
          'EVIDENCE_VALIDATION_TIME_REQUIRED'
        );
      }

      assertDate(
        input.validatedAt,
        'INVALID_EVIDENCE_VALIDATION_DATE'
      );
    }

    const record:
      TaxEvidenceRecord = {
        ...input,

        evidenceId,

        documentId:
          input.documentId
            ? normalize(
                input.documentId
              )
            : undefined,

        factPath:
          input.factPath
            ? normalize(
                input.factPath
              )
            : undefined,

        validatedBy:
          input.validatedBy
            ? normalize(
                input.validatedBy
              )
            : undefined,

        createdAt:
          new Date().toISOString()
      };

    this.evidence.set(
      evidenceId,
      record
    );

    return cloneEvidence(record);
  }

  getEvidence(
    evidenceId: string
  ): TaxEvidenceRecord | null {

    const record =
      this.evidence.get(
        normalize(evidenceId)
      );

    return record
      ? cloneEvidence(record)
      : null;
  }

  validateEvidence(
    evidenceId: string,
    reviewer: string,
    reviewedAt =
      new Date().toISOString()
  ): TaxEvidenceRecord {

    const record =
      this.evidence.get(
        normalize(evidenceId)
      );

    if (!record) {
      throw new Error(
        'EVIDENCE_NOT_FOUND'
      );
    }

    if (
      record.validationState ===
        'rejected' ||
      record.validationState ===
        'quarantined'
    ) {
      throw new Error(
        'EVIDENCE_NOT_ELIGIBLE_FOR_VALIDATION'
      );
    }

    const reviewerId =
      normalize(reviewer);

    if (!reviewerId) {
      throw new Error(
        'EVIDENCE_VALIDATOR_REQUIRED'
      );
    }

    assertDate(
      reviewedAt,
      'INVALID_EVIDENCE_VALIDATION_DATE'
    );

    record.validationState =
      'validated';

    record.validatedBy =
      reviewerId;

    record.validatedAt =
      reviewedAt;

    return cloneEvidence(record);
  }

  rejectEvidence(
    evidenceId: string
  ): TaxEvidenceRecord {

    const record =
      this.evidence.get(
        normalize(evidenceId)
      );

    if (!record) {
      throw new Error(
        'EVIDENCE_NOT_FOUND'
      );
    }

    record.validationState =
      'rejected';

    return cloneEvidence(record);
  }

  quarantineEvidence(
    evidenceId: string
  ): TaxEvidenceRecord {

    const record =
      this.evidence.get(
        normalize(evidenceId)
      );

    if (!record) {
      throw new Error(
        'EVIDENCE_NOT_FOUND'
      );
    }

    record.validationState =
      'quarantined';

    return cloneEvidence(record);
  }

  buildAuthorityCitations(
    ruleId: string,
    taxYear: number
  ): TaxEvidenceAuthorityCitation[] {

    const rule =
      this.rules.get(ruleId);

    if (!rule) {
      throw new Error(
        'CITATION_RULE_NOT_FOUND'
      );
    }

    if (
      rule.status !==
        'verified'
    ) {
      throw new Error(
        'CITATION_RULE_NOT_VERIFIED'
      );
    }

    if (
      !rule.taxYears.includes(
        taxYear
      )
    ) {
      throw new Error(
        'CITATION_TAX_YEAR_MISMATCH'
      );
    }

    const citations:
      TaxEvidenceAuthorityCitation[] = [];

    for (
      const sourceId of
      rule.authoritySourceIds
    ) {
      const authority =
        this.authorities.get(
          sourceId
        );

      if (!authority) {
        throw new Error(
          'CITATION_AUTHORITY_NOT_FOUND'
        );
      }

      if (
        authority.status !==
          'verified'
      ) {
        throw new Error(
          'CITATION_AUTHORITY_NOT_VERIFIED'
        );
      }

      if (
        !authority.taxYears.includes(
          taxYear
        )
      ) {
        throw new Error(
          'CITATION_AUTHORITY_TAX_YEAR_MISMATCH'
        );
      }

      const ruleCitation =
        rule.citations.find(
          citation =>
            citation.sourceId ===
            sourceId
        );

      citations.push({
        sourceId,

        sourceTitle:
          authority.title,

        sourceUrl:
          authority.sourceUrl,

        taxYear,

        locator:
          ruleCitation?.locator,

        section:
          ruleCitation?.section,

        explanation:
          ruleCitation?.explanation
      });
    }

    return citations.map(
      cloneCitation
    );
  }

  bindRuleEvidence(
    input: {
      bindingId: string;
      ruleId: string;
      taxYear: number;
      jurisdictionCode: string;
      evidenceIds: string[];
      createdBy: string;
    }
  ): RuleEvidenceBinding {

    const bindingId =
      normalize(
        input.bindingId
      );

    if (!bindingId) {
      throw new Error(
        'BINDING_ID_REQUIRED'
      );
    }

    if (
      this.bindings.has(
        bindingId
      )
    ) {
      throw new Error(
        'EVIDENCE_BINDING_ALREADY_EXISTS'
      );
    }

    const rule =
      this.rules.get(
        input.ruleId
      );

    if (!rule) {
      throw new Error(
        'BINDING_RULE_NOT_FOUND'
      );
    }

    if (
      !this.rules.isUsableRule(
        rule.ruleId,
        input.taxYear
      )
    ) {
      throw new Error(
        'BINDING_RULE_NOT_USABLE'
      );
    }

    const jurisdictionCode =
      normalizeCode(
        input.jurisdictionCode
      );

    if (
      rule.jurisdictionCode !==
      jurisdictionCode
    ) {
      throw new Error(
        'BINDING_JURISDICTION_MISMATCH'
      );
    }

    const evidenceIds =
      uniqueStrings(
        input.evidenceIds
      );

    if (
      evidenceIds.length === 0
    ) {
      throw new Error(
        'BINDING_EVIDENCE_REQUIRED'
      );
    }

    for (
      const evidenceId of
      evidenceIds
    ) {
      const evidence =
        this.evidence.get(
          evidenceId
        );

      if (!evidence) {
        throw new Error(
          'BINDING_EVIDENCE_NOT_FOUND'
        );
      }

      if (
        evidence.validationState !==
          'validated'
      ) {
        throw new Error(
          'BINDING_EVIDENCE_NOT_VALIDATED'
        );
      }
    }

    const createdBy =
      normalize(
        input.createdBy
      );

    if (!createdBy) {
      throw new Error(
        'BINDING_CREATOR_REQUIRED'
      );
    }

    const citations =
      this.buildAuthorityCitations(
        rule.ruleId,
        input.taxYear
      );

    if (
      citations.length === 0
    ) {
      throw new Error(
        'BINDING_CITATION_REQUIRED'
      );
    }

    const binding:
      RuleEvidenceBinding = {
        bindingId,

        ruleId:
          rule.ruleId,

        taxYear:
          input.taxYear,

        jurisdictionCode,

        evidenceIds,

        citations,

        createdAt:
          new Date().toISOString(),

        createdBy
      };

    this.bindings.set(
      bindingId,
      binding
    );

    return {
      ...binding,

      evidenceIds: [
        ...binding.evidenceIds
      ],

      citations:
        binding.citations.map(
          cloneCitation
        )
    };
  }

  buildDecisionEvidencePackage(
    input: {
      packageId: string;

      applicability:
        TaxRuleApplicabilityResult;

      bindingId: string;
    }
  ): DecisionEvidencePackage {

    const packageId =
      normalize(
        input.packageId
      );

    if (!packageId) {
      throw new Error(
        'DECISION_PACKAGE_ID_REQUIRED'
      );
    }

    const binding =
      this.bindings.get(
        normalize(
          input.bindingId
        )
      );

    if (!binding) {
      throw new Error(
        'DECISION_BINDING_NOT_FOUND'
      );
    }

    const rule =
      this.rules.get(
        binding.ruleId
      );

    if (!rule) {
      throw new Error(
        'DECISION_RULE_NOT_FOUND'
      );
    }

    if (
      input.applicability.ruleId !==
      rule.ruleId
    ) {
      throw new Error(
        'DECISION_RULE_BINDING_MISMATCH'
      );
    }

    if (
      input.applicability.taxYear !==
      binding.taxYear
    ) {
      throw new Error(
        'DECISION_TAX_YEAR_BINDING_MISMATCH'
      );
    }

    if (
      normalizeCode(
        input.applicability
          .jurisdictionCode
      ) !==
      binding.jurisdictionCode
    ) {
      throw new Error(
        'DECISION_JURISDICTION_BINDING_MISMATCH'
      );
    }

    const evidence =
      binding.evidenceIds
        .map(
          evidenceId =>
            this.evidence.get(
              evidenceId
            )
        )
        .filter(
          (
            record
          ): record is TaxEvidenceRecord =>
            Boolean(record)
        )
        .map(
          cloneEvidence
        );

    const evidenceComplete =
      evidence.length ===
        binding.evidenceIds.length &&
      evidence.every(
        record =>
          record.validationState ===
          'validated'
      );

    const citationComplete =
      binding.citations.length > 0;

    const authorityVerified =
      rule.authoritySourceIds.every(
        sourceId =>
          this.authorities
            .isUsableAuthority(
              sourceId,
              binding.taxYear
            )
      );

    const ruleVerified =
      this.rules.isUsableRule(
        rule.ruleId,
        binding.taxYear
      );

    const taxYearAligned =
      rule.taxYears.includes(
        binding.taxYear
      ) &&
      input.applicability.taxYear ===
        binding.taxYear;

    const jurisdictionAligned =
      rule.jurisdictionCode ===
        binding.jurisdictionCode &&
      normalizeCode(
        input.applicability
          .jurisdictionCode
      ) ===
        binding.jurisdictionCode;

    const reasonCodes:
      string[] = [];

    if (!evidenceComplete) {
      reasonCodes.push(
        'EVIDENCE_INCOMPLETE'
      );
    }

    if (!citationComplete) {
      reasonCodes.push(
        'CITATION_INCOMPLETE'
      );
    }

    if (!authorityVerified) {
      reasonCodes.push(
        'AUTHORITY_NOT_VERIFIED'
      );
    }

    if (!ruleVerified) {
      reasonCodes.push(
        'RULE_NOT_VERIFIED'
      );
    }

    if (!taxYearAligned) {
      reasonCodes.push(
        'TAX_YEAR_NOT_ALIGNED'
      );
    }

    if (!jurisdictionAligned) {
      reasonCodes.push(
        'JURISDICTION_NOT_ALIGNED'
      );
    }

    if (
      !input.applicability
        .applicable
    ) {
      reasonCodes.push(
        'RULE_NOT_APPLICABLE'
      );
    }

    const readyForDecisionUse =
      evidenceComplete &&
      citationComplete &&
      authorityVerified &&
      ruleVerified &&
      taxYearAligned &&
      jurisdictionAligned &&
      input.applicability
        .applicable;

    if (readyForDecisionUse) {
      reasonCodes.push(
        'DECISION_EVIDENCE_READY'
      );
    }

    return {
      packageId,

      ruleId:
        rule.ruleId,

      ruleName:
        rule.name,

      taxYear:
        binding.taxYear,

      jurisdictionCode:
        binding.jurisdictionCode,

      applicabilityState:
        input.applicability.state,

      applicable:
        input.applicability
          .applicable,

      professionalReviewRequired:
        input.applicability
          .professionalReviewRequired,

      evidence,

      citations:
        binding.citations.map(
          cloneCitation
        ),

      integrity: {
        evidenceComplete,
        citationComplete,
        authorityVerified,
        ruleVerified,
        taxYearAligned,
        jurisdictionAligned
      },

      readyForDecisionUse,

      reasonCodes,

      createdAt:
        new Date().toISOString()
    };
  }

  getBinding(
    bindingId: string
  ): RuleEvidenceBinding | null {

    const binding =
      this.bindings.get(
        normalize(bindingId)
      );

    if (!binding) {
      return null;
    }

    return {
      ...binding,

      evidenceIds: [
        ...binding.evidenceIds
      ],

      citations:
        binding.citations.map(
          cloneCitation
        )
    };
  }

  clearForTesting(): void {
    this.evidence.clear();
    this.bindings.clear();
  }
}
`;

write(
  "src/taxguard/knowledge/TaxEvidenceCitationBinding.ts",
  bindingSource.trimStart()
);

/*
============================================================
PRESERVE INDEX + ADD M6.5 EXPORT
============================================================
*/

const indexFile =
  "src/taxguard/knowledge/index.ts";

let index =
  exists(indexFile)
    ? read(indexFile)
    : "";

const requiredExports = [
  "export * from './TaxAuthoritySourceRegistry';",
  "export * from './TaxRuleRegistry';",
  "export * from './Federal1040KnowledgePack2025';",
  "export * from './TaxRuleApplicabilityEngine';",
  "export * from './TaxEvidenceCitationBinding';"
];

for (const exportLine of requiredExports) {
  if (!index.includes(exportLine)) {
    index +=
      (
        index.length === 0 ||
        index.endsWith("\n")
          ? ""
          : "\n"
      ) +
      exportLine +
      "\n";
  }
}

write(
  indexFile,
  index
);

/*
============================================================
M6.5 TESTS
============================================================
*/

const testSource = `
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxAuthoritySourceRegistry
} from '../taxguard/knowledge/TaxAuthoritySourceRegistry';

import {
  TaxRuleRegistry
} from '../taxguard/knowledge/TaxRuleRegistry';

import {
  TaxRuleApplicabilityEngine
} from '../taxguard/knowledge/TaxRuleApplicabilityEngine';

import {
  TaxEvidenceCitationBindingService
} from '../taxguard/knowledge/TaxEvidenceCitationBinding';

describe(
  'M6.5 Evidence + Citation Binding',
  () => {

    let authorities:
      TaxAuthoritySourceRegistry;

    let rules:
      TaxRuleRegistry;

    let applicability:
      TaxRuleApplicabilityEngine;

    let binding:
      TaxEvidenceCitationBindingService;

    beforeEach(() => {
      authorities =
        new TaxAuthoritySourceRegistry();

      rules =
        new TaxRuleRegistry(
          authorities
        );

      applicability =
        new TaxRuleApplicabilityEngine(
          rules
        );

      binding =
        new TaxEvidenceCitationBindingService(
          authorities,
          rules
        );
    });

    function installVerifiedFoundation() {

      authorities.register({
        sourceId:
          'IRS-M65-2025',

        jurisdictionLevel:
          'federal',

        jurisdictionCode:
          'US',

        authorityType:
          'official_guidance',

        title:
          'M6.5 Test Authority',

        issuingAuthority:
          'Internal Revenue Service',

        taxYears:
          [2025],

        sourceUrl:
          'https://www.irs.gov/',

        citation: {
          title:
            'M6.5 Test Authority'
        }
      });

      authorities.verify(
        'IRS-M65-2025',
        {
          reviewedBy:
            'authorized-authority-reviewer'
        }
      );

      rules.register({
        ruleId:
          'TG-M65-RULE',

        name:
          'M6.5 Test Rule',

        description:
          'Evidence and citation binding test rule.',

        jurisdictionLevel:
          'federal',

        jurisdictionCode:
          'US',

        taxYears:
          [2025],

        executionClass:
          'informational',

        authoritySourceIds:
          ['IRS-M65-2025'],

        citations: [
          {
            sourceId:
              'IRS-M65-2025',

            section:
              'Test Section',

            locator:
              'Test Locator'
          }
        ],

        requiredFacts:
          [
            'taxpayer.filingStatus'
          ],

        applicabilityConditions:
          [
            {
              factPath:
                'taxpayer.filingStatus',

              operator:
                'equals',

              value:
                'single'
            }
          ]
      });

      rules.verify(
        'TG-M65-RULE',
        {
          reviewedBy:
            'authorized-rule-reviewer'
        }
      );
    }

    function validatedEvidence() {

      return binding.registerEvidence({
        evidenceId:
          'EVIDENCE-001',

        origin:
          'uploaded_document',

        documentId:
          'DOC-001',

        documentHash:
          'a'.repeat(64),

        artifactId:
          'OCR-001',

        factPath:
          'taxpayer.filingStatus',

        factValue:
          'single',

        locator: {
          pageNumber: 1,
          fieldName:
            'filingStatus'
        },

        validationState:
          'validated',

        validatedBy:
          'authorized-reviewer',

        validatedAt:
          '2026-09-23T00:00:00.000Z'
      });
    }

    it(
      'requires SHA-256 hash for uploaded evidence',
      () => {

        expect(() =>
          binding.registerEvidence({
            evidenceId:
              'BAD-EVIDENCE',

            origin:
              'uploaded_document',

            documentId:
              'DOC-BAD',

            documentHash:
              'not-a-hash',

            validationState:
              'pending'
          })
        ).toThrow(
          'VALID_SHA256_DOCUMENT_HASH_REQUIRED'
        );
      }
    );

    it(
      'requires validator for directly validated evidence',
      () => {

        expect(() =>
          binding.registerEvidence({
            evidenceId:
              'EVIDENCE-VALIDATOR',

            origin:
              'validated_taxpayer_fact',

            factPath:
              'taxpayer.filingStatus',

            validationState:
              'validated',

            validatedAt:
              '2026-09-23T00:00:00.000Z'
          })
        ).toThrow(
          'EVIDENCE_VALIDATOR_REQUIRED'
        );
      }
    );

    it(
      'preserves document provenance',
      () => {

        const evidence =
          validatedEvidence();

        expect(
          evidence.documentId
        ).toBe('DOC-001');

        expect(
          evidence.documentHash
        ).toHaveLength(64);

        expect(
          evidence.artifactId
        ).toBe('OCR-001');

        expect(
          evidence.locator?.pageNumber
        ).toBe(1);
      }
    );

    it(
      'does not bind evidence to an unverified rule',
      () => {

        authorities.register({
          sourceId:
            'IRS-M65-DRAFT',

          jurisdictionLevel:
            'federal',

          jurisdictionCode:
            'US',

          authorityType:
            'official_guidance',

          title:
            'Draft Authority',

          issuingAuthority:
            'Internal Revenue Service',

          taxYears:
            [2025],

          sourceUrl:
            'https://www.irs.gov/',

          citation: {
            title:
              'Draft Authority'
          }
        });

        rules.register({
          ruleId:
            'TG-M65-DRAFT-RULE',

          name:
            'Draft Rule',

          description:
            'Draft test rule.',

          jurisdictionLevel:
            'federal',

          jurisdictionCode:
            'US',

          taxYears:
            [2025],

          executionClass:
            'informational',

          authoritySourceIds:
            ['IRS-M65-DRAFT']
        });

        validatedEvidence();

        expect(() =>
          binding.bindRuleEvidence({
            bindingId:
              'BIND-DRAFT',

            ruleId:
              'TG-M65-DRAFT-RULE',

            taxYear:
              2025,

            jurisdictionCode:
              'US',

            evidenceIds:
              ['EVIDENCE-001'],

            createdBy:
              'authorized-reviewer'
          })
        ).toThrow(
          'BINDING_RULE_NOT_USABLE'
        );
      }
    );

    it(
      'does not bind pending evidence',
      () => {

        installVerifiedFoundation();

        binding.registerEvidence({
          evidenceId:
            'EVIDENCE-PENDING',

          origin:
            'validated_taxpayer_fact',

          factPath:
            'taxpayer.filingStatus',

          factValue:
            'single',

          validationState:
            'pending'
        });

        expect(() =>
          binding.bindRuleEvidence({
            bindingId:
              'BIND-PENDING',

            ruleId:
              'TG-M65-RULE',

            taxYear:
              2025,

            jurisdictionCode:
              'US',

            evidenceIds:
              ['EVIDENCE-PENDING'],

            createdBy:
              'authorized-reviewer'
          })
        ).toThrow(
          'BINDING_EVIDENCE_NOT_VALIDATED'
        );
      }
    );

    it(
      'binds validated evidence to verified rule',
      () => {

        installVerifiedFoundation();
        validatedEvidence();

        const result =
          binding.bindRuleEvidence({
            bindingId:
              'BIND-001',

            ruleId:
              'TG-M65-RULE',

            taxYear:
              2025,

            jurisdictionCode:
              'US',

            evidenceIds:
              ['EVIDENCE-001'],

            createdBy:
              'authorized-reviewer'
          });

        expect(
          result.evidenceIds
        ).toContain(
          'EVIDENCE-001'
        );

        expect(
          result.citations
        ).toHaveLength(1);
      }
    );

    it(
      'builds citation from verified authority',
      () => {

        installVerifiedFoundation();

        const citations =
          binding.buildAuthorityCitations(
            'TG-M65-RULE',
            2025
          );

        expect(citations)
          .toHaveLength(1);

        expect(
          citations[0].sourceId
        ).toBe(
          'IRS-M65-2025'
        );

        expect(
          citations[0].section
        ).toBe(
          'Test Section'
        );
      }
    );

    it(
      'blocks jurisdiction mismatch',
      () => {

        installVerifiedFoundation();
        validatedEvidence();

        expect(() =>
          binding.bindRuleEvidence({
            bindingId:
              'BIND-SC',

            ruleId:
              'TG-M65-RULE',

            taxYear:
              2025,

            jurisdictionCode:
              'SC',

            evidenceIds:
              ['EVIDENCE-001'],

            createdBy:
              'authorized-reviewer'
          })
        ).toThrow(
          'BINDING_JURISDICTION_MISMATCH'
        );
      }
    );

    it(
      'creates a complete decision evidence package',
      () => {

        installVerifiedFoundation();
        validatedEvidence();

        binding.bindRuleEvidence({
          bindingId:
            'BIND-001',

          ruleId:
            'TG-M65-RULE',

          taxYear:
            2025,

          jurisdictionCode:
            'US',

          evidenceIds:
            ['EVIDENCE-001'],

          createdBy:
            'authorized-reviewer'
        });

        const result =
          applicability.evaluateRule(
            'TG-M65-RULE',
            2025,
            'US',
            {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          );

        const evidencePackage =
          binding.buildDecisionEvidencePackage({
            packageId:
              'PACKAGE-001',

            applicability:
              result,

            bindingId:
              'BIND-001'
          });

        expect(
          evidencePackage
            .readyForDecisionUse
        ).toBe(true);

        expect(
          evidencePackage
            .integrity
            .evidenceComplete
        ).toBe(true);

        expect(
          evidencePackage
            .integrity
            .citationComplete
        ).toBe(true);

        expect(
          evidencePackage
            .integrity
            .authorityVerified
        ).toBe(true);

        expect(
          evidencePackage
            .integrity
            .ruleVerified
        ).toBe(true);
      }
    );

    it(
      'does not mark a non-applicable decision ready',
      () => {

        installVerifiedFoundation();
        validatedEvidence();

        binding.bindRuleEvidence({
          bindingId:
            'BIND-001',

          ruleId:
            'TG-M65-RULE',

          taxYear:
            2025,

          jurisdictionCode:
            'US',

          evidenceIds:
            ['EVIDENCE-001'],

          createdBy:
            'authorized-reviewer'
        });

        const result =
          applicability.evaluateRule(
            'TG-M65-RULE',
            2025,
            'US',
            {
              taxpayer: {
                filingStatus:
                  'married'
              }
            }
          );

        const evidencePackage =
          binding.buildDecisionEvidencePackage({
            packageId:
              'PACKAGE-NOT-APPLICABLE',

            applicability:
              result,

            bindingId:
              'BIND-001'
          });

        expect(
          evidencePackage
            .readyForDecisionUse
        ).toBe(false);

        expect(
          evidencePackage.reasonCodes
        ).toContain(
          'RULE_NOT_APPLICABLE'
        );
      }
    );

    it(
      'prevents rejected evidence from later validation',
      () => {

        binding.registerEvidence({
          evidenceId:
            'EVIDENCE-REJECTED',

          origin:
            'validated_taxpayer_fact',

          factPath:
            'taxpayer.filingStatus',

          factValue:
            'single',

          validationState:
            'pending'
        });

        binding.rejectEvidence(
          'EVIDENCE-REJECTED'
        );

        expect(() =>
          binding.validateEvidence(
            'EVIDENCE-REJECTED',
            'reviewer'
          )
        ).toThrow(
          'EVIDENCE_NOT_ELIGIBLE_FOR_VALIDATION'
        );
      }
    );

    it(
      'prevents quarantined evidence from later validation',
      () => {

        binding.registerEvidence({
          evidenceId:
            'EVIDENCE-QUARANTINED',

          origin:
            'validated_taxpayer_fact',

          factPath:
            'taxpayer.filingStatus',

          factValue:
            'single',

          validationState:
            'pending'
        });

        binding.quarantineEvidence(
          'EVIDENCE-QUARANTINED'
        );

        expect(() =>
          binding.validateEvidence(
            'EVIDENCE-QUARANTINED',
            'reviewer'
          )
        ).toThrow(
          'EVIDENCE_NOT_ELIGIBLE_FOR_VALIDATION'
        );
      }
    );

    it(
      'returns defensive evidence copies',
      () => {

        validatedEvidence();

        const first =
          binding.getEvidence(
            'EVIDENCE-001'
          );

        expect(first)
          .not.toBeNull();

        if (!first) {
          return;
        }

        first.documentId =
          'TAMPERED';

        const second =
          binding.getEvidence(
            'EVIDENCE-001'
          );

        expect(
          second?.documentId
        ).toBe(
          'DOC-001'
        );
      }
    );
  }
);
`;

write(
  "src/tests/taxEvidenceCitationBinding.test.ts",
  testSource.trimStart()
);

/*
============================================================
STATIC GOVERNANCE ASSERTIONS
============================================================
*/

banner("M6.5 GOVERNANCE ASSERTIONS");

const builtSource = read(
  "src/taxguard/knowledge/TaxEvidenceCitationBinding.ts"
);

const assertions = [
  [
    "Evidence ID",
    builtSource.includes(
      "evidenceId"
    )
  ],

  [
    "Document hash",
    builtSource.includes(
      "documentHash"
    )
  ],

  [
    "SHA-256 validation",
    builtSource.includes(
      "VALID_SHA256_DOCUMENT_HASH_REQUIRED"
    )
  ],

  [
    "Artifact provenance",
    builtSource.includes(
      "artifactId"
    )
  ],

  [
    "Fact path",
    builtSource.includes(
      "factPath"
    )
  ],

  [
    "Page locator",
    builtSource.includes(
      "pageNumber"
    )
  ],

  [
    "Bounding box",
    builtSource.includes(
      "boundingBox"
    )
  ],

  [
    "Verified rule gate",
    builtSource.includes(
      "isUsableRule"
    )
  ],

  [
    "Verified authority gate",
    builtSource.includes(
      "isUsableAuthority"
    )
  ],

  [
    "Citation binding",
    builtSource.includes(
      "TaxEvidenceAuthorityCitation"
    )
  ],

  [
    "Decision evidence package",
    builtSource.includes(
      "DecisionEvidencePackage"
    )
  ],

  [
    "Professional review propagation",
    builtSource.includes(
      "professionalReviewRequired"
    )
  ],

  [
    "Fail closed evidence",
    builtSource.includes(
      "BINDING_EVIDENCE_NOT_VALIDATED"
    )
  ],

  [
    "No OpenAI dependency",
    !builtSource.includes(
      "OpenAI"
    )
  ],

  [
    "No browser authority",
    !builtSource.includes(
      "localStorage"
    )
  ],

  [
    "No tax calculation",
    !builtSource.includes(
      "calculateTax"
    )
  ],

  [
    "No return submission",
    !builtSource.includes(
      "submitReturn"
    )
  ]
];

for (const [name, ok] of assertions) {
  console.log(
    (ok ? "PASS " : "FAIL ") +
    name
  );

  if (!ok) {
    stop(
      "Governance assertion failed: " +
      name
    );
  }
}

/*
============================================================
STEP 1 - TYPESCRIPT
============================================================
*/

run(
  "STEP 1 - TYPESCRIPT",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
M6 REGRESSION
============================================================
*/

run(
  "STEP 2 - M6.1 AUTHORITY REGISTRY",
  [
    "test",
    "--",
    "src/tests/taxAuthoritySourceRegistry.test.ts",
    "--run"
  ]
);

run(
  "STEP 3 - M6.2 RULE REGISTRY",
  [
    "test",
    "--",
    "src/tests/taxRuleRegistry.test.ts",
    "--run"
  ]
);

run(
  "STEP 4 - M6.3 FEDERAL 1040 PACK",
  [
    "test",
    "--",
    "src/tests/federal1040KnowledgePack2025.test.ts",
    "--run"
  ]
);

run(
  "STEP 5 - M6.4 APPLICABILITY ENGINE",
  [
    "test",
    "--",
    "src/tests/taxRuleApplicabilityEngine.test.ts",
    "--run"
  ]
);

run(
  "STEP 6 - M6.5 EVIDENCE + CITATION",
  [
    "test",
    "--",
    "src/tests/taxEvidenceCitationBinding.test.ts",
    "--run"
  ]
);

/*
============================================================
INTELLIGENCE CORE
============================================================
*/

run(
  "STEP 7 - INTELLIGENCE CORE",
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
LIVE WORKFLOW AUTHORITY
============================================================
*/

run(
  "STEP 8 - LIVE WORKFLOW AUTHORITY",
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
FULL ACTIVE SYSTEM REGRESSION

This is the system-wide validation requested for other
features. Any covered regression stops here.
============================================================
*/

run(
  "STEP 9 - FULL ACTIVE SYSTEM REGRESSION",
  [
    "test",
    "--",
    "--run"
  ]
);

/*
============================================================
PRODUCTION BUILD
============================================================
*/

run(
  "STEP 10 - PRODUCTION BUILD",
  [
    "run",
    "build"
  ]
);

/*
============================================================
FINAL TYPESCRIPT
============================================================
*/

run(
  "STEP 11 - FINAL TYPESCRIPT",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
FINAL REPORT
============================================================
*/

banner("TAXGUARD M6.5 VERIFIED PASS");

console.log("");
console.log("PRESERVED");
console.log("---------------------------------------------");
console.log("M1-M5.5                        FROZEN / PASS");
console.log("M6.1 Authority Registry        FROZEN / PASS");
console.log("M6.2 Tax Rule Registry         FROZEN / PASS");
console.log("M6.3 Federal 1040 Pack         FROZEN / PASS");
console.log("M6.4 Applicability Engine      FROZEN / PASS");

console.log("");
console.log("M6.5");
console.log("---------------------------------------------");
console.log("Evidence Registry              PASS");
console.log("Document Hash Binding          PASS");
console.log("Artifact Provenance            PASS");
console.log("Fact Binding                   PASS");
console.log("Page / Bounding Box Locator    PASS");
console.log("Rule Evidence Binding          PASS");
console.log("Authority Citation Binding     PASS");
console.log("Tax-Year Alignment             PASS");
console.log("Jurisdiction Alignment         PASS");
console.log("Decision Evidence Package      PASS");
console.log("Integrity Validation           PASS");
console.log("Professional Review Flag       PASS");
console.log("Fail-Closed Provenance         PASS");

console.log("");
console.log("SYSTEM VALIDATION");
console.log("---------------------------------------------");
console.log("TypeScript                     PASS");
console.log("M6.1                           PASS");
console.log("M6.2                           PASS");
console.log("M6.3                           PASS");
console.log("M6.4                           PASS");
console.log("M6.5                           PASS");
console.log("Intelligence Core              PASS");
console.log("LIVE Workflow Authority        PASS");
console.log("Full Active Regression         PASS");
console.log("Production Build               PASS");
console.log("Final TypeScript               PASS");

console.log("");
console.log("SECURITY / GOVERNANCE");
console.log("---------------------------------------------");
console.log("Unvalidated evidence           BLOCKED");
console.log("Rejected evidence              BLOCKED");
console.log("Quarantined evidence           BLOCKED");
console.log("Missing source hash            BLOCKED");
console.log("Unverified authority           BLOCKED");
console.log("Unverified rule                BLOCKED");
console.log("Tax-year mismatch              BLOCKED");
console.log("Jurisdiction mismatch          BLOCKED");
console.log("AI-created verified evidence   PROHIBITED");
console.log("Calculation execution          RESERVED FOR M7");
console.log("Browser workflow authority     BLOCKED");
console.log("External tax submission        DISABLED");
console.log("OpenAI API credits             NONE");

console.log("");
console.log("============================================================");
console.log(" M6.5 COMPLETE - FREEZE CHECKPOINT");
console.log("============================================================");

console.log("");
console.log("NEXT:");
console.log("M6.6 - CONFLICT + SUPERSESSION DETECTION");
console.log("");
console.log("Then:");
console.log("M6.7 - AI Knowledge Boundary");
console.log("M6.8 - Human Review + Audit Integration");
console.log("M6.9 - M6 Final Regression + Freeze");
console.log("M7   - Deterministic Calculation Engine");
console.log("");

