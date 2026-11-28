import { describe, expect, it } from 'vitest';
import { inspectDocumentIntake } from '../server/ai/documents/DocumentIntakeAdvisory';
import { inspectDocumentExtraction } from '../server/ai/documents/DocumentValidationAdvisory';
import type { EvidenceMetadata } from '../server/ai/capabilities/contracts';

describe('A05 document intake advisory', () => {
  const scope = { clientId: 'client', engagementId: 'engagement', taxYear: 2025 };
  const snapshot = { ...scope, documentId: 'doc', version: 1, fileName: 'document.pdf', fileType: 'application/pdf',
    sizeBytes: 512, status: 'SCAN_PENDING', quarantineStatus: 'PENDING', linkedRequest: true };
  it.each([null, undefined])('rejects missing vault metadata', missing => {
    expect(() => inspectDocumentIntake(scope, missing as unknown as typeof snapshot))
      .toThrow('AI_DOCUMENT_METADATA_INVALID');
  });
  it.each(['   ', { unexpected: 'metadata' }])('rejects a malformed vault document ID', documentId => {
    const malformed = { ...snapshot, documentId } as unknown as typeof snapshot;
    expect(() => inspectDocumentIntake(scope, malformed)).toThrow('AI_DOCUMENT_METADATA_INVALID');
  });
  it('holds documents awaiting scanning and flags missing request links', () => {
    const result = inspectDocumentIntake(scope, { ...snapshot, linkedRequest: false });
    expect(result).toMatchObject({ findings: ['WAITING_FOR_SCAN', 'REQUEST_LINK_MISSING'], human_review_required: true });
  });
  it.each(['UPLOAD_PENDING', 'SCAN_PENDING'])('marks infected evidence unavailable during %s', status => {
    expect(inspectDocumentIntake(scope, { ...snapshot, status, quarantineStatus: 'INFECTED' }).findings)
      .toEqual(['DOCUMENT_UNAVAILABLE']);
  });
  it.each(['UPLOAD_PENDING', 'SCAN_PENDING'])('recognizes the vault quarantine state during %s', status => {
    expect(inspectDocumentIntake(scope, { ...snapshot, status, quarantineStatus: 'QUARANTINED' }).findings).toEqual(['WAITING_FOR_SCAN']);
  });
  it.each(['CLEAN', 'UNKNOWN', ''])('holds an inconsistent scan-pending snapshot with quarantine state %j', quarantineStatus => {
    expect(inspectDocumentIntake(scope, { ...snapshot, quarantineStatus }).findings).toEqual(['DOCUMENT_UNAVAILABLE']);
  });
  it('flags unsafe metadata, refuses out-of-scope intake, and never releases a rejected document', () => {
    expect(inspectDocumentIntake(scope, { ...snapshot, fileName: 'document.exe.pdf', status: 'PENDING_REVIEW', quarantineStatus: 'CLEAN' }).findings)
      .toEqual(['FILE_SUSPICIOUS', 'DOCUMENT_UNAVAILABLE']);
    expect(() => inspectDocumentIntake(scope, { ...snapshot, taxYear: 2024 })).toThrow('AI_DOCUMENT_SCOPE_INVALID');
  });
});

describe('A08 source comparison advisory', () => {
  const evidence: EvidenceMetadata = { source_id: 'source', document_record_id: 'doc', document_version: 2,
    source_hash: 'a'.repeat(64), document_status: 'RELEASED', quarantine_status: 'CLEAN' };
  const extraction = { sourceId: 'source', documentVersion: 2, sourceHash: evidence.source_hash,
    fields: [{ key: 'first', page: 1, value: 2 }, { key: 'second', page: 1, value: 'private value' }, { key: 'third', page: 2, value: 3 }] };
  const source = { ...extraction, fields: [{ key: 'first', page: 1, value: 2 }, { key: 'second', page: 1, value: 'different' }] };
  it('reports mismatches and missing anchors without echoing extracted values', () => {
    const advisory = inspectDocumentExtraction(evidence, extraction, source);
    expect(advisory.findings).toEqual([
      { field_key: 'second', page: 1, code: 'SOURCE_VALUE_MISMATCH' },
      { field_key: 'third', page: 2, code: 'SOURCE_ANCHOR_MISSING' },
    ]);
    expect(advisory).toMatchObject({ extracted_fields: 3, anchored_fields: 2, compared_fields: 2 });
    expect(JSON.stringify(advisory)).not.toContain('private value');
    expect(advisory.human_review_required).toBe(true);
  });
  it('reports every anchored field when extraction returns no fields', () => {
    const empty = { ...extraction, fields: [] };
    const advisory = inspectDocumentExtraction(evidence, empty, source);
    expect(advisory).toMatchObject({ compared_fields: 0, human_review_required: true, authoritative_mutation: false });
    expect(advisory.findings).toEqual(source.fields.map(({ key, page }) => ({
      field_key: key, page, code: 'EXTRACTED_FIELD_MISSING',
    })));
    expect(() => inspectDocumentExtraction(evidence, empty, empty)).toThrow('AI_EXTRACTION_FIELDS_INVALID');
  });
  it('flags an anchored field omitted from extraction on a different page', () => {
    const extra = { ...extraction.fields[0], page: 2, value: 'private anchor' };
    const advisory = inspectDocumentExtraction(evidence, extraction, { ...source, fields: [...extraction.fields, extra] });
    expect(advisory.findings).toEqual([{ field_key: extra.key, page: 2, code: 'EXTRACTED_FIELD_MISSING' }]);
    expect(JSON.stringify(advisory)).not.toContain(extra.value);
  });
  it('rejects missing extraction or source snapshots before comparing fields', () => {
    const missing = null as unknown as typeof extraction;
    expect(() => inspectDocumentExtraction(evidence, missing, source)).toThrow('AI_EXTRACTION_SOURCE_INVALID');
    expect(() => inspectDocumentExtraction(evidence, extraction, missing)).toThrow('AI_EXTRACTION_SOURCE_INVALID');
  });
  it('rejects a non-string evidence hash before source comparison', () => {
    const malformed = { ...evidence, source_hash: [evidence.source_hash] } as unknown as EvidenceMetadata;
    expect(() => inspectDocumentExtraction(malformed, extraction, source)).toThrow('AI_EXTRACTION_SOURCE_INVALID');
  });
  it('rejects snapshots with a different content hash even when source and version match', () => {
    const substituted = { ...extraction, sourceHash: 'b'.repeat(64) };
    expect(() => inspectDocumentExtraction(evidence, substituted, source)).toThrow('AI_EXTRACTION_SOURCE_INVALID');
    expect(() => inspectDocumentExtraction(evidence, extraction, substituted)).toThrow('AI_EXTRACTION_SOURCE_INVALID');
  });
  it('refuses stale versions, released-state gaps, and malformed duplicate anchors', () => {
    expect(() => inspectDocumentExtraction(evidence, extraction, { ...source, documentVersion: 1 })).toThrow('AI_EXTRACTION_SOURCE_INVALID');
    expect(() => inspectDocumentExtraction({ ...evidence, document_status: 'SCAN_PENDING' as EvidenceMetadata['document_status'] }, extraction, source))
      .toThrow('AI_EXTRACTION_SOURCE_INVALID');
    expect(() => inspectDocumentExtraction(evidence, extraction, { ...source, fields: [source.fields[0], source.fields[0]] }))
      .toThrow('AI_EXTRACTION_FIELDS_INVALID');
  });
});
