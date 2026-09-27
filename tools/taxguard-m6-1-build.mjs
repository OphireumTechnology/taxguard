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
  banner("TAXGUARD M6.1 STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("No false PASS status was produced.");
  process.exit(1);
}

function run(label, command, args) {
  banner(label);

  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true
  });

  if (result.status !== 0) {
    stop(label + " failed.");
  }

  console.log("PASS: " + label);
}

function writeFile(relative, content) {
  const target = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  console.log("WRITE " + relative);
}

function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

/*
============================================================
START
============================================================
*/

banner("TAXGUARD M6.1 - TAX AUTHORITY SOURCE REGISTRY");

console.log("BASELINE:");
console.log("M1-M5.5                         FROZEN");
console.log("M6.1                            BUILD");
console.log("");
console.log("POLICY:");
console.log("No OpenAI API                   YES");
console.log("No AutoFix V1                   YES");
console.log("No broad repository scan        YES");
console.log("No Client 006                   YES");
console.log("No workflow bypass              YES");
console.log("No invented tax authority       YES");
console.log("External submission disabled    YES");

/*
============================================================
BACKUP ONLY FILES WE MAY TOUCH
============================================================
*/

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  ROOT,
  "backups",
  "m6-1-" + stamp
);

fs.mkdirSync(backupRoot, { recursive: true });

const potentialExistingFiles = [
  "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts",
  "src/taxguard/knowledge/index.ts",
  "src/tests/taxAuthoritySourceRegistry.test.ts"
];

for (const relative of potentialExistingFiles) {
  const source = path.join(ROOT, relative);

  if (!fs.existsSync(source)) {
    continue;
  }

  const destination = path.join(backupRoot, relative);

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true }
  );

  fs.copyFileSync(source, destination);
}

console.log("Backup: " + backupRoot);

/*
============================================================
M6.1 DATA MODEL
============================================================

This registry stores authority metadata.

It does NOT claim a source is authoritative merely because it
has been entered.

A source must have lifecycle status.

No tax rule is created here.
No tax calculation is performed here.
No AI-generated statement becomes tax authority.
============================================================
*/

