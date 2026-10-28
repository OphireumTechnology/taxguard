import { describe, expect, it } from 'vitest';
import { withBoundedSessionRevocationRetry } from '../server/sessionRevocationRetry';

describe('bounded session revocation retries', () => {
  it('retries only known transaction-abort SQLSTATEs and returns the committed operation result', async () => {
    let attempts = 0;
    const retryCodes: string[] = [];
    const result = await withBoundedSessionRevocationRetry(async () => {
      attempts++;
      if (attempts < 4) throw Object.assign(new Error('transaction aborted'), { code: ['55P03', '40P01', '40001'][attempts - 1] });
      return { revokedSessions: 8 };
    }, { onRetry: code => retryCodes.push(code) });
    expect(result).toEqual({ revokedSessions: 8 });
    expect(attempts).toBe(4);
    expect(retryCodes).toEqual(['55P03', '40P01', '40001']);
  });

  it('does not retry authority denials or ambiguous errors and stops after the bound', async () => {
    const denied = Object.assign(new Error('SESSION_AUTHORITY_DENIED'), { code: 'P0001' });
    let deniedAttempts = 0;
    await expect(withBoundedSessionRevocationRetry(async () => { deniedAttempts++; throw denied; }))
      .rejects.toBe(denied);
    expect(deniedAttempts).toBe(1);

    let conflictAttempts = 0;
    await expect(withBoundedSessionRevocationRetry(async () => {
      conflictAttempts++;
      throw Object.assign(new Error('lock conflict'), { code: '55P03' });
    }, { maxAttempts: 3 })).rejects.toMatchObject({ code: '55P03' });
    expect(conflictAttempts).toBe(3);
    await expect(withBoundedSessionRevocationRetry(async () => 1, { maxAttempts: 11 }))
      .rejects.toThrow('SESSION_RETRY_POLICY_INVALID');
  });

  it('accepts the mapped service conflict while preserving it after the retry bound', async () => {
    let attempts = 0;
    await expect(withBoundedSessionRevocationRetry(async () => {
      attempts++;
      throw Object.assign(new Error('SESSION_STORE_BUSY'), { code: 'SESSION_STORE_BUSY' });
    }, { maxAttempts: 2 })).rejects.toMatchObject({ code: 'SESSION_STORE_BUSY' });
    expect(attempts).toBe(2);
  });
});
