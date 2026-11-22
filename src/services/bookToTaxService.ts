import { apiRequest, ApiRequestError } from './api';

export class BookToTaxRequestError extends ApiRequestError {}

export interface B2tMappingEntry {
  accountId: string;
  categoryCode: string | null;
  [key: string]: any;
}

export interface B2tMappingSet {
  setId: string;
  version: number;
  status: string;
  mappings: B2tMappingEntry[];
  [key: string]: any;
}

export interface B2tOverview {
  caseId?: string;
  taxYear?: number;
  mappingSets: B2tMappingSet[];
  lines?: any[];
  adjustments: any[];
  summary?: Record<string, any>;
  [key: string]: any;
}

export function newB2tKey(prefix = 'b2t'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function centsText(cents: number | null | undefined): string {
  const value = typeof cents === 'number' ? cents / 100 : 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function bookToTaxMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Book-to-tax service is currently unavailable.';
}

export const bookToTaxApi: any = new Proxy(
  {
    getOverview: (caseId: string) => apiRequest(`/api/book-to-tax/${encodeURIComponent(caseId)}/overview`),
    createAdjustment: (caseId: string, payload: any) =>
      apiRequest(`/api/book-to-tax/${encodeURIComponent(caseId)}/adjustments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => apiRequest(`/api/book-to-tax/${prop}`);
    },
  }
);
