import type { CapabilityKey, CapabilityState, ReadinessLabel, SourceVerification } from './types';

export function readinessLabel(
  source: SourceVerification,
  capabilities: Record<CapabilityKey, CapabilityState>
): ReadinessLabel {
  if (capabilities.filingReady.status === 'available') return 'Filing Ready';
  if (capabilities.efile.status === 'available') return 'E-File Integration Available';
  if (capabilities.reviewReady.status === 'available') return 'Review Ready';
  if (capabilities.pdf.status === 'available') return 'PDF Generation Supported';
  if (capabilities.validation.status === 'available') return 'Validation Supported';
  if (capabilities.calculation.status === 'available') return 'Calculation Supported';
  if (capabilities.dataEntry.status === 'available') return 'Data Entry Supported';
  if (source.status === 'verified') return 'Official Source Verified';
  return 'Cataloged / Reference Only';
}

export function preparationStatus(capabilities: Record<CapabilityKey, CapabilityState>): string {
  if (capabilities.filingReady.status === 'available') return 'Filing Ready';
  if (capabilities.reviewReady.status === 'available') return 'Review Ready';
  if (capabilities.dataEntry.status === 'available') return 'Data Entry Supported';
  return 'Reference Only';
}