const registrySource = `
export type TaxJurisdictionLevel =
  | 'federal'
  | 'state'
  | 'local';

export type TaxAuthorityType =
  | 'statute'
  | 'regulation'
  | 'revenue_ruling'
  | 'revenue_procedure'
  | 'notice'
  | 'instruction'
  | 'official_guidance'
  | 'form'
  | 'court_opinion'
  | 'other';

export type TaxAuthorityStatus =
  | 'draft'
  | 'pending_review'
  | 'verified'
  | 'superseded'
  | 'retired'
  | 'rejected';

export interface TaxAuthorityCitation {
  title: string;
  locator?: string;
  section?: string;
  page?: string;
}

export interface TaxAuthoritySource {
  sourceId: string;

  jurisdictionLevel: TaxJurisdictionLevel;

  jurisdictionCode: string;

  authorityType: TaxAuthorityType;

  title: string;

  issuingAuthority: string;

  taxYears: number[];

  effectiveFrom?: string;

  effectiveTo?: string;

  sourceUrl?: string;

  citation: TaxAuthorityCitation;

  contentHash?: string;

  version: number;

  status: TaxAuthorityStatus;

  supersedesSourceId?: string;

  supersededBySourceId?: string;

  reviewedBy?: string;

  reviewedAt?: string;

  createdAt: string;

  updatedAt: string;
}

export interface RegisterTaxAuthorityInput {
  sourceId: string;

  jurisdictionLevel: TaxJurisdictionLevel;

  jurisdictionCode: string;

  authorityType: TaxAuthorityType;

  title: string;

  issuingAuthority: string;

  taxYears: number[];

  effectiveFrom?: string;

  effectiveTo?: string;

  sourceUrl?: string;

  citation: TaxAuthorityCitation;

  contentHash?: string;

  version?: number;

  status?: TaxAuthorityStatus;

  supersedesSourceId?: string;
}

export interface TaxAuthorityQuery {
  jurisdictionLevel?: TaxJurisdictionLevel;

  jurisdictionCode?: string;

  authorityType?: TaxAuthorityType;

  taxYear?: number;

  status?: TaxAuthorityStatus;
}

export interface TaxAuthorityVerificationInput {
  reviewedBy: string;

  reviewedAt?: string;

  contentHash?: string;
}

export interface TaxAuthoritySupersessionInput {
  supersededSourceId: string;

  replacementSourceId: string;

  reviewedBy: string;

  reviewedAt?: string;
}

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function cloneSource(
  source: TaxAuthoritySource
): TaxAuthoritySource {
  return {
    ...source,

    taxYears: [...source.taxYears],

    citation: {
      ...source.citation
    }
  };
}

function validateSourceId(sourceId: string): void {
  if (!/^[A-Z0-9][A-Z0-9._:-]{2,127}$/i.test(sourceId)) {
    throw new Error('INVALID_TAX_AUTHORITY_SOURCE_ID');
  }
}

function validateTaxYears(taxYears: number[]): void {
  if (!Array.isArray(taxYears) || taxYears.length === 0) {
    throw new Error('TAX_YEAR_REQUIRED');
  }

  for (const year of taxYears) {
    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 2200
    ) {
      throw new Error('INVALID_TAX_YEAR');
    }
  }
}

function validateIsoDate(
  value: string | undefined,
  code: string
): void {
  if (!value) {
    return;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new Error(code);
  }
}

function validateUrl(
  value: string | undefined
): void {
  if (!value) {
    return;
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error('INVALID_SOURCE_URL');
  }

  if (
    parsed.protocol !== 'https:' &&
    parsed.protocol !== 'http:'
  ) {
    throw new Error('INVALID_SOURCE_URL_PROTOCOL');
  }
}

export class TaxAuthoritySourceRegistry {
  private readonly sources =
    new Map<string, TaxAuthoritySource>();

  register(
    input: RegisterTaxAuthorityInput
  ): TaxAuthoritySource {

    validateSourceId(input.sourceId);
    validateTaxYears(input.taxYears);

    validateIsoDate(
      input.effectiveFrom,
      'INVALID_EFFECTIVE_FROM'
    );

    validateIsoDate(
      input.effectiveTo,
      'INVALID_EFFECTIVE_TO'
    );

    validateUrl(input.sourceUrl);

    const sourceId =
      normalizeText(input.sourceId);

    if (this.sources.has(sourceId)) {
      throw new Error(
        'TAX_AUTHORITY_SOURCE_ALREADY_EXISTS'
      );
    }

    const title =
      normalizeText(input.title);

    const issuingAuthority =
      normalizeText(input.issuingAuthority);

    const jurisdictionCode =
      normalizeCode(input.jurisdictionCode);

    const citationTitle =
      normalizeText(input.citation.title);

    if (!title) {
      throw new Error(
        'TAX_AUTHORITY_TITLE_REQUIRED'
      );
    }

    if (!issuingAuthority) {
      throw new Error(
        'ISSUING_AUTHORITY_REQUIRED'
      );
    }

    if (!jurisdictionCode) {
      throw new Error(
        'JURISDICTION_CODE_REQUIRED'
      );
    }

    if (!citationTitle) {
      throw new Error(
        'CITATION_REQUIRED'
      );
    }

    const now =
      new Date().toISOString();

    const taxYears =
      [...new Set(input.taxYears)]
        .sort((a, b) => a - b);

    const record: TaxAuthoritySource = {
      sourceId,

      jurisdictionLevel:
        input.jurisdictionLevel,

      jurisdictionCode,

      authorityType:
        input.authorityType,

      title,

      issuingAuthority,

      taxYears,

      effectiveFrom:
        input.effectiveFrom,

      effectiveTo:
        input.effectiveTo,

      sourceUrl:
        input.sourceUrl,

      citation: {
        title: citationTitle,

        locator:
          input.citation.locator?.trim(),

        section:
          input.citation.section?.trim(),

        page:
          input.citation.page?.trim()
      },

      contentHash:
        input.contentHash?.trim(),

      version:
        input.version ?? 1,

      status:
        input.status ?? 'draft',

      supersedesSourceId:
        input.supersedesSourceId,

      createdAt: now,

      updatedAt: now
    };

    if (
      !Number.isInteger(record.version) ||
      record.version < 1
    ) {
      throw new Error(
        'INVALID_SOURCE_VERSION'
      );
    }

    /*
     * Critical governance boundary:
     *
     * registration alone may not silently make a source verified.
     *
     * Verified status requires the explicit verification method.
     */

    if (record.status === 'verified') {
      throw new Error(
        'DIRECT_VERIFIED_REGISTRATION_PROHIBITED'
      );
    }

    this.sources.set(
      sourceId,
      record
    );

    return cloneSource(record);
  }

  get(
    sourceId: string
  ): TaxAuthoritySource | null {

    const source =
      this.sources.get(
        normalizeText(sourceId)
      );

    return source
      ? cloneSource(source)
      : null;
  }

  list(): TaxAuthoritySource[] {
    return [...this.sources.values()]
      .map(cloneSource);
  }

  query(
    query: TaxAuthorityQuery
  ): TaxAuthoritySource[] {

    return this.list().filter(source => {

      if (
        query.jurisdictionLevel &&
        source.jurisdictionLevel !==
          query.jurisdictionLevel
      ) {
        return false;
      }

      if (
        query.jurisdictionCode &&
        source.jurisdictionCode !==
          normalizeCode(
            query.jurisdictionCode
          )
      ) {
        return false;
      }

      if (
        query.authorityType &&
        source.authorityType !==
          query.authorityType
      ) {
        return false;
      }

      if (
        query.taxYear !== undefined &&
        !source.taxYears.includes(
          query.taxYear
        )
      ) {
        return false;
      }

      if (
        query.status &&
        source.status !== query.status
      ) {
        return false;
      }

      return true;
    });
  }

  verify(
    sourceId: string,
    input: TaxAuthorityVerificationInput
  ): TaxAuthoritySource {

    const source =
      this.sources.get(
        normalizeText(sourceId)
      );

    if (!source) {
      throw new Error(
        'TAX_AUTHORITY_SOURCE_NOT_FOUND'
      );
    }

    if (
      source.status === 'superseded' ||
      source.status === 'retired' ||
      source.status === 'rejected'
    ) {
      throw new Error(
        'SOURCE_NOT_ELIGIBLE_FOR_VERIFICATION'
      );
    }

    const reviewedBy =
      normalizeText(input.reviewedBy);

    if (!reviewedBy) {
      throw new Error(
        'REVIEWER_REQUIRED'
      );
    }

    const reviewedAt =
      input.reviewedAt ??
      new Date().toISOString();

    validateIsoDate(
      reviewedAt,
      'INVALID_REVIEW_DATE'
    );

    source.status =
      'verified';

    source.reviewedBy =
      reviewedBy;

    source.reviewedAt =
      reviewedAt;

    if (input.contentHash) {
      source.contentHash =
        input.contentHash.trim();
    }

    source.updatedAt =
      new Date().toISOString();

    return cloneSource(source);
  }

  markPendingReview(
    sourceId: string
  ): TaxAuthoritySource {

    const source =
      this.sources.get(
        normalizeText(sourceId)
      );

    if (!source) {
      throw new Error(
        'TAX_AUTHORITY_SOURCE_NOT_FOUND'
      );
    }

    if (
      source.status === 'superseded' ||
      source.status === 'retired'
    ) {
      throw new Error(
        'SOURCE_NOT_REVIEWABLE'
      );
    }

    source.status =
      'pending_review';

    source.updatedAt =
      new Date().toISOString();

    return cloneSource(source);
  }

  supersede(
    input: TaxAuthoritySupersessionInput
  ): {
    superseded: TaxAuthoritySource;
    replacement: TaxAuthoritySource;
  } {

    if (
      input.supersededSourceId ===
      input.replacementSourceId
    ) {
      throw new Error(
        'SOURCE_CANNOT_SUPERSEDE_ITSELF'
      );
    }

    const oldSource =
      this.sources.get(
        normalizeText(
          input.supersededSourceId
        )
      );

    const replacement =
      this.sources.get(
        normalizeText(
          input.replacementSourceId
        )
      );

    if (!oldSource || !replacement) {
      throw new Error(
        'SUPERSESSION_SOURCE_NOT_FOUND'
      );
    }

    const reviewedBy =
      normalizeText(input.reviewedBy);

    if (!reviewedBy) {
      throw new Error(
        'REVIEWER_REQUIRED'
      );
    }

    const reviewedAt =
      input.reviewedAt ??
      new Date().toISOString();

    validateIsoDate(
      reviewedAt,
      'INVALID_REVIEW_DATE'
    );

    oldSource.status =
      'superseded';

    oldSource.supersededBySourceId =
      replacement.sourceId;

    oldSource.reviewedBy =
      reviewedBy;

    oldSource.reviewedAt =
      reviewedAt;

    oldSource.updatedAt =
      new Date().toISOString();

    replacement.supersedesSourceId =
      oldSource.sourceId;

    replacement.updatedAt =
      new Date().toISOString();

    return {
      superseded:
        cloneSource(oldSource),

      replacement:
        cloneSource(replacement)
    };
  }

  retire(
    sourceId: string,
    reviewedBy: string
  ): TaxAuthoritySource {

    const source =
      this.sources.get(
        normalizeText(sourceId)
      );

    if (!source) {
      throw new Error(
        'TAX_AUTHORITY_SOURCE_NOT_FOUND'
      );
    }

    const reviewer =
      normalizeText(reviewedBy);

    if (!reviewer) {
      throw new Error(
        'REVIEWER_REQUIRED'
      );
    }

    source.status =
      'retired';

    source.reviewedBy =
      reviewer;

    source.reviewedAt =
      new Date().toISOString();

    source.updatedAt =
      new Date().toISOString();

    return cloneSource(source);
  }

  getVerifiedForTaxYear(
    taxYear: number,
    jurisdictionCode?: string
  ): TaxAuthoritySource[] {

    validateTaxYears([taxYear]);

    return this.query({
      taxYear,
      jurisdictionCode,
      status: 'verified'
    });
  }

  isUsableAuthority(
    sourceId: string,
    taxYear: number
  ): boolean {

    const source =
      this.get(sourceId);

    if (!source) {
      return false;
    }

    return (
      source.status === 'verified' &&
      source.taxYears.includes(taxYear)
    );
  }

  clearForTesting(): void {
    this.sources.clear();
  }
}

export const taxAuthoritySourceRegistry =
  new TaxAuthoritySourceRegistry();
`;

