/**
 * Exact BigInt cent conversion helpers for financial reporting.
 */
export function exactReportCents(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.round(value));
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return 0n;
}

export function reportDollars(cents: bigint | number | string): number {
  const exact = exactReportCents(cents);
  return Number(exact) / 100;
}
