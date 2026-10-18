/** Exact report cents, including SQL aggregate values transported as decimal text. */
export type ReportCents = number | string | bigint;

export class ReportAmountError extends Error {
  readonly code = 'LEDGER_REPORT_AMOUNT_OUT_OF_RANGE';
  readonly status = 422;
  constructor() { super('LEDGER_REPORT_AMOUNT_OUT_OF_RANGE'); }
}

export function exactReportCents(value: ReportCents): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?(0|[1-9]\d{0,63})$/.test(value)) return BigInt(value);
  throw new ReportAmountError();
}

/** Preserve the dollar-number contract only when its JSON decimal retains every cent. */
export function reportDollars(value: ReportCents): number {
  const cents = exactReportCents(value);
  const magnitude = cents < 0n ? -cents : cents;
  if (magnitude > BigInt(Number.MAX_SAFE_INTEGER)) throw new ReportAmountError();
  const dollars = Number(`${cents < 0n ? '-' : ''}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`);
  const decimal = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(dollars));
  if (!decimal) throw new ReportAmountError();
  const roundTrip = (BigInt(decimal[2]) * 100n + BigInt((decimal[3] ?? '').padEnd(2, '0'))) * (decimal[1] ? -1n : 1n);
  if (roundTrip !== cents) throw new ReportAmountError();
  return dollars === 0 ? 0 : dollars;
}
