import { beforeEach, describe, expect, it } from 'vitest';
import { KnowledgeRegistry } from '../taxguard/intelligence/knowledge/KnowledgeRegistry';
import type { KnowledgeSource } from '../taxguard/intelligence/types';

describe('TG-CORE-001 Knowledge Registry', () => {
  beforeEach(() => {
    KnowledgeRegistry.clear();
  });

  const createSource = (
    overrides: Partial<KnowledgeSource> = {}
  ): KnowledgeSource => ({
    sourceId: 'IRS-FORM-1040-2025',
    sourceType: 'IRS_FORM',
    title: 'Form 1040',
    citation: 'Form 1040',
    jurisdiction: 'US-FEDERAL',
    taxYear: 2025,
    authority: 'PRIMARY_AUTHORITY',
    version: '2025',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it('registers and retrieves a knowledge source', () => {
    KnowledgeRegistry.register(createSource());

    const result =
      KnowledgeRegistry.get('IRS-FORM-1040-2025');

    expect(result).toBeDefined();
    expect(result?.title).toBe('Form 1040');
    expect(result?.taxYear).toBe(2025);
  });

  it('rejects duplicate source IDs', () => {
    const source = createSource();

    KnowledgeRegistry.register(source);

    expect(() =>
      KnowledgeRegistry.register(source)
    ).toThrow(/already registered/i);
  });

  it('filters sources by authority', () => {
    KnowledgeRegistry.register(createSource());

    KnowledgeRegistry.register(
      createSource({
        sourceId: 'FIRM-SOP-001',
        sourceType: 'FIRM_SOP',
        title: 'Firm Review SOP',
        authority: 'FIRM_POLICY',
        taxYear: undefined,
      })
    );

    const primary =
      KnowledgeRegistry.findByAuthority(
        'PRIMARY_AUTHORITY'
      );

    expect(primary).toHaveLength(1);
    expect(primary[0].sourceId).toBe(
      'IRS-FORM-1040-2025'
    );
  });

  it('returns knowledge applicable to a tax year', () => {
    KnowledgeRegistry.register(createSource());

    expect(
      KnowledgeRegistry.findForTaxYear(2025)
    ).toHaveLength(1);

    expect(
      KnowledgeRegistry.findForTaxYear(2024)
    ).toHaveLength(0);
  });

  it('deactivates knowledge without deleting history', () => {
    KnowledgeRegistry.register(createSource());

    KnowledgeRegistry.deactivate(
      'IRS-FORM-1040-2025'
    );

    expect(
      KnowledgeRegistry.get('IRS-FORM-1040-2025')
        ?.isActive
    ).toBe(false);

    expect(KnowledgeRegistry.getActive()).toHaveLength(0);

    expect(KnowledgeRegistry.getAll()).toHaveLength(1);
  });
});