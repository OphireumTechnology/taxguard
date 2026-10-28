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
