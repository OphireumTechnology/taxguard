/**
 * The ONLY place that states what TaxGuard can actually do with a form. Every library entry's
 * capability states are derived from these facts, so a readiness label cannot be fabricated.
 *
 * Facts reflected here (checked in the codebase on 2026-10-12):
 * - src/server/taxguard/authority.repository.ts generateDraftReturn() builds a DRAFT Form 1040 only,
 *   with a simplified, non-authoritative calculation (single-filer 2025 brackets up to 24%, fixed
 *   standard deduction, flat QBI). Other return types and state calculations are rejected.
 * - No PDF generation library or renderer exists in the project.
 * - The FILING and E_SIGNATURE providers report NOT_CONFIGURED; no e-file transmitter is integrated.
 */
import type { CapabilityKey, CapabilityState, ReadinessLabel, SourceVerification } from './types';
import { BLOCKED_LABEL, READINESS_LADDER } from './types';

const notImplemented = (note: string): CapabilityState => ({ status: 'not_implemented', note });
const blocked = (note: string): CapabilityState => ({ status: 'blocked', note });

export const NO_PDF = notImplemented('No PDF generation is implemented in TaxGuard.');
export const NO_EFILE = blocked('No authorized e-file transmitter is integrated (filing provider not configured).');

/** Default for every catalog entry: reference only. */
export function referenceOnlyCapabilities(): Record<CapabilityKey, CapabilityState> {
  return {
    dataEntry: notImplemented('No form-specific data entry is implemented.'),
    calculation: notImplemented('No authoritative calculation engine for this form.'),
    validation: notImplemented('No form-specific validation rules are implemented.'),
    pdf: NO_PDF,
    reviewReady: notImplemented('Cannot be review-ready without authoritative preparation.'),
    efile: NO_EFILE,
    filingReady: blocked('Not filing ready: preparation, PDF and e-file capabilities are not operational.'),
  };
}

/** Code that exists but is NOT authoritative. Shown as prototype; never counted as supported. */
export const PROTOTYPE_CAPABILITIES: Record<string, Partial<Record<CapabilityKey, CapabilityState>>> = {
  'F-1040': {
    dataEntry: { status: 'prototype', note: 'Draft generator reads recorded tax-record categories (wages, interest, dividends, business income, capital transactions, adjustments, itemized deductions, credits, withholding, estimated payments).' },
    calculation: { status: 'prototype', note: 'Simplified draft only: single-filer 2025 brackets up to 24%, fixed standard deduction, flat 20% QBI; no filing status, phase-outs or other taxes. Not authoritative.' },
    validation: { status: 'prototype', note: 'Draft diagnostics only (open exceptions, zero income). Not IRS business-rule validation.' },
  },
  'F-SCH-1': {
    calculation: { status: 'prototype', note: 'Draft 1040 records two Schedule 1 totals (additional income, adjustments). Not authoritative.' },
  },
};

export function capabilitiesFor(id: string): Record<CapabilityKey, CapabilityState> {
  return { ...referenceOnlyCapabilities(), ...(PROTOTYPE_CAPABILITIES[id] || {}) };
}

const LADDER_CAPABILITIES: CapabilityKey[] = ['dataEntry', 'calculation', 'validation', 'pdf', 'reviewReady', 'efile', 'filingReady'];

/** Highest readiness step reached: every earlier step must be met, and only 'available' counts. */
export function readinessLabel(source: SourceVerification, capabilities: Record<CapabilityKey, CapabilityState>): ReadinessLabel {
  if (source.status !== 'verified') return READINESS_LADDER[0];
  let label: ReadinessLabel = READINESS_LADDER[1];
  for (let i = 0; i < LADDER_CAPABILITIES.length; i++) {
    if (capabilities[LADDER_CAPABILITIES[i]].status !== 'available') break;
    label = READINESS_LADDER[i + 2];
  }
  return label;
}

/** Preparation status shown beside the readiness label. */
export function preparationStatus(capabilities: Record<CapabilityKey, CapabilityState>): 'Operational' | 'Prototype only' | typeof BLOCKED_LABEL {
  if (capabilities.dataEntry.status === 'available' && capabilities.calculation.status === 'available') return 'Operational';
  if (Object.values(capabilities).some(c => c.status === 'prototype')) return 'Prototype only';
  return BLOCKED_LABEL;
}
