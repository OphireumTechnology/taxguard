const RETRYABLE_SESSION_STORE_CONFLICTS = new Set(['SESSION_STORE_BUSY', '55P03', '40001', '40P01']);

/** Retry only an explicitly aborted lock/deadlock/serialization transaction. `operation` must
 * start a new RPC/request transaction on every call; never retry inside a caller-owned transaction.
 * The SQL routines make mutations and audit rows atomically, so these SQLSTATEs guarantee that
 * attempt rolled back. All other failures, including authority denials and ambiguous transport
 * errors, are terminal. */
export async function withBoundedSessionRevocationRetry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts?: number; onRetry?: (code: string, failedAttempt: number) => void } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 7;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new Error('SESSION_RETRY_POLICY_INVALID');
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const candidate = error as { code?: unknown; message?: unknown };
      const code = typeof candidate?.code === 'string' ? candidate.code
        : typeof candidate?.message === 'string' ? candidate.message : '';
      if (!RETRYABLE_SESSION_STORE_CONFLICTS.has(code) || attempt >= maxAttempts) throw error;
      options.onRetry?.(code, attempt);
      // Small bounded exponential backoff lets the conflicting transaction release row locks.
      await new Promise<void>(resolve => setTimeout(resolve, Math.min(2 ** attempt, 32)));
    }
  }
}
