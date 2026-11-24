import { describe, expect, it } from 'vitest';
import { inspectMissingDocuments } from '../server/ai/documents/MissingDocumentAdvisory';

const scope = { clientId: 'synthetic-client', engagementId: 'synthetic-engagement', taxYear: 2025 };
type Item = Parameters<typeof inspectMissingDocuments>[1]['requirements'][number];
const row = (requirementId: string, status: Item['status'], requirementLevel: Item['requirementLevel'] = 'REQUIRED'): Item =>
  ({ requirementId, engagementId: scope.engagementId, taxYear: scope.taxYear, status, requirementLevel });
const manifest = (...requirements: Item[]) => ({ ...scope, manifestVersion: 2, requirements });

describe('A09 missing-document advisory', () => {
  it('distinguishes missing evidence, pending review and unusable evidence', () => {
    const input = manifest(row('one', 'MISSING'), row('two', 'MATCHED'), row('three', 'WRONG_YEAR', 'CONDITIONAL'),
      row('four', 'COLLECTION_ACCEPTED'), row('five', 'WAIVED'), row('six', 'MISSING', 'OPTIONAL'));
    const snapshot = structuredClone(input);
    expect(inspectMissingDocuments(scope, input)).toEqual({
      agent_id: 'A09', status: 'ADVISORY', human_review_required: true, authoritative_mutation: false, manifest_version: 2,
      findings: [
        { requirement_id: 'one', code: 'MISSING_EVIDENCE', requirement_level: 'REQUIRED' },
        { requirement_id: 'two', code: 'EVIDENCE_PENDING_REVIEW', requirement_level: 'REQUIRED' },
        { requirement_id: 'three', code: 'EVIDENCE_NEEDS_CORRECTION', requirement_level: 'CONDITIONAL' },
      ],
    });
    expect(input).toEqual(snapshot);
  });

  it('omits conditional requirements already settled or marked inapplicable', () => {
    const settled = ['WAIVED', 'NOT_APPLICABLE', 'SATISFIED', 'COLLECTION_ACCEPTED'] as const;
    const input = manifest(...settled.map(status => row(status, status, 'CONDITIONAL')));
    expect(inspectMissingDocuments(scope, input).findings).toEqual([]);
  });

  it('rejects a malformed status that would suppress a required finding', () => {
    const malformed = { ...row('one', 'EXPECTED'), status: ['WAIVED'] } as unknown as Item;
    expect(() => inspectMissingDocuments(scope, manifest(malformed))).toThrow('AI_MANIFEST_INVALID');
  });

  it('refuses out-of-scope, duplicate or unknown requirement records', () => {
    const item = row('one', 'EXPECTED');
    expect(() => inspectMissingDocuments({ ...scope, clientId: 'other' }, manifest(item))).toThrow('AI_MANIFEST_SCOPE_INVALID');
    for (const items of [[item, item], [{ ...item, taxYear: 2024 }], [{ ...item, status: 'UNKNOWN' as Item['status'] }]]) {
      expect(() => inspectMissingDocuments(scope, manifest(...items))).toThrow('AI_MANIFEST_INVALID');
    }
  });
});
