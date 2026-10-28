/**
 * TaxGuard Durable Mutation Idempotency Service
 * Legacy process-local simulation. Not durable across restarts or distributed workers.
 * Released production operations must use an independently verified durable adapter.
 */

import { randomUUID } from 'node:crypto';
import { MutationIdempotencyRecord, MutationIdempotencyStatus } from './types';

export class DurableIdempotencyService {
  private memoryStore = new Map<string, MutationIdempotencyRecord>();

  private makeKey(tenantId: string, operation: string, idempotencyKey: string): string {
    return `${tenantId}::${operation}::${idempotencyKey}`;
  }

  /**
   * Acquire or inspect an idempotency lock for a mutation.
   * Returns:
   * - { status: 'COMPLETED', result: ... } if already successfully executed
   * - { status: 'PROCESSING' } if a concurrent worker is running this operation
   * - { status: 'ACQUIRED', record: ... } if lock was successfully obtained to proceed
   */
  async acquire(
    tenantId: string,
    operation: string,
    provider: string,
    idempotencyKey: string,
    requestFingerprint: string,
    ttlSeconds = 86400 * 30 // 30 days default
  ): Promise<
    | { status: 'ACQUIRED'; recordId: string }
    | { status: 'COMPLETED'; resultReference: Record<string, unknown>; auditEventId?: string }
    | { status: 'PROCESSING'; message: string }
  > {
    if (![tenantId, operation, provider, idempotencyKey, requestFingerprint].every(value =>
      typeof value === 'string' && value.length > 0 && value.length <= 256 && !value.includes('::')) ||
      !Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 86400 * 365) {
      throw new Error('INVALID_IDEMPOTENCY_REQUEST');
    }
    const key = this.makeKey(tenantId, operation, idempotencyKey);
    const existing = this.memoryStore.get(key);

    if (existing) {
      // An expired lease is not evidence that the external operation did not happen.
      // Preserve ambiguous/completed reservations; retries must keep the same payload.
      if (existing.requestFingerprint !== requestFingerprint || existing.provider !== provider) {
        throw new Error('IDEMPOTENCY_REQUEST_MISMATCH');
      }
      if (existing.status === 'COMPLETED') {
        return {
          status: 'COMPLETED',
          resultReference: structuredClone(existing.resultReference || {}),
          auditEventId: existing.auditEventId,
        };
      } else if (existing.status === 'PROCESSING') {
        return {
          status: 'PROCESSING',
          message: 'Operation is currently being processed by another worker.',
        };
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const id = randomUUID();

    const record: MutationIdempotencyRecord = {
      id,
      tenantId,
      operation,
      provider,
      idempotencyKey,
      requestFingerprint,
      status: 'PROCESSING',
      createdAt: now.toISOString(),
      expiresAt,
    };

    this.memoryStore.set(key, record);
    return { status: 'ACQUIRED', recordId: id };
  }

  /**
   * Complete the mutation and store the authoritative result for replay.
   */
  async complete(
    tenantId: string,
    operation: string,
    idempotencyKey: string,
    resultReference: Record<string, unknown>,
    auditEventId?: string
  ): Promise<void> {
    const key = this.makeKey(tenantId, operation, idempotencyKey);
    const existing = this.memoryStore.get(key);
    if (!existing) {
      throw new Error(`IDEMPOTENCY_RECORD_NOT_FOUND: Cannot complete unregistered key ${idempotencyKey}`);
    }
    if (existing.status !== 'PROCESSING') throw new Error('INVALID_IDEMPOTENCY_STATE');

    existing.status = 'COMPLETED';
    existing.resultReference = structuredClone(resultReference);
    existing.auditEventId = auditEventId;
    existing.completedAt = new Date().toISOString();
    this.memoryStore.set(key, existing);
  }

  /**
   * Mark a mutation as failed, allowing bounded retry under a fresh or same key.
   */
  async fail(
    tenantId: string,
    operation: string,
    idempotencyKey: string,
    errorCode: string
  ): Promise<void> {
    const key = this.makeKey(tenantId, operation, idempotencyKey);
    const existing = this.memoryStore.get(key);
    if (existing) {
      if (existing.status !== 'PROCESSING') throw new Error('INVALID_IDEMPOTENCY_STATE');
      existing.status = 'FAILED';
      existing.errorCode = errorCode;
      this.memoryStore.set(key, existing);
    }
  }

  /**
   * Retrieve existing idempotency state if present
   */
  getRecord(tenantId: string, operation: string, idempotencyKey: string): MutationIdempotencyRecord | undefined {
    const record = this.memoryStore.get(this.makeKey(tenantId, operation, idempotencyKey));
    return record ? structuredClone(record) : undefined;
  }

  /**
   * Reset store (primarily for clean test isolation)
   */
  clear(): void {
    this.memoryStore.clear();
  }
}

export const globalDurableIdempotencyService = new DurableIdempotencyService();
