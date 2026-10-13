/**
 * Server-side validation for document intake metadata (Phase 6).
 * Pure and deterministic: no I/O. Content scanning is a separate, uncommissioned pipeline;
 * this layer only refuses metadata that is invalid, inconsistent or obviously dangerous.
 */

/** Permitted MIME types and the file extensions each may carry. */
export const ALLOWED_DOCUMENT_TYPES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/csv': ['csv'],
});
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const MAX_BATCH_FILES = 20;
const MIN_TAX_YEAR = 2000;

// Executable or active-content extensions anywhere in the name (catches "w2.pdf.exe" and "a.exe.pdf").
const DANGEROUS_SEGMENT = /\.(exe|bat|cmd|com|scr|pif|msi|msp|dll|cpl|jar|js|jse|mjs|vbs|vbe|wsf|wsh|ps1|psm1|sh|hta|html?|xhtml|svg|lnk|reg|iso|img|docm|xlsm|pptm)(?=\.|$)/i;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F]/;
const SIZE_TEXT = /^(\d+(?:\.\d+)?)\s*(b|bytes?|kb|mb|gb)$/i;
const UNIT: Record<string, number> = { b: 1, byte: 1, bytes: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

export type UploadRejectionCode =
  | 'FILE_NAME_INVALID' | 'FILE_TYPE_UNSUPPORTED' | 'FILE_EXTENSION_MISMATCH' | 'FILE_SUSPICIOUS'
  | 'FILE_SIZE_REQUIRED' | 'FILE_SIZE_INVALID' | 'FILE_TOO_LARGE' | 'TAX_YEAR_INVALID' | 'CATEGORY_INVALID';

export interface ValidatedUpload { fileName: string; fileType: string; sizeBytes: number; taxYear: number; category?: string }
export interface UploadAccepted { ok: true; value: ValidatedUpload }
export interface UploadRejected { ok: false; code: UploadRejectionCode; error: string; suspicious: boolean }
export type UploadValidation = UploadAccepted | UploadRejected;
/** Explicit guard: narrows reliably even without strictNullChecks. */
export const isUploadRejected = (v: UploadValidation): v is UploadRejected => v.ok === false;

/** Accepts a positive integer byte count (number or digit string) or a display size such as "1.2 MB". */
export function parseDocumentSize(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) { const n = Number(text); return Number.isSafeInteger(n) && n > 0 ? n : null; }
  const match = SIZE_TEXT.exec(text);
  if (!match) return null;
  const bytes = Math.ceil(Number(match[1]) * UNIT[match[2].toLowerCase()]);
  return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : null;
}

/** Strict base64 decoding: rejects malformed input instead of silently dropping characters. */
export function decodeBase64Strict(value: unknown): Buffer | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/^data:[^;,]+;base64,/, '').replace(/\s+/g, '');
  if (!text || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
  const bytes = Buffer.from(text, 'base64');
  return bytes.length > 0 ? bytes : null;
}

/**
 * File-signature (magic byte) check: the content must actually be of the declared type.
 * XLSX is a ZIP container (PK\x03\x04); CSV must be text without NUL bytes.
 */
export function matchesFileSignature(bytes: Buffer, fileType: string): boolean {
  const starts = (sig: number[]) => bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);
  switch (fileType) {
    case 'application/pdf': return starts([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case 'image/png': return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg': return starts([0xff, 0xd8, 0xff]);
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return starts([0x50, 0x4b, 0x03, 0x04]);
    case 'text/csv': return !bytes.includes(0x00);
    default: return false;
  }
}

export function formatDocumentSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

const reject = (code: UploadRejectionCode, error: string, suspicious = false): UploadValidation => ({ ok: false, code, error, suspicious });

export function validateDocumentUpload(input: { fileName?: unknown; fileType?: unknown; fileSize?: unknown; taxYear?: unknown; category?: unknown }, now = new Date()): UploadValidation {
  if (typeof input.fileName !== 'string') return reject('FILE_NAME_INVALID', 'A file name is required.');
  const fileName = input.fileName.trim();
  if (!fileName || fileName.length > 255 || CONTROL.test(fileName) || /[\\/]/.test(fileName) || fileName.startsWith('.') || fileName.includes('..')) {
    return reject('FILE_NAME_INVALID', 'The file name is invalid.');
  }
  if (DANGEROUS_SEGMENT.test(fileName)) {
    return reject('FILE_SUSPICIOUS', 'Security alert: File failed pre-upload anti-malware heuristics.', true);
  }
  if (typeof input.fileType !== 'string' || !ALLOWED_DOCUMENT_TYPES[input.fileType]) {
    return reject('FILE_TYPE_UNSUPPORTED', 'Unsupported file format. Permitted types: PDF, PNG, JPG, XLSX, CSV.');
  }
  const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase() : '';
  if (!ALLOWED_DOCUMENT_TYPES[input.fileType].includes(extension)) {
    return reject('FILE_EXTENSION_MISMATCH', 'The file extension does not match the declared file type.');
  }
  if (input.fileSize === undefined || input.fileSize === null || input.fileSize === '') {
    return reject('FILE_SIZE_REQUIRED', 'The file size is required.');
  }
  const sizeBytes = parseDocumentSize(input.fileSize);
  if (sizeBytes === null) return reject('FILE_SIZE_INVALID', 'The file size is invalid.');
  if (sizeBytes > MAX_DOCUMENT_BYTES) return reject('FILE_TOO_LARGE', 'Files must be 25 MB or smaller.');
  const taxYear = typeof input.taxYear === 'number' ? input.taxYear : typeof input.taxYear === 'string' && /^\d{4}$/.test(input.taxYear) ? Number(input.taxYear) : NaN;
  if (!Number.isInteger(taxYear) || taxYear < MIN_TAX_YEAR || taxYear > now.getUTCFullYear() + 1) {
    return reject('TAX_YEAR_INVALID', 'A valid tax year is required.');
  }
  let category: string | undefined;
  if (input.category !== undefined && input.category !== null && input.category !== '') {
    if (typeof input.category !== 'string' || !/^[a-z0-9_]{1,64}$/.test(input.category)) return reject('CATEGORY_INVALID', 'The document category is invalid.');
    category = input.category;
  }
  return { ok: true, value: { fileName, fileType: input.fileType, sizeBytes, taxYear, ...(category ? { category } : {}) } };
}
