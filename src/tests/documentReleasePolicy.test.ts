import { expect, it } from 'vitest';
import { documentCanBeReleased } from '../../functions/src/documentReleasePolicy';
const clean = { clientId: 'owner', id: 'doc1', status: 'uploaded', scanStatus: 'CLEAN', storageGeneration: '123', sha256: 'a'.repeat(64), storagePath: 'clients/owner/doc1/file.pdf' };
it('allows only a clean object bound to its owner and generation', () => {
  expect(documentCanBeReleased(clean, 'owner')).toBe(true);
});
it.each([{ scanStatus: 'PENDING' }, { scanStatus: undefined }, { storageGeneration: undefined }, { sha256: 'fake' },
  { status: 'quarantined' }, { storagePath: 'clients/other/doc1/file.pdf' }, { storagePath: 'clients/owner/doc1/../file.pdf' }])('blocks unsafe release %j', patch => {
  expect(documentCanBeReleased({ ...clean, ...patch }, 'owner')).toBe(false);
});
it('rejects unassigned staff and other clients', () => {
  expect(documentCanBeReleased(clean, 'another-client')).toBe(false);
});
