export type TaxRoundingMode =
  | 'HALF_UP'
  | 'HALF_EVEN'
  | 'DOWN'
  | 'UP'
  | 'TRUNCATE';

export interface TaxDecimalJSON {
  unscaledValue: string;
  scale: number;
}

const POW10: bigint[] = [1n];

function power10(exponent: number): bigint {
  if (
    !Number.isInteger(exponent) ||
    exponent < 0 ||
    exponent > 18
  ) {
    throw new Error(
      'TAX_DECIMAL_INVALID_SCALE'
    );
  }

  while (POW10.length <= exponent) {
    POW10.push(
      POW10[POW10.length - 1] * 10n
    );
  }

  return POW10[exponent];
}

function assertScale(scale: number): void {
  if (
    !Number.isInteger(scale) ||
    scale < 0 ||
    scale > 18
  ) {
    throw new Error(
      'TAX_DECIMAL_INVALID_SCALE'
    );
  }
}

function signOf(value: bigint): bigint {
  return value < 0n ? -1n : 1n;
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export class TaxDecimal {
  private constructor(
    private readonly units: bigint,
    public readonly scale: number
  ) {
    assertScale(scale);
  }

  static fromUnscaled(
    value: bigint | string,
    scale: number
  ): TaxDecimal {
    assertScale(scale);

    return new TaxDecimal(
      typeof value === 'bigint'
        ? value
        : BigInt(value),
      scale
    );
  }

  static parse(
    value: string,
    scale?: number
  ): TaxDecimal {
    const normalized =
      value.trim();

    if (
      !/^[+-]?\d+(?:\.\d+)?$/.test(
        normalized
      )
    ) {
      throw new Error(
        'TAX_DECIMAL_INVALID_FORMAT'
      );
    }

    const negative =
      normalized.startsWith('-');

    const unsigned =
      normalized.replace(
        /^[+-]/,
        ''
      );

    const parts =
      unsigned.split('.');

    const whole =
      parts[0];

    const fraction =
      parts[1] ?? '';

    const targetScale =
      scale ?? fraction.length;

    assertScale(targetScale);

    if (
      fraction.length >
      targetScale
    ) {
      throw new Error(
        'TAX_DECIMAL_SCALE_LOSS_REQUIRES_ROUNDING'
      );
    }

    const padded =
      fraction.padEnd(
        targetScale,
        '0'
      );

    const raw =
      BigInt(
        whole +
        (
          targetScale > 0
            ? padded
            : ''
        )
      );

    return new TaxDecimal(
      negative ? -raw : raw,
      targetScale
    );
  }

  static zero(
    scale = 2
  ): TaxDecimal {
    return new TaxDecimal(
      0n,
      scale
    );
  }

  get unscaledValue(): bigint {
    return this.units;
  }

  add(
    other: TaxDecimal
  ): TaxDecimal {
    const [left, right, scale] =
      TaxDecimal.align(
        this,
        other
      );

    return new TaxDecimal(
      left + right,
      scale
    );
  }

  subtract(
    other: TaxDecimal
  ): TaxDecimal {
    const [left, right, scale] =
      TaxDecimal.align(
        this,
        other
      );

    return new TaxDecimal(
      left - right,
      scale
    );
  }

  multiply(
    other: TaxDecimal
  ): TaxDecimal {
    const newScale =
      this.scale +
      other.scale;

    assertScale(newScale);

    return new TaxDecimal(
      this.units *
        other.units,
      newScale
    );
  }

  divide(
    other: TaxDecimal,
    outputScale: number,
    mode:
      TaxRoundingMode =
        'HALF_UP'
  ): TaxDecimal {
    assertScale(outputScale);

    if (
      other.units === 0n
    ) {
      throw new Error(
        'TAX_DECIMAL_DIVIDE_BY_ZERO'
      );
    }

    const exponent =
      outputScale +
      other.scale -
      this.scale;

    let numerator =
      this.units;

    let denominator =
      other.units;

    if (exponent >= 0) {
      numerator *=
        power10(exponent);
    } else {
      denominator *=
        power10(-exponent);
    }

    const quotient =
      numerator /
      denominator;

    const remainder =
      numerator %
      denominator;

    return new TaxDecimal(
      TaxDecimal.applyRounding(
        quotient,
        remainder,
        denominator,
        mode
      ),
      outputScale
    );
  }

  round(
    targetScale: number,
    mode:
      TaxRoundingMode =
        'HALF_UP'
  ): TaxDecimal {
    assertScale(targetScale);

    if (
      targetScale ===
      this.scale
    ) {
      return this;
    }

    if (
      targetScale >
      this.scale
    ) {
      return new TaxDecimal(
        this.units *
          power10(
            targetScale -
            this.scale
          ),
        targetScale
      );
    }

    const divisor =
      power10(
        this.scale -
        targetScale
      );

    const quotient =
      this.units /
      divisor;

    const remainder =
      this.units %
      divisor;

    return new TaxDecimal(
      TaxDecimal.applyRounding(
        quotient,
        remainder,
        divisor,
        mode
      ),
      targetScale
    );
  }

  compare(
    other: TaxDecimal
  ): -1 | 0 | 1 {
    const [left, right] =
      TaxDecimal.align(
        this,
        other
      );

    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }

    return 0;
  }

  isNegative(): boolean {
    return this.units < 0n;
  }

  isZero(): boolean {
    return this.units === 0n;
  }

  toFixed(): string {
    const negative =
      this.units < 0n;

    const digits =
      absolute(this.units)
        .toString()
        .padStart(
          this.scale + 1,
          '0'
        );

    if (
      this.scale === 0
    ) {
      return (
        negative ? '-' : ''
      ) + digits;
    }

    const split =
      digits.length -
      this.scale;

    return (
      (negative ? '-' : '') +
      digits.slice(0, split) +
      '.' +
      digits.slice(split)
    );
  }

  toJSON():
    TaxDecimalJSON {
    return {
      unscaledValue:
        this.units.toString(),

      scale:
        this.scale
    };
  }

  private static align(
    left: TaxDecimal,
    right: TaxDecimal
  ): [bigint, bigint, number] {
    const scale =
      Math.max(
        left.scale,
        right.scale
      );

    return [
      left.units *
        power10(
          scale -
          left.scale
        ),

      right.units *
        power10(
          scale -
          right.scale
        ),

      scale
    ];
  }

  private static applyRounding(
    quotient: bigint,
    remainder: bigint,
    denominator: bigint,
    mode: TaxRoundingMode
  ): bigint {
    if (
      remainder === 0n
    ) {
      return quotient;
    }

    if (
      mode === 'TRUNCATE'
    ) {
      return quotient;
    }

    const resultSign =
      signOf(remainder) *
      signOf(denominator);

    if (
      mode === 'DOWN'
    ) {
      return quotient;
    }

    if (
      mode === 'UP'
    ) {
      return (
        quotient +
        resultSign
      );
    }

    const twiceRemainder =
      absolute(remainder) *
      2n;

    const absoluteDenominator =
      absolute(denominator);

    if (
      twiceRemainder <
      absoluteDenominator
    ) {
      return quotient;
    }

    if (
      twiceRemainder >
      absoluteDenominator
    ) {
      return (
        quotient +
        resultSign
      );
    }

    if (
      mode === 'HALF_UP'
    ) {
      return (
        quotient +
        resultSign
      );
    }

    if (
      mode === 'HALF_EVEN'
    ) {
      const isEven =
        absolute(quotient) %
          2n ===
        0n;

      return isEven
        ? quotient
        : quotient +
            resultSign;
    }

    throw new Error(
      'TAX_DECIMAL_UNKNOWN_ROUNDING_MODE'
    );
  }
}
