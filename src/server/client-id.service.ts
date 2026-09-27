import { Firestore } from 'firebase-admin/firestore';

const COUNTER_COLLECTION = 'system';
const COUNTER_DOCUMENT = 'taxguard_client_id_sequence';

const NUMERIC_LIMIT = 999_999_999;
const MAX_ID_LENGTH = 9;

/**
 * Converts a zero-based integer into a fixed-width base-26
 * alphabetic prefix.
 *
 * Length 1:
 *   0  -> A
 *   25 -> Z
 *
 * Length 2:
 *   0   -> AA
 *   1   -> AB
 *   25  -> AZ
 *   26  -> BA
 *   675 -> ZZ
 */
function numberToFixedAlphaPrefix(
  value: number,
  length: number
): string {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    !Number.isSafeInteger(length) ||
    length < 1
  ) {
    throw new Error('Invalid TaxGuard Client ID prefix request.');
  }

  const capacity = 26 ** length;

  if (value >= capacity) {
    throw new Error('TaxGuard Client ID prefix exceeds block capacity.');
  }

  let remaining = value;
  const chars = new Array<string>(length);

  for (let position = length - 1; position >= 0; position--) {
    chars[position] = String.fromCharCode(
      65 + (remaining % 26)
    );

    remaining = Math.floor(remaining / 26);
  }

  return chars.join('');
}

/**
 * Converts a permanent sequence number into a TaxGuard Client ID.
 *
 * Numeric:
 *   1           -> 001
 *   999         -> 999
 *   1000        -> 1000
 *   999999999   -> 999999999
 *
 * One-letter prefix:
 *   1000000000  -> A00000000
 *   ...
 *   A99999999
 *   B00000000
 *   ...
 *   Z99999999
 *
 * Two-letter prefix:
 *   AA0000000
 *   AB0000000
 *   ...
 *   ZZ9999999
 *
 * The same rule continues until the complete
 * nine-character namespace is exhausted.
 */
export function formatTaxGuardClientId(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error('Invalid TaxGuard Client ID sequence.');
  }

  if (sequence <= NUMERIC_LIMIT) {
    return sequence < 1000
      ? sequence.toString().padStart(3, '0')
      : sequence.toString();
  }

  let remaining = sequence - NUMERIC_LIMIT - 1;

  for (
    let prefixLength = 1;
    prefixLength <= MAX_ID_LENGTH;
    prefixLength++
  ) {
    const suffixLength = MAX_ID_LENGTH - prefixLength;

    const suffixCapacity = 10 ** suffixLength;
    const prefixCapacity = 26 ** prefixLength;
    const blockCapacity = prefixCapacity * suffixCapacity;

    if (remaining < blockCapacity) {
      const prefixIndex = Math.floor(
        remaining / suffixCapacity
      );

      const suffixIndex =
        remaining % suffixCapacity;

      const prefix = numberToFixedAlphaPrefix(
        prefixIndex,
        prefixLength
      );

      if (suffixLength === 0) {
        return prefix;
      }

      return (
        prefix +
        suffixIndex
          .toString()
          .padStart(suffixLength, '0')
      );
    }

    remaining -= blockCapacity;
  }

  throw new Error(
    'TaxGuard Client ID namespace exhausted.'
  );
}

/**
 * Atomically reserves the next permanent TaxGuard Client ID.
 *
 * Rules:
 * - IDs are server generated.
 * - IDs are never decremented.
 * - IDs are never reused.
 * - Allocation is atomic.
 */
export async function allocateTaxGuardClientId(
  db: Firestore
): Promise<{
  clientId: string;
  sequence: number;
}> {
  const counterRef = db
    .collection(COUNTER_COLLECTION)
    .doc(COUNTER_DOCUMENT);

  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(counterRef);

    const currentSequence = snapshot.exists
      ? Number(snapshot.data()?.currentSequence || 0)
      : 0;

    if (
      !Number.isSafeInteger(currentSequence) ||
      currentSequence < 0
    ) {
      throw new Error(
        'TaxGuard Client ID counter is corrupted.'
      );
    }

    const nextSequence = currentSequence + 1;

    const clientId =
      formatTaxGuardClientId(nextSequence);

    transaction.set(
      counterRef,
      {
        currentSequence: nextSequence,
        lastIssuedClientId: clientId,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    return {
      clientId,
      sequence: nextSequence
    };
  });
}