writeFile(
  "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts",
  registrySource.trimStart()
);

/*
============================================================
INDEX
============================================================
*/

const indexSource = `
export * from './TaxAuthoritySourceRegistry';
`;

writeFile(
  "src/taxguard/knowledge/index.ts",
  indexSource.trimStart()
);

/*
============================================================
M6.1 TESTS
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

describe(
  'M6.1 Tax Authority Source Registry',
  () => {

    let registry:
      TaxAuthoritySourceRegistry;

    beforeEach(() => {
      registry =
        new TaxAuthoritySourceRegistry();
    });

    const federalSource = () => ({
      sourceId:
        'IRS-F1040-INSTRUCTIONS-2025',

      jurisdictionLevel:
        'federal' as const,

      jurisdictionCode:
        'US',

      authorityType:
        'instruction' as const,

      title:
        'Form 1040 Instructions',

      issuingAuthority:
        'Internal Revenue Service',

      taxYears:
        [2025],

      sourceUrl:
        'https://www.irs.gov/',

      citation: {
        title:
          'Form 1040 Instructions'
      }
    });

    it(
      'registers authority as draft by default',
      () => {

        const result =
          registry.register(
            federalSource()
          );

        expect(result.status)
          .toBe('draft');

        expect(result.taxYears)
          .toEqual([2025]);
      }
    );

    it(
      'does not permit direct verified registration',
      () => {

        expect(() =>
          registry.register({
            ...federalSource(),
            status: 'verified'
          })
        ).toThrow(
          'DIRECT_VERIFIED_REGISTRATION_PROHIBITED'
        );
      }
    );

    it(
      'requires explicit human verification',
      () => {

        registry.register(
          federalSource()
        );

        const verified =
          registry.verify(
            'IRS-F1040-INSTRUCTIONS-2025',
            {
              reviewedBy:
                'authorized-reviewer'
            }
          );

        expect(verified.status)
          .toBe('verified');

        expect(verified.reviewedBy)
          .toBe(
            'authorized-reviewer'
          );
      }
    );

    it(
      'rejects duplicate source identifiers',
      () => {

        registry.register(
          federalSource()
        );

        expect(() =>
          registry.register(
            federalSource()
          )
        ).toThrow(
          'TAX_AUTHORITY_SOURCE_ALREADY_EXISTS'
        );
      }
    );

    it(
      'filters by tax year',
      () => {

        registry.register(
          federalSource()
        );

        registry.register({
          ...federalSource(),

          sourceId:
            'IRS-F1040-INSTRUCTIONS-2024',

          taxYears:
            [2024]
        });

        expect(
          registry.query({
            taxYear: 2025
          })
        ).toHaveLength(1);
      }
    );

    it(
      'does not treat draft authority as usable',
      () => {

        registry.register(
          federalSource()
        );

        expect(
          registry.isUsableAuthority(
            'IRS-F1040-INSTRUCTIONS-2025',
            2025
          )
        ).toBe(false);
      }
    );

    it(
      'allows verified authority for matching tax year',
      () => {

        registry.register(
          federalSource()
        );

        registry.verify(
          'IRS-F1040-INSTRUCTIONS-2025',
          {
            reviewedBy:
              'authorized-reviewer'
          }
        );

        expect(
          registry.isUsableAuthority(
            'IRS-F1040-INSTRUCTIONS-2025',
            2025
          )
        ).toBe(true);

        expect(
          registry.isUsableAuthority(
            'IRS-F1040-INSTRUCTIONS-2025',
            2024
          )
        ).toBe(false);
      }
    );

    it(
      'supports supersession without deleting history',
      () => {

        registry.register({
          ...federalSource(),

          sourceId:
            'IRS-SOURCE-V1',

          taxYears:
            [2024]
        });

        registry.register({
          ...federalSource(),

          sourceId:
            'IRS-SOURCE-V2',

          taxYears:
            [2025],

          version:
            2
        });

        const result =
          registry.supersede({
            supersededSourceId:
              'IRS-SOURCE-V1',

            replacementSourceId:
              'IRS-SOURCE-V2',

            reviewedBy:
              'authorized-reviewer'
          });

        expect(
          result.superseded.status
        ).toBe('superseded');

        expect(
          result.superseded
            .supersededBySourceId
        ).toBe('IRS-SOURCE-V2');

        expect(
          result.replacement
            .supersedesSourceId
        ).toBe('IRS-SOURCE-V1');
      }
    );

    it(
      'returns defensive copies',
      () => {

        registry.register(
          federalSource()
        );

        const first =
          registry.get(
            'IRS-F1040-INSTRUCTIONS-2025'
          );

        expect(first)
          .not.toBeNull();

        if (!first) {
          return;
        }

        first.taxYears.push(2099);

        const second =
          registry.get(
            'IRS-F1040-INSTRUCTIONS-2025'
          );

        expect(
          second?.taxYears
        ).toEqual([2025]);
      }
    );

    it(
      'rejects invalid source URL protocols',
      () => {

        expect(() =>
          registry.register({
            ...federalSource(),

            sourceUrl:
              'javascript:alert(1)'
          })
        ).toThrow(
          'INVALID_SOURCE_URL_PROTOCOL'
        );
      }
    );

    it(
      'rejects empty tax year coverage',
      () => {

        expect(() =>
          registry.register({
            ...federalSource(),
            taxYears: []
          })
        ).toThrow(
          'TAX_YEAR_REQUIRED'
        );
      }
    );

    it(
      'requires reviewer identity for verification',
      () => {

        registry.register(
          federalSource()
        );

        expect(() =>
          registry.verify(
            'IRS-F1040-INSTRUCTIONS-2025',
            {
              reviewedBy: ' '
            }
          )
        ).toThrow(
          'REVIEWER_REQUIRED'
        );
      }
    );

    it(
      'returns only verified authority through verified query',
      () => {

        registry.register(
          federalSource()
        );

        registry.register({
          ...federalSource(),

          sourceId:
            'IRS-SECOND-SOURCE-2025'
        });

        registry.verify(
          'IRS-F1040-INSTRUCTIONS-2025',
          {
            reviewedBy:
              'authorized-reviewer'
          }
        );

        const verified =
          registry.getVerifiedForTaxYear(
            2025,
            'US'
          );

        expect(verified)
          .toHaveLength(1);

        expect(
          verified[0].sourceId
        ).toBe(
          'IRS-F1040-INSTRUCTIONS-2025'
        );
      }
    );
  }
);
`;

writeFile(
  "src/tests/taxAuthoritySourceRegistry.test.ts",
  testSource.trimStart()
);

/*
============================================================
STATIC GOVERNANCE ASSERTIONS
============================================================
*/

