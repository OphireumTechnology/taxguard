/**
 * Exact Fixed-Point Decimal Arithmetic Engine for TaxGuard Stages 09–18
 *
 * Uses BigInt scaled by 10_000 (4 fractional digits) to guarantee deterministic
 * financial, rate, and tax calculations without IEEE-754 floating-point drift.
 */

const SCALE = 10_000n;
const CENTS_DIVISOR = 100n;

export class ExactDecimal {
  private readonly scaled: bigint;

  private constructor(scaled: bigint) {
    this.scaled = scaled;
  }

  static zero(): ExactDecimal {
    return new ExactDecimal(0n);
  }

  static fromString(input: string): ExactDecimal {
    const trimmed = input.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      throw new Error(`INVALID_DECIMAL_FORMAT:${input}`);
    }
    const negative = trimmed.startsWith('-');
    const unsigned = negative ? trimmed.slice(1) : trimmed;
    const [wholePart, fracPart = ''] = unsigned.split('.');
    const paddedFrac = (fracPart + '0000').slice(0, 4);
    let value = BigInt(wholePart) * SCALE + BigInt(paddedFrac);

    // Half-up rounding if > 4 fractional digits were supplied
    if (fracPart.length > 4) {
      const fifthDigit = Number(fracPart[4]);
      if (fifthDigit >= 5) {
        value += 1n;
      }
    }

    return new ExactDecimal(negative ? -value : value);
  }

  static fromNumber(input: number): ExactDecimal {
    if (!Number.isFinite(input)) {
      throw new Error(`NON_FINITE_DECIMAL:${String(input)}`);
    }
    return ExactDecimal.fromString(input.toFixed(4));
  }

  static fromCents(cents: bigint | number): ExactDecimal {
    const c = typeof cents === 'bigint' ? cents : BigInt(Math.trunc(cents));
    return new ExactDecimal(c * CENTS_DIVISOR);
  }

  static max(a: ExactDecimal, b: ExactDecimal): ExactDecimal {
    return a.scaled >= b.scaled ? a : b;
  }

  static min(a: ExactDecimal, b: ExactDecimal): ExactDecimal {
    return a.scaled <= b.scaled ? a : b;
  }

  add(other: ExactDecimal): ExactDecimal {
    return new ExactDecimal(this.scaled + other.scaled);
  }

  sub(other: ExactDecimal): ExactDecimal {
    return new ExactDecimal(this.scaled - other.scaled);
  }

  mul(other: ExactDecimal): ExactDecimal {
    const product = this.scaled * other.scaled;
    const half = SCALE / 2n;
    const adjusted = product >= 0n ? (product + half) / SCALE : (product - half) / SCALE;
    return new ExactDecimal(adjusted);
  }

  div(other: ExactDecimal): ExactDecimal {
    if (other.scaled === 0n) {
      throw new Error('DIVISION_BY_ZERO');
    }
    const numerator = this.scaled * SCALE;
    const half = (other.scaled >= 0n ? other.scaled : -other.scaled) / 2n;
    const sameSign = (numerator >= 0n) === (other.scaled >= 0n);
    const adjusted = sameSign
      ? (numerator + (numerator >= 0n ? half : -half)) / other.scaled
      : (numerator - (numerator >= 0n ? half : -half)) / other.scaled;
    return new ExactDecimal(adjusted);
  }

  isNegative(): boolean {
    return this.scaled < 0n;
  }

  isZero(): boolean {
    return this.scaled === 0n;
  }

  gt(other: ExactDecimal): boolean {
    return this.scaled > other.scaled;
  }

  gte(other: ExactDecimal): boolean {
    return this.scaled >= other.scaled;
  }

  lt(other: ExactDecimal): boolean {
    return this.scaled < other.scaled;
  }

  equals(other: ExactDecimal): boolean {
    return this.scaled === other.scaled;
  }

  /** Rounds half-up to exact integer cents (2 decimal places). */
  toCents(): bigint {
    const abs = this.scaled < 0n ? -this.scaled : this.scaled;
    const rounded = (abs + 50n) / CENTS_DIVISOR;
    return this.scaled < 0n ? -rounded : rounded;
  }

  /** Returns canonical fixed 2-decimal monetary string (e.g. "1234.56" or "-45.00"). */
  toMoneyString(): string {
    const cents = this.toCents();
    const neg = cents < 0n;
    const abs = neg ? -cents : cents;
    const dollars = abs / 100n;
    const rem = abs % 100n;
    return `${neg ? '-' : ''}${dollars.toString()}.${rem.toString().padStart(2, '0')}`;
  }

  /** Returns exact 4-decimal string for tax rates and intermediate calculation audit records. */
  toRateString(): string {
    const neg = this.scaled < 0n;
    const abs = neg ? -this.scaled : this.scaled;
    const whole = abs / SCALE;
    const frac = abs % SCALE;
    return `${neg ? '-' : ''}${whole.toString()}.${frac.toString().padStart(4, '0')}`;
  }
}

export function sumMoney(values: string[]): string {
  return values
    .reduce((acc, val) => acc.add(ExactDecimal.fromString(val)), ExactDecimal.zero())
    .toMoneyString();
}
