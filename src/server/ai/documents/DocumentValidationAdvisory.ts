import { GovernanceError } from '../governance/contracts';
import type { EvidenceMetadata } from '../capabilities/contracts';

type Field = Readonly<{ key: string; page: number; value: string | number }>;
type Extraction = Readonly<{
  sourceId: string;
  documentVersion: number;
  sourceHash: string;
  fields: readonly Field[];
}>;
type FindingCode = 'EXTRACTED_FIELD_MISSING' | 'SOURCE_ANCHOR_MISSING' | 'SOURCE_VALUE_MISMATCH';

function validateField(field: Field) {
  if (!field || typeof field.key !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(field.key)
    || !Number.isSafeInteger(field.page) || field.page < 1
    || !((typeof field.value === 'string' && field.value.length <= 4096 && field.value.trim().length > 0)
      || (typeof field.value === 'number' && Number.isFinite(field.value)))) {
    throw new GovernanceError('AI_EXTRACTION_FIELDS_INVALID');
  }
}

/** Compare an extraction with independently resolved source anchors from the same authorized document version. */
export function inspectDocumentExtraction(evidence: EvidenceMetadata, extraction: Extraction, source: Extraction) {
  if (!evidence || typeof evidence.source_id !== 'string' || !evidence.source_id.trim() || evidence.quarantine_status !== 'CLEAN'
    || !['RELEASED', 'VERIFIED'].includes(evidence.document_status)
    || !Number.isSafeInteger(evidence.document_version) || evidence.document_version < 1
    || typeof evidence.source_hash !== 'string'
    || !/^[a-f0-9]{64}$/.test(evidence.source_hash)
    || [extraction, source].some(input => !input || input.sourceId !== evidence.source_id
      || input.documentVersion !== evidence.document_version || input.sourceHash !== evidence.source_hash)) {
    throw new GovernanceError('AI_EXTRACTION_SOURCE_INVALID');
  }

  const buildIndex = (fields: readonly Field[]) => {
    if (!Array.isArray(fields) || fields.length > 200) throw new GovernanceError('AI_EXTRACTION_FIELDS_INVALID');
    const index = new Map<string, Field>();
    for (const field of fields) {
      validateField(field);
      const key = JSON.stringify([field.page, field.key]);
      if (index.has(key)) throw new GovernanceError('AI_EXTRACTION_FIELDS_INVALID');
      index.set(key, field);
    }
    return index;
  };
  const extracted = buildIndex(extraction.fields);
  const anchored = buildIndex(source.fields);
  if (!extracted.size && !anchored.size) throw new GovernanceError('AI_EXTRACTION_FIELDS_INVALID');

  const findings: { field_key: string; page: number; code: FindingCode }[] = [];
  for (const [key, field] of extracted) {
    const anchor = anchored.get(key);
    if (!anchor || anchor.value !== field.value) {
      findings.push({ field_key: field.key, page: field.page, code: anchor ? 'SOURCE_VALUE_MISMATCH' : 'SOURCE_ANCHOR_MISSING' });
    }
  }

  for (const [key, anchor] of anchored) {
    if (!extracted.has(key)) {
      findings.push({ field_key: anchor.key, page: anchor.page, code: 'EXTRACTED_FIELD_MISSING' });
    }
  }

  return {
    agent_id: 'A08' as const, status: 'ADVISORY' as const, human_review_required: true as const,
    authoritative_mutation: false as const, source_id: evidence.source_id, document_version: evidence.document_version,
    compared_fields: extracted.size, findings,
  };
}