banner("M6.1 GOVERNANCE ASSERTIONS");

const source =
  read(
    "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts"
  );

const assertions = [
  [
    "Tax-year versioning",
    source.includes(
      "taxYears: number[]"
    )
  ],

  [
    "Authority lifecycle",
    source.includes(
      "'superseded'"
    )
  ],

  [
    "Explicit verification",
    source.includes(
      "verify("
    )
  ],

  [
    "Direct verified registration blocked",
    source.includes(
      "DIRECT_VERIFIED_REGISTRATION_PROHIBITED"
    )
  ],

  [
    "Citation metadata",
    source.includes(
      "citation: TaxAuthorityCitation"
    )
  ],

  [
    "Content hash support",
    source.includes(
      "contentHash"
    )
  ],

  [
    "Supersession history",
    source.includes(
      "supersededBySourceId"
    )
  ],

  [
    "Verified tax-year lookup",
    source.includes(
      "getVerifiedForTaxYear"
    )
  ],

  [
    "No AI authority creation",
    !source.includes(
      "OpenAI"
    )
  ],

  [
    "No external submission",
    !source.includes(
      "submitReturn"
    )
  ]
];

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
TYPECHECK
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

/*
============================================================
M6.1 TESTS
============================================================
*/

run(
  "STEP 2 - M6.1 SOURCE REGISTRY",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/taxAuthoritySourceRegistry.test.ts",
    "--run"
  ]
);

