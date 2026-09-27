import type {
  KnowledgeSource,
  KnowledgeSourceType,
  IntelligenceAuthority,
} from '../types';

/**
 * TG-CORE-001 — TaxGuard Knowledge Registry
 *
 * Central deterministic registry for authoritative tax knowledge.
 *
 * This registry stores metadata and references to tax authority.
 * It does not treat AI-generated material as authoritative tax law.
 */
export class KnowledgeRegistry {
  private static readonly sources = new Map<string, KnowledgeSource>();

  public static register(
    source: KnowledgeSource
  ): KnowledgeSource {
    if (!source.sourceId.trim()) {
      throw new Error('Knowledge source requires sourceId.');
    }

    if (!source.title.trim()) {
      throw new Error('Knowledge source requires title.');
    }

    if (!source.jurisdiction.trim()) {
      throw new Error('Knowledge source requires jurisdiction.');
    }

    const existing = this.sources.get(source.sourceId);

    if (existing) {
      throw new Error(
        `Knowledge source already registered: ${source.sourceId}`
      );
    }

    const stored: KnowledgeSource = {
      ...source,
      createdAt: source.createdAt || new Date().toISOString(),
      updatedAt: source.updatedAt || new Date().toISOString(),
    };

    this.sources.set(stored.sourceId, stored);

    return { ...stored };
  }

  public static get(sourceId: string): KnowledgeSource | undefined {
    const source = this.sources.get(sourceId);

    return source ? { ...source } : undefined;
  }

  public static getAll(): KnowledgeSource[] {
    return Array.from(this.sources.values()).map(source => ({
      ...source,
    }));
  }

  public static getActive(): KnowledgeSource[] {
    return this.getAll().filter(source => source.isActive);
  }

  public static findByType(
    sourceType: KnowledgeSourceType
  ): KnowledgeSource[] {
    return this.getAll().filter(
      source => source.sourceType === sourceType
    );
  }

  public static findByAuthority(
    authority: IntelligenceAuthority
  ): KnowledgeSource[] {
    return this.getAll().filter(
      source => source.authority === authority
    );
  }

  public static findForTaxYear(
    taxYear: number
  ): KnowledgeSource[] {
    return this.getActive().filter(source => {
      if (source.taxYear !== undefined) {
        return source.taxYear === taxYear;
      }

      const startYear = source.effectiveFrom
        ? new Date(source.effectiveFrom).getUTCFullYear()
        : undefined;

      const endYear = source.effectiveTo
        ? new Date(source.effectiveTo).getUTCFullYear()
        : undefined;

      if (startYear !== undefined && taxYear < startYear) {
        return false;
      }

      if (endYear !== undefined && taxYear > endYear) {
        return false;
      }

      return true;
    });
  }

  public static update(
    sourceId: string,
    changes: Partial<
      Omit<KnowledgeSource, 'sourceId' | 'createdAt'>
    >
  ): KnowledgeSource {
    const existing = this.sources.get(sourceId);

    if (!existing) {
      throw new Error(
        `Knowledge source not found: ${sourceId}`
      );
    }

    const updated: KnowledgeSource = {
      ...existing,
      ...changes,
      sourceId: existing.sourceId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.sources.set(sourceId, updated);

    return { ...updated };
  }

  public static deactivate(
    sourceId: string
  ): KnowledgeSource {
    return this.update(sourceId, {
      isActive: false,
    });
  }

  /**
   * Test/support utility.
   *
   * Production workflows should deactivate or supersede knowledge
   * rather than silently deleting historical authority.
   */
  public static clear(): void {
    this.sources.clear();
  }
}