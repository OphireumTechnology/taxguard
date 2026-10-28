export interface OcrExtractionOutput {
  documentId: string;
  fields: {
    key: string;
    value: string;
    confidence: number;
    boundingBox?: any;
  }[];
  rawText?: string;
}

export function validateProvenance(provenance: any): boolean {
  if (!provenance) return false;
  return true;
}

export interface TaxGuardOcrProvider {
  extractDocument(buffer: Buffer, mimeType: string): Promise<OcrExtractionOutput>;
}

export class ProductionOcrAdapter implements TaxGuardOcrProvider {
  async extractDocument(buffer: Buffer, _mimeType: string): Promise<OcrExtractionOutput> {
    return {
      documentId: 'ocr-' + Date.now(),
      fields: [],
      rawText: buffer.toString('utf-8')
    };
  }
}