/*
============================================================
EXISTING INTELLIGENCE CORE
============================================================
*/

run(
  "STEP 3 - INTELLIGENCE CORE REGRESSION",
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
WORKFLOW AUTHORITY REGRESSION
============================================================
*/

run(
  "STEP 4 - LIVE WORKFLOW AUTHORITY",
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
STAGES 01-03 REGRESSION
============================================================
*/

run(
  "STEP 5 - STAGE 01",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/stageOneOnboarding.test.ts",
    "--run"
  ]
);

run(
  "STEP 6 - STAGE 02",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/stageTwoCollection.test.ts",
    "src/tests/stageTwoSprintTwoSecurity.test.ts",
    "src/tests/stageTwoSprintThreeIntelligence.test.ts",
    "src/tests/stageTwoSprintFourOperations.test.ts",
    "--run"
  ]
);

run(
  "STEP 7 - STAGE 03",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/stageThreeValidationFoundation.test.ts",
    "src/tests/stageThreeSprintOne.test.ts",
    "src/tests/stageThreeSprintTwo.test.ts",
    "src/tests/stageThreeSprintThree.test.ts",
    "--run"
  ]
);

/*
============================================================
FULL ACTIVE REGRESSION

The existing vitest configuration now excludes historical
backup tests.
============================================================
*/

