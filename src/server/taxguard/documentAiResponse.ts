import { AuthorityError } from './authority.repository';
import type { OcrExtractionOutput } from './ocrProvider';

/** Untrusted candidate parsing only; no human verification or taxpayer fact certification. */
export function parseDocumentAiResponse(raw: unknown, provider: string, providerVersion: string): OcrExtractionOutput[] {
  const data = raw as any;
  if (!data || typeof data !== 'object' || !data.document || typeof data.document !== 'object' || data.document.error) {
    throw new AuthorityError('OCR_INVALID_RESPONSE', 503);
  }
  const entities = data.document.entities ?? [];
  if (!Array.isArray(entities) || entities.length > 1000 ||
      (data.document.text !== undefined && (typeof data.document.text !== 'string' || data.document.text.length > 1_000_000))) {
    throw new AuthorityError('OCR_INVALID_RESPONSE', 503);
  }
  const outputs = entities.map((entity: any, index: number) => {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) throw new AuthorityError('OCR_INVALID_RESPONSE', 503);
    const confidence = entity.confidence ?? 0;
    const field = entity.type ?? `Field_${index}`;
    const proposedValue = entity.normalizedValue?.text ?? entity.mentionText ?? '';
    const rawPage = entity.pageAnchor?.pageRefs?.[0]?.page ?? 0;
    const page = typeof rawPage === 'string' && /^\d+$/.test(rawPage) ? Number(rawPage) : rawPage;
    if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 ||
        typeof field !== 'string' || field.length === 0 || field.length > 256 ||
        typeof proposedValue !== 'string' || proposedValue.length > 65536 ||
        !Number.isSafeInteger(page) || page < 0 || page > 10000 ||
        (entity.mentionText !== undefined && (typeof entity.mentionText !== 'string' || entity.mentionText.length > 65536))) {
      throw new AuthorityError('OCR_INVALID_RESPONSE', 503);
    }
    return { field, page: page + 1, proposedValue, confidence, sourceText: entity.mentionText, provider, providerVersion };
  });
  if (!outputs.length && data.document.text) outputs.push({
    field: 'rawDocumentText', page: 1, proposedValue: data.document.text,
    confidence: 0, sourceText: data.document.text.slice(0, 100), provider, providerVersion,
  });
  return outputs;
}
