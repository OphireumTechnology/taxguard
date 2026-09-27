import { describe, expect, it } from 'vitest';
import { formatTaxGuardClientId } from '../server/client-id.service';

describe('TaxGuard Client ID Sequence', () => {
  it('formats the beginning of the numeric sequence', () => {
    expect(formatTaxGuardClientId(1)).toBe('001');
    expect(formatTaxGuardClientId(2)).toBe('002');
    expect(formatTaxGuardClientId(9)).toBe('009');
    expect(formatTaxGuardClientId(10)).toBe('010');
    expect(formatTaxGuardClientId(99)).toBe('099');
    expect(formatTaxGuardClientId(100)).toBe('100');
    expect(formatTaxGuardClientId(999)).toBe('999');
    expect(formatTaxGuardClientId(1000)).toBe('1000');
  });

  it('handles the numeric-to-alpha boundary', () => {
    expect(formatTaxGuardClientId(999_999_998)).toBe('999999998');
    expect(formatTaxGuardClientId(999_999_999)).toBe('999999999');
    expect(formatTaxGuardClientId(1_000_000_000)).toBe('A00000000');
    expect(formatTaxGuardClientId(1_000_000_001)).toBe('A00000001');
  });

  it('handles A to B transition', () => {
    expect(formatTaxGuardClientId(1_099_999_999)).toBe('A99999999');
    expect(formatTaxGuardClientId(1_100_000_000)).toBe('B00000000');
  });

  it('handles Z to AA transition', () => {
    expect(formatTaxGuardClientId(3_599_999_999)).toBe('Z99999999');
    expect(formatTaxGuardClientId(3_600_000_000)).toBe('AA0000000');
    expect(formatTaxGuardClientId(3_600_000_001)).toBe('AA0000001');
  });

  it('handles AA to AB transition', () => {
    expect(formatTaxGuardClientId(3_609_999_999)).toBe('AA9999999');
    expect(formatTaxGuardClientId(3_610_000_000)).toBe('AB0000000');
  });

  it('handles AZ to BA transition', () => {
    expect(formatTaxGuardClientId(3_859_999_999)).toBe('AZ9999999');
    expect(formatTaxGuardClientId(3_860_000_000)).toBe('BA0000000');
  });

  it('handles ZZ to AAA transition', () => {
    expect(formatTaxGuardClientId(10_359_999_999)).toBe('ZZ9999999');
    expect(formatTaxGuardClientId(10_360_000_000)).toBe('AAA000000');
  });

  it('rejects invalid sequence values', () => {
    expect(() => formatTaxGuardClientId(0)).toThrow();
    expect(() => formatTaxGuardClientId(-1)).toThrow();
    expect(() => formatTaxGuardClientId(1.5)).toThrow();
    expect(() =>
      formatTaxGuardClientId(Number.MAX_SAFE_INTEGER + 1)
    ).toThrow();
  });
});
