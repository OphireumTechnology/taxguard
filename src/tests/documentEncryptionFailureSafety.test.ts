import { afterEach, expect, it, vi } from 'vitest';
import { DocumentEncryptionService } from '../services/stageTwoIntakeSecurityService';
afterEach(() => vi.unstubAllGlobals());
it('shares one key across concurrent first encryptions', async () => {
  vi.resetModules();
  const { DocumentEncryptionService: FreshService } = await import('../services/stageTwoIntakeSecurityService');
  const service = new FreshService();
  const data = new Uint8Array([4, 5, 6]);
  const results = await Promise.all(Array.from({ length: 5 }, (_, i) => service.encryptBytes(data, String(i))));
  for (const [i, result] of results.entries()) {
    expect(await service.decryptBytes(result.encryptedBytes, result.metadata, String(i))).toEqual(data);
  }
});
it('round trips using authenticated encryption and rejects tampering', async () => {
  const service = new DocumentEncryptionService();
  const input = new TextEncoder().encode('sensitive document');
  const result = await service.encryptBytes(input, 'document-1');
  expect(result.encryptedBytes.length).toBe(input.length + 16);
  expect(await service.decryptBytes(result.encryptedBytes, result.metadata, 'document-1')).toEqual(input);
  result.encryptedBytes[0] ^= 1;
  await expect(service.decryptBytes(result.encryptedBytes, result.metadata, 'document-1')).rejects.toThrow('DOCUMENT_DECRYPTION_FAILED');
});
it('rejects ciphertext bound to a different document', async () => {
  const service = new DocumentEncryptionService();
  const result = await service.encryptBytes(new Uint8Array([1, 2, 3]), 'one');
  await expect(service.decryptBytes(result.encryptedBytes, result.metadata, 'two')).rejects.toThrow('DOCUMENT_DECRYPTION_FAILED');
});
it('fails closed when cryptographic services are unavailable', async () => {
  vi.stubGlobal('crypto', undefined);
  await expect(new DocumentEncryptionService().encryptBytes(new Uint8Array([1]), 'one')).rejects.toThrow('DOCUMENT_CRYPTO_UNAVAILABLE');
});
