import { api } from './api';

export interface B2tOverview {
  clientId: string;
  taxYear: number;
  bookNetIncomeCents?: number;
  taxableIncomeCents?: number;
  mappingSets: Array<{
    setId: string;
    version: number;
    status: string;
    mappings: Array<{ accountId: string; categoryCode: string }>;
    [key: string]: any;
  }>;
  adjustments: any[];
  workpapers: any[];
  status?: string;
  [key: string]: any;
}

export class BookToTaxRequestError extends Error {
  constructor(public readonly code: string, message?: string, public readonly status?: number) {
    super(message || code);
    this.name = 'BookToTaxRequestError';
  }
}

export function newB2tKey(): string {
  return `b2t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function centsText(cents?: number | null): string {
  const n = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
}

export function bookToTaxMessage(err: unknown, fallback = 'Book-to-tax service unavailable.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const bookToTaxApi: any = {
  getOverview: (clientId: string, taxYear: number, signal?: AbortSignal) =>
    api.request(`/api/book-to-tax/${encodeURIComponent(clientId)}/${taxYear}`, { signal }),
  addAdjustment: (clientId: string, taxYear: number, payload: Record<string, any>) =>
    api.request(`/api/book-to-tax/${encodeURIComponent(clientId)}/${taxYear}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approveAdjustment: (clientId: string, taxYear: number, id: string) =>
    api.request(`/api/book-to-tax/${encodeURIComponent(clientId)}/${taxYear}/adjustments/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    }),
};
