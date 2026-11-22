import type { TaxRequirementManifest } from './stageTwoRequirementManifest';

export type RecognizedDocumentType = string;

export interface DocumentExtractionEnvelope {
  documentId: string;
  originalFileName: string;
  sha256Hash: string;
  detectedType: RecognizedDocumentType;
  detectedCategory?: string;
  detectedTaxYear: number;
  detectedTaxpayer?: string;
  detectedEmployer?: string;
  detectedPayer?: string;
  detectedJurisdiction?: string;
  confidence: number;
  isCorrected?: boolean;
  isDuplicate?: boolean;
  extractedFields: Record<string, any>;
  warnings: string[];
  rawTextPreview?: string;
  [key: string]: any;
}

export interface DocumentRequirementMatch {
  matched: boolean;
  result: DocumentRequirementMatchResult;
  requirementId?: string;
  requirementTitle?: string;
  confidence: number;
  score: number;
  matchedBy: string[];
  candidates?: DocumentRequirementMatch[];
  needsHumanReview?: boolean;
  isWrongYear?: boolean;
  isWrongTaxpayer?: boolean;
  isDuplicate?: boolean;
  isCorrectedDocument?: boolean;
  discoveredNewSource?: boolean;
  reasons: string[];
  [key: string]: any;
}

export type DocumentRequirementMatchResult =
  | 'EXACT_MATCH'
  | 'PROBABLE_MATCH'
  | 'AMBIGUOUS'
  | 'UNMATCHED'
  | 'UNCLASSIFIED'
  | 'DUPLICATE'
  | 'WRONG_YEAR'
  | 'WRONG_TAXPAYER'
  | string;

function detectDocumentTypeFromName(fileName: string, rawText?: string): RecognizedDocumentType {
  const haystack = `${fileName} ${rawText || ''}`.toLowerCase();
  if (haystack.includes('w-2c') || haystack.includes('w2c')) return 'W-2C';
  if (haystack.includes('w-2') || haystack.includes('w2')) return 'W-2';
  if (haystack.includes('1099-nec')) return '1099-NEC';
  if (haystack.includes('1099-int')) return '1099-INT';
  if (haystack.includes('1099-div')) return '1099-DIV';
  if (haystack.includes('1099-b')) return '1099-B';
  if (haystack.includes('1099-r')) return '1099-R';
  if (haystack.includes('1099')) return '1099-MISC';
  if (haystack.includes('k-1') || haystack.includes('k1')) return 'K-1';
  if (haystack.includes('1098')) return '1098';
  return 'SUPPORTING_TAX_DOCUMENT';
}

export const StageTwoMatchingEngine = {
  recognizeAndExtract(params: {
    documentId: string;
    originalFileName: string;
    sha256Hash: string;
    fileBytes?: Uint8Array;
    rawText?: string;
    activeTaxYear: number;
    expectedTaxpayerName?: string;
  }): DocumentExtractionEnvelope {
    const detectedType = detectDocumentTypeFromName(params.originalFileName, params.rawText);
    const yearMatch = `${params.originalFileName} ${params.rawText || ''}`.match(/\b(202[0-9])\b/);
    const detectedTaxYear = yearMatch ? Number(yearMatch[1]) : params.activeTaxYear;
    return {
      documentId: params.documentId,
      originalFileName: params.originalFileName,
      sha256Hash: params.sha256Hash,
      detectedType,
      detectedCategory: detectedType,
      detectedTaxYear,
      detectedTaxpayer: params.expectedTaxpayerName,
      detectedJurisdiction: 'SC',
      confidence: 0.9,
      isCorrected: detectedType === 'W-2C' || /corrected/i.test(params.originalFileName),
      isDuplicate: false,
      extractedFields: {},
      warnings: [],
      rawTextPreview: params.rawText?.slice(0, 200),
    };
  },

  matchDocumentToManifest(
    envelope: DocumentExtractionEnvelope,
    manifest: TaxRequirementManifest,
    _existingUploadSummary?: any
  ): DocumentRequirementMatch {
    const candidates: DocumentRequirementMatch[] = [];
    for (const req of manifest.requirements || []) {
      const target = `${req.title || ''} ${req.documentType || ''} ${req.category || ''}`.toLowerCase();
      const dt = envelope.detectedType.toLowerCase();
      if (target.includes(dt) || (req.expectedDocumentTypes || []).some((t) => t.toLowerCase() === dt)) {
        candidates.push({
          matched: true,
          result: 'EXACT_MATCH',
          requirementId: req.requirementId,
          requirementTitle: req.title,
          confidence: envelope.confidence,
          score: Math.round(envelope.confidence * 100),
          matchedBy: ['document_type'],
          reasons: ['Matched by detected document type'],
        });
      }
    }
    const best = candidates[0];
    const isWrongYear = envelope.detectedTaxYear !== manifest.taxYear;
    const result: DocumentRequirementMatchResult = isWrongYear
      ? 'WRONG_YEAR'
      : best
        ? 'EXACT_MATCH'
        : 'UNMATCHED';
    return {
      matched: Boolean(best),
      result,
      requirementId: best?.requirementId,
      requirementTitle: best?.requirementTitle,
      candidates,
      confidence: best ? best.confidence : 0,
      score: best ? best.score : 0,
      matchedBy: best ? best.matchedBy : [],
      needsHumanReview: !best || isWrongYear || envelope.confidence < 0.75,
      isWrongYear,
      isWrongTaxpayer: false,
      isDuplicate: Boolean(envelope.isDuplicate),
      isCorrectedDocument: Boolean(envelope.isCorrected),
      discoveredNewSource: !best,
      reasons: best ? ['Matched by detected document type'] : ['No existing manifest requirement matched'],
    };
  },
};