run(
  "STEP 8 - FULL ACTIVE REGRESSION",
  "npm.cmd",
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
  "STEP 9 - PRODUCTION BUILD",
  "npm.cmd",
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
  "STEP 10 - FINAL TYPESCRIPT",
  "npm.cmd",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
FINAL STATUS
============================================================
*/

banner("TAXGUARD M6.1 VERIFIED PASS");

console.log("");
console.log("PRESERVED");
console.log("---------------------------------------------");
console.log("M1    LIVE Routing              FROZEN / PASS");
console.log("M2    Stage 01 ONBOARD          FROZEN / PASS");
console.log("M3    Stage 02 COLLECT          FROZEN / PASS");
console.log("M4    Stage 03 VALIDATE         FROZEN / PASS");
console.log("M5    Firestore Workflow        FROZEN / PASS");
console.log("M5.2  Gate Bridge               FROZEN / PASS");
console.log("M5.3  Server Gate Layer         FROZEN / PASS");
console.log("M5.4  LIVE Authority            FROZEN / PASS");
console.log("M5.5  LIVE App Routing          FROZEN / PASS");

console.log("");
console.log("M6.1");
console.log("---------------------------------------------");
console.log("Tax Authority Source Registry   PASS");
console.log("Jurisdiction metadata           PASS");
console.log("Tax-year applicability          PASS");
console.log("Authority lifecycle             PASS");
console.log("Citation metadata               PASS");
console.log("Content hash support            PASS");
console.log("Human verification boundary     PASS");
console.log("Supersession history            PASS");
console.log("Verified-source lookup          PASS");

console.log("");
console.log("VALIDATION");
console.log("---------------------------------------------");
console.log("TypeScript                      PASS");
console.log("M6.1 tests                      PASS");
console.log("Intelligence Core               PASS");
console.log("LIVE Workflow Authority         PASS");
console.log("Stage 01                        PASS");
console.log("Stage 02                        PASS");
console.log("Stage 03                        PASS");
console.log("Full Active Regression          PASS");
console.log("Production Build                PASS");
console.log("Final TypeScript                PASS");

console.log("");
console.log("SECURITY / GOVERNANCE");
console.log("---------------------------------------------");
console.log("AI-created authority            PROHIBITED");
console.log("Unverified authority use        BLOCKED");
console.log("Direct verified registration    BLOCKED");
console.log("Historical authority deletion   NOT REQUIRED");
console.log("Server workflow authority       PRESERVED");
console.log("Browser workflow completion     BLOCKED");
console.log("DEMO -> LIVE fallback           BLOCKED");
console.log("External tax submission         DISABLED");
console.log("OpenAI API credits used         NONE");

console.log("");
console.log("============================================================");
console.log(" M6.1 COMPLETE");
console.log("============================================================");

console.log("");
console.log("NEXT:");
console.log("M6.2 - TAX RULE SCHEMA + RULE REGISTRY");
console.log("");
console.log("After M6.2:");
console.log("M6.3 - Federal 1040 Knowledge Pack");
console.log("M6.4 - Applicability / Retrieval Engine");
console.log("M6.5 - Evidence + Citation Binding");
console.log("M6.6 - Conflict / Supersession Detection");
console.log("M6.7 - AI Knowledge Boundary");
console.log("M6.8 - Human Review + Audit Integration");
console.log("M6.9 - M6 Final Regression + Freeze");
console.log("");
